/**
 * Perfetto Pizza - Unified Serverless API Router (Single Entry Point for Vercel)
 * Consolidates all backend endpoints into 1 Serverless Function to stay under the Vercel Hobby Limit (Max 12)
 */

if (!process.env.MONGODB_URI) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const { handleMenuRequest } = require('./controllers/menuController');
const { handleOrdersRequest } = require('./controllers/ordersController');
const { handleUsersRequest } = require('./controllers/usersController');
const { handleAdminAuthRequest } = require('./controllers/adminAuthController');
const { handleGoogleAuthRequest } = require('./controllers/authGoogleController');
const { handlePaymentRequest } = require('./controllers/paymentController');
const { handleOtpRequest } = require('./controllers/otpController');

module.exports = async function handler(req, res) {
    // 1. Set Global CORS & Cross-Origin Headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-VERIFY, authkey, x-admin-email, x-requester-email, x-user-email'
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

    // 2. Immediate Preflight OPTIONS Handling
    if (req.method === 'OPTIONS') {
        if (typeof res.status === 'function') {
            return res.status(200).end();
        }
        res.writeHead(204);
        return res.end();
    }

    // 3. Resolve Clean Pathname & Query Params
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:8080';
    const parsedUrl = new URL(req.url, `http://${host}`);
    let pathname = parsedUrl.pathname || '/';

    // Normalize trailing slashes (e.g. /api/menu/ -> /api/menu)
    if (pathname.endsWith('/') && pathname.length > 1) {
        pathname = pathname.slice(0, -1);
    }

    // Ensure query object is populated
    if (!req.query) {
        const queryObj = {};
        for (const [key, value] of parsedUrl.searchParams.entries()) {
            queryObj[key] = value;
        }
        req.query = queryObj;
    }

    // Parse body if coming as string or buffer
    if (typeof req.body === 'string' && req.body.length > 0) {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            // keep raw string if not JSON
        }
    }

    try {
        // ----------------------------------------------------------------------
        // ROUTE DISPATCHER
        // ----------------------------------------------------------------------

        // A. Menu API: /api/menu
        if (pathname === '/api/menu') {
            return await handleMenuRequest(req, res);
        }

        // B. Orders API: /api/orders
        if (pathname === '/api/orders') {
            return await handleOrdersRequest(req, res);
        }

        // C. Users API: /api/users
        if (pathname === '/api/users') {
            return await handleUsersRequest(req, res);
        }

        // D. Admin Auth & Team API: /api/admin-auth
        if (pathname === '/api/admin-auth') {
            return await handleAdminAuthRequest(req, res);
        }

        // E. Google Auth API: /api/auth/config, /api/auth/google, /api/auth/google/callback, /api/auth/google/verify
        if (pathname.startsWith('/api/auth')) {
            return await handleGoogleAuthRequest(req, res, pathname);
        }

        // F. PhonePe Payment API: /api/payment/initiate, /api/payment/status, /api/payment/callback
        if (pathname.startsWith('/api/payment')) {
            return await handlePaymentRequest(req, res, pathname);
        }

        // G. MSG91 OTP API: /api/send-voice-otp, /api/verify-otp, /api/msg91/*
        if (
            pathname.includes('send-voice-otp') ||
            pathname.includes('verify-otp') ||
            pathname.startsWith('/api/msg91')
        ) {
            return await handleOtpRequest(req, res, pathname);
        }

        // 404 for unknown endpoints
        return res.status(404).json({
            success: false,
            message: `Endpoint not found: ${pathname}`
        });

    } catch (err) {
        console.error(`Error handling ${req.method} ${pathname}:`, err);
        return res.status(500).json({
            success: false,
            message: err.message || 'Internal Server Error'
        });
    }
};
