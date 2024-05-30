const CryptoJS = require("crypto-js")
const jwt = require("jsonwebtoken");
const { jwtExpiries } = require("../hobbyland.config");
const isProdEnv = process.env.DEVELOPMENT_ENV === "PRODUCTION";

const generateRandomInt = (from, to) => Math.floor(Math.random() * (to - from + 1)) + from;
const SignJwt = (data, expiry) => jwt.sign(data, process.env.APP_SECRET_KEY, expiry ? { expiresIn: expiry } : {});
const DeleteCookie = (name) => document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
const getDateOfTimezone = (timeZone) => new Date(new Date().toLocaleDateString('en-US', { timeZone }));
const hashValue = (value = "hobbyland@2024") => CryptoJS.SHA256(value).toString(CryptoJS.enc.Hex);

const isValidTimeZone = (timeZone) => {
    try {
        new Date().toLocaleString('en', { timeZone });
        return true;
    } catch (error) { return false }
}

const EncryptOrDecryptData = (data, encrypt = true) => {
    if (typeof data !== "string") throw new Error("Encryption error: The data must be of type string.")
    if (encrypt) return CryptoJS.AES.encrypt(data, process.env.APP_SECRET_KEY).toString()
    else return CryptoJS.AES.decrypt(data, process.env.APP_SECRET_KEY).toString(CryptoJS.enc.Utf8)
}

const SetSessionCookie = (res, sessionData, expiresAfter = jwtExpiries.default) => {
    const maxAge = Math.floor(expiresAfter * 24 * 60 * 60);
    res.cookie(process.env.SESSION_COOKIE, SignJwt(sessionData, `${expiresAfter} days`), {
        httpOnly: true,
        sameSite: isProdEnv ? "none" : "lax",
        priority: "high",
        path: "/",
        domain: "localhost",
        secure: isProdEnv,
        maxAge
    })
    res.cookie(process.env.LOGGEDIN_COOKIE, true, {
        httpOnly: false,
        sameSite: isProdEnv ? "none" : "lax",
        priority: "high",
        domain: "localhost",
        path: "/",
        secure: isProdEnv,
        maxAge
    })
}

const RemoveSessionCookie = (res) => {
    const sessionTokenCookie = serialize(process.env.SESSION_COOKIE, "null", {
        httpOnly: true,
        sameSite: isProdEnv ? "none" : "lax",
        path: "/",
        secure: isProdEnv,
        maxAge: 0
    })
    const isLoggedInCookie = serialize(process.env.LOGGEDIN_COOKIE, false, {
        httpOnly: false,
        sameSite: isProdEnv ? "none" : "lax",
        path: "/",
        secure: isProdEnv,
        maxAge: 0
    })
    res.setHeader('Set-Cookie', [sessionTokenCookie, isLoggedInCookie])
}

module.exports = {
    SignJwt,
    hashValue,
    DeleteCookie,
    isValidTimeZone,
    SetSessionCookie,
    generateRandomInt,
    getDateOfTimezone,
    RemoveSessionCookie,
    EncryptOrDecryptData
}