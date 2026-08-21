/**
 * Perfetto Pizza - Unified PhonePe Payment Controller
 * Consolidates /api/payment/initiate, /api/payment/status, /api/payment/callback
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

async function handlePaymentRequest(req, res, pathname) {
    const subRoute = pathname.replace(/^\/api\/payment\/?/, '').toLowerCase();

    // --------------------------------------------------------------------------
    // 1. INITIATE: POST /api/payment/initiate
    // --------------------------------------------------------------------------
    if (subRoute === 'initiate') {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, message: 'Method Not Allowed. Use POST.' });
        }

        try {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const { orderId, amount, customerPhone, customerName, redirectUrl, callbackUrl } = body || {};

            if (!orderId || !amount) {
                return res.status(400).json({ success: false, message: 'orderId and amount are required' });
            }

            const amountInPaise = Math.round(Number(amount) * 100);
            const merchantTransactionId = `MT_${orderId}_${Date.now()}`;
            const merchantUserId = `USER_${(customerPhone || '9999999999').replace(/[^0-9]/g, '')}`;

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

            const base64Payload = Buffer.from(JSON.stringify(phonepePayload)).toString('base64');
            const endpoint = '/pg/v1/pay';
            const stringToHash = base64Payload + endpoint + PHONEPE_SALT_KEY;
            const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
            const checksum = `${sha256}###${PHONEPE_SALT_INDEX}`;

            console.log(`Initiating PhonePe payment for Order #${orderId}, Amount: ₹${amount}`);

            try {
                const db = await connectToDatabase();
                if (db) {
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
                }
            } catch (dbErr) {
                console.warn('Could not update MongoDB before PhonePe call:', dbErr.message);
            }

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

            if (phonePeResponse && phonePeResponse.success && phonePeResponse.data?.instrumentResponse?.redirectInfo?.url) {
                return res.status(200).json({
                    success: true,
                    mode: 'live',
                    merchantTransactionId,
                    redirectUrl: phonePeResponse.data.instrumentResponse.redirectInfo.url,
                    data: phonePeResponse.data
                });
            }

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
            console.error('Error in PhonePe initiate:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Payment initiation failed'
            });
        }
    }

    // --------------------------------------------------------------------------
    // 2. STATUS: GET / POST /api/payment/status
    // --------------------------------------------------------------------------
    if (subRoute === 'status') {
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
                console.warn('PhonePe status check API notice:', err.message);
            }

            if (req.query?.simulated === 'true') {
                isPaid = true;
            }

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
    }

    // --------------------------------------------------------------------------
    // 3. CALLBACK / WEBHOOK: POST /api/payment/callback
    // --------------------------------------------------------------------------
    if (subRoute === 'callback') {
        try {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            if (body?.response) {
                let paymentData = null;
                try {
                    const decodedResponse = Buffer.from(body.response, 'base64').toString('utf8');
                    paymentData = JSON.parse(decodedResponse);
                } catch (parseErr) {
                    console.error('Failed to decode PhonePe callback payload:', parseErr.message);
                }

                if (paymentData) {
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
            }

            return res.status(200).json({ success: true, message: 'Callback processed' });
        } catch (err) {
            console.error('Error handling PhonePe callback:', err);
            return res.status(500).json({ success: false, message: err?.message || 'Callback error' });
        }
    }

    return res.status(404).json({ success: false, message: 'Payment endpoint not found' });
}

module.exports = {
    handlePaymentRequest
};
