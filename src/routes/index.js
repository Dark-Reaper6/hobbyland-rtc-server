const router = require('express').Router();
const { AddUser, GetPeers, JoinUser } = require("./rtc");
const { GetMeetings, CallMeeting, AnswerMeeting, CreateMeeting, EndMeeting, AddUserToMeeting } = require("./meeting");

// router.get('/images/:id', require('./images'));
// router.get('/files/:id', require('./files'));
// router.get('/images/:id/:size', require('./images'));

router.post('/rtc/create', AddUser);
router.post('/rtc/join', GetPeers);
router.post('/rtc/peers', JoinUser);

router.post('/meeting/create', CreateMeeting);
router.post('/meeting/call', CallMeeting);
router.post('/meeting/add', AddUserToMeeting);
router.post('/meeting/answer', AnswerMeeting);
router.post('/meeting/close', EndMeeting);
router.post('/meeting/get', GetMeetings);

module.exports = router;
