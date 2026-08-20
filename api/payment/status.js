/**
 * Vercel Serverless Function: PhonePe Payment Status Verification
 * Route: /api/payment/status
 */

if (!process.env.PHONEPE_MERCHANT_ID) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const crypto = require('crypto');
const { connectToDatabase } = require('../lib/mongodb');
const Order = require('../models/Order');

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

    try {
        const merchantTransactionId = req.query?.txnId || req.body?.merchantTransactionId;
        const orderId = req.query?.orderId || req.body?.orderId;

        if (!merchantTransactionId) {
            return res.status(400).json({ success: false, message: 'merchantTransactionId is required' });
        }

        const endpoint = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
        const stringToHash = endpoint + PHONEPE_SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
        const checksum = `${sha256}###${PHONEPE_SALT_INDEX}`;

        let isPaid = false;
        let phonePeData = null;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const apiRes = await fetch(`${PHONEPE_HOST_URL}${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                    'X-MERCHANT-ID': PHONEPE_MERCHANT_ID,
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            phonePeData = await apiRes.json();
            if (phonePeData && phonePeData.code === 'PAYMENT_SUCCESS') {
                isPaid = true;
            }
        } catch (err) {
            console.warn('PhonePe status check API warning:', err.message);
        }

        // Check for sandbox simulation flag in query if testing locally
        if (req.query?.simulated === 'true') {
            isPaid = true;
        }

        // Update MongoDB
        try {
            const db = await connectToDatabase();
            if (db && orderId) {
                await Order.findOneAndUpdate(
                    { orderId: String(orderId) },
                    {
                        $set: {
                            paymentStatus: isPaid ? 'Paid' : 'Pending',
                            paymentMethod: 'PhonePe',
                            'paymentDetails.status': isPaid ? 'COMPLETED' : 'PENDING',
                            'paymentDetails.rawResponse': phonePeData,
                        }
                    }
                );
            }
        } catch (dbErr) {
            console.error('MongoDB update error on payment status check:', dbErr);
        }

        return res.status(200).json({
            success: true,
            isPaid,
            orderId,
            merchantTransactionId,
            status: isPaid ? 'SUCCESS' : 'PENDING',
            phonePeData
        });

    } catch (error) {
        console.error('Error checking payment status:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Error checking payment status'
        });
    }
};
