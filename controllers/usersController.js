/**
 * Perfetto Pizza - Users Controller
 * Handles user profile lookup and synchronization with MongoDB Atlas
 */

const { connectToDatabase } = require('../lib/mongodb');
const User = require('../models/User');

async function handleUsersRequest(req, res) {
    try {
        const db = await connectToDatabase();

        // 1. GET: Lookup user profile
        if (req.method === 'GET') {
            if (!db) {
                return res.status(200).json({
                    success: false,
                    isFallback: true,
                    message: 'MongoDB URI not configured. Use LocalStorage mode.'
                });
            }

            const { email, phone, firebaseUid } = req.query || {};
            const filter = {};

            if (firebaseUid) filter.firebaseUid = firebaseUid;
            else if (email) filter.email = email.toLowerCase().trim();
            else if (phone) filter.phone = phone.trim();
            else {
                return res.status(400).json({ success: false, message: 'Please provide email, phone, or firebaseUid' });
            }

            const user = await User.findOne(filter).lean();
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            return res.status(200).json({ success: true, user });
        }

        // 2. POST: Upsert User Profile
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = null; }
            }

            if (!body) {
                return res.status(400).json({ success: false, message: 'Missing or invalid user payload' });
            }

            if (!db) {
                return res.status(200).json({
                    success: true,
                    isFallback: true,
                    message: 'User profile stored (LocalStorage mode)',
                    user: body
                });
            }

            const searchFilter = {};
            if (body.firebaseUid) searchFilter.firebaseUid = body.firebaseUid;
            else if (body.email) searchFilter.email = body.email.toLowerCase().trim();
            else if (body.phone) searchFilter.phone = body.phone.trim();
            else {
                return res.status(400).json({ success: false, message: 'User must have email, phone, or firebaseUid' });
            }

            const updateData = {
                ...(body.firebaseUid && { firebaseUid: body.firebaseUid }),
                ...(body.email && { email: body.email.toLowerCase().trim() }),
                ...(body.fullName && { fullName: body.fullName.trim() }),
                ...(body.phone && { phone: body.phone.trim() }),
                ...(body.photoURL && { photoURL: body.photoURL }),
                ...(body.address && { address: body.address }),
                ...(body.gps && { gps: body.gps }),
                ...(body.isPhoneVerified !== undefined && { isPhoneVerified: body.isPhoneVerified }),
                lastLoginAt: new Date(),
            };

            const user = await User.findOneAndUpdate(
                searchFilter,
                { $set: updateData },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            return res.status(200).json({
                success: true,
                message: 'User profile updated successfully',
                user
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleUsersRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error'
        });
    }
}

module.exports = {
    handleUsersRequest
};
