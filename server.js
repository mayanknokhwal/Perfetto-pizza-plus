/**
 * Perfetto Pizza - Local Development & Serverless API Server
 * Handles static assets and serverless API routes (/api/orders, /api/users, /api/payment/*, /api/otp/*)
 */

try {
    require('dotenv').config();
} catch (e) {}

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
};

// Mock Next.js / Vercel style req/res for serverless handlers
function adaptServerless(req, res, handler) {
    const parsedUrl = url.parse(req.url, true);
    req.query = parsedUrl.query;

    res.status = function (code) {
        res.statusCode = code;
        return res;
    };

    res.json = function (data) {
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-VERIFY, authkey');
            res.end(JSON.stringify(data));
        }
        return res;
    };

    async function run() {
        try {
            await handler(req, res);
        } catch (err) {
            console.error('API execution error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
            }
        }
    }

    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        req.body = {};
        return run();
    }

    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
        try {
            req.body = bodyData ? JSON.parse(bodyData) : {};
        } catch (e) {
            req.body = bodyData;
        }
        run();
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Enable CORS for all routes
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-VERIFY, authkey',
        });
        res.end();
        return;
    }

    // 1. API ROUTES
    if (pathname === '/api/menu' || pathname === '/api/menu/') {
        const menuHandler = require('./api/menu');
        return adaptServerless(req, res, menuHandler);
    }

    if (pathname === '/api/orders' || pathname === '/api/orders/') {
        const ordersHandler = require('./api/orders');
        return adaptServerless(req, res, ordersHandler);
    }

    if (pathname === '/api/users' || pathname === '/api/users/') {
        const usersHandler = require('./api/users');
        return adaptServerless(req, res, usersHandler);
    }

    if (pathname === '/api/payment/initiate') {
        const initiateHandler = require('./api/payment/initiate');
        return adaptServerless(req, res, initiateHandler);
    }

    if (pathname === '/api/payment/status') {
        const statusHandler = require('./api/payment/status');
        return adaptServerless(req, res, statusHandler);
    }

    if (pathname === '/api/payment/callback') {
        const callbackHandler = require('./api/payment/callback');
        return adaptServerless(req, res, callbackHandler);
    }

    if (pathname === '/api/send-voice-otp' || pathname === '/api/msg91/send-voice-otp') {
        const otpSendHandler = require('./api/send-voice-otp').default || require('./api/send-voice-otp');
        return adaptServerless(req, res, otpSendHandler);
    }

    if (pathname === '/api/verify-otp' || pathname === '/api/msg91/verify-otp') {
        const otpVerifyHandler = require('./api/verify-otp').default || require('./api/verify-otp');
        return adaptServerless(req, res, otpVerifyHandler);
    }

    // 2. STATIC FILES SERVING & CLEAN URLS
    if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
    } else if (pathname === '/admin' || pathname === '/admin/') {
        pathname = '/admin.html';
    } else if (pathname === '/staff' || pathname === '/staff/') {
        pathname = '/staff.html';
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
        });

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(` Perfetto Pizza Server running at http://localhost:${PORT}`);
        console.log(` - Customer App:   http://localhost:${PORT}/index.html`);
        console.log(` - Staff App:      http://localhost:${PORT}/staff.html`);
        console.log(` - Admin App:      http://localhost:${PORT}/admin.html`);
        console.log(` - API Endpoints:  /api/orders, /api/users, /api/payment/*`);
        console.log(`=======================================================`);
    });
}

module.exports = server;
