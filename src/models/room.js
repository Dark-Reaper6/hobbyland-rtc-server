const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  title: { type: String, default: "Untitled" },
  picture: String,
  is_group: { type: Boolean, default: false },
  last_author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  last_message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
