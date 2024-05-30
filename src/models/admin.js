const mongoose = require('mongoose');
const { hashValue } = require("../../lib/cyphers");

const AdminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Please enter a username"],
        maxLength: [30, "Username cannot exceed 30 characters"],
        minLength: [4, "Username should have more than 4 characters"],
        unique: [true, "This username is already in use"],
        immutable: true
    },
    email: {
        type: String,
        required: [true, "Please enter a valid email address"],
        unique: [true, "This email address is already in use"],
        immutable: true
    },
    role: {
        type: String,
        enum: ["administrator", "maintainer", "support"],
        default: "maintainer",
        immutable: true
    },
    profile_image: {
        type: String
    },
    password: {
        type: String,
        minLength: [8, "Password should be greater than 8 characters"],
        set: hashValue,
        immutable: true
    },
    firstname: {
        type: String
    },
    lastname: {
        type: String
    },
    gender: {
        type: String
    },
    two_fa: {
        secret: {
            type: String,
            minLength: 20,
            select: false,
            immutable: true
        },
        activation_date: Date,
        enabled: {
            type: Boolean,
            default: false
        }
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model(`Admin`, AdminSchema);