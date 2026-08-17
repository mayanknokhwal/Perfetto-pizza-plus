/**
 * Optional Node.js / Express Proxy Server for MSG91 Voice / Flash Call API
 * Use if client-side browser requests encounter strict CORS restrictions on direct MSG91 endpoints.
 * 
 * Usage:
 *   node server.js
 */

const http = require('http');
const https = require('https');
const url = require('url');

const MSG91_AUTH_KEY = '561143ADQBWRQ2O6a818769P1';
const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, authkey'
    });
    res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, authkey'
        });
        res.end();
        return;
    }

    // 1. Send Voice OTP Proxy
    if (req.method === 'POST' && parsedUrl.pathname === '/api/msg91/send-voice-otp') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body || '{}');
                const mobile = parsed.mobile;
                if (!mobile) {
                    return sendJson(res, 400, { type: 'error', message: 'Mobile number is required' });
                }

                const postData = JSON.stringify({ mobile });
                const options = {
                    hostname: 'api.msg91.com',
                    path: '/api/v5/otp/voice',
                    method: 'POST',
                    headers: {
                        'authkey': MSG91_AUTH_KEY,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };

                const msg91Req = https.request(options, msg91Res => {
                    let responseData = '';
                    msg91Res.on('data', chunk => { responseData += chunk; });
                    msg91Res.on('end', () => {
                        try {
                            const json = JSON.parse(responseData);
                            sendJson(res, msg91Res.statusCode || 200, json);
                        } catch (e) {
                            sendJson(res, 200, { type: 'success', raw: responseData });
                        }
                    });
                });

                msg91Req.on('error', err => {
                    sendJson(res, 500, { type: 'error', message: err.message });
                });

                msg91Req.write(postData);
                msg91Req.end();
            } catch (e) {
                sendJson(res, 400, { type: 'error', message: 'Invalid JSON payload' });
            }
        });
        return;
    }

    // 2. Verify OTP Proxy
    if ((req.method === 'GET' || req.method === 'POST') && parsedUrl.pathname === '/api/msg91/verify-otp') {
        const mobile = parsedUrl.query.mobile;
        const otp = parsedUrl.query.otp;

        if (!mobile || !otp) {
            return sendJson(res, 400, { type: 'error', message: 'Both mobile and otp params are required' });
        }

        const verifyPath = `/api/v5/otp/verify?authkey=${encodeURIComponent(MSG91_AUTH_KEY)}&mobile=${encodeURIComponent(mobile)}&otp=${encodeURIComponent(otp)}`;

        const options = {
            hostname: 'api.msg91.com',
            path: verifyPath,
            method: 'GET'
        };

        const msg91Req = https.request(options, msg91Res => {
            let responseData = '';
            msg91Res.on('data', chunk => { responseData += chunk; });
            msg91Res.on('end', () => {
                try {
                    const json = JSON.parse(responseData);
                    sendJson(res, msg91Res.statusCode || 200, json);
                } catch (e) {
                    sendJson(res, 200, { type: 'success', raw: responseData });
                }
            });
        });

        msg91Req.on('error', err => {
            sendJson(res, 500, { type: 'error', message: err.message });
        });

        msg91Req.end();
        return;
    }

    // Not found
    sendJson(res, 404, { type: 'error', message: 'Endpoint not found' });
});

module.exports = server;

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`MSG91 Voice OTP Proxy Server running on port ${PORT}`);
    });
}
