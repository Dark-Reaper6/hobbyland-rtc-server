const Meeting = require('../models/meeting');
const Room = require('../models/room');
const User = require('../models/user');
const xss = require('xss');
const store = require('../store');

const AnswerMeeting = (req, res) => {
    let { userID, meetingID, answer } = req.fields;

    store.io.to(userID).emit('answer', { status: 200, meetingID, answer, callee: req.user.id });

    res.status(200).json({ ok: true });
};

const CreateMeeting = (req, res) => {
    let { title, caller, callee, startedAsCall, callToGroup, group } = req.fields;

    Meeting({ title: xss(title), caller, callee, startedAsCall, callToGroup, group })
        .save()
        .then((meeting) => {
            res.status(200).json(meeting);
        });
};

const AddUserToMeeting = async (req, res) => {
    let { userID, meetingID } = req.fields;

    const user = await User.findOne({ _id: req.user.id }, { email: 0, password: 0, friends: 0, __v: 0 }).populate([
        { path: 'picture', strictPopulate: false },
    ]);

    store.io
        .to(userID)
        .emit('call', { status: 200, meetingID, roomID: null, caller: req.user.id, counterpart: user, added: true });

    res.status(200).json({ ok: true });
};

const GetMeetings = (req, res) => {
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
};

const CallMeeting = async (req, res) => {
    let { roomID, meetingID } = req.fields;

    const user = await User.findOne({ _id: req.user.id }, { email: 0, password: 0, friends: 0, __v: 0 }).populate([
        { path: 'picture', strictPopulate: false },
    ]);

    Room.findOne({ _id: roomID })
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
                        .emit('call', { status: 200, room, meetingID, roomID, caller: req.user.id, counterpart: user });
                }
            });

            res.status(200).json({ ok: true });
        })
        .catch((err) => {
            console.log(err);
            return res.status(500).json({ error: true });
        });
};

const EndMeeting = (req, res, next) => {
    let { userID, meetingID } = req.fields;
    store.io.to(userID).emit('close', { status: 200, meetingID, counterpart: req.user.id });
    res.status(200).json({ ok: true });
};

module.exports = {
    EndMeeting,
    GetMeetings,
    CallMeeting,
    AnswerMeeting,
    CreateMeeting,
    AddUserToMeeting
};