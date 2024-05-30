const Admin = require("../models/admin");
const { isValidObjectId } = require("mongoose");
const { sendAdminNotification } = require("../../lib/send-notification");
const { verify, decode } = require("jsonwebtoken");
const { adminRoles } = require("../../hobbyland.config");

module.exports = async function StandardApi(req, res, next, { verify_user = true, verify_admin = false, validationSchema = null } = {}) {
    let nextHandler = null;
    try {
        if (verify_user || verify_admin) try {
            // Authorizing the request.
            const { "session-token": sessionToken } = req.cookies;
            if (!sessionToken) throw new Error("invalid session token");
            const decodedToken = verify(sessionToken, process.env.APP_SECRET_KEY);
            if (!isValidObjectId(decodedToken._id)) throw new Error("invalid session token");
            // if (decode(decodedToken.user_agent) !== req.headers['user-agent']) throw new Error("invalid session token"); // Currently disabled due to testing in different divices.S
            if (verify_admin) {
                let admin = await Admin.findById(decodedToken._id);
                if (!admin || !adminRoles.includes(admin.role)) throw new Error("invalid session token");
            }
            req.user = decodedToken;
            nextHandler = next;
        } catch (error) {
            console.log(error)
            return res.status(401).json({ success: false, error_code: process.env.APP_CODE + 401, error, msg: "Your session is invalid or expired. Please sign in again." })
        } else nextHandler = next;

        if (validationSchema) {
            nextHandler = null;
            try {
                const parsedData = await validationSchema.validate(req.body, { abortEarly: false });
                req.body = parsedData;
                nextHandler = next;
            } catch (error) {
                console.log(error)
                return res.status(400).json({ success: false, error: error.errors.join(', ') });
            }
        } else nextHandler = next;

        if (nextHandler) await nextHandler();

    } catch (error) {
        console.log(error);
        sendAdminNotification()
        return res.status(500).json({ success: false, msg: "Internal Server Error occurred, please try again in a while.", error })
    }
}