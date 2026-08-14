// --------------------------------------------------------------------------
// PERFETTO PIZZA - STAFF / CHEF / DELIVERY BOY API ROUTES
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { Staff } = require('../models');

// 1. STAFF LOGIN (CHEF & DELIVERY BOY)
router.post('/login', async (req, res) => {
    try {
        const { mobileNumber, credentials, role } = req.body;
        if (!mobileNumber || !credentials) {
            return res.status(400).json({ success: false, message: 'Mobile number and credentials are required' });
        }

        const staff = await Staff.findOne({ mobileNumber: mobileNumber.trim() });
        if (!staff || staff.credentials !== credentials.trim()) {
            return res.status(401).json({ success: false, message: 'Invalid staff mobile number or PIN' });
        }

        staff.lastLogin = new Date();
        staff.currentStatus = 'available';
        if (role) staff.role = role;
        await staff.save();

        return res.status(200).json({
            success: true,
            message: `Welcome, ${staff.name}! (${staff.role.toUpperCase()})`,
            staff: {
                id: staff._id,
                name: staff.name,
                role: staff.role,
                mobileNumber: staff.mobileNumber
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. GET ALL STAFF
router.get('/', async (req, res) => {
    try {
        const staffList = await Staff.find({ isActive: true }).select('-credentials').sort({ name: 1 });
        return res.status(200).json({ success: true, count: staffList.length, staff: staffList });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
