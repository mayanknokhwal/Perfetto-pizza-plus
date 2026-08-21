/**
 * Mongoose User Schema
 * Stores customer account information, Firebase Google Auth profile, phone, address, and GPS coordinates
 */

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
    {
        firebaseUid: {
            type: String,
            sparse: true,
            index: true,
            trim: true,
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
            index: true,
        },
        fullName: {
            type: String,
            trim: true,
            default: 'Customer',
        },
        phone: {
            type: String,
            trim: true,
            index: true,
        },
        photoURL: {
            type: String,
            default: '',
        },
        address: {
            colonyName: { type: String, default: '' },
            nearBy: { type: String, default: '' },
            streetName: { type: String, default: '' },
            wardNo: { type: String, default: '' },
            formattedAddress: { type: String, default: '' },
        },
        gps: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
        },
        isPhoneVerified: {
            type: Boolean,
            default: false,
        },
        lastLoginAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Prevent model recompilation in serverless environments
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
