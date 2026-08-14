// --------------------------------------------------------------------------
// PERFETTO PIZZA - CART API ROUTES
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { Cart, User } = require('../models');

function extract10DigitPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
}

// 1. GET CUSTOMER CART FROM MONGODB
router.get('/:mobileNumber', async (req, res) => {
    try {
        const phone = extract10DigitPhone(req.params.mobileNumber);
        const cart = await Cart.findOne({ customerPhone: phone });
        if (!cart) {
            return res.status(200).json({
                success: true,
                customerPhone: phone,
                items: [],
                subtotal: 0,
                tax: 0,
                deliveryFee: 0,
                total: 0
            });
        }
        return res.status(200).json({ success: true, cart: cart.items, subtotal: cart.subtotal, total: cart.total });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. SYNC / SAVE CUSTOMER CART TO MONGODB
router.post('/:mobileNumber', async (req, res) => {
    try {
        const phone = extract10DigitPhone(req.params.mobileNumber);
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ success: false, message: 'Items array is required' });
        }

        let cart = await Cart.findOne({ customerPhone: phone });
        if (!cart) {
            cart = new Cart({ customerPhone: phone, items });
        } else {
            cart.items = items;
        }
        await cart.save();

        return res.status(200).json({ success: true, cart: cart.items, total: cart.total });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 3. CLEAR CART
router.delete('/:mobileNumber', async (req, res) => {
    try {
        const phone = extract10DigitPhone(req.params.mobileNumber);
        await Cart.findOneAndDelete({ customerPhone: phone });
        return res.status(200).json({ success: true, message: 'Cart cleared' });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
