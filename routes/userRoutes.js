// --------------------------------------------------------------------------
// PERFETTO PIZZA - USER / CUSTOMER API ROUTES
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { User, Cart, Order } = require('../models');

function extract10DigitPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
}

// 1. GET OR LOGIN CUSTOMER USER
router.post('/login', async (req, res) => {
    try {
        const { mobileNumber, name, deliveryAddress } = req.body;
        const phone = extract10DigitPhone(mobileNumber);
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Valid mobile number is required' });
        }

        let user = await User.findOne({ mobileNumber: phone });
        if (!user) {
            user = new User({
                mobileNumber: phone,
                name: name || 'Perfetto Customer',
                signInStatus: true,
                deliveryAddress: deliveryAddress || {}
            });
            await user.save();
        } else {
            user.signInStatus = true;
            user.lastLogin = new Date();
            if (name) user.name = name;
            if (deliveryAddress) user.deliveryAddress = { ...user.deliveryAddress, ...deliveryAddress };
            await user.save();
        }

        const cart = await Cart.findOne({ customerPhone: phone });
        const orders = await Order.find({ customerPhone: phone }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            user,
            cart: cart ? cart.items : [],
            orders
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. GET USER PROFILE
router.get('/:mobileNumber', async (req, res) => {
    try {
        const phone = extract10DigitPhone(req.params.mobileNumber);
        const user = await User.findOne({ mobileNumber: phone });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        return res.status(200).json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 3. UPDATE USER ADDRESS
router.put('/:mobileNumber/address', async (req, res) => {
    try {
        const phone = extract10DigitPhone(req.params.mobileNumber);
        const { deliveryAddress, name } = req.body;
        const updateData = {};
        if (deliveryAddress) updateData.deliveryAddress = deliveryAddress;
        if (name) updateData.name = name;

        const user = await User.findOneAndUpdate(
            { mobileNumber: phone },
            { $set: updateData },
            { new: true, upsert: true }
        );

        return res.status(200).json({ success: true, user });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
