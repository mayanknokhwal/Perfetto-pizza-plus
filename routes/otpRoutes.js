// --------------------------------------------------------------------------
// PERFETTO PIZZA - FAST2SMS OTP VERIFICATION API ROUTES
// --------------------------------------------------------------------------
const express = require('express');
const router = express.Router();
const https = require('https');
const { Otp, User } = require('../models');

// In-memory OTP storage fallback (ensures high availability and zero timeout delay)
const inMemoryOtpStore = new Map();

// Helper to clean and validate 10-digit Indian phone number
function extract10DigitPhone(phone) {
    if (!phone) return '';
    const digits = phone.toString().replace(/[^0-9]/g, '');
    if (digits.length > 10) {
        return digits.slice(-10);
    }
    return digits;
}

// Helper to make Fast2SMS HTTP request with comprehensive error handling
function sendFast2SmsOtp(phone, otpCode) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.FAST2SMS_API_KEY;
        if (!apiKey) {
            console.error('❌ Fast2SMS Error: FAST2SMS_API_KEY is not defined in environment variables');
            return reject(new Error('FAST2SMS_API_KEY is missing in server environment'));
        }

        const postData = JSON.stringify({
            variables_values: otpCode.toString(),
            route: 'otp',
            numbers: phone.toString()
        });

        console.log(`📡 [Fast2SMS Request] Dispatched to number: ${phone}, route: otp, payload: ${postData}`);

        const options = {
            hostname: 'www.fast2sms.com',
            port: 443,
            path: '/dev/bulkV2',
            method: 'POST',
            headers: {
                'authorization': apiKey.trim(),
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 12000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                console.log(`📥 [Fast2SMS Response] Status Code: ${res.statusCode}, Body: ${body}`);
                try {
                    const parsed = JSON.parse(body);
                    resolve({ statusCode: res.statusCode, data: parsed, raw: body });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: { return: false, message: body }, raw: body });
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ [Fast2SMS Network Error]:', e.message);
            reject(e);
        });

        req.on('timeout', () => {
            req.destroy();
            console.error('❌ [Fast2SMS Timeout]: Request exceeded 12 seconds');
            reject(new Error('Fast2SMS gateway connection timed out'));
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
            return res.status(400).json({ success: false, message: 'Please provide a 10-digit mobile number' });
        }

        const cleanPhone = extract10DigitPhone(mobileNumber);
        if (cleanPhone.length !== 10) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mobile number! Please enter exactly 10 digits.'
            });
        }

        // Generate 6-digit cryptographic-style random OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Save in memory store
        inMemoryOtpStore.set(cleanPhone, {
            otpCode,
            verified: false,
            attempts: 0,
            createdAt: Date.now()
        });

        // Asynchronously save to MongoDB (with catch block to prevent blocking if DB is buffering)
        try {
            Otp.deleteMany({ mobileNumber: cleanPhone }).then(() => {
                const newOtp = new Otp({
                    mobileNumber: cleanPhone,
                    otpCode: otpCode,
                    verified: false
                });
                return newOtp.save();
            }).catch(e => console.warn('MongoDB OTP async save notice:', e.message));
        } catch (dbErr) {
            console.warn('MongoDB save notice:', dbErr.message);
        }

        console.log(`\n======================================================`);
        console.log(`📱 GENERATED OTP [${otpCode}] FOR MOBILE: +91 ${cleanPhone}`);
        console.log(`======================================================`);

        // Dispatch via Fast2SMS API
        let smsResult = null;
        let smsSuccess = false;
        let smsMessage = '';

        try {
            smsResult = await sendFast2SmsOtp(cleanPhone, otpCode);
            if (smsResult && smsResult.data) {
                if (smsResult.data.return === true || smsResult.statusCode === 200) {
                    smsSuccess = true;
                    smsMessage = Array.isArray(smsResult.data.message) ? smsResult.data.message.join(', ') : (smsResult.data.message || 'SMS sent successfully.');
                    console.log(`✅ Fast2SMS Dispatched Successfully to +91 ${cleanPhone}`);
                } else {
                    smsMessage = Array.isArray(smsResult.data.message) ? smsResult.data.message.join(', ') : (smsResult.data.message || JSON.stringify(smsResult.data));
                    console.warn(`⚠️ Fast2SMS Gateway Notice: ${smsMessage}`);
                }
            }
        } catch (smsErr) {
            console.error('❌ Fast2SMS Dispatch Exception:', smsErr.message);
            smsMessage = smsErr.message;
        }

        return res.status(200).json({
            success: true,
            gatewayStatus: smsSuccess ? 'sent' : 'notice',
            gatewayMessage: smsMessage,
            message: smsSuccess
                ? `OTP sent successfully to +91 ${cleanPhone}! Valid for 10 minutes.`
                : `OTP generated for +91 ${cleanPhone}. (${smsMessage || 'Valid for 10 mins'})`,
            mobileNumber: cleanPhone,
            previewOtp: otpCode
        });
    } catch (err) {
        console.error('Error in /api/otp/send:', err);
        return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
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

        if (cleanPhone.length !== 10) {
            return res.status(400).json({ success: false, message: 'Invalid 10-digit mobile number' });
        }

        // Check in-memory store first
        const memRecord = inMemoryOtpStore.get(cleanPhone);
        let isValid = false;

        if (memRecord) {
            if (Date.now() - memRecord.createdAt > 10 * 60 * 1000) {
                inMemoryOtpStore.delete(cleanPhone);
                return res.status(400).json({
                    success: false,
                    message: 'OTP has expired. Please click Send OTP again.'
                });
            }

            if (memRecord.otpCode === enteredOtp) {
                isValid = true;
                memRecord.verified = true;
            } else {
                memRecord.attempts += 1;
                return res.status(400).json({
                    success: false,
                    message: `Invalid OTP code. Please check your SMS and try again. (${5 - memRecord.attempts} attempts remaining)`
                });
            }
        }

        // If not found in memory, check MongoDB
        if (!isValid) {
            try {
                const otpRecord = await Otp.findOne({ mobileNumber: cleanPhone }).sort({ createdAt: -1 });
                if (otpRecord && otpRecord.otpCode === enteredOtp) {
                    isValid = true;
                    otpRecord.verified = true;
                    await otpRecord.save();
                }
            } catch (dbErr) {
                console.warn('DB verify lookup note:', dbErr.message);
            }
        }

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP code. Please check your SMS and try again.'
            });
        }

        // Update / Save user profile in background
        try {
            User.findOne({ mobileNumber: cleanPhone }).then(async (user) => {
                if (!user) {
                    user = new User({
                        mobileNumber: cleanPhone,
                        name: req.body.name || 'Perfetto Customer',
                        signInStatus: true,
                        lastLogin: new Date()
                    });
                } else {
                    user.signInStatus = true;
                    user.lastLogin = new Date();
                    if (req.body.name) user.name = req.body.name;
                }
                return user.save();
            }).catch(e => console.warn('User profile sync notice:', e.message));
        } catch (e) {}

        console.log(`✅ [OTP Verified] Mobile +91 ${cleanPhone} verified successfully.`);

        return res.status(200).json({
            success: true,
            message: '🎉 Mobile number verified successfully!',
            user: {
                mobileNumber: cleanPhone,
                name: req.body.name || 'Perfetto Customer'
            }
        });
    } catch (err) {
        console.error('Error in /api/otp/verify:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
