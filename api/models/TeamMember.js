/**
 * Mongoose TeamMember Schema
 * Stores authorized staff members, role assignments (Master Admin, Admin, Chef, Delivery Boy), and status.
 */

const mongoose = require('mongoose');

const TeamMemberSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        fullName: {
            type: String,
            trim: true,
            default: 'Team Member',
        },
        photoURL: {
            type: String,
            default: '',
        },
        firebaseUid: {
            type: String,
            sparse: true,
            index: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ['Master Admin', 'Admin', 'Chef', 'Delivery Boy'],
            default: 'Chef',
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive'],
            default: 'Active',
        },
        isMasterAdmin: {
            type: Boolean,
            default: false,
        },
        addedBy: {
            type: String,
            default: 'system',
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
module.exports = mongoose.models.TeamMember || mongoose.model('TeamMember', TeamMemberSchema);
