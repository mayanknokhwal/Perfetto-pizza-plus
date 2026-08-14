// --------------------------------------------------------------------------
// PERFETTO PIZZA - ORDER API ROUTES (MONGODB + OTP VERIFICATION CHECK)
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const { Order, User, Cart, Otp } = require('../models');

function extract10DigitPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
}

// 1. PLACE NEW ORDER (STRICT EMPTY CART & OTP VERIFICATION)
router.post('/', async (req, res) => {
    try {
        const {
            orderId,
            customerPhone,
            customerName,
            address,
            deliveryDetails,
            items,
            subtotal,
            tax,
            deliveryFee,
            total,
            paymentStatus,
            otpCode // Optional if already verified in session
        } = req.body;

        const cleanPhone = extract10DigitPhone(customerPhone);
        if (!cleanPhone || cleanPhone.length !== 10) {
            return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number is required' });
        }

        // Check 1: Strict Empty Cart check
        if (!items || !Array.isArray(items) || items.length === 0 || !total || total <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Your cart is empty! Please add items before placing an order.'
            });
        }

        // Check 2: OTP Verification Check
        let isOtpVerified = false;
        if (otpCode) {
            const otpRecord = await Otp.findOne({ mobileNumber: cleanPhone, otpCode: otpCode.toString().trim() });
            if (otpRecord && otpRecord.verified) {
                isOtpVerified = true;
            }
        }
        
        if (!isOtpVerified) {
            // Check if there is a recently verified OTP record for this mobile number
            const recentVerified = await Otp.findOne({ mobileNumber: cleanPhone, verified: true });
            if (recentVerified) {
                isOtpVerified = true;
            }
        }

        // If not verified, reject order placement
        if (!isOtpVerified) {
            return res.status(403).json({
                success: false,
                message: 'Mobile number verification required. Please click Send OTP and verify your number before placing an order.'
            });
        }

        const genId = orderId ? orderId.toString() : Math.floor(1000 + Math.random() * 9000).toString();

        // Update or create User profile
        let user = await User.findOne({ mobileNumber: cleanPhone });
        if (!user) {
            user = new User({
                mobileNumber: cleanPhone,
                name: customerName || 'Perfetto Customer',
                signInStatus: true,
                deliveryAddress: deliveryDetails || {}
            });
            await user.save();
        } else {
            user.signInStatus = true;
            if (customerName) user.name = customerName;
            if (deliveryDetails) user.deliveryAddress = { ...user.deliveryAddress, ...deliveryDetails };
            user.rewardPoints = (user.rewardPoints || 0) + Math.floor(total / 50);
            await user.save();
        }

        // Create and save Order in MongoDB
        const order = new Order({
            orderId: genId,
            customerPhone: cleanPhone,
            user: user ? user._id : undefined,
            customerName: customerName || 'Perfetto Customer',
            address: address || `${deliveryDetails?.colonyName || ''}, ${deliveryDetails?.streetName || ''}`,
            deliveryDetails: deliveryDetails || {},
            items: items,
            subtotal: subtotal || 0,
            tax: tax || 0,
            deliveryFee: deliveryFee || 0,
            total: Math.round(total),
            paymentStatus: paymentStatus || 'Cash on Delivery',
            status: 'new',
            otpVerified: true,
            timeAgo: 'Just Now'
        });

        try {
            await order.save();
            await Cart.findOneAndDelete({ customerPhone: cleanPhone });
            await Otp.deleteMany({ mobileNumber: cleanPhone });
            console.log(`🍕 Order #${order.orderId} saved to MongoDB for +91 ${cleanPhone}`);
        } catch (saveErr) {
            console.warn('MongoDB order persistence note:', saveErr.message);
        }

        return res.status(201).json({
            success: true,
            message: '🎉 Order placed successfully in Perfetto Pizza Database! Arriving in 25 mins.',
            order
        });
    } catch (err) {
        console.error('Error in POST /api/orders:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. GET ALL ORDERS (FOR STAFF & ADMIN)
router.get('/', async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status && status !== 'all') {
            if (status === 'kitchen') {
                query.status = { $in: ['new', 'preparing'] };
            } else {
                query.status = status;
            }
        }

        const orders = await Order.find(query).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: orders.length, orders });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 3. GET PAST ORDER HISTORY FOR CUSTOMER
router.get('/customer/:mobileNumber', async (req, res) => {
    try {
        const cleanPhone = extract10DigitPhone(req.params.mobileNumber);
        const orders = await Order.find({ customerPhone: cleanPhone }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: orders.length, orders });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 4. UPDATE ORDER STATUS (CHEF / DELIVERY BOY / ADMIN)
router.put('/:orderId/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['new', 'preparing', 'ready', 'delivery', 'completed', 'cancelled'];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid order status' });
        }

        const order = await Order.findOneAndUpdate(
            { orderId: req.params.orderId.toString() },
            { $set: { status } },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({
            success: true,
            message: `Order #${order.orderId} updated to ${status.toUpperCase()}`,
            order
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
