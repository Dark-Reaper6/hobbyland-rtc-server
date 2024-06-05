const router = require('express').Router();
const { AddUser, GetPeers, JoinUser } = require("../controllers/rtc");
const { GetMeetings, CallMeeting, AnswerMeeting, CreateMeeting, EndMeeting, AddUserToMeeting } = require("../controllers/meeting");

router.post('/rtc/create', AddUser);
router.post('/rtc/join', JoinUser);
router.post('/rtc/get-peers', GetPeers);

router.post('/meeting/create', CreateMeeting);
router.post('/meeting/call', CallMeeting);
router.post('/meeting/add', AddUserToMeeting);
router.post('/meeting/answer', AnswerMeeting);
router.post('/meeting/close', EndMeeting);
router.post('/meeting/get', GetMeetings);

module.exports = router;
