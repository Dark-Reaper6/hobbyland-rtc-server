const { createWorker } = require('mediasoup');
const { ipAddress, rtcPorts, mediaCodecs, rtcBitrates } = require("../hobbyland.config");
const store = require('./store');
const Meeting = require('./models/meeting');
const Room = require('./models/room');

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
    try {
        const transport = await mediasoupRouter.createWebRtcTransport({
            listenInfos: [
                { protocol: 'tcp', ...ipAddress },
                { protocol: 'udp', ...ipAddress },
            ],
            initialAvailableOutgoingBitrate: rtcBitrates.initial,
        });
        await transport.setMaxIncomingBitrate(rtcBitrates.max)
        return {
            transport,
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            }
        };
    } catch (error) { console.log(error) }
}

const closeProducer = (producer, socketId) => {
    producer.close();
    producers.get(socketId)?.delete(producer.id);
    if (producers.get(socketId)?.size === 0) producers.delete(socketId);
    console.log("\nA producer has been closed with socket id : " + socketId);
};

const closeConsumer = (consumer, socketId) => {
    consumer.close();
    consumers.get(socketId)?.delete(consumer.id);
    if (consumers.get(socketId)?.size === 0) consumers.delete(socketId);
    console.log("\nA consumer has been closed with socket id : " + socketId);
};

const createConsumer = async (producer, rtpCapabilities, consumerTransport) => {
    if (!mediasoupRouter.canConsume({
        producerId: producer.id,
        rtpCapabilities
    })) throw new Error("Router cannot consume the media.");

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
        params: {
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
        console.log("create-producer-transport event got called.")
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
        console.log("create-consumer-transport event got called.")
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
        console.log("connect-producer-transport event got called.")
        const transport = producerTransports.get(socket.id);
        if (transport) {
            await transport.connect({ dtlsParameters });
            callback();
        } else { callback({ error: 'Transport not found' }) }
    });

    socket.on('connect-consumer-transport', async ({ dtlsParameters }, callback) => {
        console.log("connect-consumer-transport event got called.")
        const transport = await consumerTransports.get(socket.id);
        if (transport) {
            await transport.connect({ dtlsParameters });
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
                socket_id: socket.id,
                user_id: socket.user.id,
                producerID: producer.id,
                room_id,
                isScreen
            });

            if (!producers.has(socket.id)) producers.set(socket.id, new Map());
            producers.get(socket.id).set(producer.id, producer);

            socket.to(room_id).emit('new-producer', {
                room_id,
                socket_id: socket.id,
                user_id: socket.user.id,
                producerID: producer.id,
                isScreen
            });
            callback({ id: producer.id });
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on('consume', async ({ producer_id, rtpCapabilities, socket_id }, callback) => {
        try {
            const transport = await consumerTransports.get(socket.id);
            if (!transport) throw new Error('Transport not found');

            const producer = await producers.get(socket_id)?.get(producer_id);
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

            const peers = await store.peers.asyncFind({ type: 'producer', room_id });

            if (!store.consumerUserIDs[room_id]) store.consumerUserIDs[room_id] = [];
            store.consumerUserIDs[room_id].push(socket.id);

            socket.to(room_id).emit('new-peer', { socket_id: socket.id, user: socket.user });
            socket.to(room_id).emit('consumers', { content: store.consumerUserIDs[room_id], timestamp: Date.now() });

            await Meeting.findByIdAndUpdate(room_id, {
                last_enter: Date.now(),
                $push: { peers: socket.id },
                $push: { users: socket.user.id }
            });

            store.roomIDs[socket.id] = room_id;
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

    socket.on('leave-meeting', async (data, callback) => {
        try {
            const { room_id } = data;
            socket.leave(room_id || 'general');
            await store.peers.asyncRemove({ socket_id: socket.id }, { multi: true });

            store.io.to(room_id).emit('leave', { socketID: socket.id });

            if (producerTransports.has(socket.id)) producerTransports.get(socket.id).close();
            if (consumerTransports.has(socket.id)) consumerTransports.get(socket.id).close();

            store.roomIDs[socket.id] = null;

            await Meeting.findByIdAndUpdate(room_id, {
                last_leave: Date.now(),
                $pull: { peers: socket.id }
            });

            if (store.consumerUserIDs[room_id]) store.consumerUserIDs[room_id].splice(store.consumerUserIDs[room_id].indexOf(socket.id), 1);

            socket.to(room_id).emit('consumers', { content: store.consumerUserIDs[room_id], timestamp: Date.now() });
            socket.to(room_id).emit('leave', { socketID: socket.id });

            callback();
        } catch (err) {
            console.error(err);
            if (callback) callback({ error: err.message });
        }
    });

    socket.on('remove', async (data, callback) => {
        try {
            await store.peers.asyncRemove({ producerID: data.producerID }, { multi: true });
            store.io.to(data.room_id).emit('remove', { producerID: data.producerID, socket_id: socket.id });
            callback();
        } catch (err) {
            console.error(err);
            callback({ error: err.message });
        }
    });

    socket.on("call-user", async ({ room_id }, callback) => {
        const room = await Room.findById(room_id).populate({
            path: "members",
            select: "_id username email profile_image firstname lastname"
        }).lean();

        // const isCalleeOnline = store.io.sockets.sockets.has(room.members.find(member => member._id.toString() !== socket.user.id));
        // if (!room.is_group && !isCalleeOnline) return callback({ error: "User is not online" });

        const caller = room.members.find(member => member._id.toString() === socket.user.id);
        room.members.forEach(memeber => store.io.to(memeber._id.toString()).emit("incoming-call", { room, caller }));
        callback({ success: true });
    })
};

module.exports = {
    initMediasoupWorker,
    registerMediasoupEvents
};
