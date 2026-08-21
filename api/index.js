/**
 * Perfetto Pizza - Single Express Serverless Entrypoint (Vercel)
 * Consolidates all backend routes into 1 Express Serverless Function to stay under the Vercel Hobby Limit
 */

if (!process.env.MONGODB_URI) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const express = require('express');
const cors = require('cors');

const { handleMenuRequest } = require('../controllers/menuController');
const { handleOrdersRequest } = require('../controllers/ordersController');
const { handleUsersRequest } = require('../controllers/usersController');
const { handleAdminAuthRequest } = require('../controllers/adminAuthController');
const { handleGoogleAuthRequest } = require('../controllers/authGoogleController');
const { handlePaymentRequest } = require('../controllers/paymentController');
const { handleOtpRequest } = require('../controllers/otpController');

const app = express();

// Global CORS & Cross-Origin Headers
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-VERIFY',
        'authkey',
        'x-admin-email',
        'x-requester-email',
        'x-user-email',
        'X-CSRF-Token',
        'Accept',
        'Accept-Version',
        'Content-Length',
        'Content-MD5',
        'Date',
        'X-Api-Version'
    ],
    credentials: true,
}));

app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

// JSON & URL-Encoded Body Parsers with 10MB limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 1. Menu API: /api/menu
app.use(['/api/menu', '/menu'], (req, res) => handleMenuRequest(req, res));

// 2. Orders API: /api/orders
app.use(['/api/orders', '/orders'], (req, res) => handleOrdersRequest(req, res));

// 3. Users API: /api/users
app.use(['/api/users', '/users'], (req, res) => handleUsersRequest(req, res));

// 4. Admin Auth & Team API: /api/admin-auth
app.use(['/api/admin-auth', '/admin-auth'], (req, res) => handleAdminAuthRequest(req, res));

// 5. Google Auth API: /api/auth, /auth, /api/auth/google, /auth/google, etc.
app.all([
    '/api/auth/config', '/auth/config',
    '/api/auth/google', '/auth/google',
    '/api/auth/google/callback', '/auth/google/callback',
    '/api/auth/callback', '/auth/callback',
    '/api/auth/google/verify', '/auth/google/verify',
    '/api/auth/verify', '/auth/verify',
    '/api/auth', '/auth'
], (req, res) => {
    const rawPath = (req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.originalUrl || req.url || '').split('?')[0];
    return handleGoogleAuthRequest(req, res, rawPath);
});

app.use(['/api/auth', '/auth'], (req, res) => {
    const rawPath = (req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.originalUrl || req.url || '').split('?')[0];
    return handleGoogleAuthRequest(req, res, rawPath);
});

// 6. PhonePe Payment API: /api/payment
app.use(['/api/payment', '/payment'], (req, res) => {
    const rawPath = (req.originalUrl || req.url || '').split('?')[0];
    return handlePaymentRequest(req, res, rawPath);
});

// 7. MSG91 OTP API: /api/send-voice-otp, /api/verify-otp, /api/msg91
app.use([
    '/api/send-voice-otp', '/send-voice-otp',
    '/api/verify-otp', '/verify-otp',
    '/api/msg91', '/msg91'
], (req, res) => {
    const rawPath = (req.originalUrl || req.url || '').split('?')[0];
    return handleOtpRequest(req, res, rawPath);
});

// 404 Handler for undefined API routes
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint not found: ${req.method} ${req.originalUrl || req.url}`
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Express Serverless Error:', err);
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            message: err.message || 'Internal Server Error'
        });
    }
});

module.exports = app;
