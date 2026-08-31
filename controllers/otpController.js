/**
 * Perfetto Pizza - Unified OTP Controller (MSG91 Voice / Flash Call OTP)
 * Consolidates /api/send-voice-otp and /api/verify-otp
 */

if (!process.env.MSG91_AUTH_KEY) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '';

async function handleOtpRequest(req, res, pathname = '') {
    if (!MSG91_AUTH_KEY) {
        return res.status(500).json({
            type: 'error',
            message: 'MSG91_AUTH_KEY is not configured in server environment variables.'
        });
    }

    const cleanPath = (pathname || req.path || '').toLowerCase();

    // --------------------------------------------------------------------------
    // 1. SEND VOICE OTP: POST /api/send-voice-otp or /api/msg91/send-voice-otp
    // --------------------------------------------------------------------------
    if (cleanPath.includes('send-voice-otp')) {
        if (req.method !== 'POST') {
            return res.status(405).json({ type: 'error', message: 'Method Not Allowed. Use POST.' });
        }

        try {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const mobile = body?.mobile;

            if (!mobile) {
                return res.status(400).json({ type: 'error', message: 'Missing mobile number.' });
            }

            const cleanMobile = String(mobile).replace(/[^0-9]/g, '').slice(-10);
            try {
                const { getFirestoreDoc } = require('../lib/firestore');
                const teamMember = await getFirestoreDoc('team', cleanMobile);
                if (teamMember && (teamMember.status === 'blocked' || teamMember.status === 'rejected')) {
                    return res.status(403).json({
                        type: 'error',
                        isBlocked: true,
                        message: 'This number is blocked. Please contact the Admin.'
                    });
                }
            } catch (fsErr) { }

            const msg91Response = await fetch('https://api.msg91.com/api/v5/otp/voice', {
                method: 'POST',
                headers: {
                    'authkey': MSG91_AUTH_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mobile: String(mobile)
                })
            });

            const data = await msg91Response.json();
            return res.status(msg91Response.status).json(data);
        } catch (error) {
            console.error('Error sending voice OTP via MSG91:', error);
            return res.status(500).json({
                type: 'error',
                message: error.message || 'Internal Server Error while communicating with MSG91'
            });
        }
    }

    // --------------------------------------------------------------------------
    // 2. VERIFY OTP: GET or POST /api/verify-otp or /api/msg91/verify-otp
    // --------------------------------------------------------------------------
    if (cleanPath.includes('verify-otp')) {
        if (req.method !== 'GET' && req.method !== 'POST') {
            return res.status(405).json({ type: 'error', message: 'Method Not Allowed. Use GET or POST.' });
        }

        try {
            let body = req.body || {};
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const mobile = req.query?.mobile || body?.mobile;
            const otp = req.query?.otp || body?.otp;

            if (!mobile || !otp) {
                return res.status(400).json({ type: 'error', message: 'Both mobile and otp parameters are required.' });
            }

            const verifyUrl = `https://api.msg91.com/api/v5/otp/verify?authkey=${encodeURIComponent(MSG91_AUTH_KEY)}&mobile=${encodeURIComponent(mobile)}&otp=${encodeURIComponent(otp)}`;

            const msg91Response = await fetch(verifyUrl, {
                method: 'GET'
            });

            const data = await msg91Response.json();
            return res.status(msg91Response.status).json(data);
        } catch (error) {
            console.error('Error verifying OTP with MSG91:', error);
            return res.status(500).json({
                type: 'error',
                message: error.message || 'Internal Server Error while verifying with MSG91'
            });
        }
    }

    return res.status(404).json({ type: 'error', message: 'OTP endpoint not found' });
}

module.exports = {
    handleOtpRequest
};
