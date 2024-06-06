const Room = require("../models/room");
const Meeting = require('../models/meeting');
const User = require('../models/user');
const StandardApi = require("../middlewares/standard-api");
const xss = require('xss');
const store = require('../store');

const AnswerMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { user_id, meeting_id, answer } = req.body;
    store.io.to(user_id).emit('answer', { status: 200, meeting_id, answer, callee: req.user._id });

    res.status(200).json({ ok: true });
});

const CreateMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { title, caller, callee, started_as_call, group_call, group } = req.body;

    const meeting = (await Meeting.create({ title: xss(title), caller, callee, started_as_call, group_call, group })).toObject();
    res.json({ success: true, msg: "Meeting created successfully.", meeting })
});

const AddUserToMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { user_id, meeting_id } = req.body;

    const user = await User.findById(req.user.id).lean();
    store.io.to(user_id).emit('call', { status: 200, meeting_id, roomID: null, caller: req.user.id, counterpart: user, added: true });
    res.status(200).json({ ok: true });
});

const GetMeetings = async (req, res) => StandardApi(req, res, async () => {
    let { limit } = req.fields;

    !limit && (limit = 30);

    Meeting.find({
        $or: [{ users: { $in: [req.user.id] } }, { caller: req.user.id }, { callee: req.user.id }],
    })
        .sort({ lastEnter: -1 })
        .populate({
            path: 'users',
            select: '-email -password -friends -__v',
            populate: {
                path: 'picture',
            },
        })
        .populate([{ path: 'caller', strictPopulate: false }])
        .populate([{ path: 'callee', strictPopulate: false }])
        .populate('group')
        .limit(limit)
        .exec((err, meetings) => {
            if (err) return res.status(500).json({ error: true });
            res.status(200).json({ limit, meetings });
        });
});

const CallMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { room_id, meeting_id } = req.fields;

    const user = await User.findOne({ _id: req.user.id }, { email: 0, password: 0, friends: 0, __v: 0 }).populate([
        { path: 'picture', strictPopulate: false },
    ]);

    Room.findOne({ _id: room_id })
        .populate({
            path: 'people',
            select: '-email -password -friends -__v',
            populate: [
                {
                    path: 'picture',
                },
            ],
        })
        .then((room) => {
            room.people.forEach((person) => {
                const myUserID = req.user.id;
                const personUserID = person._id.toString();

                if (personUserID !== myUserID) {
                    store.io
                        .to(personUserID)
                        .emit('call', { status: 200, room, meeting_id, room_id, caller: req.user.id, counterpart: user });
                }
            });

            res.status(200).json({ ok: true });
        })
        .catch((err) => {
            console.log(err);
            return res.status(500).json({ error: true });
        });
});

const EndMeeting = async (req, res) => StandardApi(req, res, async () => {
    let { user_id, meeting_id } = req.body;
    store.io.to(user_id).emit('close', { status: 200, meeting_id, counterpart: req.user._id });
    res.status(200).json({ ok: true });
});

module.exports = {
    EndMeeting,
    GetMeetings,
    CallMeeting,
    AnswerMeeting,
    CreateMeeting,
    AddUserToMeeting
};