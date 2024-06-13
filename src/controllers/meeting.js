const Room = require("../models/room");
const Meeting = require('../models/meeting');
const User = require('../models/user');
const StandardApi = require("../middlewares/standard-api");
const store = require('../store');
// const xss = require('xss');

const AnswerMeeting = async (req, res) => StandardApi(req, res, async () => {
    const { user_id, meeting_id, answer } = req.body;
    store.io.to(user_id).emit('answer', { status: 200, meeting_id, answer, callee: req.user._id });

    res.status(200).json({ ok: true });
});

const CreateMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { title, caller, callee, started_as_call, group_call, group } = req.body;

    const meeting = (await Meeting.create({ title, caller, callee, started_as_call, group_call, group })).toObject();
    res.json({ success: true, msg: "Meeting created successfully.", meeting })
});

const AddUserToMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { user_id, meeting_id } = req.body;

    const user = await User.findById(req.user._id).lean();
    store.io.to(user_id).emit('call', { status: 200, meeting_id, roomID: null, caller: req.user._id, counterpart: user, added: true });
    res.status(200).json({ success: true, msg: "You are added to the meeting successfully." });
});

const GetMeetings = async (req, res) => StandardApi(req, res, async () => {
    let { limit } = req.body;

    !limit && (limit = 30);

    const meetings = await Meeting.find({
        $or: [{ users: { $in: [req.user._id] } },
        { caller: req.user._id },
        { callee: req.user._id }]
    }).sort({ lastEnter: -1 })
        .populate({ path: 'users', select: '-email -password -friends -__v' })
        .populate("caller callee group")
        .limit(limit)
        .lean()

    res.status(200).json({ limit, meetings });
});

const CallMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { room_id, meeting_id } = req.body;

    const user = await User.findById(req.user._id).lean();
    const room = await Room.findOne({ _id: room_id }).populate({
        path: 'people',
        select: '-email -password -friends -__v'
    })

    room.people.forEach((person) => {
        const personUserID = person?._id?.toString();

        if (personUserID !== req.user._id) store.io.to(personUserID).emit('call', {
            status: 200, room, meeting_id, room_id, caller: req.user._id, counterpart: user
        });
    });

    res.status(200).json({ success: true, msg: "Call initiated" });
});

const EndMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { user_id, meeting_id } = req.body;
    store.io.to(user_id).emit('close', { status: 200, meeting_id, counterpart: req.user._id });
    res.status(200).json({ success: true, msg: "Meeting call ended" });
});

module.exports = {
    EndMeeting,
    GetMeetings,
    CallMeeting,
    AnswerMeeting,
    CreateMeeting,
    AddUserToMeeting
};