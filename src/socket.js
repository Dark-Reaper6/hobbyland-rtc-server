const SocketIO = require('socket.io');
const User = require('./models/user');
const Meeting = require('./models/meeting');
const events = require('./events');
const store = require('./store');
const { AsyncNedb } = require('nedb-async');
const { registerMediasoupEvents } = require('./mediasoup');
const { allowedOrigins } = require('../hobbyland.config');

module.exports = async (server) => {
    store.rooms = new AsyncNedb();
    store.peers = new AsyncNedb();
    store.onlineUsers = new Map();

    store.io = SocketIO(server, {
        cors: { origin: allowedOrigins }
    });

    store.io.use(async (socket, next) => {
        await ConnectDB(false);
        const authError = () => { console.log("Socket handshake authentication error"); next(new Error('Authentication error')); }
        if (!socket?.handshake?.query?.token) return authError();
        jwt.verify(socket.handshake.query.token, process.env.APP_SECRET_KEY, (err, decoded) => {
            if (err || !validate(decoded.session_id)) return authError();
            socket.user = decoded;
            socket.id = decoded.session_id;
            console.log("A candidate just authenticated with id: " + socket.id)
            next();
        });
    });

    store.io.on('connection', async (socket) => {
        const { user } = socket;
        console.log(`Socket connected: ${user.email}`);

        registerMediasoupEvents(socket);

        socket.join(user.id);

        events.forEach((event) => socket.on(event.tag, (data) => event.callback(socket, data)));

        store.socketIds.push(socket.id);
        store.sockets[socket.id] = socket;

        if (!store.socketsByUserID[user.id]) store.socketsByUserID[user.id] = [];
        store.socketsByUserID[user.id].push(socket);
        store.userIDsBySocketID[socket.id] = user.id;

        store.onlineUsers.set(socket, { id: user.id, status: 'online' });
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
                if (element.id === array[i].user.id) {
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
            console.log(`Socket disconnected: ${user.email}`);
            store.socketIds.splice(store.socketIds.indexOf(socket.id), 1);
            store.sockets[socket.id] = undefined;
            store.socketsByUserID[user.id] = removeSocket(store.socketsByUserID[user.id], socket);
            User.findOneAndUpdate({ _id: user.id }, { $set: { lastOnline: Date.now() } })
                .then(() => console.log('last online ' + user.id))
                .catch((err) => console.log(err));
            store.onlineUsers.delete(socket);
            store.io.emit('onlineUsers', Array.from(store.onlineUsers.values()));
        });
    });
};
