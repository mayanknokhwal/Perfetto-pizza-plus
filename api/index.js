/**
 * Perfetto Pizza - Single Express Serverless Entrypoint (Vercel)
 * Consolidates backend routes into 1 Express Serverless Function to stay under the Vercel Hobby Limit.
 * Fully equipped with live Vercel request logging, URL path recovery, and dynamic route dispatching.
 */

require('../lib/globalStores');
try {
    require('../lib/firebaseAdmin');
} catch (e) { }

const express = require('express');
const cors = require('cors');

const { handleMenuRequest } = require('../controllers/menuController');
const { handleOrdersRequest } = require('../controllers/ordersController');
const { handleUsersRequest } = require('../controllers/usersController');
const { handleSettingsRequest } = require('../controllers/settingsController');
const { handleAdminAuthRequest } = require('../controllers/adminAuthController');
const { handlePaymentRequest } = require('../controllers/paymentController');
const { handleOtpRequest } = require('../controllers/otpController');

const app = express();

// --------------------------------------------------------------------------
// 1. GLOBAL CORS & CROSS-ORIGIN HEADERS
// --------------------------------------------------------------------------
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-VERIFY',
        'authkey',
        'x-admin-phone',
        'x-requester-phone',
        'x-user-phone',
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

// --------------------------------------------------------------------------
// 2. LIVE REQUEST LOGGER FOR VERCEL LOGS
// --------------------------------------------------------------------------
app.use((req, res, next) => {
    const start = Date.now();
    const clientIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const effectivePath = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'] || req.originalUrl || req.url;

    console.log(`📡 [VERCEL LIVE INCOMING] ${req.method} ${effectivePath} (IP: ${clientIp})`);

    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusEmoji = res.statusCode < 400 ? '✅' : res.statusCode < 500 ? '⚠️' : '❌';
        console.log(`${statusEmoji} [VERCEL LIVE COMPLETED] ${req.method} ${effectivePath} -> HTTP ${res.statusCode} (${duration}ms)`);
    });

    next();
});

// --------------------------------------------------------------------------
// 3. BODY PARSERS
// --------------------------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --------------------------------------------------------------------------
// 4. URL PATH RECOVERY & NORMALIZATION MIDDLEWARE
// --------------------------------------------------------------------------
app.use((req, res, next) => {
    let targetPath = '';

    if (req.headers['x-forwarded-uri']) {
        targetPath = req.headers['x-forwarded-uri'];
    } else if (req.headers['x-vercel-matched-path'] && !req.headers['x-vercel-matched-path'].includes('api/index')) {
        targetPath = req.headers['x-vercel-matched-path'];
    } else if (req.headers['x-matched-path'] && !req.headers['x-matched-path'].includes('api/index')) {
        targetPath = req.headers['x-matched-path'];
    } else if (req.headers['x-invoke-path'] && !req.headers['x-invoke-path'].includes('api/index')) {
        targetPath = req.headers['x-invoke-path'];
    } else if (req.originalUrl && !req.originalUrl.startsWith('/api/index') && req.originalUrl !== '/') {
        targetPath = req.originalUrl;
    } else if (req.url && !req.url.startsWith('/api/index') && req.url !== '/' && req.url !== '/index.js') {
        targetPath = req.url;
    }

    if (targetPath) {
        const queryIndex = targetPath.indexOf('?');
        const queryFromTarget = queryIndex !== -1 ? targetPath.slice(queryIndex) : '';
        const cleanPath = targetPath.split('?')[0];
        const queryFromUrl = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        const effectiveQuery = queryFromTarget || queryFromUrl;
        req.url = cleanPath + effectiveQuery;
    }

    // Ensure req.query is properly populated if URL contains query string
    if (req.url.includes('?')) {
        try {
            const qs = req.url.split('?')[1];
            if (qs) {
                const searchParams = new URLSearchParams(qs);
                req.query = { ...req.query, ...Object.fromEntries(searchParams.entries()) };
            }
        } catch (e) { }
    }

    next();
});

// --------------------------------------------------------------------------
// 5. EXPLICIT ROUTE HANDLERS & WILDCARDS
// --------------------------------------------------------------------------

// 1. Menu API: /api/menu, /menu
app.all(['/api/menu', '/menu'], (req, res) => handleMenuRequest(req, res));

// 2. Orders API: /api/orders, /orders, /api/orders/*, /orders/*
app.all(['/api/orders', '/orders', '/api/orders/*', '/orders/*'], (req, res) => handleOrdersRequest(req, res));

// 3. Customer Users API: /api/users, /users
app.all(['/api/users', '/users'], (req, res) => handleUsersRequest(req, res));

// 4. Store Settings API: /api/settings, /settings
app.all(['/api/settings', '/settings'], (req, res) => handleSettingsRequest(req, res));

// 5. Admin & Staff Auth & Team API: /api/admin-auth, /admin-auth, /api/admin, /api/team, /team
app.all(['/api/admin-auth', '/admin-auth', '/api/admin', '/api/team', '/team'], (req, res) => handleAdminAuthRequest(req, res));

// 6. PhonePe Payment API: /api/payment/*
app.all(['/api/payment/initiate', '/payment/initiate'], (req, res) => handlePaymentRequest(req, res, '/api/payment/initiate'));
app.all(['/api/payment/status', '/payment/status'], (req, res) => handlePaymentRequest(req, res, '/api/payment/status'));
app.all(['/api/payment/callback', '/payment/callback'], (req, res) => handlePaymentRequest(req, res, '/api/payment/callback'));
app.all(['/api/payment', '/payment'], (req, res) => handlePaymentRequest(req, res, '/api/payment'));

// 7. MSG91 OTP API: /api/send-voice-otp, /api/verify-otp, /api/msg91
app.all(['/api/send-voice-otp', '/send-voice-otp'], (req, res) => handleOtpRequest(req, res, '/api/send-voice-otp'));
app.all(['/api/verify-otp', '/verify-otp'], (req, res) => handleOtpRequest(req, res, '/api/verify-otp'));
app.all(['/api/msg91', '/msg91'], (req, res) => handleOtpRequest(req, res, '/api/msg91'));

// 8. Resilient Dynamic Fallback Route Dispatcher
app.use((req, res, next) => {
    const rawUrl = (req.headers['x-forwarded-uri'] || req.originalUrl || req.url || '').toLowerCase();
    
    if (rawUrl.includes('admin-auth') || rawUrl.includes('/team') || rawUrl.includes('/admin')) {
        return handleAdminAuthRequest(req, res);
    }
    if (rawUrl.includes('/menu')) {
        return handleMenuRequest(req, res);
    }
    if (rawUrl.includes('/orders')) {
        return handleOrdersRequest(req, res);
    }
    if (rawUrl.includes('/users')) {
        return handleUsersRequest(req, res);
    }
    if (rawUrl.includes('/settings')) {
        return handleSettingsRequest(req, res);
    }
    if (rawUrl.includes('/payment')) {
        return handlePaymentRequest(req, res, req.url);
    }
    if (rawUrl.includes('/send-voice-otp') || rawUrl.includes('/verify-otp') || rawUrl.includes('/msg91')) {
        return handleOtpRequest(req, res, req.url);
    }
    next();
});

// --------------------------------------------------------------------------
// 6. 404 HANDLER FOR UNDEFINED API ROUTES
// --------------------------------------------------------------------------
app.use((req, res) => {
    const targetUrl = req.headers['x-forwarded-uri'] || req.headers['x-matched-path'] || req.originalUrl || req.url;
    console.warn(`⚠️ [404 NOT FOUND] ${req.method} ${targetUrl}`);
    res.status(404).json({
        success: false,
        message: `Endpoint not found: ${req.method} ${targetUrl}`
    });
});

// --------------------------------------------------------------------------
// 7. GLOBAL ERROR HANDLER
// --------------------------------------------------------------------------
app.use((err, req, res, next) => {
    console.error('❌ Express Serverless Error:', err);
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            message: err.message || 'Internal Server Error'
        });
    }
});

module.exports = app;

