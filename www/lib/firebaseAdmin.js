/**
 * Perfetto Pizza - Firebase Admin SDK & Cloud Messaging (FCM) Service
 * Initialized with serviceAccountKey.json for Server-side Push Notifications & Admin Firestore Access.
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

let firebaseAdminApp = null;

/**
 * Initializes the Firebase Admin SDK singleton.
 * Prioritizes process.env.FIREBASE_SERVICE_ACCOUNT for serverless Vercel deployments,
 * with fallback to local serviceAccountKey.json and individual environment variables.
 */
function initFirebaseAdmin() {
    if (firebaseAdminApp) {
        return firebaseAdminApp;
    }

    const apps = getApps();
    if (apps && apps.length > 0) {
        firebaseAdminApp = apps[0];
        return firebaseAdminApp;
    }

    try {
        // 1. Primary: Check process.env.FIREBASE_SERVICE_ACCOUNT (or FIREBASE_SERVICE_ACCOUNT_JSON)
        const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.SERVICE_ACCOUNT_KEY;
        if (envServiceAccount) {
            let parsedAccount = null;
            if (typeof envServiceAccount === 'object') {
                parsedAccount = envServiceAccount;
            } else {
                let cleanStr = String(envServiceAccount).trim();
                if (!cleanStr.startsWith('{')) {
                    try {
                        cleanStr = Buffer.from(cleanStr, 'base64').toString('utf8');
                    } catch (e) { }
                }
                try {
                    parsedAccount = JSON.parse(cleanStr);
                } catch (e) {
                    try {
                        cleanStr = cleanStr.replace(/\\n/g, '\n');
                        parsedAccount = JSON.parse(cleanStr);
                    } catch (parseErr) {
                        console.warn('⚠️ [Firebase Admin] Error parsing FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
                    }
                }
            }

            if (parsedAccount) {
                if (parsedAccount.private_key) {
                    parsedAccount.private_key = parsedAccount.private_key.replace(/\\n/g, '\n');
                }
                firebaseAdminApp = initializeApp({
                    credential: cert(parsedAccount)
                });
                console.log(`✅ [Firebase Admin] Initialized successfully from FIREBASE_SERVICE_ACCOUNT env (Project: ${parsedAccount.project_id || 'N/A'})`);
                return firebaseAdminApp;
            }
        }

        // 2. Fallback: Check local serviceAccountKey.json file if env variable is absent
        const candidatePaths = [
            path.resolve(process.cwd(), 'serviceAccountKey.json'),
            path.resolve(__dirname, '../serviceAccountKey.json'),
            path.resolve(__dirname, 'serviceAccountKey.json'),
            path.resolve(process.cwd(), 'serviceAccountKey.json.json'),
        ];

        let resolvedKeyPath = null;
        for (const p of candidatePaths) {
            if (fs.existsSync(p)) {
                resolvedKeyPath = p;
                break;
            }
        }

        if (resolvedKeyPath) {
            const serviceAccount = JSON.parse(fs.readFileSync(resolvedKeyPath, 'utf8'));
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
            firebaseAdminApp = initializeApp({
                credential: cert(serviceAccount)
            });
            console.log(`✅ [Firebase Admin] Initialized successfully with ${path.basename(resolvedKeyPath)} (Project: ${serviceAccount.project_id || 'N/A'})`);
            return firebaseAdminApp;
        }

        // 3. Fallback: Individual environment variables
        if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            firebaseAdminApp = initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID || 'website-fa79c',
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                })
            });
            console.log('✅ [Firebase Admin] Initialized successfully from individual environment variables');
            return firebaseAdminApp;
        }

        console.warn('⚠️ [Firebase Admin] Neither FIREBASE_SERVICE_ACCOUNT env nor serviceAccountKey.json found. Push notifications will operate in fallback mode.');
    } catch (err) {
        console.error('❌ [Firebase Admin] Initialization notice (handled gracefully):', err.message);
    }

    return firebaseAdminApp;
}

// Auto-initialize on import
initFirebaseAdmin();

/**
 * Helper function: sendOrderNotificationToStaff(orderData)
 * Fetches all device tokens from the Firestore collection 'staff_tokens' (and 'staff_fcm_tokens')
 * and sends a high-priority pure data FCM message to all active staff devices.
 *
 * @param {Object} orderData - The order document payload
 * @returns {Promise<Object>} Result summary with successCount and failureCount
 */
async function sendOrderNotificationToStaff(orderData = {}) {
    const app = initFirebaseAdmin();
    if (!app) {
        console.warn('⚠️ [FCM Trigger] Firebase Admin not initialized. Cannot send push notification.');
        return { success: false, reason: 'Firebase Admin not initialized' };
    }

    try {
        const db = getFirestore(app);
        const messaging = getMessaging(app);
        const tokensSet = new Set();

        // 1. Fetch all tokens from Firestore collection 'staff_tokens'
        try {
            const staffTokensSnap = await db.collection('staff_tokens').get();
            staffTokensSnap.forEach(doc => {
                const data = doc.data() || {};
                const token = data.token || data.fcmToken || data.deviceToken || (typeof data === 'string' ? data : null) || (doc.id.length > 30 ? doc.id : null);
                if (token && typeof token === 'string' && token.length > 20 && !token.includes(' ') && !token.startsWith('+')) {
                    tokensSet.add(token.trim());
                } else if (data.token && typeof data.token === 'string' && data.token.length > 20) {
                    tokensSet.add(data.token.trim());
                }
            });
            console.log(`🔍 [FCM Trigger] Checked 'staff_tokens' collection (${staffTokensSnap.size} doc(s) found, ${tokensSet.size} unique token(s))`);
        } catch (e) {
            console.warn('⚠️ [FCM Trigger] Notice fetching from staff_tokens:', e.message);
        }

        // 2. Also check 'staff_fcm_tokens' collection to support legacy/fallback records
        try {
            const staffFcmSnap = await db.collection('staff_fcm_tokens').get();
            staffFcmSnap.forEach(doc => {
                const data = doc.data() || {};
                const token = data.fcmToken || data.token || data.deviceToken;
                if (token && typeof token === 'string' && token.length > 20 && !token.includes(' ') && !token.startsWith('+')) {
                    tokensSet.add(token.trim());
                }
            });
        } catch (e) { }

        const tokens = Array.from(tokensSet);

        if (tokens.length === 0) {
            console.log('ℹ️ [FCM Trigger] No staff device tokens registered in Firestore. Skipping notification broadcast.');
            return { success: true, count: 0, message: 'No registered tokens found' };
        }

        console.log(`📡 [FCM Trigger] Broadcasting high-priority data-only order alert to ${tokens.length} staff device(s)...`);

        const orderIdStr = String(orderData.id || orderData.orderId || '');
        const customerNameStr = String(orderData.customerName || orderData.customer?.name || 'Customer');
        const totalAmountStr = String(orderData.totalAmount || orderData.total || orderData.costs?.total || '0');

        // Pure High-Priority Data-Only FCM Message (forces onMessageReceived to execute in killed state)
        const payload = {
            data: {
                type: 'NEW_ORDER_CALL',
                orderId: orderIdStr,
                customerName: customerNameStr,
                totalAmount: totalAmountStr,
                sound: 'order_alert',
                channelId: 'orders_channel_v1'
            },
            android: {
                priority: 'high'
            },
            tokens: tokens
        };

        let response;
        if (typeof messaging.sendEachForMulticast === 'function') {
            response = await messaging.sendEachForMulticast(payload);
        } else if (typeof messaging.sendMulticast === 'function') {
            response = await messaging.sendMulticast(payload);
        } else {
            // Fallback to sending individually
            const results = await Promise.allSettled(tokens.map(token => {
                return messaging.send({
                    data: payload.data,
                    android: payload.android,
                    token: token
                });
            }));
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            const failureCount = results.length - successCount;
            response = { successCount, failureCount, responses: results };
        }

        console.log(`✅ [FCM Trigger] Data-only Push Notification Broadcast Complete: ${response.successCount} succeeded, ${response.failureCount} failed.`);
        return {
            success: true,
            count: tokens.length,
            successCount: response.successCount,
            failureCount: response.failureCount
        };
    } catch (err) {
        console.error('❌ [FCM Trigger] Failed to broadcast FCM notifications:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    initFirebaseAdmin,
    sendOrderNotificationToStaff,
};
