/**
 * Vercel Serverless Function: Send MSG91 Voice / Flash Call OTP
 * Route: /api/send-voice-otp
 */

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || '561143ADQBWRQ2O6a818769P1';

export default async function handler(req, res) {
    // Enable CORS for Vercel deployment
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, authkey'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ type: 'error', message: 'Method Not Allowed. Use POST.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const mobile = body?.mobile;

        if (!mobile) {
            return res.status(400).json({ type: 'error', message: 'Missing mobile number.' });
        }

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
