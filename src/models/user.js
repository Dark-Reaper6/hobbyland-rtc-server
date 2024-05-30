const mongoose = require('mongoose');
const { immutableCondition } = require('../../lib/database');
const { userLevels } = require("../../hobbyland.config")

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Please enter a username"],
        maxLength: [30, "Username cannot exceed 30 characters"],
        minLength: [4, "Username should have more than 4 characters"],
        unique: [true, "This username is already in use"],
        immutable: immutableCondition
    },
    email: {
        type: String,
        required: [true, "Please enter a valid email address"],
        unique: [true, "This email address is already in use"],
        immutable: immutableCondition
    },
    register_provider: {
        type: String,
        enum: ["hobbyland", "google"],
        default: "hobbyland",
        immutable: immutableCondition
    },
    phone_number: {
        prefix: String,
        suffix: String
    },
    country: String,
    profile_image: {
        type: String
    },
    banner_image: {
        type: String
    },
    password: {
        type: String,
        minLength: [8, "Password should be greater than 8 characters"],
        select: false,
        immutable: immutableCondition
    },
    firstname: {
        type: String,
        required: true
    },
    lastname: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        enum: ["male", "female", "other"]
    },
    account_type: {
        type: String,
        enum: ["student", "mentor"],
        default: "student",
        immutable: immutableCondition
    },
    agency: {
        agency_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Agency"
        },
        role: {
            type: String
        }
    },
    level: {
        level: {
            type: Number,
            default: 0,
            immutable: immutableCondition
        },
        exp: {
            type: Number,
            default: userLevels["0"],
            immutable: immutableCondition
        }
    },
    two_fa: {
        secret: {
            type: String,
            minLength: 20,
            select: false,
            immutable: immutableCondition
        },
        register_date: {
            type: Date,
            immutable: immutableCondition
        },
        enabled: {
            type: Boolean,
            default: false,
            immutable: immutableCondition
        }
    },
    timezone: {
        type: String,
        required: true,
        immutable: immutableCondition
    },
    social_links: [
        {
            name: String,
            link: String
        }
    ],
    socket: {
        active: {
            type: Boolean,
            default: true
        },
        id: String,
        // ids: [
        //     { user_agent: String }
        // ],
        last_active: Date
    },
    is_active: {
        type: Boolean,
        default: true
    },
    last_checkin: {
        type: Date,
        default: new Date()
    }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);