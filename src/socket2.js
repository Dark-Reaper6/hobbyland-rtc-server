const SocketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { ConnectDB } = require('../lib/database');
const { allowedOrigins } = require("../hobbyland.config");
const { validate } = require('uuid');
const { getDateOfTimezone } = require('../../lib/cyphers');

let io;
const initSocket = async (server) => {
    io = SocketIO(server, {
        cors: { origin: allowedOrigins }
    });

    io.use(async (socket, next) => {
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

    io.on('connection', async (socket) => {
        const { user } = socket;

        await User.findOneAndUpdate(
            { _id: user.id, "socket.sessions.session_id": user.session_id },
            {
                $set: {
                    "socket.sessions.$.active": true,
                    "socket.active": true
                },
            }, { new: true, lean: true, immutability: "disable" });
        socket.join(user.id);
        socket.join(user.session_id);
        io.emit('online', { id: user.id, username: user.username, firstname: user.firstname, lastname: user.lastname });
        console.log("A user with id: " + user.id + " connected!")

        socket.on(`disconnect-${user.id}`, () => {
            socket.disconnect(true)
        });

        socket.on('disconnect', async () => {
            console.log("User disconnection event occured ", user.id);
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
            io.emit('offline', { id: user.id });
        });
    });

    console.log('socket system online');
};

const Io = () => io;

module.exports = { initSocket, Io };
