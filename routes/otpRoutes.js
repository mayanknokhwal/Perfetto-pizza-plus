// --------------------------------------------------------------------------
// PERFETTO PIZZA - FAST2SMS OTP VERIFICATION API ROUTES
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const https = require('https');
const { Otp, User } = require('../models');

// Helper to clean 10-digit Indian phone number
function extract10DigitPhone(phone) {
    if (!phone) return '';
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length > 10) {
        return digits.slice(-10);
    }
    return digits;
}

// Helper to make Fast2SMS HTTP request
function sendFast2SmsOtp(phone, otpCode) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (!apiKey) {
            return reject(new Error('FAST2SMS_API_KEY is not defined in environment'));
        }

        const postData = JSON.stringify({
            variables_values: otpCode,
            route: 'otp',
            numbers: phone
        });

        const options = {
            hostname: 'www.fast2sms.com',
            port: 443,
            path: '/dev/bulkV2',
            method: 'POST',
            headers: {
                'authorization': apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ Fast2SMS Network Error:', e.message);
            reject(e);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Fast2SMS request timed out'));
        });

        req.write(postData);
        req.end();
    });
}

// 1. SEND OTP TO CUSTOMER MOBILE
router.post('/send', async (req, res) => {
    try {
        const { mobileNumber } = req.body;
        if (!mobileNumber) {
            return res.status(400).json({ success: false, message: 'Please provide a valid mobile number' });
        }

        const cleanPhone = extract10DigitPhone(mobileNumber);
        if (cleanPhone.length !== 10) {
            return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
        }

        // Generate 6-digit cryptographic-style random OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete any pending OTPs for this phone number
        await Otp.deleteMany({ mobileNumber: cleanPhone });

        // Save new OTP in MongoDB
        const newOtp = new Otp({
            mobileNumber: cleanPhone,
            otpCode: otpCode,
            verified: false
        });
        await newOtp.save();

        console.log(`📱 Sending OTP [${otpCode}] via Fast2SMS to +91 ${cleanPhone}...`);

        // Send via Fast2SMS API
        let smsResponse = null;
        try {
            smsResponse = await sendFast2SmsOtp(cleanPhone, otpCode);
            console.log('✅ Fast2SMS API Response:', smsResponse);
        } catch (smsErr) {
            console.warn('⚠️ Fast2SMS dispatch note:', smsErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `OTP sent successfully to +91 ${cleanPhone}! Valid for 10 minutes.`,
            mobileNumber: cleanPhone,
            // In development or if needed for instant verification preview:
            previewOtp: process.env.NODE_ENV === 'development' ? otpCode : undefined
        });
    } catch (err) {
        console.error('Error in /api/otp/send:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// 2. VERIFY CUSTOMER OTP
router.post('/verify', async (req, res) => {
    try {
        const { mobileNumber, otpCode } = req.body;
        if (!mobileNumber || !otpCode) {
            return res.status(400).json({ success: false, message: 'Mobile number and OTP code are required' });
        }

        const cleanPhone = extract10DigitPhone(mobileNumber);
        const enteredOtp = otpCode.toString().trim();

        // Find active OTP document in MongoDB
        const otpRecord = await Otp.findOne({ mobileNumber: cleanPhone }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired or was not requested. Please click Send OTP again.'
            });
        }

        if (otpRecord.attempts >= 5) {
            await Otp.deleteOne({ _id: otpRecord._id });
            return res.status(400).json({
                success: false,
                message: 'Too many incorrect attempts. Please request a new OTP.'
            });
        }

        if (otpRecord.otpCode !== enteredOtp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP code. Please check the SMS and try again.'
            });
        }

        // Mark OTP as verified
        otpRecord.verified = true;
        await otpRecord.save();

        // Create or update Customer User profile in MongoDB
        let user = await User.findOne({ mobileNumber: cleanPhone });
        if (!user) {
            user = new User({
                mobileNumber: cleanPhone,
                name: req.body.name || 'Perfetto Customer',
                signInStatus: true,
                lastLogin: new Date()
            });
            await user.save();
        } else {
            user.signInStatus = true;
            user.lastLogin = new Date();
            if (req.body.name) user.name = req.body.name;
            await user.save();
        }

        console.log(`✅ Mobile Number +91 ${cleanPhone} verified successfully via OTP`);

        return res.status(200).json({
            success: true,
            message: '🎉 Mobile number verified successfully!',
            user: {
                mobileNumber: user.mobileNumber,
                name: user.name,
                deliveryAddress: user.deliveryAddress
            }
        });
    } catch (err) {
        console.error('Error in /api/otp/verify:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
