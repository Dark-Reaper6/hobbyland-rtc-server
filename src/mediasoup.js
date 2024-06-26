const { createWorker } = require('mediasoup');
const { ipAddress, rtcPorts, mediaCodecs, rtcBitrates } = require("../hobbyland.config");
const store = require('./store');
const User = require('./models/user');
const Meeting = require('./models/meeting');
const { ObjectId } = require('mongoose').Types;

let worker;
let mediasoupRouter;
let producerTransports = new Map();
let consumerTransports = new Map();
let producers = new Map();
let consumers = new Map();
let consumersObjects = new Map();

const initMediasoupWorker = async () => {
    worker = await createWorker({
        rtcMinPort: rtcPorts.min,
        rtcMaxPort: rtcPorts.max,
        logLevel: "warn",
    });

    worker.on('died', () => {
        console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
    });

    mediasoupRouter = await worker.createRouter({ mediaCodecs });
    console.log('✅ Mediasoup worker initiated.');
};

const createWebRtcTransport = async () => {
    const transport = await mediasoupRouter.createWebRtcTransport({
        listenInfos: [
            { protocol: 'tcp', ...ipAddress },
            { protocol: 'udp', ...ipAddress },
        ],
        initialAvailableOutgoingBitrate: rtcBitrates.initial,
    });
    try { await transport.setMaxIncomingBitrate(rtcBitrates.max) } catch (error) { console.log(error) }
    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
        }
    };
}

async function createConsumer(producer, rtpCapabilities, consumerTransport) {
    if (!mediasoupRouter.canConsume({
        producerId: producer.id,
        rtpCapabilities,
    })) return console.error('cannot consume');
    let consumer;
    try {
        consumer = await consumerTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: producer.kind === 'video',
        });
    } catch (error) { return console.error('consume failed', error) }

    if (consumer.type === 'simulcast') await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 })

    return {
        consumer,
        response: {
            producerId: producer.id,
            id: consumer.id,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            type: consumer.type,
            producerPaused: consumer.producerPaused,
        },
    };
}

const registerMediasoupEvents = (socket) => {
    socket.on('get-router-rtp-capabilities', (_, callback) => {
        callback(mediasoupRouter.rtpCapabilities);
    });

    socket.on('create-producer-transport', async (_, callback) => {
        try {
            const { transport, params } = await createWebRtcTransport();
            producerTransports.set(socket.id, transport);
            callback(params);
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on('create-consumer-transport', async (_, callback) => {
        try {
            const { transport, params } = await createWebRtcTransport();
            consumerTransports.set(socket.id, transport);
            callback(params);
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on('connect-producer-transport', async ({ dtlsParameters }, callback) => {
        const transport = producerTransports.get(socket.id);
        if (transport) {
            await transport.connect({ dtlsParameters });
            callback();
        } else {
            callback({ error: 'Transport not found' });
        }
    });

    socket.on('connect-consumer-transport', async (data, callback) => {
        const transport = consumerTransports.get(socket.id);
        if (transport) {
            await transport.connect({ dtlsParameters: data.dtlsParameters });
            callback();
        } else { callback({ error: 'Transport not found' }) }
    });

    socket.on('produce', async ({ kind, rtpParameters, isScreen, room_id }, callback) => {
        try {
            const transport = producerTransports.get(socket.id);
            if (!transport) throw new Error('Transport not found');

            const producer = await transport.produce({ kind, rtpParameters });
            producer.on('transportclose', () => closeProducer(producer, socket.id));
            producer.observer.on('close', () => closeProducer(producer, socket.id));

            await store.peers.asyncInsert({
                type: 'producer',
                socketID: socket.id,
                userID: socket.user.id,
                room_id,
                producerID: producer.id,
                isScreen,
            });

            if (!producers.has(socket.id)) producers.set(socket.id, new Map());
            producers.get(socket.id).set(producer.id, producer);

            socket.to(room_id).emit('new-producer', {
                room_id,
                socketID: socket.id,
                userID: socket.user.id,
                producerID: producer.id,
                isScreen,
            });
            callback({ id: producer.id });
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on('consume', async ({ producer_id, rtpCapabilities, socket_id }, callback) => {
        try {
            const transport = consumerTransports.get(socket.id);
            if (!transport) throw new Error('Transport not found');

            const producer = producers.get(socket_id)?.get(producer_id);
            if (!producer) throw new Error('Producer not found');

            const { consumer, params } = await createConsumer(producer, rtpCapabilities, transport);

            consumer.on('transportclose', () => closeConsumer(consumer, socket.id));
            consumer.on('producerclose', () => closeConsumer(consumer, socket.id));

            if (!consumers.has(socket.id)) consumers.set(socket.id, new Map());
            consumers.get(socket.id).set(producer_id, consumer);

            callback(params);
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on('resume', async ({ producer_id }, callback) => {
        const consumer = consumers.get(socket.id)?.get(producer_id);
        if (!consumer) return callback({ error: 'Consumer not found' });
        await consumer.resume();
        callback();
    });

    socket.on('join-meeting', async (data, callback) => {
        try {
            const { room_id } = data;

            socket.join(room_id);
            consumersObjects.set(room_id, {
                ...consumersObjects.get(room_id),
                [socket.id]: socket.user
            });

            const peers = await store.peers.asyncFind({ type: 'producer', room_id: room_id || 'general' });

            if (!store.consumerUserIDs[room_id]) store.consumerUserIDs[room_id] = [];
            store.consumerUserIDs[room_id].push(socket.id);

            socket.to(room_id).emit('newPeer', socket.user);
            socket.to(room_id).emit('consumers', { content: store.consumerUserIDs[room_id], timestamp: Date.now() });

            await Meeting.findByIdAndUpdate(room_id, {
                last_enter: Date.now(),
                $push: { peers: socket.id },
                $push: { users: socket.user.id },
            });

            store.roomIDs[socket.id] = room_id;
            // store.onlineUsers.delete(socket);
            // store.onlineUsers.set(socket, { id: socket.user.id, status: 'busy' });
            // store.io.emit('onlineUsers', Array.from(store.onlineUsers.values()));

            callback({
                producers: peers,
                consumers: { content: store.consumerUserIDs[room_id], timestamp: Date.now() },
                peers: consumersObjects.get(room_id),
            });
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on('leave', async (data, callback) => {
        try {
            const { roomID } = data;
            socket.leave(roomID || 'general');
            await store.peers.asyncRemove({ socketID: socket.id }, { multi: true });

            store.io.to(roomID || 'general').emit('leave', { socketID: socket.id });

            if (producerTransports.has(socket.id)) producerTransports.get(socket.id).close();
            if (consumerTransports.has(socket.id)) consumerTransports.get(socket.id).close();

            store.roomIDs[socket.id] = null;

            await Meeting.findOneAndUpdate(
                { _id: roomID },
                { lastLeave: Date.now(), $pull: { peers: socket.id } }
            );

            if (store.consumerUserIDs[roomID])
                store.consumerUserIDs[roomID].splice(store.consumerUserIDs[roomID].indexOf(socket.id), 1);

            socket.to(roomID).emit('consumers', { content: store.consumerUserIDs[roomID], timestamp: Date.now() });
            socket.to(roomID).emit('leave', { socketID: socket.id });

            store.onlineUsers.delete(socket);
            store.onlineUsers.set(socket, { id: socket.user.id, status: 'online' });
            store.io.emit('onlineUsers', Array.from(store.onlineUsers.values()));

            callback();
        } catch (err) {
            console.error(err);
            if (callback) callback({ error: err.message });
        }
    });

    socket.on('remove', async (data, callback) => {
        try {
            await store.peers.asyncRemove({ producerID: data.producerID }, { multi: true });
            store.io.to(data.roomID || 'general').emit('remove', { producerID: data.producerID, socketID: socket.id });
            callback();
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on("testing-event", (_, callback) => {
        console.log("Yooo the promisified version of the socket io works like hell!!")
        callback({
            some: "kind of string here"
        });
    })
};

const closeProducer = (producer, socketId) => {
    producer.close();
    producers.get(socketId)?.delete(producer.id);
    if (producers.get(socketId)?.size === 0) producers.delete(socketId);
};

const closeConsumer = (consumer, socketId) => {
    consumer.close();
    consumers.get(socketId)?.delete(consumer.id);
    if (consumers.get(socketId)?.size === 0) consumers.delete(socketId);
};

module.exports = {
    initMediasoupWorker,
    registerMediasoupEvents
};
