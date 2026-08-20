/**
 * Vercel Serverless Function: PhonePe Payment Callback / Webhook Handler
 * Route: /api/payment/callback
 */

if (!process.env.PHONEPE_SALT_KEY) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const crypto = require('crypto');
const { connectToDatabase } = require('../lib/mongodb');
const Order = require('../models/Order');

const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';


module.exports = async function handler(req, res) {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const xVerify = req.headers['x-verify'];

        if (body?.response) {
            const decodedResponse = Buffer.from(body.response, 'base64').toString('utf8');
            const paymentData = JSON.parse(decodedResponse);

            console.log('PhonePe Webhook received:', paymentData);

            const merchantTransactionId = paymentData.data?.merchantTransactionId;
            const isSuccess = paymentData.code === 'PAYMENT_SUCCESS';

            if (merchantTransactionId) {
                const db = await connectToDatabase();
                if (db) {
                    await Order.findOneAndUpdate(
                        { 'paymentDetails.merchantTransactionId': merchantTransactionId },
                        {
                            $set: {
                                paymentStatus: isSuccess ? 'Paid' : 'Failed',
                                paymentMethod: 'PhonePe',
                                'paymentDetails.transactionId': paymentData.data?.transactionId || '',
                                'paymentDetails.providerReferenceId': paymentData.data?.providerReferenceId || '',
                                'paymentDetails.status': isSuccess ? 'COMPLETED' : 'FAILED',
                                'paymentDetails.rawResponse': paymentData,
                            }
                        }
                    );
                }
            }
        }

        return res.status(200).json({ success: true, message: 'Callback processed' });
    } catch (err) {
        console.error('Error handling PhonePe callback:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
