module.exports = {
    app: null,
    config: {},
    connected: false,
    io: null,
    sockets: {},
    socketIds: [],
    socketsByUserID: {},
    userIDsBySocketID: {},
    onlineUsers: null,
    rtcRooms: {},
    rooms: {},
    peers: {},
    consumerUserIDs: {},
    roomIDs: {}
};