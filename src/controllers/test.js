
const { Io } = require("../socket/index");
const StandardApi = require("../middlewares/standard-api");

module.exports = async (req, res) => StandardApi(req, res, async () => {
    const user_id = req.user._id;
    Io().to(user_id).emit("test-event", { data: "Yayyyy! test event delivered successfully." })
    return res.json({ success: true, msg: "Test event triggered, listen to the `test-event` on client side." })
})