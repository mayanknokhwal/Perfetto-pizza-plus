/**
 * Perfetto Pizza - Local Development & Serverless API Server
 * Handles static assets and serverless API routes (/api/orders, /api/users, /api/payment/*, /api/otp/*, /api/menu, /api/admin-auth)
 * Configured for seamless Localhost operation with Firebase Auth & MongoDB Atlas support.
 */

try {
    require('dotenv').config();
} catch (e) {}

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8080', 10);

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
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json; charset=utf-8',
};

// Mock Next.js / Vercel style req/res for serverless handlers
function adaptServerless(req, res, parsedUrl, handler) {
    const queryObj = {};
    for (const [key, value] of parsedUrl.searchParams.entries()) {
        queryObj[key] = value;
    }
    req.query = queryObj;

    res.status = function (code) {
        res.statusCode = code;
        return res;
    };

    res.json = function (data) {
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-VERIFY, authkey, x-admin-email, x-requester-email, x-user-email, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
            res.end(JSON.stringify(data));
        }
        return res;
    };

    res.send = function (data) {
        if (!res.headersSent) {
            if (typeof data === 'object' && data !== null) {
                return res.json(data);
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
            res.end(String(data));
        }
        return res;
    };

    res.redirect = function (urlOrStatus, targetUrl) {
        const statusCode = typeof urlOrStatus === 'number' ? urlOrStatus : 302;
        const redirectUrl = typeof urlOrStatus === 'string' ? urlOrStatus : targetUrl;
        if (!res.headersSent) {
            res.writeHead(statusCode, {
                Location: redirectUrl,
                'Access-Control-Allow-Origin': '*',
                'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
            });
            res.end();
        }
        return res;
    };

    async function run() {
        try {
            await handler(req, res);
        } catch (err) {
            console.error('API execution error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: err?.message || 'Internal Server Error' });
            }
        }
    }

    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        req.body = {};
        return run();
    }

    let bodyData = '';
    req.on('error', (err) => {
        console.error('Request stream error:', err);
        if (!res.headersSent) {
            res.status(400).json({ success: false, message: 'Request stream error' });
        }
    });

    req.on('data', (chunk) => {
        bodyData += chunk;
        if (bodyData.length > 1e7) { // 10MB safety cap
            req.destroy();
        }
    });

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
    const host = req.headers.host || `localhost:${PORT}`;
    const parsedUrl = new URL(req.url, `http://${host}`);
    let pathname = parsedUrl.pathname || '/';

    // Global CORS & COOP Headers for local popup & communication support
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-VERIFY, authkey, x-admin-email, x-requester-email, x-user-email, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        });
        res.end();
        return;
    }

    // 1. API ROUTES (Handled by Unified Serverless Router api/index.js)
    if (pathname.startsWith('/api/') || pathname === '/api') {
        try {
            const apiHandler = require('./api/index');
            return adaptServerless(req, res, parsedUrl, apiHandler);
        } catch (routeErr) {
            console.error(`Error loading unified API route for ${pathname}:`, routeErr);
            res.writeHead(500, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
            });
            res.end(JSON.stringify({ success: false, message: 'Failed to execute API route' }));
            return;
        }
    }

    // 2. STATIC FILES SERVING & CLEAN URLS
    if (pathname === '/' || pathname === '' || pathname === '/index') {
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
            res.writeHead(404, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
            });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        });

        const readStream = fs.createReadStream(filePath);
        readStream.on('error', (streamErr) => {
            console.error('File stream error:', streamErr);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Internal Server Error');
            }
        });
        readStream.pipe(res);
    });
});

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🍕 Perfetto Pizza Local Dev Server running on Localhost`);
        console.log(`-------------------------------------------------------`);
        console.log(` • Customer App:   http://localhost:${PORT}/index.html`);
        console.log(` • Staff Portal:   http://localhost:${PORT}/staff.html`);
        console.log(` • Admin Panel:    http://localhost:${PORT}/admin.html`);
        console.log(` • API Base:       http://localhost:${PORT}/api/`);
        console.log(`=======================================================`);
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Retrying on port ${PORT + 1}...`);
            server.listen(PORT + 1);
        } else {
            console.error('Server error:', e);
        }
    });
}

module.exports = server;
