const allowedOrigins = ["http://localhost:3001", "http://localhost:3000"];

const adminRoles = ["administrator", "maintainer", "support"];

const hobbylandServers = ["hobbyland-root-server", "hobbyland-chat-server"];
const serverActionTypes = ["dispatch_event"];

const jwtExpiries = {
    default: 7, // 7 days
    extended: 30 // 30 days
}

const userLevels = {
    "0": 500,
    "1": 1000,
    "2": 3200,
    "3": 6400,
    "4": 18000,
    "5": 30000
}

const registerProviders = ["hobbyland", "google"];
const userNotificationTypes = ["account", "primary"];

const messageTypes = ["message", "announcement", "tooltip"];

const userDocsTypes = ['id_card', 'passport', "driver_license", 'other'];

const docsVerificStatuses = ["pending", "verified", "unverified"];

const ipAddress = {
    ip: '0.0.0.0',
    // announcedIp: process.env.APP_MODE === 'DEV' ? "127.0.0.1" : process.env.HOST,
    announcedIp: null,
};
const mediaCodecs = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 },
    },
];
const rtcPorts = {
    min: 10000,
    max: 12000
}
const rtcBitrates = {
    initial: 1200000,
    max: 1800000
}

module.exports = {
    rtcPorts,
    ipAddress,
    adminRoles,
    userLevels,
    rtcBitrates,
    mediaCodecs,
    jwtExpiries,
    messageTypes,
    userDocsTypes,
    allowedOrigins,
    hobbylandServers,
    registerProviders,
    serverActionTypes,
    docsVerificStatuses,
    userNotificationTypes
}