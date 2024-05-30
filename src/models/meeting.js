const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const MeetingSchema = new Schema({
    title: {
        type: String,
        required: false,
        default: 'Untitled'
    },
    startedAt: {
        type: Date,
        default: Date.now,
    },
    lastEnter: {
        type: Date,
        default: Date.now,
    },
    lastLeave: {
        type: Date,
        default: Date.now,
    },
    startedAsCall: {
        type: Boolean,
        default: false,
    },
    caller: { type: ObjectId, ref: 'users' },
    callee: { type: ObjectId, ref: 'users' },
    callToGroup: {
        type: Boolean,
        default: false,
    },
    group: { type: ObjectId, ref: 'rooms' },
    peers: {
        type: Array,
        default: [],
    },
    users: [{ type: ObjectId, ref: 'users' }],
});

module.exports = mongoose.model('meetings', MeetingSchema);
