const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const MeetingSchema = new mongoose.Schema({
    title: {
        type: String,
        required: false,
        default: 'Untitled'
    },
    startedAt: {
        type: Date,
        default: Date.now,
    },
    last_enter: {
        type: Date,
        default: Date.now,
    },
    last_leave: {
        type: Date,
        default: Date.now,
    },
    started_as_call: {
        type: Boolean,
        default: false,
    },
    caller: { type: ObjectId, ref: 'users' },
    callee: { type: ObjectId, ref: 'users' },
    group_call: {
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
