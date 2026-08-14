// --------------------------------------------------------------------------
// PERFETTO PIZZA - OTP VERIFICATION MONGOOSE SCHEMA (WITH TTL AUTO-EXPIRY)
// --------------------------------------------------------------------------
const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
    mobileNumber: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    otpCode: {
        type: String,
        required: true,
        trim: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
        // Document automatically deleted from MongoDB after 10 minutes (600 seconds)
        expires: 600
    }
});

module.exports = mongoose.model('Otp', OtpSchema);
