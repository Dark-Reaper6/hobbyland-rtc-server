const mongoose = require('mongoose');
const { messageTypes } = require("../../hobbyland.config");

const MessageSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  room_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  files: [{ type: String }],
  type: {
    type: String,
    enum: messageTypes,
    default: messageTypes[0]
  },
  deleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
