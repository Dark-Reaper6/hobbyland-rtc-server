const SocketIO = require('socket.io');
const User = require('./models/user');
const Meeting = require('./models/meeting');
const { ConnectDB } = require('../lib/database');
const { verify } = require('jsonwebtoken');
const { validate } = require('uuid');
const store = require('./store');
const { AsyncNedb } = require('nedb-async');
const { registerMediasoupEvents } = require('./mediasoup');
const { getDateOfTimezone } = require('../lib/cyphers');
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
        verify(socket.handshake.query.token, process.env.APP_SECRET_KEY, (err, decoded) => {
            if (err || !validate(decoded.session_id)) return authError();
            socket.user = decoded;
            socket.id = decoded.session_id;
            console.log("A candidate just authenticated with id: " + socket.id)
            next();
        });
    });

    store.io.on('connection', async (socket) => {
        const { user } = socket;
        console.log(`Socket connected: ${user.id}`);
        socket.join(user.id);
        socket.join(user.session_id);

        registerMediasoupEvents(socket);

        socket.on('disconnect', async () => {
            const respectedUser = await User.findById(user.id).lean();
            respectedUser.socket.sessions.forEach(session => {
                if (session.session_id === user.session_id) {
                    session.active = false;
                    last_seen = getDateOfTimezone(respectedUser.timezone);
                }
            });
            await User.findByIdAndUpdate(user.id, {
                "socket.sessions": respectedUser.socket.sessions,
                "socket.active": respectedUser.socket.sessions.some(session => (session.session_id !== user.session_id && session.active))
            }, { immutability: "disable" })

            console.log("A user with id: " + user.id + " disconnected!")
            store.io.emit('offline', { id: user.id });
            console.log(`A user with email ${user.email} just disconnected.`);

            await Meeting.updateOne({}, { $pull: { peers: socket.id } }, { multi: true });
        });
    });
};
