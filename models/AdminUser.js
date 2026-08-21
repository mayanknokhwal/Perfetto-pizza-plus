/**
 * Mongoose AdminUser Schema
 * Stores staff/admin accounts, assigned roles, status, Google profile info, and review history
 */

const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema(
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
            default: 'Staff Member',
        },
        photoURL: {
            type: String,
            default: '',
        },
        firebaseUid: {
            type: String,
            trim: true,
            default: '',
            index: true,
        },
        role: {
            type: String,
            enum: ['Master Admin', 'Admin', 'Chef', 'Delivery Boy', 'Pending'],
            default: 'Pending',
            index: true,
        },
        status: {
            type: String,
            enum: ['active', 'pending', 'rejected'],
            default: 'pending',
            index: true,
        },
        lastLoginAt: {
            type: Date,
            default: Date.now,
        },
        requestedAt: {
            type: Date,
            default: Date.now,
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        reviewedBy: {
            type: String,
            default: '',
        },
        notes: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// Prevent model recompilation in serverless environments
module.exports = mongoose.models.AdminUser || mongoose.model('AdminUser', AdminUserSchema);
