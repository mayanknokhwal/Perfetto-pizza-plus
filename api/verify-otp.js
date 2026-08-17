/**
 * Vercel Serverless Function: Verify MSG91 Voice / Flash Call OTP
 * Route: /api/verify-otp?mobile=...&otp=...
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

    if (req.method !== 'GET') {
        return res.status(405).json({ type: 'error', message: 'Method Not Allowed. Use GET.' });
    }

    try {
        const { mobile, otp } = req.query;

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
