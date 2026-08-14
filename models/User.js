// --------------------------------------------------------------------------
// PERFETTO PIZZA - USER / CUSTOMER MONGOOSE SCHEMA
// --------------------------------------------------------------------------
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    // Mobile number is unique customer identifier across panels
    mobileNumber: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        trim: true,
        index: true,
        match: [/^[0-9+ ]{10,15}$/, 'Please provide a valid mobile number']
    },
    name: {
        type: String,
        trim: true,
        default: 'Perfetto Customer'
    },
    signInStatus: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    deliveryAddress: {
        colonyName: { type: String, default: '' },
        nearBy: { type: String, default: '' },
        streetName: { type: String, default: '' },
        wardNo: { type: String, default: '' },
        fullAddress: { type: String, default: '' }
    },
    rewardPoints: {
        type: Number,
        default: 0
    },
    vipMember: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);
