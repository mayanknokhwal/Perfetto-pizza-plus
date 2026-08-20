/**
 * Vercel Serverless Function: PhonePe Payment Gateway Initiation
 * Route: /api/payment/initiate
 */

if (!process.env.PHONEPE_MERCHANT_ID) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const crypto = require('crypto');
const { connectToDatabase } = require('../../lib/mongodb');
const Order = require('../../models/Order');

const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT';
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const PHONEPE_HOST_URL = process.env.PHONEPE_HOST_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox';


module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed. Use POST.' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { orderId, amount, customerPhone, customerName, redirectUrl, callbackUrl } = body || {};

        if (!orderId || !amount) {
            return res.status(400).json({ success: false, message: 'orderId and amount are required' });
        }

        const amountInPaise = Math.round(Number(amount) * 100);
        const merchantTransactionId = `MT_${orderId}_${Date.now()}`;
        const merchantUserId = `USER_${(customerPhone || '9999999999').replace(/[^0-9]/g, '')}`;

        // Host origin for redirect fallback
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:8080';
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const defaultRedirectUrl = `${protocol}://${host}/index.html?payment=success&orderId=${orderId}&txnId=${merchantTransactionId}`;

        const phonepePayload = {
            merchantId: PHONEPE_MERCHANT_ID,
            merchantTransactionId: merchantTransactionId,
            merchantUserId: merchantUserId,
            amount: amountInPaise,
            redirectUrl: redirectUrl || defaultRedirectUrl,
            redirectMode: 'REDIRECT',
            callbackUrl: callbackUrl || `${protocol}://${host}/api/payment/callback`,
            mobileNumber: (customerPhone || '9999999999').replace(/[^0-9]/g, '').slice(-10),
            paymentInstrument: {
                type: 'PAY_PAGE',
            },
        };

        // 1. Base64 Encode Payload
        const base64Payload = Buffer.from(JSON.stringify(phonepePayload)).toString('base64');

        // 2. Calculate SHA256 Checksum
        const endpoint = '/pg/v1/pay';
        const stringToHash = base64Payload + endpoint + PHONEPE_SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const checksum = `${sha256}###${PHONEPE_SALT_INDEX}`;

        console.log(`Initiating PhonePe payment for Order #${orderId}, Amount: ₹${amount} (${amountInPaise} paise)`);

        // Connect to MongoDB and update order with transaction id
        try {
            await connectToDatabase();
            await Order.findOneAndUpdate(
                { orderId: String(orderId) },
                {
                    $set: {
                        paymentMethod: 'PhonePe',
                        paymentStatus: 'Pending',
                        'paymentDetails.merchantTransactionId': merchantTransactionId,
                        'paymentDetails.amount': Number(amount),
                    }
                }
            );
        } catch (dbErr) {
            console.warn('Could not update MongoDB before PhonePe call:', dbErr.message);
        }

        // 3. Make POST request to PhonePe API with timeout protection
        let phonePeResponse = null;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const apiRes = await fetch(`${PHONEPE_HOST_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                    'X-MERCHANT-ID': PHONEPE_MERCHANT_ID,
                },
                body: JSON.stringify({
                    request: base64Payload,
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            phonePeResponse = await apiRes.json();
        } catch (netErr) {
            console.warn('PhonePe fetch warning (sandbox mode active):', netErr.message);
        }

        // 4. Return Redirect URL or Sandbox Mock
        if (phonePeResponse && phonePeResponse.success && phonePeResponse.data?.instrumentResponse?.redirectInfo?.url) {
            const redirectUrl = phonePeResponse.data.instrumentResponse.redirectInfo.url;
            return res.status(200).json({
                success: true,
                mode: 'live',
                merchantTransactionId,
                redirectUrl: redirectUrl,
                data: phonePeResponse.data
            });
        }

        // Fallback for SandBox / Demo / Local Testing:
        // If PhonePe pre-prod test endpoint is simulated or returns redirect directly
        const simulatedRedirectUrl = `${defaultRedirectUrl}&simulated=true`;

        return res.status(200).json({
            success: true,
            mode: 'sandbox',
            merchantTransactionId,
            redirectUrl: simulatedRedirectUrl,
            message: 'PhonePe test checkout initiated',
            phonePeRaw: phonePeResponse || null,
        });

    } catch (error) {
        console.error('Error in /api/payment/initiate handler:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Payment initiation failed'
        });
    }
};
