/**
 * Perfetto Pizza - Google OAuth 2.0 & Role Authentication Controller
 * Handles /api/auth/config, /api/auth/google, /api/auth/google/callback, /api/auth/google/verify
 */

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const https = require('https');
const { connectToDatabase } = require('../lib/mongodb');
const AdminUser = require('../models/AdminUser');
const User = require('../models/User');

const MASTER_ADMIN_EMAIL = (process.env.MASTER_ADMIN_EMAIL || '44website.com44@gmail.com').toLowerCase().trim();
const AUTHORIZED_TEST_CHEF = (process.env.AUTHORIZED_TEST_CHEF || 'abc@gmail.com').toLowerCase().trim();

function getGoogleCredentials() {
    return {
        clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
        clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
        redirectUri: (process.env.GOOGLE_REDIRECT_URI || '').trim(),
    };
}

function getRedirectUri(req, creds) {
    if (creds && creds.redirectUri) {
        const configuredUri = creds.redirectUri.trim();
        const rawHost = req?.headers ? (req.headers['x-forwarded-host'] || req.headers.host || 'perfetto-pizza-plus.vercel.app') : 'perfetto-pizza-plus.vercel.app';
        const host = rawHost.split(',')[0].trim();
        const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

        // If configuredUri points to localhost but we are running in production on Vercel, use production host
        if (!isLocal && configuredUri.includes('localhost')) {
            const protoHeader = req.headers['x-forwarded-proto'];
            const protocol = protoHeader ? protoHeader.split(',')[0].trim() : 'https';
            return `${protocol}://${host}/api/auth/google/callback`;
        }
        return configuredUri;
    }

    const rawHost = req?.headers ? (req.headers['x-forwarded-host'] || req.headers.host || 'perfetto-pizza-plus.vercel.app') : 'perfetto-pizza-plus.vercel.app';
    const host = rawHost.split(',')[0].trim();
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');

    let protocol = 'https';
    if (isLocal) {
        protocol = req?.headers ? (req.headers['x-forwarded-proto'] || 'http') : 'http';
    } else {
        const protoHeader = req?.headers ? req.headers['x-forwarded-proto'] : null;
        protocol = protoHeader ? protoHeader.split(',')[0].trim() : 'https';
    }

    return `${protocol}://${host}/api/auth/google/callback`;
}

function httpsPost(urlStr, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(parsed.error_description || parsed.error || `HTTP ${res.statusCode}: ${body}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function httpsGet(urlStr, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Perfetto-Pizza-Server',
                ...headers,
            },
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(parsed.error_description || parsed.error || `HTTP ${res.statusCode}: ${body}`));
                    }
                } catch (e) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    }
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function resolveUserRoleAndSync(profile, targetHint = '') {
    const email = (profile.email || '').trim().toLowerCase();
    const fullName = profile.name || profile.fullName || (email ? email.split('@')[0] : 'User');
    const photoURL = profile.picture || profile.photoURL || '';
    const firebaseUid = profile.sub || profile.id || profile.firebaseUid || ('g_' + Buffer.from(email).toString('base64').slice(0, 16));

    let role = 'Customer';
    let status = 'active';
    let isMaster = false;

    if (email === MASTER_ADMIN_EMAIL.toLowerCase()) {
        role = 'Master Admin';
        status = 'active';
        isMaster = true;
    } else if (email === AUTHORIZED_TEST_CHEF.toLowerCase()) {
        role = 'Chef';
        status = 'active';
    }

    let db = null;
    try {
        db = await connectToDatabase();
    } catch (e) {
        console.warn('Database connection notice during auth sync:', e.message);
    }

    if (db) {
        try {
            const adminRecord = await AdminUser.findOne({ email }).lean();
            if (adminRecord) {
                role = adminRecord.role || (isMaster ? 'Master Admin' : 'Pending');
                status = adminRecord.status || 'pending';

                await AdminUser.updateOne(
                    { email },
                    {
                        $set: {
                            fullName: fullName || adminRecord.fullName,
                            photoURL: photoURL || adminRecord.photoURL,
                            firebaseUid: firebaseUid || adminRecord.firebaseUid,
                            lastLoginAt: new Date(),
                        },
                    }
                );
            } else if (isMaster) {
                await AdminUser.findOneAndUpdate(
                    { email: MASTER_ADMIN_EMAIL.toLowerCase() },
                    {
                        $set: {
                            email: MASTER_ADMIN_EMAIL.toLowerCase(),
                            fullName,
                            photoURL,
                            firebaseUid,
                            role: 'Master Admin',
                            status: 'active',
                            lastLoginAt: new Date(),
                        },
                        $setOnInsert: {
                            requestedAt: new Date(),
                            approvedAt: new Date(),
                        },
                    },
                    { upsert: true, new: true }
                );
            } else if (role === 'Customer') {
                await User.findOneAndUpdate(
                    { email },
                    {
                        $set: {
                            email,
                            fullName,
                            photoURL,
                            firebaseUid,
                            lastLoginAt: new Date(),
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            }
        } catch (dbErr) {
            console.warn('MongoDB auth sync error:', dbErr.message);
        }
    }

    let destination = '/index.html';
    if (status === 'active' && (role === 'Master Admin' || role === 'Admin')) {
        destination = '/admin.html';
    } else if (status === 'active' && (role === 'Chef' || role === 'Delivery Boy')) {
        destination = '/staff.html';
    } else if (status === 'pending') {
        destination = '/admin.html';
    } else if (targetHint === 'admin') {
        destination = '/admin.html';
    } else if (targetHint === 'staff') {
        destination = '/staff.html';
    } else {
        destination = '/index.html';
    }

    return {
        email,
        fullName,
        photoURL,
        firebaseUid,
        role,
        status,
        destination,
    };
}

async function handleGoogleAuthRequest(req, res, pathname) {
    const creds = getGoogleCredentials();
    const dynamicRedirectUri = getRedirectUri(req, creds);
    const rawPath = (pathname || req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.originalUrl || req.url || '').split('?')[0];
    const cleanPath = rawPath.replace(/\/+$/, '').toLowerCase();
    const expressPath = (req.path || '').replace(/\/+$/, '').toLowerCase();

    // 1. GET /api/auth/config or /auth/config
    const isConfig = cleanPath === '/api/auth/config' ||
                     cleanPath === '/auth/config' ||
                     cleanPath.endsWith('/config') ||
                     expressPath === '/config';

    if (isConfig && req.method === 'GET') {
        return res.status(200).json({
            success: true,
            clientId: creds.clientId,
            redirectUri: dynamicRedirectUri,
        });
    }

    // 2. GET /api/auth/google/callback or /auth/google/callback (Check callback before generic /google)
    const isCallback = cleanPath === '/api/auth/google/callback' ||
                       cleanPath === '/auth/google/callback' ||
                       cleanPath === '/api/auth/callback' ||
                       cleanPath === '/auth/callback' ||
                       cleanPath.endsWith('/callback') ||
                       expressPath === '/google/callback' ||
                       expressPath === '/callback';

    if (isCallback && req.method === 'GET') {
        const code = req.query.code;
        const error = req.query.error;

        let returnTarget = '';
        let initialRedirectUri = dynamicRedirectUri;
        if (req.query.state) {
            try {
                const parsedState = JSON.parse(Buffer.from(req.query.state, 'base64').toString('utf8'));
                if (parsedState.returnUrl) returnTarget = parsedState.returnUrl;
                if (parsedState.redirectUri) initialRedirectUri = parsedState.redirectUri;
            } catch (e) { }
        }

        const errorDest = returnTarget === 'admin' ? '/admin.html' : (returnTarget === 'staff' ? '/staff.html' : '/index.html');

        if (error) {
            console.warn('Google OAuth error from callback:', error);
            return res.redirect(302, `${errorDest}?auth_error=${encodeURIComponent(error)}`);
        }

        if (!code) {
            return res.redirect(302, `${errorDest}?auth_error=missing_code`);
        }

        if (!creds.clientId || !creds.clientSecret) {
            return res.redirect(302, `${errorDest}?auth_error=${encodeURIComponent('Google OAuth credentials not configured on server')}`);
        }

        try {
            const tokenParams = new URLSearchParams({
                code,
                client_id: creds.clientId,
                client_secret: creds.clientSecret,
                redirect_uri: initialRedirectUri || dynamicRedirectUri,
                grant_type: 'authorization_code',
            });

            const tokenData = await httpsPost(
                'https://oauth2.googleapis.com/token',
                tokenParams.toString(),
                { 'Content-Type': 'application/x-www-form-urlencoded' }
            );

            const accessToken = tokenData.access_token;
            if (!accessToken) {
                throw new Error('Failed to retrieve access token from Google');
            }

            const profile = await httpsGet('https://www.googleapis.com/oauth2/v3/userinfo', {
                Authorization: `Bearer ${accessToken}`,
            });

            const userAuth = await resolveUserRoleAndSync(profile, returnTarget);

            const targetParams = new URLSearchParams({
                auth: 'success',
                email: userAuth.email,
                name: userAuth.fullName,
                photo: userAuth.photoURL,
                uid: userAuth.firebaseUid,
                role: userAuth.role,
                status: userAuth.status,
            });

            const redirectUrl = `${userAuth.destination}?${targetParams.toString()}`;
            return res.redirect(302, redirectUrl);
        } catch (err) {
            console.error('Google OAuth callback exchange error:', err);
            return res.redirect(302, `${errorDest}?auth_error=${encodeURIComponent(err.message || 'OAuth error')}`);
        }
    }

    // 3. GET /api/auth/google or /auth/google (Initiate Google OAuth Flow)
    const isGoogleInit = cleanPath === '/api/auth/google' ||
                         cleanPath === '/auth/google' ||
                         cleanPath === '/api/auth' ||
                         cleanPath === '/auth' ||
                         cleanPath.endsWith('/google') ||
                         cleanPath.endsWith('/auth') ||
                         expressPath === '/google' ||
                         expressPath === '/' ||
                         expressPath === '';

    if (isGoogleInit && req.method === 'GET') {
        if (!creds.clientId) {
            return res.status(500).json({
                success: false,
                message: 'GOOGLE_CLIENT_ID is not configured in server environment variables.'
            });
        }

        const returnTarget = req.query.returnUrl || req.query.target || '';
        const state = JSON.stringify({
            returnUrl: returnTarget,
            redirectUri: dynamicRedirectUri,
            ts: Date.now(),
        });
        const encodedState = Buffer.from(state).toString('base64');

        const params = new URLSearchParams({
            client_id: creds.clientId,
            redirect_uri: dynamicRedirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            prompt: 'select_account',
            state: encodedState,
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        return res.redirect(302, authUrl);
    }

    // 4. POST /api/auth/google/verify or /auth/google/verify
    const isVerify = (cleanPath === '/api/auth/google/verify' ||
                      cleanPath === '/auth/google/verify' ||
                      cleanPath === '/api/auth/verify' ||
                      cleanPath === '/auth/verify' ||
                      cleanPath.endsWith('/verify') ||
                      expressPath === '/google/verify' ||
                      expressPath === '/verify') && req.method === 'POST';

    if (isVerify) {
        let body = req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        const idToken = body?.idToken;
        let profile = {
            email: body?.email,
            name: body?.fullName || body?.displayName || body?.name,
            picture: body?.photoURL || body?.picture,
            sub: body?.firebaseUid || body?.uid || body?.sub,
        };

        if (idToken) {
            try {
                const tokenInfo = await httpsGet(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
                if (tokenInfo && tokenInfo.email) {
                    profile.email = tokenInfo.email;
                    profile.name = tokenInfo.name || profile.name;
                    profile.picture = tokenInfo.picture || profile.picture;
                    profile.sub = tokenInfo.sub || profile.sub;
                }
            } catch (vErr) {
                console.warn('ID token verification notice:', vErr.message);
            }
        }

        if (!profile.email) {
            return res.status(400).json({ success: false, message: 'Missing email in verification payload' });
        }

        const userAuth = await resolveUserRoleAndSync(profile);

        return res.status(200).json({
            success: true,
            user: userAuth,
            role: userAuth.role,
            status: userAuth.status,
            redirectUrl: userAuth.destination,
        });
    }

    return res.status(404).json({ success: false, message: `Auth endpoint not found: ${req.method} ${cleanPath}` });
}

module.exports = {
    handleGoogleAuthRequest,
    getGoogleCredentials,
    getRedirectUri
};
