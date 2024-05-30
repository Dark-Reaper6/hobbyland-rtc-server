const store = require('./store');
const events = require('./events');
const socketioJwt = require('socketio-jwt');
const cors = require('cors');
const router = require('./routes');
const formidableMiddleware = require('express-formidable');
const User = require('./models/User');
const { AsyncNedb } = require('nedb-async');
const mediasoup = require('./mediasoup');
const Meeting = require('./models/meeting');

module.exports = () => {
    store.rooms = new AsyncNedb();
    store.peers = new AsyncNedb();
    store.onlineUsers = new Map();
    store.io.sockets.on(
            'connection',
            socketioJwt.authorize({
                secret: store.config.secret,
                timeout: 15000, // 15 seconds to send the authentication message
            }),
        )
        .on('authenticated', (socket) => {
            const { email, id } = socket.decoded_token;
            console.log(`Socket connected: ${email}`.cyan);

            mediasoup.initSocket(socket);

            socket.join(id);

            events.forEach((event) => socket.on(event.tag, (data) => event.callback(socket, data)));

            store.socketIds.push(socket.id);
            store.sockets[socket.id] = socket;

            if (!store.socketsByUserID[id]) store.socketsByUserID[id] = [];
            store.socketsByUserID[id].push(socket);
            store.userIDsBySocketID[socket.id] = id;

            store.onlineUsers.set(socket, { id, status: 'online' });
            store.io.emit('onlineUsers', Array.from(store.onlineUsers.values()));

            socket.on('unauthorized', (error, callback) => {
                console.log('Unauthorized user attempt.');
                if (error.data.type === 'UnauthorizedError' || error.data.code === 'invalid_token') {
                    // redirect user to login page perhaps or execute callback:
                    callback();
                    console.log('User token has expired');
                }
            });

            const removeSocket = (array, element) => {
                let result = [...array];
                let i = 0;
                let found = false;
                while (i < result.length && !found) {
                    if (element.id === array[i].id) {
                        result.splice(i, 1);
                        found = true;
                    }
                    i++;
                }
                return result;
            };

            socket.on('disconnect', () => {
                if (store.roomIDs[socket.id]) {
                    let roomID = store.roomIDs[socket.id];
                    store.consumerUserIDs[roomID].splice(store.consumerUserIDs[roomID].indexOf(socket.id), 1);
                    socket.to(roomID).emit('consumers', { content: store.consumerUserIDs[roomID], timestamp: Date.now() });
                    socket.to(roomID).emit('leave', { socketID: socket.id });
                }

                Meeting.update({}, { $pull: { peers: socket.id } }, { multi: true });

                store.peers.remove({ socketID: socket.id }, { multi: true });
                console.log(`Socket disconnected: ${email}`.cyan);
                store.socketIds.splice(store.socketIds.indexOf(socket.id), 1);
                store.sockets[socket.id] = undefined;
                store.socketsByUserID[id] = removeSocket(store.socketsByUserID[id], socket);
                User.findOneAndUpdate({ _id: id }, { $set: { lastOnline: Date.now() } })
                    .then(() => console.log('last online ' + id))
                    .catch((err) => console.log(err));
                store.onlineUsers.delete(socket);
                store.io.emit('onlineUsers', Array.from(store.onlineUsers.values()));
            });
        });

    store.app.use(cors());
    store.app.use(formidableMiddleware());
    store.app.use('/api', router);
};
