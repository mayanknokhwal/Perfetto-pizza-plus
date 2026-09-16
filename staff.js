// --------------------------------------------------------------------------
// PERFETTO PIZZA - MOBILE STAFF PORTAL LOGIC (CHEF ROLE ONLY)
// --------------------------------------------------------------------------

const API_BASE_URL = (typeof window !== 'undefined' && (window.PERFETTO_API_BASE_URL || window.API_BASE_URL)) || '/api';

function resolveApiUrl(path) {
    if (!path) return API_BASE_URL;
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    if (cleanPath.startsWith('/api')) {
        if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && window.location.protocol !== 'file:') {
            return `${window.location.origin}${cleanPath}`;
        }
        return cleanPath;
    }
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    if (typeof window !== 'undefined' && window.location && window.location.origin && base.startsWith('/')) {
        return `${window.location.origin}${base}${cleanPath}`;
    }
    return `${base}${cleanPath}`;
}

async function apiCall(endpoint, options = {}) {
    const url = resolveApiUrl(endpoint);
    const headers = {
        'Accept': 'application/json',
        ...(options.headers || {})
    };
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
}

// --------------------------------------------------------------------------
// 1. STAFF CONTEXT, AUTHENTICATION & REAL-TIME FIRESTORE
// --------------------------------------------------------------------------
const STAFF_SESSION_STORAGE_KEY = 'perfetto_staff_session_user';
const STAFF_LOCAL_STORAGE_KEY = 'perfetto_staff_user_session';
const STAFF_VERIFIED_PHONE_KEY = 'perfetto_staff_verified_phone';
const STAFF_ORDERS_STORAGE_KEY = 'perfetto_staff_orders';
const MASTER_ADMIN_PHONE_NUM = '9414503886';
const STAFF_MSG91_CONFIG = {
    widgetId: "3668716b4f68313937363038",
    tokenAuth: "561143TsR6UbiIs0v6a82f3f8P1"
};

let currentStaffUser = null;
let staffCurrentName = '';
let staffCurrentPhone = '';
let staffOtpTimerId = null;
let staffOtpCountdown = 45;

// Centralized Firebase Configuration for Real-time sync
const defaultFirebaseConfig = {
  apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
  authDomain: "website-fa79c.firebaseapp.com",
  projectId: "website-fa79c",
  storageBucket: "website-fa79c.firebasestorage.app",
  messagingSenderId: "1070276115284",
  appId: "1:1070276115284:web:ebcb37d56f3af2a2d326c1",
  measurementId: "G-DT7MRXDMZ0",
  vapidKey: "BAzvQIJwnZ7a1vVUH4k9sNE3dHGFN2b5wRiwe8Ae4AAIjGN-RqTouVe36mYj-HhI-R1RTkFYvbuOtFQ1tjfDvIk"
};

const firebaseConfig = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || defaultFirebaseConfig;
const FIREBASE_CONFIG = firebaseConfig;
if (typeof window !== 'undefined') {
  window.FIREBASE_CONFIG = firebaseConfig;
}

function getFirebaseVapidKey() {
  try {
    if (typeof window !== 'undefined') {
      if (window.FIREBASE_VAPID_KEY && typeof window.FIREBASE_VAPID_KEY === 'string') {
        const cleaned = window.FIREBASE_VAPID_KEY.trim().replace(/^['"]|['"]$/g, '');
        if (cleaned) return cleaned;
      }
      if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.vapidKey) {
        const cleaned = String(window.FIREBASE_CONFIG.vapidKey).trim().replace(/^['"]|['"]$/g, '');
        if (cleaned) return cleaned;
      }
    }
    if (typeof process !== 'undefined' && process.env) {
      const envKey = process.env.FIREBASE_VAPID_KEY || 
                     process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 
                     process.env.VITE_FIREBASE_VAPID_KEY;
      if (envKey && typeof envKey === 'string') {
        const cleaned = envKey.trim().replace(/^['"]|['"]$/g, '');
        if (cleaned) return cleaned;
      }
    }
  } catch (err) {
    // Graceful fallback on evaluation notice
  }
  return "BAzvQIJwnZ7a1vVUH4k9sNE3dHGFN2b5wRiwe8Ae4AAIjGN-RqTouVe36mYj-HhI-R1RTkFYvbuOtFQ1tjfDvIk";
}

const FIREBASE_VAPID_KEY = getFirebaseVapidKey();
if (typeof window !== 'undefined') {
  window.FIREBASE_VAPID_KEY = FIREBASE_VAPID_KEY;
}

let staffFirebaseAuth = null;
let staffFirestore = null;
let staffOrdersUnsubscribe = null;
let staffTeamUnsubscribe = null;
let staffFcmMessaging = null;
let staffFcmToken = null;
let staffSwRegistration = null;

/**
 * Production-grade FCM Web Push & Service Worker Engine
 * Strictly guarded against SSR and unsupported browser environments.
 */
async function initStaffFCM() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        console.log('ℹ️ [FCM Web Push] ServiceWorker / window not available on this platform.');
        return null;
    }

    try {
        if (!staffSwRegistration) {
            staffSwRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
            });
            console.log('✅ [FCM Service Worker] Registered successfully with scope:', staffSwRegistration.scope);
        }

        // Strictly verify client-side Firebase messaging & isSupported() before initializing
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            let isSupported = false;
            try {
                if (typeof firebase.messaging.isSupported === 'function') {
                    isSupported = await firebase.messaging.isSupported();
                } else {
                    isSupported = true;
                }
            } catch (suppErr) {
                console.warn('FCM isSupported check returned false or failed:', suppErr.message);
                isSupported = false;
            }

            if (!isSupported) {
                console.log('ℹ️ [FCM Web Push] Browser environment does not support Firebase Cloud Messaging Web Push.');
                return staffSwRegistration;
            }

            if (!staffFcmMessaging) {
                if (!firebase.apps || !firebase.apps.length) {
                    const config = (typeof window !== 'undefined' && window.FIREBASE_CONFIG) || firebaseConfig;
                    try { firebase.initializeApp(config); } catch (e) { }
                }
                staffFcmMessaging = firebase.messaging();

                // Listen for foreground FCM push messages
                staffFcmMessaging.onMessage((payload) => {
                    console.log('📬 [FCM Foreground Push] Received message:', payload);
                    const data = payload.data || payload.notification || {};
                    const orderNumber = data.orderNumber || data.orderId || data.id || 'New';
                    const customerName = data.customerName || data.customer || 'Customer';
                    const items = data.items || data.itemsSummary || 'Pizza Order';
                    const total = data.total || data.totalAmount || '';
                    const summary = total ? `${customerName} • ${items} • ₹${total}` : `${customerName} • ${items}`;

                    // Hybrid Dual-Layer Alert Trigger:
                    // 1. Trigger continuous physical chime alert
                    startOrderAlertAudio(orderNumber, summary);

                    // 2. Hardware haptics
                    triggerStaffVibration();

                    // 3. Foreground-fallback notification if tab is hidden
                    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                        dispatchStaffOrderNotification(orderNumber, summary);
                    }
                });
            }

            // Retrieve push token if permission is already granted
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                await requestAndRegisterStaffFcmToken(staffSwRegistration);
            }
        }

        return staffSwRegistration;
    } catch (err) {
        console.warn('FCM Service Worker initialization notice:', err.message);
        return null;
    }
}
if (typeof window !== 'undefined') {
    window.initStaffFCM = initStaffFCM;
}

async function requestAndRegisterStaffFcmToken(swReg) {
    if (typeof window === 'undefined' || typeof firebase === 'undefined' || !firebase.messaging) return null;
    try {
        if (typeof firebase.messaging.isSupported === 'function') {
            const supported = await firebase.messaging.isSupported();
            if (!supported) return null;
        }

        const messaging = staffFcmMessaging || firebase.messaging();
        const reg = swReg || staffSwRegistration || (typeof navigator !== 'undefined' && navigator.serviceWorker && (await navigator.serviceWorker.ready));
        const vapidKey = getFirebaseVapidKey();

        const token = await messaging.getToken({
            vapidKey: vapidKey,
            serviceWorkerRegistration: reg
        });

        if (token) {
            console.log('🔑 [FCM Web Push Token] Registration successful:', token.slice(0, 16) + '...');
            staffFcmToken = token;
            if (typeof window !== 'undefined') {
                window.staffFcmToken = token;
            }
            recordStaffDeviceToken(token);
            return token;
        } else {
            console.warn('⚠️ [FCM Web Push] No registration token returned.');
        }
    } catch (err) {
        console.warn('Notice acquiring FCM registration token:', err.message);
    }
    return null;
}
if (typeof window !== 'undefined') {
    window.requestAndRegisterStaffFcmToken = requestAndRegisterStaffFcmToken;
}

async function recordStaffDeviceToken(token) {
    if (!token) return;
    try {
        const db = getStaffFirestore();
        if (db) {
            const staffUser = currentStaffUser || {};
            const staffPhone = staffUser.phone || staffUser.mobile || 'staff';
            const docId = String(token).slice(0, 36).replace(/[^a-zA-Z0-9_-]/g, '_');
            await db.collection('staff_devices').doc(docId).set({
                token: token,
                phone: staffPhone,
                role: staffUser.role || 'staff',
                name: staffUser.fullName || staffUser.name || 'Kitchen Staff',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || ''
            }, { merge: true });
            console.log('☁️ [FCM Device Registered] Token recorded in Firestore staff_devices.');
        }
    } catch (err) {
        console.warn('Notice saving FCM device token to Firestore:', err.message);
    }
}
window.recordStaffDeviceToken = recordStaffDeviceToken;

function getStaffFirestore() {
    if (staffFirestore) return staffFirestore;
    if (window.db) {
        staffFirestore = window.db;
        return staffFirestore;
    }
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps || !firebase.apps.length) {
            const config = window.FIREBASE_CONFIG || firebaseConfig || FIREBASE_CONFIG;
            try { firebase.initializeApp(config); } catch (e) { }
        }
        if (firebase.firestore) {
            staffFirestore = firebase.firestore();
            window.db = staffFirestore;
            return staffFirestore;
        }
    }
    return null;
}

async function initStaffFirebase() {
    try {
        const db = getStaffFirestore();
        if (typeof firebase !== 'undefined' && firebase.auth) {
            staffFirebaseAuth = firebase.auth();
        }
        listenToFirestoreStaffSettings();
        fetchStaffSettingsFromBackend();
        if (db) {
            listenToFirestoreStaffOrders();
        }
        // Initialize FCM Service Worker and push messaging
        initStaffFCM();
    } catch (e) {
        console.warn('Staff Firebase init notice:', e.message);
    }
}

let staffSettingsUnsubscribe = null;
let staffConfigUnsubscribe = null;
let staffWalletUnsubscribe = null;
let staffWalletConfig = { enabled: true };

function listenToFirestoreStaffSettings() {
    const db = getStaffFirestore();
    if (!db) return;
    if (!staffSettingsUnsubscribe) {
        try {
            staffSettingsUnsubscribe = db.collection('settings').doc('storeSettings')
                .onSnapshot((doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        if (data) {
                            applyStaffStoreSettings(data);
                        }
                    }
                }, (err) => {
                    console.warn('Firestore staff settings real-time notice:', err.message);
                    staffSettingsUnsubscribe = null;
                });
        } catch (e) {
            console.warn('Error attaching Firestore staff settings listener:', e);
            staffSettingsUnsubscribe = null;
        }
    }
    if (!staffConfigUnsubscribe) {
        try {
            staffConfigUnsubscribe = db.collection('settings').doc('store_config')
                .onSnapshot((doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        if (data) {
                            applyStaffStoreSettings(data);
                        }
                    }
                }, (err) => {
                    console.warn('Firestore staff store_config real-time notice:', err.message);
                    staffConfigUnsubscribe = null;
                });
        } catch (e) {
            console.warn('Error attaching Firestore store_config listener:', e);
            staffConfigUnsubscribe = null;
        }
    }
    if (!staffWalletUnsubscribe) {
        try {
            staffWalletUnsubscribe = db.collection('settings').doc('wallet_config')
                .onSnapshot((doc) => {
                    if (doc && doc.exists && doc.data()) {
                        const data = doc.data();
                        const cfg = data.wallet_config || data;
                        staffWalletConfig = { ...staffWalletConfig, ...cfg, enabled: cfg.enabled !== false };
                    }
                }, (err) => {
                    console.warn('Firestore staff wallet_config real-time notice:', err.message);
                    staffWalletUnsubscribe = null;
                });
        } catch (e) {
            console.warn('Error attaching Firestore staff wallet_config listener:', e);
            staffWalletUnsubscribe = null;
        }
    }
}

async function fetchStaffSettingsFromBackend() {
    try {
        const res = await fetch(resolveApiUrl('/api/settings'));
        if (res && res.ok) {
            const data = await res.json();
            if (data && data.success && data.settings) {
                applyStaffStoreSettings(data.settings);
            }
        }
    } catch (e) {}
    try {
        const wRes = await fetch(resolveApiUrl('/api/wallet/config'));
        if (wRes && wRes.ok) {
            const wData = await wRes.json();
            if (wData && wData.config) {
                staffWalletConfig = { ...staffWalletConfig, ...wData.config, enabled: wData.config.enabled !== false };
            }
        }
    } catch (e) {}
}

function applyStaffStoreSettings(settings) {
    if (!settings) return;
    if (settings.masterDeliveryOtp !== undefined) {
        try {
            localStorage.setItem('masterDeliveryOtp', String(settings.masterDeliveryOtp).replace(/[^0-9]/g, '').slice(0, 4));
        } catch (e) { }
    }
}

function getMasterDeliveryOtp() {
    try {
        const stored = localStorage.getItem('masterDeliveryOtp');
        if (stored && stored.trim() !== '') {
            return stored.trim();
        }
    } catch (e) { }
    return '9999';
}

let staffOrdersReconnectTimeout = null;
let isFirestoreInitialHydrationDone = false;
const processedOrderDocIds = new Set();
const staffIncomingAlertedIds = new Set();

function listenToFirestoreStaffOrders() {
    const db = getStaffFirestore();
    if (!db) {
        if (!staffOrdersReconnectTimeout) {
            staffOrdersReconnectTimeout = setTimeout(() => {
                staffOrdersReconnectTimeout = null;
                listenToFirestoreStaffOrders();
            }, 1000);
        }
        return;
    }
    if (staffOrdersUnsubscribe) return;

    function processOrdersSnapshot(snapshot) {
        if (!snapshot) return;

        const docChanges = typeof snapshot.docChanges === 'function' ? snapshot.docChanges() : [];
        const isFirstHydration = !isFirestoreInitialHydrationDone;

        if (isFirstHydration) {
            // Exclude initial collection hydration so already existing orders do not re-alarm on page load
            snapshot.forEach((doc) => {
                const docId = doc.id;
                const data = doc.data() || {};
                const orderId = String(data.orderId || data.id || docId);
                const matchingKey = String(orderId).replace(/^#/, '').trim();
                processedOrderDocIds.add(docId);
                processedOrderDocIds.add(orderId);
                staffSeenOrderIds.add(docId);
                staffSeenOrderIds.add(orderId);
                staffIncomingAlertedIds.add(docId);
                staffIncomingAlertedIds.add(orderId);
                if (matchingKey) {
                    processedOrderDocIds.add(matchingKey);
                    staffSeenOrderIds.add(matchingKey);
                    staffIncomingAlertedIds.add(matchingKey);
                }
            });
            isFirestoreInitialHydrationDone = true;
            console.log(`📡 [Firestore Orders] Initial collection hydration complete (${snapshot.size} orders recorded, alerts suppressed).`);
        } else {
            // Real-time snapshot updates: check for newly added or status-modified documents
            for (const change of docChanges) {
                const doc = change.doc;
                const data = doc.data() || {};
                const docId = doc.id;
                const orderId = String(data.orderId || data.id || docId);
                const matchingKey = String(orderId).replace(/^#/, '').trim();
                const status = String(data.status || '').toLowerCase().trim();
                const isIncoming = (status === 'placed' || status === 'pending' || status === 'new');

                if (change.type === 'added' || change.type === 'modified') {
                    const isDismissed = staffDismissedAlertOrderIds.has(orderId) || 
                                        (matchingKey && staffDismissedAlertOrderIds.has(matchingKey));
                    const isAlreadyAlerted = staffIncomingAlertedIds.has(docId) ||
                                             staffIncomingAlertedIds.has(orderId) ||
                                             (matchingKey && staffIncomingAlertedIds.has(matchingKey));

                    if (isIncoming && !isAlreadyAlerted && !isDismissed) {
                        staffIncomingAlertedIds.add(docId);
                        staffIncomingAlertedIds.add(orderId);
                        if (matchingKey) staffIncomingAlertedIds.add(matchingKey);
                        staffProcessedAudioOrderIds.add(orderId);
                        if (matchingKey) staffProcessedAudioOrderIds.add(matchingKey);
                        processedOrderDocIds.add(docId);
                        processedOrderDocIds.add(orderId);
                        if (matchingKey) processedOrderDocIds.add(matchingKey);
                        staffSeenOrderIds.add(docId);
                        staffSeenOrderIds.add(orderId);
                        if (matchingKey) staffSeenOrderIds.add(matchingKey);

                        console.log(`🔥 [Firestore Real-Time] Incoming order detected via docChanges (${change.type}): Order #${orderId} (Status: ${status})`);
                        const customerName = data.customerName || data.customer?.name || 'Customer';
                        const total = data.total || data.costs?.total || '';
                        const summary = total ? `${customerName} • ₹${total}` : customerName;

                        // 1. Immediately set the incoming modal state to visible
                        showIncomingOrderModal(orderId, summary, data);

                        // 2. Immediately invoke the primed audio chime to loop continuously
                        startOrderAlertAudio(orderId, summary, data);

                        // 3. Fire the vibration sequence
                        startStaffVibrationLoop();

                        // 4. Toast notification
                        showStaffToast(`🔔 New Order #${orderId} Received in Real-Time!`);
                    } else if (change.type === 'modified' && !isIncoming) {
                        // If currently alerting for this order and status transitioned away from incoming, stop alert
                        if (currentAlertingOrderId && (
                            currentAlertingOrderId === orderId || 
                            currentAlertingOrderId === docId || 
                            currentAlertingOrderId === matchingKey
                        )) {
                            console.log(`🛑 [Firestore Real-Time] Alerting order #${orderId} transitioned to '${status}'. Stopping alert.`);
                            stopOrderAlertAudio();
                        }
                    }
                } else if (change.type === 'removed') {
                    if (currentAlertingOrderId && (
                        currentAlertingOrderId === orderId || 
                        currentAlertingOrderId === docId || 
                        currentAlertingOrderId === matchingKey
                    )) {
                        console.log(`🛑 [Firestore Real-Time] Alerting order #${orderId} removed. Stopping alert.`);
                        stopOrderAlertAudio();
                    }
                }
            }
        }

        const liveOrders = [];
        snapshot.forEach((doc) => {
            const data = doc.data() || {};
            const docId = doc.id;
            liveOrders.push({
                ...data,
                firestoreDocId: docId,
                docId: docId,
                id: data.id || data.orderId || docId,
                orderId: data.orderId || data.id || docId
            });
        });
        // Always synchronize snapshot into shared kitchen pool (even if empty, to reflect purges)
        mergeLiveOrdersIntoStaff(liveOrders);
        sweepAutoExpiredOrders();
        startStaffAutoExpireInterval();
    }

    try {
        // Centralized shared restaurant order pool across all staff devices
        // Query does NOT filter by individual staff user ID or phone; all devices watch the identical restaurant order pool
        staffOrdersUnsubscribe = db.collection('orders')
            .limit(150)
            .onSnapshot((snapshot) => {
                processOrdersSnapshot(snapshot);
            }, (err) => {
                console.warn('Firestore staff orders listener note:', err.message);
                if (typeof staffOrdersUnsubscribe === 'function') {
                    try { staffOrdersUnsubscribe(); } catch (e) { }
                }
                staffOrdersUnsubscribe = null;

                // Auto-reconnect resiliently after 3 seconds instead of dropping listener
                if (!staffOrdersReconnectTimeout) {
                    staffOrdersReconnectTimeout = setTimeout(() => {
                        staffOrdersReconnectTimeout = null;
                        listenToFirestoreStaffOrders();
                    }, 3000);
                }
                fetchOrdersFromBackend();
            });
    } catch (e) {
        console.warn('Error attaching Firestore staff listener:', e);
        staffOrdersUnsubscribe = null;
        if (!staffOrdersReconnectTimeout) {
            staffOrdersReconnectTimeout = setTimeout(() => {
                staffOrdersReconnectTimeout = null;
                listenToFirestoreStaffOrders();
            }, 3000);
        }
        fetchOrdersFromBackend();
    }
}
const listenToStaffLiveOrders = listenToFirestoreStaffOrders;

// --------------------------------------------------------------------------
// 100-MINUTE TIMEOUT EXPIRATION SWEEPER & ATOMIC WALLET REFUND ENGINE
// --------------------------------------------------------------------------
const ONE_HUNDRED_MINS_EXPIRATION_MS = 100 * 60 * 1000; // 100 mins / 6,000,000 ms
const THREE_HOURS_EXPIRATION_MS = ONE_HUNDRED_MINS_EXPIRATION_MS; // Backward-compatible alias
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const autoRejectInFlightOrderIds = new Set();
let staffAutoExpireInterval = null;

function calculateRecoveredExpiry(originalExpiresAt, nowMs = Date.now()) {
    if (!originalExpiresAt) {
        return new Date(nowMs + TWENTY_FOUR_HOURS_MS).toISOString();
    }
    const parseTs = (typeof parseTimestampMs === 'function') ? parseTimestampMs : (v) => new Date(v).getTime();
    const expMs = parseTs(originalExpiresAt);
    if (isNaN(expMs) || expMs <= nowMs || (expMs - nowMs) < TWENTY_FOUR_HOURS_MS) {
        return new Date(nowMs + TWENTY_FOUR_HOURS_MS).toISOString();
    }
    return new Date(expMs).toISOString();
}
window.calculateRecoveredExpiry = calculateRecoveredExpiry;

function isOrder100MinsExpired(order) {
    if (!order) return false;
    const status = String(order.status || '').toLowerCase().trim();
    const terminalStatuses = ['completed', 'delivered', 'rejected', 'cancelled', 'archived', 'declined'];
    if (terminalStatuses.includes(status)) return false;
    if (order.autoExpired === true || order.isAutoExpired === true) return true;
    if (status === 'expired' || status === 'auto_expired') return true;

    const createdMs = getOrderCreationTimeMs(order);
    if (!createdMs) return false;
    return (Date.now() - createdMs) >= ONE_HUNDRED_MINS_EXPIRATION_MS;
}
const isOrderThreeHoursExpired = isOrder100MinsExpired;
window.isOrder100MinsExpired = isOrder100MinsExpired;
window.isOrderThreeHoursExpired = isOrderThreeHoursExpired;

function getOrderCountdownPillHTML(order) {
    if (!order) return '';
    const terminalStatuses = ['completed', 'delivered', 'rejected', 'cancelled', 'archived', 'declined'];
    const st = String(order.status || '').toLowerCase().trim();
    if (terminalStatuses.includes(st) || isRejectedStaffOrder(order)) return '';

    const createdMs = getOrderCreationTimeMs(order) || (order.createdAt ? new Date(order.createdAt).getTime() : Date.now());
    const elapsedMs = Date.now() - createdMs;
    if (elapsedMs >= ONE_HUNDRED_MINS_EXPIRATION_MS || isOrder100MinsExpired(order)) {
        // Enforce hard Firestore state transition immediately; do NOT merely swap text badge to Expired
        autoRejectExpiredOrder(order);
        return '';
    }

    const remMs = ONE_HUNDRED_MINS_EXPIRATION_MS - elapsedMs;
    const remMins = Math.max(0, Math.ceil(remMs / 60000));
    const hrs = Math.floor(remMins / 60);
    const mins = remMins % 60;
    const countdownText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    const pillClass = remMins <= 20 ? 'pill-urgent' : 'pill-active';

    return `<span class="order-countdown-pill ${pillClass}" title="100-Minute Auto-Expiry Countdown">⏱ ${countdownText}</span>`;
}
window.getOrderCountdownPillHTML = getOrderCountdownPillHTML;

async function autoRejectExpiredOrder(order) {
    if (!order) return;
    const orderId = String(order.id || order.orderId || order.firestoreDocId || '').trim();
    if (!orderId || autoRejectInFlightOrderIds.has(orderId)) return;
    autoRejectInFlightOrderIds.add(orderId);

    try {
        console.log(`[STAFF SWEEPER] Auto-rejecting 100-minute expired order #${orderId}...`);

        const customerPhone = String(order.customerPhone || order.phone || (order.customer && order.customer.phone) || (order.deliveryDetails && order.deliveryDetails.phone) || '').replace(/[^0-9]/g, '').slice(-10);

        const refundAmount = Math.round(Number(
            order.walletDeductedAmount ||
            order.walletUsed ||
            order.walletDiscount ||
            order.usedWalletCash ||
            order.appliedWalletDiscount ||
            order.usedWallet ||
            0
        ));

        const nowIso = new Date().toISOString();
        const autoExpiryReason = 'Order timed out (>100 mins) - auto expired'; // 100-minute fulfillment timeout
        const autoExpiryDetailed = 'Order timed out (>100 minutes) - automatically cancelled by system';

        order.status = 'REJECTED';
        order.cancellationReason = autoExpiryDetailed;
        order.rejectionReason = autoExpiryReason;
        order.rejectedBy = 'SYSTEM_AUTO_EXPIRE';
        order.autoExpired = true;
        order.isAutoExpired = true;
        order.walletRefundProcessed = true;
        order.rejectedAt = nowIso;
        order.cancelledAt = nowIso;
        order.rewardStatus = 'voided';
        order.cashbackStatus = 'VOID';
        order.wonCashback = 0;
        order.earnedCashback = 0;
        if (order.scratchCard) {
            order.scratchCard.status = 'CANCELLED';
            order.scratchCard.voided = true;
            order.scratchCard.wonAmount = 0;
            order.scratchCard.amount = 0;
        }
        const isAlreadyRefunded = Boolean(order.walletRefunded);
        const originalExpiresAt = order.walletHoldExpiresAt || order.walletOriginalExpiresAt || null;
        const recoveredExpiresAt = (typeof calculateRecoveredExpiry === 'function')
            ? calculateRecoveredExpiry(originalExpiresAt)
            : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        if (refundAmount > 0 && !isAlreadyRefunded) {
            order.walletRefunded = true;
            order.walletRefundAmount = refundAmount;
            order.refundTimestamp = nowIso;
            order.walletRefundedAt = nowIso;
        }

        // 1. Direct atomic Firestore update
        const db = getStaffFirestore();
        if (db) {
            try {
                const batch = db.batch();
                const exactDocId = order.firestoreDocId || order.docId || order.id || order.orderId || orderId;
                const orderRef = db.collection('orders').doc(String(exactDocId));

                const serverTs = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : nowIso;

                const orderUpdate = {
                    status: 'REJECTED',
                    rejectionReason: autoExpiryReason,
                    cancellationReason: autoExpiryDetailed,
                    rejectedBy: 'SYSTEM_AUTO_EXPIRE',
                    walletRefundProcessed: true,
                    autoExpired: true,
                    isAutoExpired: true,
                    rejectedAt: serverTs,
                    cancelledAt: serverTs,
                    rewardStatus: 'voided',
                    cashbackStatus: 'VOID',
                    wonCashback: 0,
                    earnedCashback: 0,
                    updatedAt: serverTs
                };

                if (order.scratchCard) {
                    orderUpdate['scratchCard.status'] = 'CANCELLED';
                    orderUpdate['scratchCard.voided'] = true;
                    orderUpdate['scratchCard.wonAmount'] = 0;
                    orderUpdate['scratchCard.amount'] = 0;
                }

                if (refundAmount > 0 && customerPhone && !isAlreadyRefunded) {
                    orderUpdate.walletRefunded = true;
                    orderUpdate.walletRefundAmount = refundAmount;
                    orderUpdate.refundTimestamp = serverTs;
                    orderUpdate.walletRefundedAt = serverTs;

                    const incrementFn = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                        ? firebase.firestore.FieldValue.increment(refundAmount)
                        : refundAmount;

                    const txId = `tx_refund_${orderId}`;
                    const refundTxLog = {
                        id: txId,
                        orderId: orderId,
                        amount: refundAmount,
                        type: 'REFUND',
                        title: `+₹${refundAmount} Refund`,
                        description: `+₹${refundAmount} Refund for Order #${orderId}`,
                        status: 'completed',
                        expiresAt: recoveredExpiresAt,
                        originalExpiresAt: originalExpiresAt || null,
                        graceApplied: new Date(recoveredExpiresAt).getTime() > new Date(originalExpiresAt || 0).getTime(),
                        timestamp: serverTs,
                        createdAt: serverTs
                    };

                    // 1. Increment users/phone_{customerPhone}
                    const userPrefixedRef = db.collection('users').doc(`phone_${customerPhone}`);
                    batch.set(userPrefixedRef, {
                        balance: incrementFn,
                        walletBalance: incrementFn,
                        expiresAt: recoveredExpiresAt,
                        expired: false,
                        updatedAt: serverTs
                    }, { merge: true });
                    batch.set(userPrefixedRef.collection('wallet_transactions').doc(txId), refundTxLog, { merge: true });
                    batch.set(userPrefixedRef.collection('transactions').doc(txId), refundTxLog, { merge: true });

                    // 2. Increment users/{customerPhone}
                    const userRawRef = db.collection('users').doc(customerPhone);
                    batch.set(userRawRef, {
                        balance: incrementFn,
                        walletBalance: incrementFn,
                        expiresAt: recoveredExpiresAt,
                        expired: false,
                        updatedAt: serverTs
                    }, { merge: true });
                    batch.set(userRawRef.collection('wallet_transactions').doc(txId), refundTxLog, { merge: true });
                    batch.set(userRawRef.collection('transactions').doc(txId), refundTxLog, { merge: true });

                    // 3. Increment wallets/{customerPhone}
                    const walletRef = db.collection('wallets').doc(customerPhone);
                    batch.set(walletRef, {
                        phone: customerPhone,
                        balance: incrementFn,
                        expiresAt: recoveredExpiresAt,
                        updatedAt: serverTs
                    }, { merge: true });
                    batch.set(walletRef.collection('wallet_transactions').doc(txId), refundTxLog, { merge: true });
                    batch.set(walletRef.collection('transactions').doc(txId), refundTxLog, { merge: true });
                }

                batch.set(orderRef, orderUpdate, { merge: true });
                await batch.commit();

                // Direct update fallback
                try {
                    if (typeof updateDoc === 'function') {
                        await updateDoc(orderRef, orderUpdate);
                    } else if (orderRef && typeof orderRef.update === 'function') {
                        await orderRef.update(orderUpdate);
                    }
                } catch (uErr) { }

                console.log(`✅ [STAFF SWEEPER] Firestore atomic batch committed for expired Order #${orderId}`);
            } catch (fsErr) {
                console.warn(`[STAFF SWEEPER] Firestore write error for expired Order #${orderId}:`, fsErr);
            }
        }

        // 2. Sync to Backend API
        try {
            await apiCall('/orders', {
                method: 'PATCH',
                body: JSON.stringify({
                    orderId: orderId,
                    status: 'rejected',
                    cancellationReason: autoExpiryReason,
                    rejectionReason: autoExpiryReason,
                    rejectedBy: 'SYSTEM_AUTO_EXPIRE',
                    autoExpired: true,
                    isAutoExpired: true,
                    walletRefundProcessed: refundAmount > 0,
                    walletRefunded: refundAmount > 0,
                    walletRefundAmount: refundAmount,
                    refundTimestamp: nowIso,
                    customerPhone: customerPhone
                })
            });
        } catch (apiErr) {
            console.warn(`[STAFF SWEEPER] Backend API sync note for Order #${orderId}:`, apiErr.message);
        }

        try {
            localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
        } catch (e) { }
        renderOrders();
    } finally {
        autoRejectInFlightOrderIds.delete(orderId);
    }
}
window.autoRejectExpiredOrder = autoRejectExpiredOrder;

async function autoExpireOrder(orderId) {
    if (!orderId) return;
    const cleanId = String(orderId).replace(/^#/, '').trim();
    const order = staffOrders.find(o => 
        String(o.id) === cleanId || 
        String(o.orderId) === cleanId || 
        String(o.id) === String(orderId) || 
        String(o.orderId) === String(orderId) ||
        String(o.firestoreDocId) === cleanId ||
        String(o.docId) === cleanId
    );
    if (!order) {
        console.warn(`[STAFF AUTO-EXPIRE] Order #${orderId} not found in staffOrders in memory. Directing to backend API...`);
        try {
            await apiCall('/orders', {
                method: 'PATCH',
                body: JSON.stringify({
                    orderId: cleanId,
                    status: 'rejected',
                    cancellationReason: 'Order timed out (>100 minutes) - automatically cancelled by system',
                    rejectionReason: 'Order timed out (>100 minutes) - automatically cancelled by system',
                    rejectedBy: 'SYSTEM_AUTO_EXPIRE',
                    autoExpired: true,
                    isAutoExpired: true
                })
            });
        } catch (e) { }
        return;
    }
    return await autoRejectExpiredOrder(order);
}
window.autoExpireOrder = autoExpireOrder;

async function sweepAutoExpiredOrders() {
    if (!Array.isArray(staffOrders) || staffOrders.length === 0) return;
    const expiredOrders = staffOrders.filter(isOrder100MinsExpired);
    if (expiredOrders.length === 0) return;

    console.log(`[STAFF SWEEPER] Sweeper running: found ${expiredOrders.length} expired unfulfilled order(s). Processing rejections...`);
    for (const order of expiredOrders) {
        try {
            await autoRejectExpiredOrder(order);
        } catch (err) {
            console.error(`[STAFF SWEEPER] Error rejecting expired order #${order.id}:`, err);
        }
    }
    try {
        localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
    } catch (e) { }
    renderOrders();
}
window.sweepAutoExpiredOrders = sweepAutoExpiredOrders;

function startStaffAutoExpireInterval() {
    if (!staffAutoExpireInterval) {
        staffAutoExpireInterval = setInterval(() => {
            sweepAutoExpiredOrders();
        }, 60000);
    }
}

// --------------------------------------------------------------------------
// AUTHENTICATION & ACCESS REQUEST WORKFLOW (PHONE & FULL NAME)
// --------------------------------------------------------------------------

/**
 * Role-Based Visibility & Authorization Guard:
 * Returns true ONLY when the active session belongs to an Admin (Master Admin Tiers 1/2/3 or Normal Admin).
 * For regular delivery boys, chefs, and standard staff roles, this returns false.
 */
function isStaffAdminUser(user) {
    if (!user) user = currentStaffUser;
    if (!user) return false;

    const phone = String(user.phone || '').replace(/[^0-9]/g, '').slice(-10);
    if (phone === MASTER_ADMIN_PHONE_NUM) return true;
    if (user.isMasterAdmin === true || user.isAdmin === true) return true;

    const role = String(user.role || '').trim().toLowerCase();

    // Explicitly reject regular delivery boys, chefs, and standard staff roles
    if (
        role === 'staff' || 
        role === 'chef' || 
        role === 'kitchen staff' || 
        role === 'delivery' || 
        role === 'delivery boy' || 
        role === 'rider' ||
        role === 'pending'
    ) {
        return false;
    }

    // Matches 'master admin', 'master admin tier 1', 'master admin tier 2', 'master admin tier 3', 'admin', 'normal admin'
    if (role === 'admin' || role === 'normal admin' || role.includes('admin')) {
        return true;
    }

    return false;
}
window.isStaffAdminUser = isStaffAdminUser;

function hideStaffAuthSplash() {
    const splash = document.getElementById('staff-auth-splash');
    if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => {
            splash.style.display = 'none';
        }, 280);
    }
}
window.hideStaffAuthSplash = hideStaffAuthSplash;

async function checkStaffAuthSession() {
    // 1. Check if user explicitly logged out (prevents ghost session restoration)
    const wasExplicitlyLoggedOut = sessionStorage.getItem('perfetto_staff_logged_out') === 'true' || localStorage.getItem('perfetto_staff_logged_out') === 'true';
    if (wasExplicitlyLoggedOut) {
        currentStaffUser = null;
        staffOrders = [];
        await initStaffFirebase();
        lockStaffDashboard();
        hideStaffAuthSplash();
        return false;
    }

    // 2. Check staff-specific storage
    let savedSession = sessionStorage.getItem(STAFF_SESSION_STORAGE_KEY) || localStorage.getItem(STAFF_LOCAL_STORAGE_KEY);

    if (savedSession) {
        try {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.phone) {
                const cleanPhoneDigits = String(parsed.phone).replace(/[^0-9]/g, '').slice(-10);

                // Master Admin bypasses directly
                if (cleanPhoneDigits === MASTER_ADMIN_PHONE_NUM || parsed.role === 'Master Admin' || parsed.isMasterAdmin) {
                    currentStaffUser = {
                        ...parsed,
                        role: 'Master Admin',
                        status: 'active',
                        isApproved: true,
                        isMasterAdmin: true
                    };
                    unlockStaffDashboard(currentStaffUser);
                    initStaffFirebase().then(() => {
                        listenToFirestoreStaffOrders();
                        startStaffSessionSecurityListener(cleanPhoneDigits);
                    });
                    return true;
                }

                // If active staff member
                if (parsed.status === 'active') {
                    currentStaffUser = parsed;
                    unlockStaffDashboard(currentStaffUser);
                    initStaffFirebase().then(() => {
                        listenToFirestoreStaffOrders();
                        startStaffSessionSecurityListener(cleanPhoneDigits);
                    });
                    return true;
                } else if (parsed.status === 'rejected' || parsed.status === 'blocked') {
                    showStaffPendingAccessScreen(parsed.fullName, cleanPhoneDigits, 'blocked');
                    initStaffFirebase();
                    return false;
                } else {
                    showStaffPendingAccessScreen(parsed.fullName, cleanPhoneDigits, 'pending');
                    initStaffFirebase();
                    return false;
                }
            }
        } catch (e) {
            sessionStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
            localStorage.removeItem(STAFF_LOCAL_STORAGE_KEY);
        }
    }

    // No session: initialize Firebase and smoothly reveal phone login overlay
    await initStaffFirebase();
    lockStaffDashboard();
    hideStaffAuthSplash();
    return false;
}

function lockStaffDashboard() {
    stopOrderAlertAudio();
    currentStaffUser = null;
    const appRoot = document.getElementById('staff-app-root') || document.querySelector('.staff-app');
    if (appRoot) {
        appRoot.style.setProperty('display', 'none', 'important');
    }
    const dashboardView = document.getElementById('staff-dashboard-view');
    if (dashboardView) {
        dashboardView.style.setProperty('display', 'none', 'important');
    }
    hideStaffAuthSplash();

    const deleteCompletedBtn = document.getElementById('btn-delete-all-completed');
    if (deleteCompletedBtn) {
        deleteCompletedBtn.style.display = 'none';
        deleteCompletedBtn.disabled = true;
        deleteCompletedBtn.classList.add('is-disabled');
    }
    const overlay = document.getElementById('staff-login-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.style.visibility = 'visible';
        });
    }

    const stepPhone = document.getElementById('staff-login-step-phone');
    const stepOtp = document.getElementById('staff-login-step-otp');
    const stepPending = document.getElementById('staff-login-step-pending');

    if (stepPhone) stepPhone.style.display = 'block';
    if (stepOtp) stepOtp.style.display = 'none';
    if (stepPending) stepPending.style.display = 'none';

    const nameInput = document.getElementById('staff-login-name');
    const phoneInput = document.getElementById('staff-login-phone');
    if (phoneInput) phoneInput.value = '';
    if (nameInput) {
        nameInput.value = '';
        setTimeout(() => nameInput.focus(), 300);
    }
}

function unlockStaffDashboard(user) {
    if (!user) user = currentStaffUser;
    if (!user) return;

    currentStaffUser = user;

    try {
        sessionStorage.removeItem('perfetto_staff_logged_out');
        localStorage.removeItem('perfetto_staff_logged_out');
    } catch (e) { }

    const overlay = document.getElementById('staff-login-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        overlay.style.display = 'none';
    }

    const appRoot = document.getElementById('staff-app-root') || document.querySelector('.staff-app');
    if (appRoot) {
        appRoot.style.removeProperty('display');
        appRoot.style.display = 'flex';
    }
    const dashboardView = document.getElementById('staff-dashboard-view');
    if (dashboardView) {
        dashboardView.style.removeProperty('display');
        dashboardView.style.display = 'block';
    }
    hideStaffAuthSplash();

    // Update Header UI
    const roleLabel = document.getElementById('current-role-label');
    const userDisplay = document.getElementById('staff-email-display');

    if (roleLabel) {
        roleLabel.textContent = (user.role === 'Master Admin' || user.phone === MASTER_ADMIN_PHONE_NUM) 
            ? 'Master Admin' 
            : (user.role || 'Staff');
    }
    if (userDisplay) {
        userDisplay.textContent = user.fullName || (user.phone ? `+91 ${user.phone}` : 'Staff Member');
    }

    // Start real-time session security listener for instant block lockdown
    if (user && user.phone) {
        startStaffSessionSecurityListener(user.phone);
    }

    // Start loading store settings & orders with real-time shared listener
    fetchStaffSettingsFromBackend();
    listenToFirestoreStaffOrders();
    loadCustomerOrders();
    renderOrders();
    applyStaffTabFromUrl();
    scheduleClientMidnightCleanup();
    stopStaffOrderAlertSound();

    // Register & persist staff FCM push token upon authentication
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        requestAndRegisterStaffFcmToken();
    }
}

let activeStaffSessionListener = null;
let activeStaffSessionUsersListener = null;
let activeStaffSessionPoller = null;

function startStaffSessionSecurityListener(userPhone) {
    if (!userPhone) return;
    const clean = String(userPhone).replace(/[^0-9]/g, '').slice(-10);
    if (!clean || clean === MASTER_ADMIN_PHONE_NUM) {
        // Master Admin is immune from blocking
        return;
    }

    if (activeStaffSessionListener) {
        try { activeStaffSessionListener(); } catch(e) {}
        activeStaffSessionListener = null;
    }
    if (activeStaffSessionUsersListener) {
        try { activeStaffSessionUsersListener(); } catch(e) {}
        activeStaffSessionUsersListener = null;
    }
    if (activeStaffSessionPoller) {
        clearInterval(activeStaffSessionPoller);
        activeStaffSessionPoller = null;
    }

    // 1. Real-time Firestore snapshot listener on 'team' and 'users' collections
    const db = getStaffFirestore();
    if (db) {
        try {
            activeStaffSessionListener = db.collection('team').doc(clean).onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data() || {};
                    if (data.status === 'blocked' || data.status === 'rejected' || data.isBlocked === true) {
                        handleStaffInstantBlockedLockdown(data.fullName || data.name || 'Staff Member', clean);
                    }
                }
            }, (err) => {
                console.warn('Staff team session security listener notice:', err);
            });
        } catch(e) {
            console.warn('Error starting staff team security listener:', e);
        }

        try {
            activeStaffSessionUsersListener = db.collection('users').doc(clean).onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data() || {};
                    if (data.status === 'blocked' || data.status === 'rejected' || data.isBlocked === true) {
                        handleStaffInstantBlockedLockdown(data.fullName || data.name || 'Staff Member', clean);
                    }
                }
            }, (err) => {
                console.warn('Staff users session security listener notice:', err);
            });
        } catch(e) { }
    }

    // 2. Periodic polling backup (every 60 seconds) as fallback if snapshot listener disconnects
    activeStaffSessionPoller = setInterval(async () => {
        if (activeStaffSessionListener) return;
        try {
            const res = await fetch(resolveApiUrl(`/api/admin-auth?phone=${clean}`));
            const data = await res.json();
            if (data && data.success && (data.isBlocked || data.status === 'blocked' || data.status === 'rejected')) {
                handleStaffInstantBlockedLockdown(data.user?.fullName || data.user?.name || 'Staff Member', clean);
            }
        } catch (e) { }
    }, 60000);
}

function handleStaffInstantBlockedLockdown(userName, userPhone) {
    console.warn(`[Security Lockdown] Staff user ${userPhone} is blocked. Terminating active session immediately.`);

    // 1. Instantly silence and kill any active audio playback
    stopOrderAlertAudio();
    try {
        if (staffOrderAlertAudio) {
            staffOrderAlertAudio.pause();
            staffOrderAlertAudio.currentTime = 0;
        }
    } catch (e) { }

    // 2. Detach/unsubscribe all active Firestore order & session snapshot listeners immediately
    if (typeof staffOrdersUnsubscribe === 'function') {
        try { staffOrdersUnsubscribe(); } catch(e) {}
        staffOrdersUnsubscribe = null;
    }
    if (typeof staffSettingsUnsubscribe === 'function') {
        try { staffSettingsUnsubscribe(); } catch(e) {}
        staffSettingsUnsubscribe = null;
    }
    if (typeof staffConfigUnsubscribe === 'function') {
        try { staffConfigUnsubscribe(); } catch(e) {}
        staffConfigUnsubscribe = null;
    }
    if (typeof ordersUnsubscribe !== 'undefined' && typeof ordersUnsubscribe === 'function') {
        try { ordersUnsubscribe(); } catch(e) {}
        ordersUnsubscribe = null;
    }
    if (typeof activeStaffSessionListener === 'function') {
        try { activeStaffSessionListener(); } catch(e) {}
        activeStaffSessionListener = null;
    }
    if (typeof activeStaffSessionUsersListener === 'function') {
        try { activeStaffSessionUsersListener(); } catch(e) {}
        activeStaffSessionUsersListener = null;
    }
    if (typeof activeStaffPendingApprovalListener === 'function') {
        try { activeStaffPendingApprovalListener(); } catch(e) {}
        activeStaffPendingApprovalListener = null;
    }
    if (activeStaffSessionPoller) {
        clearInterval(activeStaffSessionPoller);
        activeStaffSessionPoller = null;
    }
    if (activeStaffPendingApprovalPoller) {
        clearInterval(activeStaffPendingApprovalPoller);
        activeStaffPendingApprovalPoller = null;
    }

    // 3. Clear session credentials, reset local state and orders list
    try {
        sessionStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
        localStorage.removeItem(STAFF_LOCAL_STORAGE_KEY);
        localStorage.removeItem(STAFF_VERIFIED_PHONE_KEY);
        localStorage.removeItem(STAFF_ORDERS_STORAGE_KEY);
    } catch(e) {}

    currentStaffUser = null;
    staffOrders = [];

    // 4. Render locked / blocked account modal immediately
    lockStaffDashboard();
    showStaffPendingAccessScreen(userName, userPhone, 'blocked');
    showStaffToast('🚫 This number is blocked, please change your number');
}

function handleStaffNameInput(input) {
    const nameVal = input.value.trim();
    if (nameVal.length >= 2) {
        input.classList.remove('invalid-field');
    }
}

function handleStaffPhoneInput(input) {
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 10);
    const errorEl = document.getElementById('staff-login-phone-error');
    if (errorEl) errorEl.style.display = 'none';
    if (input.value.length === 10) {
        input.classList.remove('invalid-field');
    }
}

async function handleStaffSendOtp(isResend = false) {
    const nameInput = document.getElementById('staff-login-name');
    const phoneInput = document.getElementById('staff-login-phone');
    const errorEl = document.getElementById('staff-login-phone-error');
    if (errorEl) errorEl.style.display = 'none';

    const nameVal = nameInput ? nameInput.value.trim() : '';
    const phoneVal = phoneInput ? phoneInput.value.trim() : '';

    // 1. Validate Full Name
    if (!nameVal || nameVal.length < 2) {
        showStaffToast('⚠️ Please enter your Full Name before requesting OTP.');
        if (nameInput) {
            nameInput.classList.add('invalid-field');
            nameInput.focus();
        }
        return;
    }
    if (nameInput) nameInput.classList.remove('invalid-field');
    staffCurrentName = nameVal;

    // 2. Validate Mobile Phone Number
    if (!phoneVal || phoneVal.replace(/[^0-9]/g, '').length < 10) {
        showStaffToast('⚠️ Please enter a valid 10-digit Indian mobile number.');
        if (phoneInput) {
            phoneInput.classList.add('invalid-field');
            phoneInput.focus();
        }
        return;
    }

    const cleanDigits = phoneVal.replace(/[^0-9]/g, '').slice(-10);
    staffCurrentPhone = cleanDigits;
    const fullNumber = '91' + cleanDigits;

    if (phoneInput) phoneInput.classList.remove('invalid-field');

    const sendBtn = document.getElementById('btn-staff-send-otp');
    const sendBtnText = document.getElementById('btn-staff-send-text');

    if (sendBtn && !isResend) {
        sendBtn.disabled = true;
        if (sendBtnText) sendBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Number...';
    }

    // 3. PRE-OTP BLOCKED CHECK (Firestore + Backend API):
    // Check Firestore team collection before sending any OTP to prevent SMS dispatch to blocked numbers
    const db = getStaffFirestore();
    if (db) {
        try {
            const docSnap = await db.collection('team').doc(cleanDigits).get();
            if (docSnap.exists) {
                const tData = docSnap.data() || {};
                if (tData.status === 'blocked' || tData.status === 'rejected') {
                    if (sendBtn) sendBtn.disabled = false;
                    if (sendBtnText) sendBtnText.textContent = 'Send Verification OTP';
                    if (phoneInput) {
                        phoneInput.classList.add('invalid-field');
                        phoneInput.focus();
                    }
                    if (errorEl) {
                        errorEl.style.display = 'flex';
                        errorEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i> This number is blocked. Please contact the Admin.';
                    }
                    showStaffToast('🚫 This number is blocked. Please contact the Admin.');
                    return; // HALT IMMEDIATELY: DO NOT TRIGGER OTP DISPATCH
                }
            }
        } catch (fsErr) {
            console.warn('Firestore Pre-OTP block check notice:', fsErr);
        }
    }

    try {
        const checkRes = await fetch(resolveApiUrl(`/api/admin-auth?phone=${cleanDigits}`));
        const checkData = await checkRes.json();
        if (checkData && (checkData.isBlocked === true || checkData.status === 'blocked' || checkData.status === 'rejected')) {
            if (sendBtn) sendBtn.disabled = false;
            if (sendBtnText) sendBtnText.textContent = 'Send Verification OTP';
            if (phoneInput) {
                phoneInput.classList.add('invalid-field');
                phoneInput.focus();
            }
            if (errorEl) {
                errorEl.style.display = 'flex';
                errorEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right: 6px;"></i> This number is blocked. Please contact the Admin.';
            }
            showStaffToast('🚫 This number is blocked. Please contact the Admin.');
            return; // HALT IMMEDIATELY: DO NOT TRIGGER OTP DISPATCH
        }
    } catch (err) {
        console.warn('Pre-OTP block verification notice:', err);
    }

    if (sendBtnText && !isResend) {
        sendBtnText.textContent = 'Sending OTP...';
    }

    showStaffToast(`📲 Sending Verification OTP to +91 ${cleanDigits}...`);

    const handleSendSuccess = (data) => {
        console.log('MSG91 Staff sendOtp Success:', data);
        if (sendBtn) sendBtn.disabled = false;
        if (sendBtnText) sendBtnText.textContent = 'Send Verification OTP';

        const stepPhone = document.getElementById('staff-login-step-phone');
        const stepOtp = document.getElementById('staff-login-step-otp');
        const stepPending = document.getElementById('staff-login-step-pending');
        const targetDisplay = document.getElementById('staff-otp-target-display');
        const otpInput = document.getElementById('staff-otp-code');

        if (targetDisplay) targetDisplay.textContent = `+91 ${cleanDigits.slice(0, 5)} ${cleanDigits.slice(5)}`;
        if (stepPhone) stepPhone.style.display = 'none';
        if (stepPending) stepPending.style.display = 'none';
        if (stepOtp) stepOtp.style.display = 'block';
        if (otpInput) {
            otpInput.value = '';
            setTimeout(() => otpInput.focus(), 250);
        }

        startStaffOtpTimer(45);
        showStaffToast('✅ Verification OTP sent! Please enter the 4-digit code.');
    };

    const handleSendFailure = (error) => {
        console.error('MSG91 Staff sendOtp Error:', error);
        if (sendBtn) sendBtn.disabled = false;
        if (sendBtnText) sendBtnText.textContent = 'Send Verification OTP';

        const errorMsg = (error && (error.message || error.description || error.msg)) || 'Failed to send OTP. Please try again.';
        showStaffToast(`❌ ${errorMsg}`);
    };

    const executeSendOtp = () => {
        if (typeof window.sendOtp === 'function') {
            window.sendOtp(fullNumber, handleSendSuccess, handleSendFailure);
            return true;
        } else if (typeof window.initSendOTP === 'function') {
            window.initSendOTP({
                widgetId: STAFF_MSG91_CONFIG.widgetId,
                tokenAuth: STAFF_MSG91_CONFIG.tokenAuth,
                exposeMethods: true,
                identifier: fullNumber,
                success: handleSendSuccess,
                failure: handleSendFailure
            });
            setTimeout(() => {
                if (typeof window.sendOtp === 'function') {
                    window.sendOtp(fullNumber, handleSendSuccess, handleSendFailure);
                }
            }, 300);
            return true;
        }
        return false;
    };

    try {
        if (!executeSendOtp()) {
            console.log('MSG91 Widget SDK loading, retrying sendOtp in 800ms...');
            setTimeout(() => {
                if (!executeSendOtp()) {
                    handleSendFailure({ message: 'MSG91 Widget SDK is loading. Please try again in a few moments.' });
                }
            }, 800);
        }
    } catch (err) {
        handleSendFailure(err);
    }
}

function startStaffOtpTimer(seconds) {
    if (staffOtpTimerId) clearInterval(staffOtpTimerId);
    staffOtpCountdown = seconds;

    const timerText = document.getElementById('staff-otp-timer-text');
    const resendBtn = document.getElementById('btn-staff-resend-otp');

    if (resendBtn) {
        resendBtn.disabled = true;
        resendBtn.style.opacity = '0.5';
    }

    staffOtpTimerId = setInterval(() => {
        staffOtpCountdown--;
        if (timerText) {
            timerText.textContent = staffOtpCountdown > 0 ? `Resend code in ${staffOtpCountdown}s` : "Didn't receive code?";
        }
        if (staffOtpCountdown <= 0) {
            clearInterval(staffOtpTimerId);
            staffOtpTimerId = null;
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.style.opacity = '1';
            }
        }
    }, 1000);
}

function handleStaffChangePhone() {
    if (staffOtpTimerId) {
        clearInterval(staffOtpTimerId);
        staffOtpTimerId = null;
    }
    const stepPhone = document.getElementById('staff-login-step-phone');
    const stepOtp = document.getElementById('staff-login-step-otp');
    const stepPending = document.getElementById('staff-login-step-pending');
    if (stepOtp) stepOtp.style.display = 'none';
    if (stepPending) stepPending.style.display = 'none';
    if (stepPhone) stepPhone.style.display = 'block';

    const phoneInput = document.getElementById('staff-login-phone');
    if (phoneInput) {
        phoneInput.focus();
    }
}

function handleStaffResetToPhone() {
    if (staffOtpTimerId) {
        clearInterval(staffOtpTimerId);
        staffOtpTimerId = null;
    }
    const stepPhone = document.getElementById('staff-login-step-phone');
    const stepOtp = document.getElementById('staff-login-step-otp');
    const stepPending = document.getElementById('staff-login-step-pending');
    if (stepOtp) stepOtp.style.display = 'none';
    if (stepPending) stepPending.style.display = 'none';
    if (stepPhone) stepPhone.style.display = 'block';

    const phoneInput = document.getElementById('staff-login-phone');
    if (phoneInput) {
        phoneInput.value = '';
        phoneInput.focus();
    }
}

function showStaffPendingAccessScreen(name, phone, status = 'pending') {
    const appRoot = document.getElementById('staff-app-root') || document.querySelector('.staff-app');
    if (appRoot) {
        appRoot.style.setProperty('display', 'none', 'important');
    }
    const dashboardView = document.getElementById('staff-dashboard-view');
    if (dashboardView) {
        dashboardView.style.setProperty('display', 'none', 'important');
    }
    hideStaffAuthSplash();

    const overlay = document.getElementById('staff-login-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
    }
    const stepPhone = document.getElementById('staff-login-step-phone');
    const stepOtp = document.getElementById('staff-login-step-otp');
    const stepPending = document.getElementById('staff-login-step-pending');
    const cardEl = document.getElementById('staff-pending-card');
    const nameEl = document.getElementById('staff-pending-display-name');
    const phoneEl = document.getElementById('staff-pending-display-phone');
    const timeEl = document.getElementById('staff-pending-display-time');
    const badgeEl = document.getElementById('staff-pending-display-badge');
    const titleEl = document.getElementById('staff-pending-status-title');
    const descEl = document.getElementById('staff-pending-status-desc');
    const iconEl = document.getElementById('staff-pending-status-icon');
    const checkBtn = document.getElementById('btn-check-staff-pending-status');

    if (stepPhone) stepPhone.style.display = 'none';
    if (stepOtp) stepOtp.style.display = 'none';
    if (stepPending) stepPending.style.display = 'block';

    if (nameEl) nameEl.textContent = name || staffCurrentName || 'Staff Applicant';
    if (phoneEl) phoneEl.textContent = phone ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : `+91 ${staffCurrentPhone}`;
    if (timeEl) {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + ', ' + now.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    if (status === 'blocked' || status === 'rejected') {
        if (cardEl) cardEl.className = 'staff-pending-access-card is-blocked';
        if (titleEl) titleEl.textContent = 'Access Suspended';
        if (descEl) descEl.textContent = 'Access Suspended. This number has been restricted from the platform. Contact support for assistance.';
        if (badgeEl) {
            badgeEl.className = 'staff-pending-status-tag status-red';
            badgeEl.innerHTML = '<i class="fa-solid fa-ban"></i> Access Restricted';
        }
        if (iconEl) {
            iconEl.className = 'staff-pending-icon-ring ring-blocked';
            iconEl.innerHTML = '<i class="fa-solid fa-shield-halved fa-beat-fade" style="color: #ef4444;"></i>';
        }
        if (checkBtn) checkBtn.style.display = 'none';
    } else {
        if (cardEl) cardEl.className = 'staff-pending-access-card';
        if (titleEl) titleEl.textContent = 'Access Pending Approval';
        if (descEl) descEl.textContent = 'Your request has been submitted to management for role verification.';
        if (badgeEl) {
            badgeEl.className = 'staff-pending-status-tag status-amber';
            badgeEl.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Awaiting Verification';
        }
        if (iconEl) {
            iconEl.className = 'staff-pending-icon-ring';
            iconEl.innerHTML = '<i class="fa-solid fa-hourglass-half fa-spin-pulse" style="color: #f59e0b;"></i>';
        }
        if (checkBtn) checkBtn.style.display = 'flex';

        // Start real-time listener for instant automatic unlock upon approval
        startStaffPendingApprovalListener(phone || staffCurrentPhone);
    }
}

let activeStaffPendingApprovalListener = null;
let activeStaffPendingApprovalPoller = null;

function startStaffPendingApprovalListener(phone) {
    if (!phone) return;
    const clean = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (!clean) return;

    if (activeStaffPendingApprovalListener) {
        try { activeStaffPendingApprovalListener(); } catch(e) {}
        activeStaffPendingApprovalListener = null;
    }
    if (activeStaffPendingApprovalPoller) {
        clearInterval(activeStaffPendingApprovalPoller);
        activeStaffPendingApprovalPoller = null;
    }

    const db = getStaffFirestore();
    if (db) {
        try {
            activeStaffPendingApprovalListener = db.collection('team').doc(clean).onSnapshot((doc) => {
                if (doc.exists) {
                    const data = doc.data() || {};
                    if (data.status === 'active') {
                        if (activeStaffPendingApprovalListener) {
                            try { activeStaffPendingApprovalListener(); } catch(e) {}
                            activeStaffPendingApprovalListener = null;
                        }
                        if (activeStaffPendingApprovalPoller) {
                            clearInterval(activeStaffPendingApprovalPoller);
                            activeStaffPendingApprovalPoller = null;
                        }
                        showStaffToast('🎉 Your access request has been approved! Unlocking Staff Portal...');
                        const approvedUser = {
                            id: data.id || ('staff_' + clean),
                            phone: clean,
                            fullName: data.fullName || staffCurrentName || 'Staff Member',
                            role: data.role || 'Staff',
                            portalOrigin: data.portalOrigin || 'staff',
                            status: 'active',
                            isApproved: true
                        };
                        currentStaffUser = approvedUser;
                        try {
                            sessionStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(approvedUser));
                            localStorage.setItem(STAFF_LOCAL_STORAGE_KEY, JSON.stringify(approvedUser));
                            localStorage.setItem(STAFF_VERIFIED_PHONE_KEY, clean);
                        } catch(e) {}
                        unlockStaffDashboard(approvedUser);
                    } else if (data.status === 'blocked' || data.status === 'rejected') {
                        showStaffPendingAccessScreen(data.fullName || staffCurrentName, clean, 'blocked');
                    }
                }
            }, (err) => {
                console.warn('Staff pending approval listener notice:', err);
            });
        } catch(e) {
            console.warn('Error starting staff pending approval listener:', e);
        }
    }

    activeStaffPendingApprovalPoller = setInterval(async () => {
        if (activeStaffPendingApprovalListener) return;
        try {
            const res = await fetch(resolveApiUrl(`/api/admin-auth?phone=${clean}`));
            const data = await res.json();
            if (data && data.success && (data.isApproved || data.status === 'active')) {
                if (activeStaffPendingApprovalListener) {
                    try { activeStaffPendingApprovalListener(); } catch(e) {}
                    activeStaffPendingApprovalListener = null;
                }
                if (activeStaffPendingApprovalPoller) {
                    clearInterval(activeStaffPendingApprovalPoller);
                    activeStaffPendingApprovalPoller = null;
                }
                showStaffToast('🎉 Your access request has been approved! Unlocking Staff Portal...');
                const approvedUser = data.user || {
                    phone: clean,
                    fullName: staffCurrentName || 'Staff Member',
                    role: data.role || 'Staff',
                    status: 'active'
                };
                currentStaffUser = approvedUser;
                try {
                    sessionStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(approvedUser));
                    localStorage.setItem(STAFF_LOCAL_STORAGE_KEY, JSON.stringify(approvedUser));
                    localStorage.setItem(STAFF_VERIFIED_PHONE_KEY, clean);
                } catch(e) {}
                unlockStaffDashboard(approvedUser);
            } else if (data && data.success && (data.isBlocked || data.status === 'blocked' || data.status === 'rejected')) {
                showStaffPendingAccessScreen(data.user?.fullName || staffCurrentName, clean, 'blocked');
            }
        } catch(e) {}
    }, 60000);
}

async function checkStaffPendingApprovalStatus() {
    const checkBtn = document.getElementById('btn-check-staff-pending-status');
    if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Status...';
    }

    const phoneToCheck = staffCurrentPhone || (currentStaffUser && currentStaffUser.phone) || '';
    try {
        const res = await fetch(resolveApiUrl(`/api/admin-auth?phone=${phoneToCheck}`));
        const data = await res.json();

        if (data && data.success) {
            if (data.isMasterAdmin === true || data.isApproved === true || data.status === 'active') {
                showStaffToast('🎉 Your access request has been approved! Unlocking Staff Portal...');
                const approvedUser = data.user || {
                    phone: phoneToCheck,
                    fullName: staffCurrentName || 'Staff Member',
                    role: data.role || 'Staff',
                    status: 'active'
                };
                currentStaffUser = approvedUser;
                try {
                    sessionStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(approvedUser));
                    localStorage.setItem(STAFF_LOCAL_STORAGE_KEY, JSON.stringify(approvedUser));
                } catch (e) { }
                unlockStaffDashboard(approvedUser);
                return;
            } else if (data.status === 'blocked' || data.status === 'rejected') {
                showStaffPendingAccessScreen(data.user?.fullName || staffCurrentName, phoneToCheck, 'blocked');
                showStaffToast('🚫 Your account has been permanently blocked by the Master Admin.');
            } else {
                showStaffPendingAccessScreen(data.user?.fullName || staffCurrentName, phoneToCheck, 'pending');
                showStaffToast('⏳ Your request is still pending review by the Master Admin.');
            }
        } else {
            showStaffPendingAccessScreen(staffCurrentName, phoneToCheck, 'pending');
            showStaffToast('⏳ Your request is still pending review by the Master Admin.');
        }
    } catch (err) {
        showStaffToast('⏳ Status checked. Request is still pending review.');
    } finally {
        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Check Approval Status';
        }
    }
}

async function handleStaffVerifyOtp() {
    const otpInput = document.getElementById('staff-otp-code');
    const enteredOtp = otpInput ? otpInput.value.replace(/[^0-9]/g, '').slice(0, 4) : '';

    if (!enteredOtp || enteredOtp.length !== 4) {
        showStaffToast('⚠️ Please enter the valid 4-digit verification OTP.');
        if (otpInput) {
            otpInput.classList.add('invalid-field');
            otpInput.focus();
            setTimeout(() => otpInput.classList.remove('invalid-field'), 2000);
        }
        return;
    }

    const verifyBtn = document.getElementById('btn-staff-verify-otp');
    const verifyBtnText = document.getElementById('btn-staff-verify-text');

    if (verifyBtn) {
        verifyBtn.disabled = true;
        if (verifyBtnText) verifyBtnText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    }

    const onVerifySuccess = async (data) => {
        console.log('MSG91 Staff OTP Verify Success:', data);

        if (staffOtpTimerId) {
            clearInterval(staffOtpTimerId);
            staffOtpTimerId = null;
        }

        // 1. Check if user is Master Admin exception (9414503886)
        const cleanPhoneDigits = String(staffCurrentPhone || '').replace(/[^0-9]/g, '').slice(-10);
        const isMasterPhone = (cleanPhoneDigits === MASTER_ADMIN_PHONE_NUM);

        // A. MASTER ADMIN DIRECT AUTO-LOGIN (9414503886 always bypasses queue directly with full rights)
        if (isMasterPhone) {
            const masterUser = {
                id: 'master_admin_' + MASTER_ADMIN_PHONE_NUM,
                phone: MASTER_ADMIN_PHONE_NUM,
                fullName: staffCurrentName || 'Master Admin',
                role: 'Master Admin',
                status: 'active',
                isApproved: true,
                isMasterAdmin: true,
                portalOrigin: 'staff',
                lastLoginAt: new Date().toISOString()
            };

            currentStaffUser = masterUser;
            try {
                sessionStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(masterUser));
                localStorage.setItem(STAFF_LOCAL_STORAGE_KEY, JSON.stringify(masterUser));
                localStorage.setItem(STAFF_VERIFIED_PHONE_KEY, MASTER_ADMIN_PHONE_NUM);
            } catch (e) { }

            // Sync with Firestore directly
            const db = getStaffFirestore();
            if (db) {
                db.collection('team').doc(MASTER_ADMIN_PHONE_NUM).set(masterUser, { merge: true }).catch(() => { });
            }

            // Non-blocking background API sync
            fetch(resolveApiUrl('/api/admin-auth'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: MASTER_ADMIN_PHONE_NUM, fullName: staffCurrentName || 'Master Admin', portalOrigin: 'staff' })
            }).catch(() => { });

            if (verifyBtn) verifyBtn.disabled = false;
            if (verifyBtnText) verifyBtnText.textContent = 'Verify & Unlock Portal';

            showStaffToast('🎉 Master Admin Authenticated! Unlocking Staff Portal...');
            unlockStaffDashboard(masterUser);
            return;
        }

        let authPayload = {
            phone: cleanPhoneDigits,
            fullName: staffCurrentName || 'Staff Applicant',
            portalOrigin: 'staff'
        };

        // Direct real-time write to Firestore team collection for 0ms instant display across all admin panels
        const db = getStaffFirestore();
        if (db) {
            try {
                const pendingDocData = {
                    id: 'staff_' + cleanPhoneDigits,
                    phone: cleanPhoneDigits,
                    fullName: staffCurrentName || 'Staff Applicant',
                    role: 'Staff',
                    portalOrigin: 'staff',
                    status: 'pending',
                    timestamp: Date.now(),
                    requestedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    lastLoginAt: new Date().toISOString(),
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(staffCurrentName || 'Applicant')}&background=10b981&color=fff`
                };

                db.collection('team').doc(cleanPhoneDigits).get().then(docSnap => {
                    if (docSnap.exists) {
                        const existingData = docSnap.data() || {};
                        // If already active Admin, Master Admin, or Staff, do NOT overwrite to pending
                        if (existingData.status === 'active' && (existingData.role === 'Admin' || existingData.role === 'Master Admin' || existingData.role === 'Staff')) {
                            return;
                        }
                        if (existingData.status === 'blocked' || existingData.status === 'rejected') {
                            return;
                        }
                    }
                    db.collection('team').doc(cleanPhoneDigits).set(pendingDocData, { merge: true }).catch(() => { });
                }).catch(() => {
                    db.collection('team').doc(cleanPhoneDigits).set(pendingDocData, { merge: true }).catch(() => { });
                });
            } catch (e) { }
        }

        let backendAuthResult = null;
        try {
            const res = await fetch(resolveApiUrl('/api/admin-auth'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(authPayload)
            });
            backendAuthResult = await res.json();
        } catch (err) {
            console.warn('Backend staff auth sync notice:', err.message);
        }

        if (verifyBtn) verifyBtn.disabled = false;
        if (verifyBtnText) verifyBtnText.textContent = 'Verify & Unlock Portal';

        // B. MASTER ADMIN FROM BACKEND RESULT
        if (backendAuthResult && backendAuthResult.isMasterAdmin) {
            const masterUser = backendAuthResult.user || {
                phone: MASTER_ADMIN_PHONE_NUM,
                fullName: staffCurrentName || 'Master Admin',
                role: 'Master Admin',
                status: 'active',
                isApproved: true,
                isMasterAdmin: true,
                lastLoginAt: new Date().toISOString()
            };

            currentStaffUser = masterUser;
            try {
                sessionStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(masterUser));
                localStorage.setItem(STAFF_LOCAL_STORAGE_KEY, JSON.stringify(masterUser));
                localStorage.setItem(STAFF_VERIFIED_PHONE_KEY, MASTER_ADMIN_PHONE_NUM);
            } catch (e) { }

            showStaffToast('🎉 Master Admin Authenticated! Unlocking Staff Portal...');
            unlockStaffDashboard(masterUser);
            return;
        }

        // B. APPROVED ACTIVE STAFF / ADMIN MEMBER
        if (backendAuthResult && backendAuthResult.isApproved && backendAuthResult.status === 'active') {
            const approvedUser = backendAuthResult.user;
            currentStaffUser = approvedUser;
            try {
                sessionStorage.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(approvedUser));
                localStorage.setItem(STAFF_LOCAL_STORAGE_KEY, JSON.stringify(approvedUser));
                localStorage.setItem(STAFF_VERIFIED_PHONE_KEY, staffCurrentPhone);
            } catch (e) { }

            showStaffToast(`🎉 Welcome back, ${approvedUser.fullName || 'Staff'}!`);
            unlockStaffDashboard(approvedUser);
            return;
        }

        // C. BLOCKED USER
        if (backendAuthResult && (backendAuthResult.status === 'blocked' || backendAuthResult.status === 'rejected')) {
            showStaffPendingAccessScreen(staffCurrentName, staffCurrentPhone, 'blocked');
            showStaffToast('🚫 Your account has been permanently blocked by the Master Admin.');
            return;
        }

        // D. NEW USER / PENDING ACCESS REQUEST (Sent to Master Admin Pending queue)
        showStaffPendingAccessScreen(staffCurrentName, staffCurrentPhone, 'pending');
        showStaffToast('📋 Access request submitted! Pending Master Admin review.');
    };

    const onVerifyFailure = (error) => {
        console.error('MSG91 Staff OTP Verify Error:', error);

        if (verifyBtn) verifyBtn.disabled = false;
        if (verifyBtnText) verifyBtnText.textContent = 'Verify & Unlock Portal';

        const errorMsg = (error && (error.message || error.description || error.msg)) || 'Invalid OTP. Please enter the correct 4-digit code.';
        showStaffToast(`❌ ${errorMsg}`);
        if (otpInput) {
            otpInput.value = '';
            otpInput.classList.add('invalid-field');
            otpInput.focus();
            setTimeout(() => otpInput.classList.remove('invalid-field'), 2000);
        }
    };

    try {
        if (typeof window.verifyOtp === 'function') {
            window.verifyOtp(enteredOtp, onVerifySuccess, onVerifyFailure);
        } else if (typeof window.OTPWidget !== 'undefined' && typeof window.OTPWidget.verifyOTP === 'function') {
            const resp = await window.OTPWidget.verifyOTP({
                widgetId: STAFF_MSG91_CONFIG.widgetId,
                otp: enteredOtp
            });
            if (resp && (resp.type === 'success' || resp.message === 'OTP verified success')) {
                onVerifySuccess(resp);
            } else {
                onVerifyFailure(resp || { message: 'Invalid OTP code.' });
            }
        } else {
            console.warn('MSG91 SDK verifyOtp function not found on window');
            onVerifyFailure({ message: 'MSG91 Widget SDK verify method unavailable. Please reload the page.' });
        }
    } catch (err) {
        onVerifyFailure(err);
    }
}

let staffConfirmResolver = null;

function showStaffConfirmDialog({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    icon = '<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i>',
    iconBg = 'rgba(245, 158, 11, 0.15)',
    iconBorder = 'rgba(245, 158, 11, 0.4)',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmType = 'danger'
} = {}) {
    return new Promise((resolve) => {
        if (typeof staffConfirmResolver === 'function') {
            try { staffConfirmResolver(false); } catch (e) { }
        }
        staffConfirmResolver = resolve;
        const modal = document.getElementById('staff-confirm-modal');
        const titleEl = document.getElementById('staff-confirm-title');
        const msgEl = document.getElementById('staff-confirm-message');
        const iconEl = document.getElementById('staff-confirm-icon');
        const okBtn = document.getElementById('staff-confirm-ok-btn');
        const cancelBtn = document.getElementById('staff-confirm-cancel-btn');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        if (iconEl) {
            iconEl.innerHTML = icon;
            iconEl.style.background = iconBg;
            iconEl.style.borderColor = iconBorder;
        }

        if (okBtn) {
            okBtn.textContent = confirmText;
            if (confirmType === 'danger') {
                okBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                okBtn.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.4)';
            } else if (confirmType === 'success') {
                okBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                okBtn.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.4)';
            } else if (confirmType === 'warning') {
                okBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                okBtn.style.boxShadow = '0 4px 14px rgba(245, 158, 11, 0.4)';
            } else {
                okBtn.style.background = 'linear-gradient(135deg, #ff6b00 0%, #ff385c 100%)';
                okBtn.style.boxShadow = '0 4px 14px rgba(255, 107, 0, 0.4)';
            }
        }
        if (cancelBtn) cancelBtn.textContent = cancelText;

        if (modal) {
            modal.style.display = 'flex';
            requestAnimationFrame(() => {
                modal.style.opacity = '1';
            });
        }
    });
}

function handleStaffConfirmResolve(result) {
    const modal = document.getElementById('staff-confirm-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 250);
    }
    if (typeof staffConfirmResolver === 'function') {
        staffConfirmResolver(result);
        staffConfirmResolver = null;
    }
}

async function handleStaffLogout() {
    stopOrderAlertAudio();
    const confirmed = await showStaffConfirmDialog({
        title: 'Lock Staff Portal',
        message: 'Are you sure you want to lock the Staff Portal and sign out of your session?',
        icon: '<i class="fa-solid fa-arrow-right-from-bracket" style="color: #ef4444;"></i>',
        iconBg: 'rgba(239, 68, 68, 0.15)',
        iconBorder: 'rgba(239, 68, 68, 0.4)',
        confirmText: 'Lock & Sign Out',
        confirmType: 'danger'
    });

    if (confirmed) {
        stopOrderAlertAudio();
        stopStaffAudioKeepAlive();
        releaseStaffWakeLock();
        isStaffSoundEnabled = false;
        updateStaffSoundToggleUI();
        cleanupAllStaffListeners();

        try {
            sessionStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
            sessionStorage.removeItem(STAFF_LOCAL_STORAGE_KEY);
            sessionStorage.removeItem(STAFF_VERIFIED_PHONE_KEY);
            sessionStorage.removeItem('perfetto_staff_session_user');
            sessionStorage.removeItem('perfetto_staff_user_session');
            sessionStorage.removeItem('perfetto_staff_verified_phone');
            sessionStorage.removeItem('staff_user');
            sessionStorage.removeItem('perfetto_staff_session');
            sessionStorage.removeItem('perfetto_admin_session_user');
            sessionStorage.removeItem('perfetto_admin_user_session');
            sessionStorage.clear();

            localStorage.removeItem(STAFF_SESSION_STORAGE_KEY);
            localStorage.removeItem(STAFF_LOCAL_STORAGE_KEY);
            localStorage.removeItem(STAFF_VERIFIED_PHONE_KEY);
            localStorage.removeItem('perfetto_staff_session_user');
            localStorage.removeItem('perfetto_staff_user_session');
            localStorage.removeItem('perfetto_staff_verified_phone');
            localStorage.removeItem('staff_user');
            localStorage.removeItem('perfetto_staff_session');
            localStorage.removeItem(STAFF_ORDERS_STORAGE_KEY);

            sessionStorage.setItem('perfetto_staff_logged_out', 'true');
            localStorage.setItem('perfetto_staff_logged_out', 'true');
        } catch (e) { }

        if (typeof firebase !== 'undefined' && firebase.auth) {
            try { firebase.auth().signOut().catch(() => {}); } catch (e) { }
        }

        currentStaffUser = null;
        staffOrders = [];
        staffCurrentName = '';
        staffCurrentPhone = '';

        renderOrders();
        lockStaffDashboard();
        showStaffToast('🔒 Staff Portal locked successfully.');
    }
}

// --------------------------------------------------------------------------
// 2. PAYMENT HELPER & ONLINE AUTO-ACCEPTANCE
// --------------------------------------------------------------------------
function isOnlinePaymentOrder(order) {
    if (!order) return false;
    const method = String(order.paymentMethod || '').toLowerCase();
    const status = String(order.paymentStatus || '').toLowerCase();

    // If marked Cash / COD, it requires manual acceptance
    if (method.includes('cash') || method.includes('cod') || status.includes('cash') || status.includes('cod')) {
        return false;
    }
    // Any other payment (PhonePe, UPI, Online, Card, Paid) is treated as online
    return true;
}

function processAutoAcceptanceForOnlineOrders() {
    let changed = false;
    staffOrders.forEach(order => {
        if (order.status === 'new' && isOnlinePaymentOrder(order)) {
            order.status = 'preparing';
            if (!order.prepStartedAt) {
                order.prepStartedAt = order.createdAt || new Date().toISOString();
            }
            syncOrderStatusToBackend(order.id, 'preparing');
            changed = true;
        }
    });
    if (changed) {
        try {
            localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
        } catch (e) { }
    }
}

// --------------------------------------------------------------------------
// 3. INITIAL ORDERS DATASET & BACKEND SYNC (OLDEST FIRST QUEUE)
// --------------------------------------------------------------------------
const actionInFlightOrders = new Set();

/**
 * Checks whether an order is currently undergoing an in-flight mutation across any ID variant
 */
function isOrderActionInFlight(orderOrId) {
    if (!orderOrId) return false;
    if (typeof orderOrId === 'object') {
        const id1 = String(orderOrId.id || '').trim();
        const clean1 = id1.replace(/^#/, '').trim();
        const id2 = String(orderOrId.orderId || '').trim();
        const clean2 = id2.replace(/^#/, '').trim();
        const docId = String(orderOrId.firestoreDocId || orderOrId.docId || '').trim();
        return (id1 && actionInFlightOrders.has(id1)) ||
               (clean1 && actionInFlightOrders.has(clean1)) ||
               (id2 && actionInFlightOrders.has(id2)) ||
               (clean2 && actionInFlightOrders.has(clean2)) ||
               (docId && actionInFlightOrders.has(docId));
    }
    const raw = String(orderOrId).trim();
    const clean = raw.replace(/^#/, '').trim();
    return (raw && actionInFlightOrders.has(raw)) || (clean && actionInFlightOrders.has(clean));
}

/**
 * Sets or unsets an order's in-flight mutation lock across all possible ID variants
 */
function setOrderActionInFlight(orderOrId, inFlight) {
    if (!orderOrId) return;
    const ids = [];
    if (typeof orderOrId === 'object') {
        if (orderOrId.id) {
            ids.push(String(orderOrId.id).trim());
            ids.push(String(orderOrId.id).replace(/^#/, '').trim());
        }
        if (orderOrId.orderId) {
            ids.push(String(orderOrId.orderId).trim());
            ids.push(String(orderOrId.orderId).replace(/^#/, '').trim());
        }
        if (orderOrId.firestoreDocId) {
            ids.push(String(orderOrId.firestoreDocId).trim());
        }
        if (orderOrId.docId) {
            ids.push(String(orderOrId.docId).trim());
        }
    } else {
        ids.push(String(orderOrId).trim());
        ids.push(String(orderOrId).replace(/^#/, '').trim());
    }
    ids.forEach(id => {
        if (!id) return;
        if (inFlight) {
            actionInFlightOrders.add(id);
        } else {
            actionInFlightOrders.delete(id);
        }
    });
}

let staffOrders = [];

function sortOrdersOldestFirst(orders) {
    if (!Array.isArray(orders)) return [];
    return orders.slice().sort((a, b) => {
        const timeA = getOrderCreationTimeMs(a);
        const timeB = getOrderCreationTimeMs(b);
        return timeA - timeB; // Ascending: oldest/earliest orders at top, new orders at bottom
    });
}

function isValidStaffOrder(order) {
    if (!order || typeof order !== 'object') return false;
    const id = String(order.id || order.orderId || order.docId || order.firestoreDocId || '').trim();
    if (!id || id === 'undefined' || id === 'null' || id === 'NaN') return false;

    // Support items, cart, orderItems, or orders with details/totals
    const items = order.items || order.cart || order.orderItems;
    const hasItems = Array.isArray(items) && items.length > 0;
    const hasDetails = Boolean(order.customerPhone || order.phone || order.customerName || order.total || order.costs || order.status);

    return hasItems || hasDetails;
}

function loadCustomerOrders() {
    // 1. Instant load from LocalStorage
    try {
        const stored = localStorage.getItem(STAFF_ORDERS_STORAGE_KEY) || localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const customerOrders = JSON.parse(stored);
            if (Array.isArray(customerOrders)) {
                staffOrders = sortOrdersOldestFirst(customerOrders.filter(isValidStaffOrder));
            } else {
                staffOrders = [];
            }
        } else {
            staffOrders = [];
        }
    } catch (e) {
        console.error('Error loading customer orders from localStorage:', e);
        staffOrders = [];
    }

    // Auto-accept any online payment orders
    processAutoAcceptanceForOnlineOrders();

    // 2. Asynchronously sync with backend API
    fetchOrdersFromBackend();
}

async function fetchOrdersFromBackend(force = false) {
    // Quota optimization: Skip polling if real-time onSnapshot listener is actively receiving orders
    if (!force && staffOrdersUnsubscribe) {
        return;
    }
    try {
        const response = await apiCall('/orders');
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        const data = await response.json();
        if (data && data.success && Array.isArray(data.orders)) {
            mergeLiveOrdersIntoStaff(data.orders);
            sweepAutoExpiredOrders();
            startStaffAutoExpireInterval();
        }
    } catch (err) {
        console.error('Staff orders sync error:', err);
        if (staffOrders.length === 0) {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) {
                emptyState.innerHTML = `
                    <i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b; font-size: 2rem; margin-bottom: 12px;"></i>
                    <h4>Connection Notice</h4>
                    <p style="margin-bottom: 12px;">Unable to load orders from server (${err.message}).</p>
                    <button type="button" class="btn-touch btn-accept" onclick="fetchOrdersFromBackend()" style="padding: 6px 14px; font-size: 0.85rem; width: auto; margin: 0 auto;">
                        <i class="fa-solid fa-arrows-rotate"></i> Retry Now
                    </button>
                `;
                emptyState.style.display = 'block';
            }
        }
    }
}

let staffSeenOrderIds = new Set();
let isInitialOrdersSyncDone = false;

function getOrderMatchingKey(o) {
    if (!o) return '';
    const raw = o.orderId || o.id || o.firestoreDocId || o.docId || '';
    return String(raw).replace(/^#/, '').trim();
}

function mergeLiveOrdersIntoStaff(serverOrders) {
    if (!Array.isArray(serverOrders)) return;
    const mergedMap = new Map();

    // 1. Server / Firestore orders are the single source of truth across all devices
    serverOrders.forEach(o => {
        if (isValidStaffOrder(o)) {
            const key = getOrderMatchingKey(o);
            if (key) {
                const existingLocal = staffOrders.find(lo => 
                    (lo.firestoreDocId && o.firestoreDocId && lo.firestoreDocId === o.firestoreDocId) ||
                    getOrderMatchingKey(lo) === key
                );
                if (existingLocal && existingLocal.firestoreDocId && !o.firestoreDocId) {
                    o.firestoreDocId = existingLocal.firestoreDocId;
                }
                mergedMap.set(key, o);
            }
        }
    });

    // 2. Only preserve local orders if they were created offline and have not yet synced to remote
    staffOrders.forEach(lo => {
        if (isValidStaffOrder(lo) && lo._isLocalOfflinePending) {
            const key = getOrderMatchingKey(lo);
            if (key && !mergedMap.has(key)) {
                mergedMap.set(key, lo);
            }
        }
    });

    // 3. Sort orders: Oldest/earliest orders at top, new incoming orders at bottom
    const mergedList = sortOrdersOldestFirst(Array.from(mergedMap.values()).filter(isValidStaffOrder));
    staffOrders = mergedList;

    // Check for newly arrived incoming orders (status === 'placed', 'new', or 'pending') while app is active
    if (isInitialOrdersSyncDone) {
        const newIncomingOrders = staffOrders.filter(o => {
            const s = String(o.status || '').trim().toLowerCase();
            const isIncoming = (s === 'placed' || s === 'pending' || s === 'new');
            const id = getOrderMatchingKey(o);
            return isIncoming && !staffSeenOrderIds.has(id) && !staffDismissedAlertOrderIds.has(id);
        });

        if (newIncomingOrders.length > 0) {
            const latestNew = newIncomingOrders[newIncomingOrders.length - 1];
            const orderId = String(latestNew.orderId || latestNew.id);
            const customerName = latestNew.customerName || latestNew.customer?.name || 'Customer';
            const total = latestNew.total || latestNew.costs?.total || '';
            const summary = total ? `${customerName} • ₹${total}` : customerName;

            showStaffToast('🔔 New Customer Order Received in Real-Time!');
            startOrderAlertAudio(orderId, summary, latestNew);
        }
    } else {
        // Exclude initial collection hydration so already existing orders do not re-alarm on page load
    }

    // Populate seen order IDs
    staffOrders.forEach(o => staffSeenOrderIds.add(getOrderMatchingKey(o)));
    isInitialOrdersSyncDone = true;

    // Auto-accept any online payment orders
    processAutoAcceptanceForOnlineOrders();

    // Auto-expire unfulfilled orders older than 3 hours
    sweepAutoExpiredOrders();

    try {
        localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
    } catch (e) { }

    renderOrders();
}

let isStaffSoundEnabled = true; // Sound switch defaults to active ON, respects saved localStorage preference
try {
    const saved = localStorage.getItem('staff_sound_enabled');
    if (saved === 'false') {
        isStaffSoundEnabled = false;
    }
} catch (e) {
    isStaffSoundEnabled = true;
}
let isStaffAudioUnlocked = false;
let isAudioAutoplayBlocked = false;
let pendingOrderAlertData = null;
let staffAudioKeepAliveInterval = null;
let staffScreenWakeLock = null;
let synthesizedBeepInterval = null;

/**
 * Updates the Sound ON/OFF Header Toggle button appearance
 * OFF: "🔕 Audio Muted (Tap to Enable Sound)" with amber/red attention glow
 * ON: "🔔 Sound Active" with stable green indicator
 */
function updateStaffSoundToggleUI() {
    const btn = document.getElementById('btn-staff-sound-toggle');
    const icon = document.getElementById('staff-sound-icon');
    const label = document.getElementById('staff-sound-label');
    if (!btn) return;

    if (isStaffSoundEnabled) {
        btn.className = 'btn-staff-sound-toggle sound-on';
        btn.setAttribute('aria-pressed', 'true');
        btn.title = 'Sound Active (Tap to Mute Kitchen Alerts)';
        if (icon) icon.className = 'fa-solid fa-bell';
        if (label) label.textContent = '🔔 Sound Active';
        dismissStaffAudioBanner();
    } else {
        btn.className = 'btn-staff-sound-toggle sound-off';
        btn.setAttribute('aria-pressed', 'false');
        btn.title = 'Audio Muted (Tap to Enable Kitchen Alerts)';
        if (icon) icon.className = 'fa-solid fa-volume-xmark';
        if (label) label.textContent = '🔕 Audio Muted (Tap to Enable Sound)';
    }
}
window.updateStaffSoundToggleUI = updateStaffSoundToggleUI;

/**
 * Plays a brief 0.3-second confirmation test chime/beep upon user clicking Sound ON
 */
function playSoundActivationChime() {
    try {
        const ctx = getStaffAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
            ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.30);
    } catch (e) {
        console.warn('Activation chime notice:', e.message);
    }
}

/**
 * Requests Screen Wake Lock (navigator.wakeLock) to keep kitchen tablet/screen awake while staff is on duty
 */
async function requestStaffWakeLock() {
    if ('wakeLock' in navigator && navigator.wakeLock) {
        try {
            if (staffScreenWakeLock && !staffScreenWakeLock.released) return;
            staffScreenWakeLock = await navigator.wakeLock.request('screen');
            staffScreenWakeLock.addEventListener('release', () => {
                console.log('📱 [Staff Portal] Screen Wake Lock released.');
            });
            console.log('📱 [Staff Portal] Screen Wake Lock active (display sleep prevented).');
        } catch (err) {
            console.warn('Screen wakeLock notice:', err.message);
        }
    }
}

/**
 * Releases Screen Wake Lock
 */
async function releaseStaffWakeLock() {
    if (staffScreenWakeLock) {
        try {
            await staffScreenWakeLock.release();
        } catch (e) {}
        staffScreenWakeLock = null;
    }
}

/**
 * Starts the silent keep-alive heartbeat interval (every 25s) to prevent browser tab/audio sleep
 */
function startStaffAudioKeepAlive() {
    stopStaffAudioKeepAlive();

    const playSilentHeartbeat = () => {
        if (!isStaffSoundEnabled) return;
        try {
            const ctx = getStaffAudioContext();
            if (!ctx) return;
            if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
                ctx.resume().catch(() => {});
            }
            // 1 sample silent buffer with zero gain
            const silentBuffer = ctx.createBuffer(1, 1, 22050);
            const source = ctx.createBufferSource();
            source.buffer = silentBuffer;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, ctx.currentTime);
            source.connect(gain);
            gain.connect(ctx.destination);
            source.start(0);
        } catch (err) {
            console.warn('Audio keep-alive notice:', err.message);
        }
    };

    playSilentHeartbeat();
    staffAudioKeepAliveInterval = setInterval(playSilentHeartbeat, 25000);
    console.log('💓 [Staff Audio] Silent keep-alive heartbeat started (every 25s).');
}

/**
 * Stops the silent keep-alive heartbeat interval
 */
function stopStaffAudioKeepAlive() {
    if (staffAudioKeepAliveInterval) {
        clearInterval(staffAudioKeepAliveInterval);
        staffAudioKeepAliveInterval = null;
        console.log('🛑 [Staff Audio] Silent keep-alive heartbeat stopped.');
    }
}

/**
 * Unlocks Web AudioContext, primes HTML5 audio, requests screen wake lock,
 * starts audio keep-alive, updates the header toggle indicator to "Sound Active".
 * Standalone Sound Pill: acts purely as an indicator and volume mute override.
 */
function enableStaffSound(options = {}) {
    console.log('🔔 [Staff Audio] Activating sound notifications via user interaction...');
    isStaffSoundEnabled = true;
    try {
        localStorage.setItem('staff_sound_enabled', 'true');
    } catch (e) { }

    // 1. Immediately unlock and initialize browser AudioContext
    const ctx = getStaffAudioContext();
    if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
        ctx.resume().catch(() => {});
    }
    unlockStaffAudioAlerts(false);

    // 2. Play 0.3-second confirmation test chime if requested
    if (options.playChime) {
        playSoundActivationChime();
    }

    // 3. Request Screen Wake Lock (prevents display sleep on kitchen device)
    requestStaffWakeLock();

    // 4. Start keep-alive audio heartbeat (every 25s)
    startStaffAudioKeepAlive();

    // 5. Update UI badge to active green state
    updateStaffSoundToggleUI();
    if (options.showToast) {
        showStaffToast('🔔 Sound Active! Kitchen audio alerts & keep-alive enabled.');
    }

    // Notice: Step 6 (retroactive search for past incoming orders) has been DECOUPLED and removed.
    // Audio and modal trigger exclusively from real-time database snapshot additions.
}
window.enableStaffSound = enableStaffSound;

/**
 * Toggles the staff sound switch ON/OFF manually via header button.
 * Acts purely as an indicator and volume mute override.
 */
async function toggleStaffSoundState() {
    if (isStaffSoundEnabled) {
        // Switch OFF: Mute alerts, stop keep-alive, release wake lock, update UI
        console.log('🔕 [Staff Audio] Sound toggled OFF by staff.');
        isStaffSoundEnabled = false;
        try {
            localStorage.setItem('staff_sound_enabled', 'false');
        } catch (e) { }

        // Pause audio if currently playing (volume mute override)
        try {
            if (staffOrderAlertAudio) {
                staffOrderAlertAudio.pause();
            }
        } catch (e) { }
        if (synthesizedBeepInterval) {
            clearInterval(synthesizedBeepInterval);
            synthesizedBeepInterval = null;
        }

        stopStaffAudioKeepAlive();
        releaseStaffWakeLock();
        updateStaffSoundToggleUI();
        showStaffToast('🔕 Audio Muted. Kitchen alerts silenced.');
    } else {
        // Switch ON
        try {
            localStorage.setItem('staff_sound_enabled', 'true');
        } catch (e) { }
        enableStaffSound({ playChime: true, showToast: true });

        // If an order alert is active while unmuting, resume audio chime loop
        if (isOrderAlertAudioPlaying && currentAlertingOrderId) {
            try {
                const audio = getOrderAlertAudio();
                if (audio) {
                    audio.currentTime = 0;
                    audio.loop = true;
                    audio.muted = false;
                    audio.volume = 1.0;
                    const p = audio.play();
                    if (p && typeof p.then === 'function') {
                        p.catch(() => startSynthesizedBeepLoop());
                    }
                }
            } catch (e) {
                startSynthesizedBeepLoop();
            }
        }
    }
}
window.toggleStaffSoundState = toggleStaffSoundState;

let hasUniversalAudioUnlocked = false;

/**
 * Attaches a global, persistent interaction listener to window/document for click, touchstart, touchend, pointerdown, keydown.
 * Upon the user's interaction anywhere on screen (tapping card, changing tabs, clicking background):
 * - Requests native browser notification permission (Notification.requestPermission())
 * - Unlocks AudioContext to satisfy autoplay restrictions
 * - Explicitly primes the persistent HTMLAudioElement with unmuted near-zero volume play so Android Chrome allows background/stream playback
 * - Automatically updates application audio state to enabled
 * - Switches header audio indicator from "Audio Muted" to green "Sound Active"
 * - Keeps header button functional for direct manual toggling
 */
function unlockAudio(event) {
    if (isStaffAudioUnlocked) return;
    console.log('Audio unlocked');

    // 1. Resume AudioContext
    const ctx = getStaffAudioContext();
    if (ctx) {
        if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
            ctx.resume().catch(() => {});
        }
        // Play and instantly pause a muted 1ms silent buffer to permanently unlock playback authorization for the session
        try {
            const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.001)), ctx.sampleRate);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start(0);
        } catch (e) { }
    }

    // 2. Play and instantly pause HTML5 audio element
    try {
        const audio = getOrderAlertAudio();
        if (audio) {
            audio.muted = true;
            const p = audio.play();
            if (p !== undefined && typeof p.then === 'function') {
                p.then(() => {
                    if (!isOrderAlertAudioPlaying) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                    audio.muted = false;
                    audio.volume = 1.0;
                }).catch(() => {
                    audio.muted = false;
                    audio.volume = 1.0;
                });
            } else {
                audio.muted = false;
                audio.volume = 1.0;
            }
        }
    } catch (e) { }

    // 3. Request Web Notification permission on genuine user gesture & register FCM token
    if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') {
            try {
                Notification.requestPermission().then((perm) => {
                    if (perm === 'granted') {
                        requestAndRegisterStaffFcmToken();
                    }
                }).catch(() => {});
            } catch (e) { }
        } else if (Notification.permission === 'granted') {
            requestAndRegisterStaffFcmToken();
        }
    }

    isStaffAudioUnlocked = true;
    isAudioAutoplayBlocked = false;
    hasUniversalAudioUnlocked = true;
    enableStaffSound({ playChime: false, showToast: false });
    dismissStaffAudioBanner();

    // 4. Once clicked, immediately replay pending sirens
    if (pendingOrderAlertData && isStaffSoundEnabled) {
        const { orderId, details, orderData } = pendingOrderAlertData;
        pendingOrderAlertData = null;
        startOrderAlertAudio(orderId, details, orderData);
    }
}
window.unlockAudio = unlockAudio;

/**
 * Attaches a global, persistent interaction listener to window/document for click, touchstart, touchend, pointerdown, keydown.
 */
function setupUniversalAudioUnlock() {
    ['click', 'touchstart'].forEach(evt => {
        document.addEventListener(evt, unlockAudio, { once: true, capture: true, passive: true });
        window.addEventListener(evt, unlockAudio, { once: true, capture: true, passive: true });
    });
    ['pointerdown', 'keydown'].forEach(evt => {
        document.addEventListener(evt, unlockAudio, { capture: true, passive: true });
        window.addEventListener(evt, unlockAudio, { capture: true, passive: true });
    });
}
window.setupUniversalAudioUnlock = setupUniversalAudioUnlock;

if (typeof document !== 'undefined') {
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
}

function unlockStaffAudioAlerts(silent = true) {
    unlockAudio();
}
window.unlockStaffAudioAlerts = unlockStaffAudioAlerts;

function dismissStaffAudioBanner() {
    const banner = document.getElementById('staff-audio-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}
window.dismissStaffAudioBanner = dismissStaffAudioBanner;

function checkAndShowStaffAudioBanner() {
    const banner = document.getElementById('staff-audio-banner');
    const bannerText = document.getElementById('staff-audio-banner-text');
    if (!banner) return;
    const ctx = getStaffAudioContext();
    const needsUnlock = !isStaffAudioUnlocked || isAudioAutoplayBlocked || (ctx && ctx.state === 'suspended');
    if (needsUnlock) {
        if (bannerText) {
            bannerText.innerHTML = '🔊 Click anywhere to activate live audio alerts';
        }
        banner.style.display = 'block';
        showStaffToast('🔊 Click anywhere to activate live audio alerts');
    } else {
        banner.style.display = 'none';
    }
}
window.checkAndShowStaffAudioBanner = checkAndShowStaffAudioBanner;

// --------------------------------------------------------------------------
// 4. UPWARD ELAPSED TIMER & DYNAMIC GRADIENT SHIFT CALCULATIONS
// --------------------------------------------------------------------------
function getOrderCreationTimeMs(order) {
    if (!order) return Date.now();
    const raw = order.createdAt || order.created_at || order.timestamp || order.date || order.prepStartedAt;
    if (raw) {
        if (typeof raw === 'number') {
            return raw < 1e11 ? raw * 1000 : raw;
        }
        if (typeof raw === 'object') {
            if (typeof raw.toMillis === 'function') {
                return raw.toMillis();
            }
            if (typeof raw.toDate === 'function') {
                return raw.toDate().getTime();
            }
            if (raw.seconds) {
                return raw.seconds * 1000;
            }
            if (raw._seconds) {
                return raw._seconds * 1000;
            }
        }
        const parsed = new Date(raw).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const idStr = String(order.id || order.orderId || order.firestoreDocId || '');
    const match = idStr.match(/(\d{10,13})/);
    if (match) {
        const num = parseInt(match[1], 10);
        if (num > 1500000000 && num < 2500000000000) {
            return num < 1e11 ? num * 1000 : num;
        }
    }
    return Date.now();
}

/**
 * Calculates a smooth, continuous HSL color gradient shift:
 * - 0m (0s) to 7m (420s): Smooth gradual shift from Pure Green (142°) to Pure Yellow (48°)
 * - 7m (420s) to 14m (840s): Smooth gradual shift from Pure Yellow (48°) to Pure Red (0°)
 * - 14m+ (840s+): Deep Red (0°), with critical pulse alert at 20m+
 */
function getDynamicTimerColor(elapsedSec) {
    let hue, sat, light;

    if (elapsedSec <= 0) {
        hue = 142;
        sat = 72;
        light = 52;
    } else if (elapsedSec < 420) {
        // 0 to 7 minutes: Continuous blend Green (142°) -> Yellow (48°)
        const progress = elapsedSec / 420;
        hue = 142 - progress * (142 - 48);
        sat = 72 + progress * (95 - 72);
        light = 52;
    } else if (elapsedSec < 840) {
        // 7 to 14 minutes: Continuous blend Yellow (48°) -> Red (0°)
        const progress = (elapsedSec - 420) / 420;
        hue = 48 - progress * 48;
        sat = 95 - progress * (95 - 85);
        light = 52 + progress * (58 - 52);
    } else {
        // 14+ minutes: Red
        hue = 0;
        sat = 85;
        light = 58;
    }

    hue = Math.round(hue);
    sat = Math.round(sat);
    light = Math.round(light);

    return {
        hue,
        sat,
        light,
        textColor: `hsl(${hue}, ${sat}%, ${light}%)`,
        borderColor: `hsla(${hue}, ${sat}%, ${light}%, 0.55)`,
        bgColor: `hsla(${hue}, ${sat}%, ${light}%, 0.16)`,
        shadowColor: `hsla(${hue}, ${sat}%, ${light}%, 0.28)`,
        isCritical: elapsedSec >= 1200 // 20+ mins
    };
}

const PENDING_STAFF_STATUSES = new Set([
    "new",
    "placed",
    "pending",
    "confirmed",
    "received",
    "order_placed",
    "preparing",
    "kitchen",
    "ready",
    "ready_for_pickup",
    "delivery",
    "out_for_delivery",
    "out-for-delivery",
    "dispatched",
    "in_transit"
]);
const COMPLETED_STAFF_STATUSES = new Set(["delivered", "completed"]);
const REJECTED_STAFF_STATUSES = new Set(["rejected", "cancelled", "canceled", "declined"]);

function isPendingStaffOrder(order) {
    if (!order) return false;
    const s = String(order.status || '').trim().toLowerCase();
    // Strictly exclude completed and rejected/cancelled orders
    if (isCompletedStaffOrder(order) || isRejectedStaffOrder(order)) return false;
    if (order.autoExpired === true || order.isAutoExpired === true || order.rejectedBy === 'SYSTEM_AUTO_EXPIRE' || s === 'expired' || s === 'auto_expired' || (typeof isOrder100MinsExpired === 'function' && isOrder100MinsExpired(order))) {
        return false;
    }
    // Any other order status is considered pending/active in kitchen
    return PENDING_STAFF_STATUSES.has(s) || true;
}

function isCompletedStaffOrder(order) {
    if (!order) return false;
    const s = String(order.status || '').trim().toLowerCase();
    return COMPLETED_STAFF_STATUSES.has(s);
}

function isRejectedStaffOrder(order) {
    if (!order) return false;
    const s = String(order.status || '').trim().toLowerCase();
    if (order.autoExpired === true || order.isAutoExpired === true || order.rejectedBy === 'SYSTEM_AUTO_EXPIRE' || s === 'expired' || s === 'auto_expired' || (typeof isOrder100MinsExpired === 'function' && isOrder100MinsExpired(order))) {
        return true;
    }
    return REJECTED_STAFF_STATUSES.has(s);
}

function isFinishedStaffOrder(order) {
    return isCompletedStaffOrder(order) || isRejectedStaffOrder(order);
}

function formatStaffTimestamp(raw) {
    if (!raw) return '';
    try {
        let d;
        if (typeof raw === 'object' && typeof raw.toDate === 'function') {
            d = raw.toDate();
        } else if (typeof raw === 'object' && raw.seconds !== undefined) {
            d = new Date(raw.seconds * 1000);
        } else {
            d = new Date(raw);
        }
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return '';
    }
}

function getOrderElapsedData(order) {
    const isCompleted = order.status === 'completed' || order.status === 'delivered';
    const isRejected = order.status === 'rejected' || order.status === 'cancelled' || order.status === 'declined';
    const createdMs = getOrderCreationTimeMs(order);

    let elapsedSec = 0;

    if (isCompleted || isRejected) {
        // FREEZE TIMER PERMANENTLY ON COMPLETION
        if (typeof order.completedDurationSec === 'number' && !isNaN(order.completedDurationSec)) {
            elapsedSec = Math.max(0, Math.floor(order.completedDurationSec));
        } else {
            const endIso = order.completedAt || order.deliveredAt || order.updatedAt;
            const endMs = endIso ? new Date(endIso).getTime() : Date.now();
            elapsedSec = Math.max(0, Math.floor((endMs - createdMs) / 1000));
            // Cache duration on order object
            order.completedDurationSec = elapsedSec;
        }
    } else {
        // LIVE UPWARD COUNTING
        const nowMs = Date.now();
        elapsedSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
    }

    const elapsedMins = Math.floor(elapsedSec / 60);
    const remSecs = elapsedSec % 60;

    let formatted = '';
    if (elapsedMins < 60) {
        formatted = `${String(elapsedMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
    } else {
        const hrs = Math.floor(elapsedMins / 60);
        const mins = elapsedMins % 60;
        formatted = `${hrs}h ${String(mins).padStart(2, '0')}m`;
    }

    const color = getDynamicTimerColor(elapsedSec);

    let stageTitle = `Elapsed: ${formatted}`;
    if (isCompleted) {
        stageTitle = `Final Duration: ${formatted} (Completed & Frozen)`;
    } else if (isRejected) {
        stageTitle = `Order Declined (${formatted})`;
    } else if (elapsedMins >= 20) {
        stageTitle = `Critical Delay: ${formatted} (20+ mins)`;
    } else if (elapsedMins >= 14) {
        stageTitle = `Delayed: ${formatted} (14+ mins)`;
    } else if (elapsedMins >= 7) {
        stageTitle = `Attention: ${formatted} (7-14 mins)`;
    } else {
        stageTitle = `On Time: ${formatted} (0-7 mins)`;
    }

    return {
        elapsedSec,
        elapsedMins,
        formatted,
        color,
        isCompleted,
        isRejected,
        stageTitle,
        styleAttr: `color: ${color.textColor}; border-color: ${color.borderColor}; background-color: ${color.bgColor}; box-shadow: 0 2px 12px ${color.shadowColor};`
    };
}

// --------------------------------------------------------------------------
// 5. DOM INITIALIZATION & LIVE TIMER LOOP
// --------------------------------------------------------------------------
function syncCustomerOrders() {
    const oldCount = staffOrders.length;
    loadCustomerOrders();
    if (oldCount > 0 && staffOrders.length > oldCount) {
        showStaffToast('🔔 New Customer Order Received!');
    }
    renderOrders();
}

let staffLiveTimersInterval = null;
let staffBackendSyncInterval = null;
let staffTimerWorker = null;

function initStaffWebWorkerTimer() {
    if (typeof Worker === 'undefined' || staffTimerWorker) return;
    try {
        const workerBlob = new Blob([`
            var timerId = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (timerId) clearInterval(timerId);
                    timerId = setInterval(function() {
                        self.postMessage('tick');
                    }, 1000);
                } else if (e.data === 'stop') {
                    if (timerId) clearInterval(timerId);
                    timerId = null;
                }
            };
        `], { type: 'application/javascript' });
        staffTimerWorker = new Worker(URL.createObjectURL(workerBlob));
        staffTimerWorker.onmessage = function(e) {
            if (e.data === 'tick' && currentStaffUser && Array.isArray(staffOrders) && staffOrders.length > 0) {
                updateLiveTimers();
            }
        };
        staffTimerWorker.postMessage('start');
    } catch (e) {
        console.warn('Web Worker timer not supported, falling back to window interval:', e);
    }
}

function initStaffApp() {
    // Initial fetch of settings & check initial auth state
    fetchStaffSettingsFromBackend();
    checkStaffAuthSession();
    startStaffAutoExpireInterval();

    // Sound switch reflects active preference (defaults to active ON)
    try {
        const saved = localStorage.getItem('staff_sound_enabled');
        isStaffSoundEnabled = saved !== 'false';
    } catch (e) {
        isStaffSoundEnabled = true;
    }
    updateStaffSoundToggleUI();

    // Preload audio and audio context early
    getOrderAlertAudio();
    getStaffAudioContext();

    // Check and show audio alert banner if audio context is suspended
    checkAndShowStaffAudioBanner();

    // Universal Tap-to-Unlock Audio: user's first tap anywhere unlocks audio & enables kitchen alerts
    setupUniversalAudioUnlock();

    // Modal backdrop dismissal handlers
    const setupBackdropDismiss = (modalId, dismissFn) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    dismissFn();
                }
            });
        }
    };
    setupBackdropDismiss('staff-confirm-modal', () => handleStaffConfirmResolve(false));
    setupBackdropDismiss('staff-reject-modal', () => closeStaffRejectModal());
    setupBackdropDismiss('staff-incoming-order-modal', () => dismissIncomingOrderAlert());

    // Global keyboard shortcuts (Escape key dismissals)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            const confirmModal = document.getElementById('staff-confirm-modal');
            if (confirmModal && confirmModal.style.display !== 'none') {
                handleStaffConfirmResolve(false);
                return;
            }
            const incomingModal = document.getElementById('staff-incoming-order-modal');
            if (incomingModal && incomingModal.style.display !== 'none') {
                dismissIncomingOrderAlert();
                return;
            }
        }
    });

    // App Visibility Listener (re-awaken on foreground return)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('👁️ [Staff Portal] App returned to foreground.');
            const ctx = getStaffAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
            checkAndShowStaffAudioBanner();
            if (currentStaffUser) {
                fetchOrdersFromBackend();
                renderOrders();
            }
        }
    });

    // Network resilience: auto-recovery on connection restore
    window.addEventListener('online', () => {
        console.log('🌐 [Staff Network] Connection restored (online).');
        showStaffToast('🌐 Internet connection restored! Resyncing live orders...');
        if (currentStaffUser) {
            if (!staffOrdersUnsubscribe) listenToFirestoreStaffOrders();
            if (!staffSettingsUnsubscribe) listenToFirestoreStaffSettings();
            fetchOrdersFromBackend();
        }
    });

    window.addEventListener('offline', () => {
        console.warn('⚠️ [Staff Network] Connection lost (offline).');
        showStaffToast('⚠️ Network connection lost! Operating in cached offline mode.');
    });

    // 1-second interval for smooth live upward elapsed timer & gradual color shift
    if (staffLiveTimersInterval) clearInterval(staffLiveTimersInterval);
    staffLiveTimersInterval = setInterval(() => {
        if (currentStaffUser && staffOrders.length > 0) {
            updateLiveTimers();
        }
    }, 1000);

    // Inline Web Worker ticker to avoid mobile background tab timer throttling
    initStaffWebWorkerTimer();

    // Fallback 60-second interval for backend sync (only if real-time listener is offline)
    if (staffBackendSyncInterval) clearInterval(staffBackendSyncInterval);
    staffBackendSyncInterval = setInterval(() => {
        if (currentStaffUser) {
            fetchOrdersFromBackend();
        }
    }, 60000);

    // 60-second recurring sweeper for auto-expiring unfulfilled orders older than 3 hours
    if (staffAutoExpireInterval) clearInterval(staffAutoExpireInterval);
    staffAutoExpireInterval = setInterval(() => {
        sweepAutoExpiredOrders();
    }, 60000);
}

// Auto-run initStaffApp regardless of whether DOMContentLoaded already fired
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStaffApp);
} else {
    initStaffApp();
}

// Re-acquire Screen Wake Lock, auto-resume audio context, and re-verify orders listener on visibility
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        sweepAutoExpiredOrders();
        if (isStaffSoundEnabled) {
            requestStaffWakeLock();
            const ctx = getStaffAudioContext();
            if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
                ctx.resume().catch(() => {});
            }
        }
        if (currentStaffUser && !staffOrdersUnsubscribe) {
            listenToFirestoreStaffOrders();
        }
    }
});

function updateLiveTimers() {
    staffOrders.forEach(order => {
        // Skip updating active elapsed time if already completed/frozen
        if (isFinishedStaffOrder(order)) {
            return;
        }

        // Hard Firestore auto-expiry state transition: do NOT merely swap a UI text badge to "Expired"
        if (isOrder100MinsExpired(order) || (Date.now() - getOrderCreationTimeMs(order) >= ONE_HUNDRED_MINS_EXPIRATION_MS)) {
            autoRejectExpiredOrder(order);
            return;
        }

        const badgeEl = document.getElementById(`timer-badge-${order.id}`);
        const valEl = document.getElementById(`timer-val-${order.id}`);
        if (badgeEl && valEl) {
            const timerData = getOrderElapsedData(order);
            valEl.textContent = timerData.formatted;

            // Apply continuous smooth color transition
            badgeEl.style.color = timerData.color.textColor;
            badgeEl.style.borderColor = timerData.color.borderColor;
            badgeEl.style.backgroundColor = timerData.color.bgColor;
            badgeEl.style.boxShadow = `0 2px 12px ${timerData.color.shadowColor}`;
            badgeEl.title = timerData.stageTitle;

            if (timerData.color.isCritical) {
                badgeEl.classList.add('timer-critical');
            } else {
                badgeEl.classList.remove('timer-critical');
            }
        }
    });
}

window.addEventListener('storage', (e) => {
    if (!e.key || e.key === 'perfettoCustomerOrders' || e.key === STAFF_ORDERS_STORAGE_KEY) {
        syncCustomerOrders();
    }
});

// --------------------------------------------------------------------------
// 6. ACCURATE AUTO GPS NAVIGATION & TURN-BY-TURN ROUTE DISPATCHER
// --------------------------------------------------------------------------
const RESTAURANT_ORIGIN_LAT = 29.533736;
const RESTAURANT_ORIGIN_LNG = 73.447895;

function extractOrderGpsCoordinates(order) {
    if (!order) return null;

    // 1. Direct top-level fields
    let lat = order.gpsLat ?? order.latitude ?? (order.gps && order.gps.lat) ?? (order.coords && order.coords.lat);
    let lng = order.gpsLng ?? order.longitude ?? (order.gps && order.gps.lng) ?? (order.coords && order.coords.lng);

    // 2. Nested in deliveryDetails
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
        if (order.deliveryDetails) {
            lat = order.deliveryDetails.gpsLat ?? order.deliveryDetails.latitude ?? (order.deliveryDetails.gps && order.deliveryDetails.gps.lat) ?? (order.deliveryDetails.coords && order.deliveryDetails.coords.lat);
            lng = order.deliveryDetails.gpsLng ?? order.deliveryDetails.longitude ?? (order.deliveryDetails.gps && order.deliveryDetails.gps.lng) ?? (order.deliveryDetails.coords && order.deliveryDetails.coords.lng);
        }
    }

    // 3. Nested in customer profile
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
        if (order.customer) {
            lat = order.customer.gpsLat ?? order.customer.latitude ?? (order.customer.gps && order.customer.gps.lat) ?? (order.customer.coords && order.customer.coords.lat);
            lng = order.customer.gpsLng ?? order.customer.longitude ?? (order.customer.gps && order.customer.gps.lng) ?? (order.customer.coords && order.customer.coords.lng);
        }
    }

    // 4. Validate and parse numbers
    if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat !== 0 && parsedLng !== 0) {
            return { lat: parsedLat, lng: parsedLng };
        }
    }

    return null;
}

function getGoogleMapsNavigationUrl(order) {
    if (!order) return 'https://www.google.com/maps/dir/?api=1&destination=Raisinghnagar%2C%20Rajasthan&travelmode=driving&dir_action=navigate';

    const coords = extractOrderGpsCoordinates(order);
    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        // Direct turn-by-turn navigation to exact pinned GPS coordinates
        return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving&dir_action=navigate`;
    }

    const rawAddress = (order.address || '').trim();
    if (rawAddress) {
        const fullAddress = rawAddress.toLowerCase().includes('raisinghnagar')
            ? rawAddress
            : `${rawAddress}, Raisinghnagar, Rajasthan`;
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}&travelmode=driving&dir_action=navigate`;
    }

    return 'https://www.google.com/maps/dir/?api=1&destination=Perfetto%20Pizza%2C%20Raisinghnagar%2C%20Rajasthan&travelmode=driving&dir_action=navigate';
}

function openOrderGpsNavigation(orderId) {
    const order = staffOrders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
    const url = getGoogleMapsNavigationUrl(order);
    try {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            window.location.href = url;
        }
    } catch (e) {
        window.location.href = url;
    }
}
window.openOrderGpsNavigation = openOrderGpsNavigation;

// Backward-compatibility dispatcher
function openGoogleMapsNavigation(lat, lng, rawAddress) {
    const cleanLat = parseFloat(lat);
    const cleanLng = parseFloat(lng);

    let url = '';
    if (!isNaN(cleanLat) && !isNaN(cleanLng) && cleanLat !== 0 && cleanLng !== 0) {
        url = `https://www.google.com/maps/dir/?api=1&destination=${cleanLat},${cleanLng}&travelmode=driving&dir_action=navigate`;
    } else if (rawAddress && rawAddress.trim()) {
        const cleanAddress = rawAddress.trim();
        const fullAddress = cleanAddress.toLowerCase().includes('raisinghnagar')
            ? cleanAddress
            : `${cleanAddress}, Raisinghnagar, Rajasthan`;
        url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}&travelmode=driving&dir_action=navigate`;
    } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('Perfetto Pizza, Raisinghnagar, Rajasthan')}&travelmode=driving`;
    }

    try {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            window.location.href = url;
        }
    } catch (e) {
        window.location.href = url;
    }
}
window.openGoogleMapsNavigation = openGoogleMapsNavigation;

// --------------------------------------------------------------------------
// 7. TAB-BASED ORDER FILTERING & RENDERER (PENDING VS COMPLETED)
// --------------------------------------------------------------------------
let currentStaffTab = 'pending'; // 'pending' | 'completed' | 'rejected'

function switchStaffTab(tab) {
    currentStaffTab = tab;

    // Immediately stop and reset audio when leaving active pending orders tab
    if (tab !== 'pending') {
        stopOrderAlertAudio();
    }

    const btnPending = document.getElementById('tab-btn-pending');
    const btnCompleted = document.getElementById('tab-btn-completed');
    const btnRejected = document.getElementById('tab-btn-rejected');
    const heading = document.getElementById('section-heading');
    const deleteCompletedBtn = document.getElementById('btn-delete-all-completed');
    const liveBadge = document.getElementById('live-pulse-badge');

    if (btnPending) {
        btnPending.classList.toggle('active', tab === 'pending');
    }
    if (btnCompleted) {
        btnCompleted.classList.toggle('active', tab === 'completed');
    }
    if (btnRejected) {
        btnRejected.classList.toggle('active', tab === 'rejected');
    }

    if (heading) {
        if (tab === 'pending') {
            heading.textContent = 'Active Kitchen Orders';
        } else if (tab === 'completed') {
            heading.textContent = 'Completed Orders (Delivered)';
        } else {
            heading.textContent = 'Rejected & Cancelled Orders';
        }
    }

    const isAdmin = isStaffAdminUser(currentStaffUser);
    if (deleteCompletedBtn) {
        deleteCompletedBtn.style.display = ((tab === 'completed' || tab === 'rejected') && isAdmin) ? 'inline-flex' : 'none';
        const spanText = deleteCompletedBtn.querySelector('span');
        if (spanText) {
            spanText.textContent = tab === 'rejected' ? 'Clear All Rejected' : 'Clear All Completed';
        }
    }

    if (liveBadge) {
        liveBadge.style.display = tab === 'pending' ? 'inline-flex' : 'none';
    }

    renderOrders();
}
window.switchStaffTab = switchStaffTab;

// 7C. DEEP-LINK TAB ROUTER (READS ?tab= / #tab from URL)
function applyStaffTabFromUrl() {
    try {
        if (typeof window === 'undefined') return;
        const urlParams = new URLSearchParams(window.location.search);
        let tab = urlParams.get('tab') || window.location.hash.replace('#', '');
        if (tab) {
            tab = String(tab).toLowerCase().trim();
            if (tab === 'rejected' || tab === 'cancelled' || tab === 'canceled' || tab === 'declined') {
                tab = 'rejected';
            } else if (tab === 'completed' || tab === 'delivered') {
                tab = 'completed';
            } else if (tab === 'pending' || tab === 'active') {
                tab = 'pending';
            }
            if (['pending', 'completed', 'rejected'].includes(tab)) {
                switchStaffTab(tab);
            }
        }
    } catch (e) {
        console.warn('Error reading staff tab routing parameter:', e);
    }
}
window.applyStaffTabFromUrl = applyStaffTabFromUrl;

if (typeof window !== 'undefined') {
    window.addEventListener('popstate', applyStaffTabFromUrl);
    window.addEventListener('hashchange', applyStaffTabFromUrl);
}

function renderOrders() {
    const container = document.getElementById('orders-list-container');
    const emptyState = document.getElementById('empty-state');
    const pendingCountEl = document.getElementById('pending-orders-count');
    const completedCountEl = document.getElementById('completed-orders-count');
    const rejectedCountEl = document.getElementById('rejected-orders-count');
    const deleteCompletedBtn = document.getElementById('btn-delete-all-completed');
    const liveBadge = document.getElementById('live-pulse-badge');

    if (liveBadge) {
        liveBadge.style.display = currentStaffTab === 'pending' ? 'inline-flex' : 'none';
    }

    // Filter valid orders first (prevent ghost/undefined orders from rendering)
    const validOrders = staffOrders.filter(isValidStaffOrder);

    // 3 isolated partitions:
    // Tab 1: Pending (placed, pending, preparing, out_for_delivery, ready)
    const pendingOrders = validOrders.filter(isPendingStaffOrder);
    // Tab 2: Completed (strictly delivered, completed)
    const completedOrders = validOrders.filter(isCompletedStaffOrder);
    // Tab 3: Rejected (strictly rejected, cancelled, canceled, declined)
    const rejectedOrders = validOrders.filter(isRejectedStaffOrder);

    // If pending orders queue becomes empty, immediately stop and reset looping audio
    if (pendingOrders.length === 0 && isOrderAlertAudioPlaying) {
        stopOrderAlertAudio();
    }

    if (pendingCountEl) pendingCountEl.textContent = pendingOrders.length;
    if (completedCountEl) completedCountEl.textContent = completedOrders.length;
    if (rejectedCountEl) rejectedCountEl.textContent = rejectedOrders.length;

    // Role-Based Visibility Guard & Empty State Guard for "Clear All"
    const isAdmin = isStaffAdminUser(currentStaffUser);
    if (deleteCompletedBtn) {
        if ((currentStaffTab === 'completed' || currentStaffTab === 'rejected') && isAdmin) {
            deleteCompletedBtn.style.display = 'inline-flex';
            const targetCount = currentStaffTab === 'completed' ? completedOrders.length : rejectedOrders.length;
            const spanText = deleteCompletedBtn.querySelector('span');
            if (spanText) {
                spanText.textContent = currentStaffTab === 'rejected' ? 'Clear All Rejected' : 'Clear All Completed';
            }
            if (targetCount === 0) {
                deleteCompletedBtn.disabled = true;
                deleteCompletedBtn.classList.add('is-disabled');
                deleteCompletedBtn.setAttribute('aria-disabled', 'true');
                deleteCompletedBtn.title = `No ${currentStaffTab} orders to clear`;
            } else {
                deleteCompletedBtn.disabled = false;
                deleteCompletedBtn.classList.remove('is-disabled');
                deleteCompletedBtn.removeAttribute('aria-disabled');
                deleteCompletedBtn.title = `Clear all ${currentStaffTab} orders`;
            }
        } else {
            deleteCompletedBtn.style.display = 'none';
            deleteCompletedBtn.disabled = true;
            deleteCompletedBtn.classList.add('is-disabled');
        }
    }

    if (!container) return;

    // Check if user is currently interacting with an OTP input or other input
    const activeEl = document.activeElement;
    const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.classList?.contains('staff-otp-input') || 
        activeEl.classList?.contains('otp-input')
    ) && container.contains(activeEl);

    // Preserve focus and input values across re-renders
    let focusedInputId = isInputFocused ? activeEl.id : null;
    let focusedInputValue = isInputFocused ? activeEl.value : null;
    let focusedSelectionStart = isInputFocused ? activeEl.selectionStart : null;
    let focusedSelectionEnd = isInputFocused ? activeEl.selectionEnd : null;

    let currentList = [];
    if (currentStaffTab === 'pending') {
        currentList = pendingOrders;
    } else if (currentStaffTab === 'completed') {
        currentList = completedOrders;
    } else {
        currentList = rejectedOrders;
    }

    if (currentList.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        if (emptyState) {
            if (currentStaffTab === 'pending') {
                emptyState.innerHTML = `
                    <i class="fa-solid fa-bell-slash"></i>
                    <h4>No Pending Orders</h4>
                    <p>All active kitchen orders have been prepared or delivered.</p>
                `;
            } else if (currentStaffTab === 'completed') {
                emptyState.innerHTML = `
                    <i class="fa-solid fa-clipboard-check"></i>
                    <h4>No Completed Orders</h4>
                    <p>Delivered orders will appear here before 11:59 PM midnight cleanup.</p>
                `;
            } else {
                emptyState.innerHTML = `
                    <i class="fa-solid fa-ban"></i>
                    <h4>No Rejected Orders</h4>
                    <p>Rejected and cancelled orders will appear here with reason and timestamp.</p>
                `;
            }
            emptyState.style.display = 'block';
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.style.display = '';

    // Pending orders: Oldest first (FIFO kitchen priority)
    // Completed & Rejected orders: Most recently finished first (LIFO)
    const sortedOrders = currentStaffTab === 'pending'
        ? sortOrdersOldestFirst(currentList)
        : [...currentList].sort((a, b) => {
            const timeA = new Date(a.completedAt || a.deliveredAt || a.rejectedAt || a.cancelledAt || a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.completedAt || b.deliveredAt || b.rejectedAt || b.cancelledAt || b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
        });

    let newHtml = '';
    if (currentStaffTab === 'pending') {
        newHtml = sortedOrders.map(order => buildOrderCardHTML(order)).join('');
    } else if (currentStaffTab === 'completed') {
        newHtml = sortedOrders.map(order => buildCompletedOrderCardHTML(order)).join('');
    } else {
        newHtml = sortedOrders.map(order => buildRejectedOrderCardHTML(order)).join('');
    }

    // If an OTP input is currently focused by the user:
    if (isInputFocused) {
        // Collect current values of all OTP inputs
        const currentOtpValues = {};
        container.querySelectorAll('input.staff-otp-input, input[id^="staff-otp-input-"]').forEach(inp => {
            if (inp.id) currentOtpValues[inp.id] = inp.value;
        });

        // Update container HTML
        container.innerHTML = newHtml;

        // Restore all entered OTP input values
        Object.keys(currentOtpValues).forEach(inputId => {
            const restoredInput = document.getElementById(inputId);
            if (restoredInput && currentOtpValues[inputId]) {
                restoredInput.value = currentOtpValues[inputId];
            }
        });

        // Seamlessly restore focus and cursor position to the active OTP input without dropping keyboard
        if (focusedInputId) {
            const elToRefocus = document.getElementById(focusedInputId);
            if (elToRefocus) {
                elToRefocus.focus();
                if (focusedInputValue !== null) elToRefocus.value = focusedInputValue;
                if (focusedSelectionStart !== null && focusedSelectionEnd !== null) {
                    try {
                        elToRefocus.setSelectionRange(focusedSelectionStart, focusedSelectionEnd);
                    } catch (e) { }
                }
            }
        }
    } else {
        container.innerHTML = newHtml;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatStaffOrderItem(item) {
    if (!item) return '';
    const isObj = typeof item === 'object';
    const qty = Math.max(1, parseInt(isObj ? (item.qty || item.quantity || 1) : 1, 10) || 1);
    let rawName = isObj ? String(item.name || item.title || item.itemName || '').trim() : String(item).trim();
    if (!rawName) return '';

    // 1. Detect size from item properties or from rawName string
    let size = '';
    const rawSize = String(isObj ? (item.size || item.variant || item.sizeName || '') : '').trim().toLowerCase();
    if (rawSize === 's' || rawSize === 'small') size = 'S';
    else if (rawSize === 'm' || rawSize === 'medium') size = 'M';
    else if (rawSize === 'l' || rawSize === 'large') size = 'L';
    else if (rawSize === 'r' || rawSize === 'regular' || rawSize === 'standard') size = 'R';

    if (!size) {
        const sizeMatch = rawName.match(/\((?:Small|Medium|Large|Regular|Standard|[SMLR])\)/i) || rawName.match(/\b(Small|Medium|Large|Regular)\b/i);
        if (sizeMatch) {
            const sm = sizeMatch[0].replace(/[()]/g, '').trim().toLowerCase();
            if (sm === 's' || sm === 'small') size = 'S';
            else if (sm === 'm' || sm === 'medium') size = 'M';
            else if (sm === 'l' || sm === 'large') size = 'L';
            else if (sm === 'r' || sm === 'regular' || sm === 'standard') size = 'R';
        }
    }

    // 2. Detect add-ons from item.addons (array or object dictionary) and rawName/notes
    let hasCheese = false;
    let hasSpicy = false;
    let hasMayo = false;
    let hasIceCream = false;

    const checkAddonText = (text) => {
        if (!text || typeof text !== 'string') return;
        const low = text.toLowerCase();
        if (low.includes('cheese')) hasCheese = true;
        if (low.includes('spicy') || low.includes('chilli') || low.includes('chili')) hasSpicy = true;
        if (low.includes('mayo')) hasMayo = true;
        if (low.includes('ice cream') || low.includes('icecream') || low.includes('ice-cream')) hasIceCream = true;
    };

    if (isObj && item.addons) {
        if (Array.isArray(item.addons)) {
            item.addons.forEach(a => {
                if (typeof a === 'string') {
                    checkAddonText(a);
                } else if (a && typeof a === 'object') {
                    checkAddonText(a.name || a.title || a.label || a.addon || '');
                }
            });
        } else if (typeof item.addons === 'object') {
            Object.entries(item.addons).forEach(([k, v]) => {
                if (v) checkAddonText(k);
            });
        } else if (typeof item.addons === 'string') {
            checkAddonText(item.addons);
        }
    }

    checkAddonText(rawName);
    if (isObj && item.notes) checkAddonText(item.notes);
    if (isObj && item.instructions) checkAddonText(item.instructions);

    // 3. Clean rawName: remove noisy addon strings (+...) and size brackets
    let cleanName = rawName
        .replace(/\s*\(\+[^)]+\)/gi, '')
        .replace(/\s*\(\s*Extra[^)]*\)/gi, '')
        .replace(/\s*\(\s*(?:Small|Medium|Large|Regular|Standard|[SMLR])\s*\)/gi, '')
        .replace(/\s*-\s*(?:Small|Medium|Large|Regular)/gi, '')
        .trim();

    // Append single-letter uppercase size bracket directly next to item name
    if (size) {
        cleanName = `${cleanName} (${size})`;
    }

    // Render corresponding visual emoji/icon indicators
    const emojiList = [];
    if (hasCheese) emojiList.push('🧀');
    if (hasSpicy) emojiList.push('🌶️');
    if (hasMayo) emojiList.push('🍥');
    if (hasIceCream) emojiList.push('🍨');

    const iconsMarkup = emojiList.length > 0
        ? ` <span class="staff-item-addon-emojis" style="margin-left: 6px; font-size: 1rem; letter-spacing: 2px; vertical-align: middle;">${emojiList.join(' ')}</span>`
        : '';

    // Cooking / Chef notes display
    const rawChefNotes = isObj ? String(item.notes || item.instructions || item.specialInstructions || '').trim() : '';
    const chefNotesMarkup = rawChefNotes && !rawChefNotes.toLowerCase().startsWith('extra')
        ? `<div class="staff-item-notes"><i class="fa-solid fa-note-sticky"></i> ${escapeHtml(rawChefNotes)}</div>`
        : '';

    return `
        <div class="item-row">
            <div class="item-info-col">
                <div class="item-title-row">
                    <span class="item-qty-badge">${qty}x</span>
                    <span class="item-name">${escapeHtml(cleanName)}${iconsMarkup}</span>
                </div>
                ${chefNotesMarkup}
            </div>
        </div>
    `;
}

// --------------------------------------------------------------------------
// 8A. BUILD MINIMAL COMPLETED ORDER CARD HTML (DELIVERED STRICTLY)
// --------------------------------------------------------------------------
function buildCompletedOrderCardHTML(order) {
    const isAdminViewer = isStaffAdminUser(currentStaffUser);

    // Build Purchased Items List with clean formatting
    const rawItems = order.items || order.cart || order.orderItems || [];
    const itemsHTML = Array.isArray(rawItems) ? rawItems.map(formatStaffOrderItem).filter(Boolean).join('') : '';

    const totalVal = order.total || order.costs?.total || 0;
    const customerName = order.customerName || order.customer?.name || order.deliveryDetails?.name || 'Customer';
    const deliveredTimeStr = formatStaffTimestamp(order.deliveredAt || order.completedAt || order.updatedAt);

    return `
        <article class="order-card completed-order-card" id="card-${order.id}">
            <div class="card-head completed-card-head">
                <div class="order-id-group">
                    <span class="order-id">#${order.id} <span class="customer-name-inline">${escapeHtml(customerName)}</span></span>
                </div>
                <div class="completed-card-status-badge status-delivered">
                    <i class="fa-solid fa-check-double"></i>
                    <span>Delivered</span>
                </div>
            </div>

            <div class="card-body completed-card-body">
                ${deliveredTimeStr ? `
                <div style="font-size: 0.78rem; color: #10b981; margin: 4px 0 8px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-regular fa-clock"></i> <span>Delivered: ${escapeHtml(deliveredTimeStr)}</span>
                </div>` : ''}

                <div class="items-list">
                    ${itemsHTML || '<div class="item-row"><span class="item-name">Standard Items</span></div>'}
                </div>

                <div class="completed-summary-bar">
                    <span class="completed-total-label">Total Amount:</span>
                    <span class="total-amount">₹${totalVal}</span>
                </div>
            </div>

            ${isAdminViewer ? `
            <div class="card-footer completed-card-footer">
                <div class="action-btn-group" style="display: flex; justify-content: flex-end; align-items: center; width: 100%;">
                    <button type="button" class="btn-outline-danger btn-sm" onclick="handleAdminDeleteOrder('${order.id}')" title="Delete Order (Admin Only)" style="padding: 6px 12px; font-size: 0.78rem; font-weight: 600; border-radius: 8px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </div>
            </div>
            ` : ''}
        </article>
    `;
}

// --------------------------------------------------------------------------
// 8A-2. BUILD REJECTED & CANCELLED ORDER CARD HTML
// --------------------------------------------------------------------------
function buildRejectedOrderCardHTML(order) {
    const isAdminViewer = isStaffAdminUser(currentStaffUser);

    // Build Purchased Items List with clean formatting
    const rawItems = order.items || order.cart || order.orderItems || [];
    const itemsHTML = Array.isArray(rawItems) ? rawItems.map(formatStaffOrderItem).filter(Boolean).join('') : '';

    const totalVal = order.total || order.costs?.total || 0;
    const customerName = order.customerName || order.customer?.name || order.deliveryDetails?.name || 'Customer';
    const isAutoExp = order.autoExpired || order.isAutoExpired || order.rejectedBy === 'SYSTEM_AUTO_EXPIRE' || (typeof isOrder100MinsExpired === 'function' && isOrder100MinsExpired(order));
    const reason = order.cancellationReason || order.rejectionReason || (isAutoExp ? 'Order timed out (>100 minutes) - automatically cancelled by system' : (order.cancelReason || order.reason || 'Not specified by kitchen'));
    const statusText = (order.status === 'cancelled' || order.status === 'canceled') ? 'Cancelled' : 'Rejected';
    const rejectedTimeStr = formatStaffTimestamp(order.rejectedAt || order.cancelledAt || order.updatedAt || order.createdAt);

    return `
        <article class="order-card completed-order-card rejected-order-card" id="card-${order.id}" style="border-color: rgba(239, 68, 68, 0.35);">
            <div class="card-head completed-card-head">
                <div class="order-id-group">
                    <span class="order-id">#${order.id} <span class="customer-name-inline">${escapeHtml(customerName)}</span></span>
                </div>
                <div class="completed-card-status-badge status-declined" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
                    <i class="fa-solid fa-ban"></i>
                    <span>${statusText}</span>
                </div>
            </div>

            <div class="card-body completed-card-body">
                ${rejectedTimeStr ? `
                <div style="font-size: 0.78rem; color: #ef4444; margin: 4px 0 8px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-regular fa-clock"></i> <span>Rejection Time: ${escapeHtml(rejectedTimeStr)}</span>
                </div>` : ''}

                <div style="font-size: 0.82rem; color: #f87171; margin: 6px 0 10px; display: flex; align-items: flex-start; gap: 8px; background: rgba(239, 68, 68, 0.08); padding: 8px 10px; border-radius: 8px; border-left: 3px solid #ef4444;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-top: 2px;"></i>
                    <div>
                        <strong style="color: #ef4444;">Reason:</strong> <span>${escapeHtml(reason)}</span>
                    </div>
                </div>

                ${(order.walletRefunded || order.walletRefundAmount > 0) ? `
                <div style="font-size: 0.74rem; color: #10b981; margin: 2px 0 8px; display: flex; align-items: center; gap: 5px; background: rgba(16, 185, 129, 0.08); padding: 6px 10px; border-radius: 6px; border-left: 3px solid #10b981;">
                    <i class="fa-solid fa-rotate-left"></i> <span>₹${order.walletRefundAmount || order.walletDiscount || order.usedWalletCash} refunded to customer wallet</span>
                </div>` : ''}

                <div class="items-list">
                    ${itemsHTML || '<div class="item-row"><span class="item-name">Standard Items</span></div>'}
                </div>

                <div class="completed-summary-bar">
                    <span class="completed-total-label">Order Total:</span>
                    <span class="total-amount">₹${totalVal}</span>
                </div>
            </div>

            ${isAdminViewer ? `
            <div class="card-footer completed-card-footer">
                <div class="action-btn-group" style="display: flex; justify-content: flex-end; align-items: center; width: 100%;">
                    <button type="button" class="btn-outline-danger btn-sm" onclick="handleAdminDeleteOrder('${order.id}')" title="Delete Order (Admin Only)" style="padding: 6px 12px; font-size: 0.78rem; font-weight: 600; border-radius: 8px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                </div>
            </div>
            ` : ''}
        </article>
    `;
}

// --------------------------------------------------------------------------
// 8B. BUILD ACTIVE / PENDING ORDER CARD HTML
// --------------------------------------------------------------------------
function buildOrderCardHTML(order) {
    const isOnline = isOnlinePaymentOrder(order);
    const isInFlight = isOrderActionInFlight(order);

    // Live upward elapsed timer data
    const timerData = getOrderElapsedData(order);

    // Chef Action Buttons based on Order Status & Payment Method
    let actionButtonsHTML = '';

    const otpVerificationBoxHTML = `
        <div class="staff-otp-verification-box" id="otp-box-${order.id}">
            <div class="staff-otp-input-group">
                <input 
                    type="tel" 
                    inputmode="numeric" 
                    pattern="[0-9]*" 
                    maxlength="4" 
                    id="staff-otp-input-${order.id}" 
                    class="staff-otp-input" 
                    placeholder="Enter 4-Digit OTP"
                    autocomplete="off"
                    ${isInFlight ? 'disabled' : ''}
                    oninput="this.value = this.value.replace(/[^0-9]/g, '').slice(0, 4)"
                    onkeydown="if(event.key === 'Enter') verifyAndCompleteOrderDelivery('${order.id}')"
                >
                <button 
                    type="button" 
                    class="btn-touch btn-verify-delivery" 
                    id="btn-verify-otp-${order.id}"
                    ${isInFlight ? 'disabled' : ''}
                    onclick="verifyAndCompleteOrderDelivery('${order.id}')"
                    title="Verify Customer OTP & Complete Delivery"
                >
                    <i class="fa-solid fa-shield-check"></i> Verify &amp; Deliver
                </button>
            </div>
        </div>
    `;

    const normalizedStatus = String(order.status || '').trim().toLowerCase();
    const isInitialOrderState = ['new', 'placed', 'pending', 'confirmed', 'received', 'order_placed'].includes(normalizedStatus);

    if (isInitialOrderState) {
        actionButtonsHTML = `
            <div class="cod-action-group">
                <button type="button" class="btn-touch btn-reject" onclick="handleRejectOrder('${order.id}')" ${isInFlight ? 'disabled' : ''}>
                    <i class="fa-solid fa-ban"></i> Reject Order
                </button>
                <button type="button" class="btn-touch btn-accept" onclick="updateOrderStatus('${order.id}', 'preparing', this)" ${isInFlight ? 'disabled' : ''}>
                    <i class="fa-solid fa-fire-burner"></i> Accept Order
                </button>
            </div>
        `;
    } else if (order.status === 'preparing') {
        // Preparing state: Dispatch Driver button + Direct OTP verification option + Reject Order
        actionButtonsHTML = `
            <div class="in-progress-action-stack">
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;">
                    <button type="button" class="btn-touch btn-dispatch" id="btn-dispatch-${order.id}" onclick="updateOrderStatus('${order.id}', 'delivery', this)" ${isInFlight ? 'disabled' : ''} style="flex: 1; padding: 10px 16px; border-radius: 10px; font-size: 0.88rem;">
                        <i class="fa-solid fa-motorcycle"></i> Dispatch Driver
                    </button>
                    <button type="button" class="btn-touch btn-reject" onclick="handleRejectOrder('${order.id}')" ${isInFlight ? 'disabled' : ''} style="padding: 10px 14px; font-size: 0.82rem; border-radius: 10px; width: auto;">
                        <i class="fa-solid fa-ban"></i> Reject
                    </button>
                </div>
                ${otpVerificationBoxHTML}
            </div>
        `;
    } else if (order.status === 'ready' || order.status === 'delivery') {
        // Out for Delivery state: Dispatched Badge + Direct OTP verification + Reject Order
        actionButtonsHTML = `
            <div class="in-progress-action-stack">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div class="order-status-dispatched-badge">
                        <i class="fa-solid fa-motorcycle fa-bounce"></i> Out for Delivery
                    </div>
                    <button type="button" class="btn-touch btn-reject" onclick="handleRejectOrder('${order.id}')" ${isInFlight ? 'disabled' : ''} style="padding: 6px 12px; font-size: 0.78rem; border-radius: 8px; width: auto;">
                        <i class="fa-solid fa-ban"></i> Reject
                    </button>
                </div>
                ${otpVerificationBoxHTML}
            </div>
        `;
    } else if (order.status === 'rejected') {
        const isMasterAdminViewer = currentStaffUser && (
            currentStaffUser.role === 'Master Admin' || 
            String(currentStaffUser.phone || '').replace(/[^0-9]/g, '').slice(-10) === MASTER_ADMIN_PHONE_NUM || 
            currentStaffUser.isMasterAdmin === true
        );
        actionButtonsHTML = `
            <div class="action-btn-group" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="order-status-rejected-label">
                    <i class="fa-solid fa-ban"></i> Order Declined / Cancelled
                </span>
                ${isMasterAdminViewer ? `
                    <button type="button" class="btn-outline-danger btn-sm" onclick="handleAdminDeleteOrder('${order.id}')" title="Delete Order (Master Admin Only)" style="padding: 6px 12px; font-size: 0.78rem; font-weight: 600; border-radius: 8px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                ` : ''}
            </div>
        `;
    } else {
        // Delivered & Completed: Protected (Cleared automatically at 11:59 PM, or manually by Master Admin)
        const isMasterAdminViewer = currentStaffUser && (
            currentStaffUser.role === 'Master Admin' || 
            String(currentStaffUser.phone || '').replace(/[^0-9]/g, '').slice(-10) === MASTER_ADMIN_PHONE_NUM || 
            currentStaffUser.isMasterAdmin === true
        );
        actionButtonsHTML = `
            <div class="action-btn-group" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <span class="order-status-completed-label">
                    <i class="fa-solid fa-check-double"></i> Delivered &amp; Verified ${order.deliveryOtp ? `(OTP: ${order.deliveryOtp})` : ''}
                </span>
                ${isMasterAdminViewer ? `
                    <button type="button" class="btn-outline-danger btn-sm" onclick="handleAdminDeleteOrder('${order.id}')" title="Delete Completed Order (Master Admin Only)" style="padding: 6px 12px; font-size: 0.78rem; font-weight: 600; border-radius: 8px; color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-trash-can"></i> Delete
                    </button>
                ` : ''}
            </div>
        `;
    }

    // Build Items List with clean formatting
    const rawItems = order.items || order.cart || order.orderItems || [];
    const itemsHTML = Array.isArray(rawItems) ? rawItems.map(formatStaffOrderItem).filter(Boolean).join('') : '';

    // Pre-resolve turn-by-turn navigation URL
    const mapsUrl = getGoogleMapsNavigationUrl(order);

    // Payment badge label
    const paymentLabel = order.paymentMethod || order.paymentStatus || 'Cash on Delivery';
    const isPaidOnline = isOnline;

    // Customer Phone & Instant Call Trigger
    const rawPhone = order.customerPhone || order.phone || (order.customer && order.customer.phone) || (order.deliveryDetails && order.deliveryDetails.phone) || '';
    const cleanPhone = String(rawPhone).replace(/[^0-9+]/g, '');
    const customerName = order.customerName || order.customer?.name || order.deliveryDetails?.name || 'Customer';

    return `
        <article class="order-card" id="card-${order.id}">
            <div class="card-head">
                <div class="order-id-group">
                    <span class="order-id">#${order.id} <span class="customer-name-inline">${escapeHtml(customerName)}</span></span>
                    ${getOrderCountdownPillHTML(order)}
                </div>
                <div class="elapsed-timer-badge ${timerData.color.isCritical ? 'timer-critical' : ''} ${timerData.isCompleted ? 'completed-frozen' : ''}" id="timer-badge-${order.id}" style="${timerData.styleAttr}" title="${timerData.stageTitle}">
                    <i class="fa-solid ${timerData.isCompleted ? 'fa-circle-check' : 'fa-stopwatch'}"></i>
                    <span class="timer-value" id="timer-val-${order.id}">${timerData.formatted}</span>
                </div>
            </div>

            <div class="card-body">
                <div class="customer-info">
                    <div class="customer-address-box">
                        <div class="customer-address-details">
                            <i class="fa-solid fa-location-dot address-pin-icon"></i>
                            <div class="address-text-wrap">
                                <span class="address-text">${escapeHtml(order.address || 'Address not specified')}</span>
                            </div>
                        </div>
                        <div class="address-actions-group">
                            ${rawPhone ? `
                                <a href="tel:${cleanPhone}" class="btn-customer-call" title="Call ${escapeHtml(customerName)} (${escapeHtml(rawPhone)})" aria-label="Call ${escapeHtml(customerName)} at ${escapeHtml(rawPhone)}">
                                    <i class="fa-solid fa-phone"></i>
                                    <span class="call-action-pill">Call</span>
                                </a>
                            ` : ''}
                            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-auto-gps" onclick="event.stopPropagation();" title="Start Turn-by-Turn GPS Navigation to Customer">
                                <i class="fa-solid fa-location-arrow"></i>
                                <span>Auto GPS</span>
                            </a>
                        </div>
                    </div>
                </div>

                <div class="items-list">
                    ${itemsHTML || '<div class="item-row"><span class="item-name">Standard Items</span></div>'}
                </div>

                <div class="card-summary-line">
                    <span class="payment-type ${isPaidOnline ? 'paid-online' : 'cod-payment'}">
                        <i class="fa-solid ${isPaidOnline ? 'fa-circle-check' : 'fa-hand-holding-dollar'}"></i>
                        ${paymentLabel}
                    </span>
                    <span class="total-amount">₹${order.total || 0}</span>
                </div>
            </div>

            <div class="card-footer">
                ${actionButtonsHTML}
            </div>
        </article>
    `;
}

// --------------------------------------------------------------------------
// 9. IN-APP OTP DELIVERY VERIFICATION & STATUS UPDATER
// --------------------------------------------------------------------------
async function verifyAndCompleteOrderDelivery(orderId) {
    const rawId = String(orderId || '').replace(/^#/, '').trim();
    if (isOrderActionInFlight(rawId)) return;

    const order = staffOrders.find(o => 
        String(o.id) === rawId || 
        String(o.orderId) === rawId || 
        String(o.id).replace(/^#/, '') === rawId || 
        String(o.orderId).replace(/^#/, '') === rawId
    );
    if (!order) {
        showStaffToast('⚠️ Order not found in active kitchen queue.');
        return;
    }

    const inputEl = document.getElementById(`staff-otp-input-${order.id}`);
    const enteredOtp = inputEl ? inputEl.value.trim().replace(/[^0-9]/g, '') : '';

    if (!enteredOtp) {
        if (inputEl) {
            inputEl.classList.remove('otp-error-shake');
            void inputEl.offsetWidth; // Trigger reflow for animation restart
            inputEl.classList.add('otp-error-shake');
            inputEl.focus();
        }
        showStaffToast('⚠️ Please enter the customer delivery verification OTP.');
        return;
    }

    const expectedOtp = String(order.deliveryOtp || order.otp || '').trim().replace(/[^0-9]/g, '');
    const masterOtp = getMasterDeliveryOtp();

    // Validate OTP match against Customer OTP OR Emergency Master Delivery OTP
    const isCustomerOtpMatch = expectedOtp ? (enteredOtp === expectedOtp) : (enteredOtp.length === 4);
    const isMasterOtpMatch = Boolean(masterOtp && enteredOtp === masterOtp);
    const isValid = isCustomerOtpMatch || isMasterOtpMatch;

    if (!isValid) {
        if (inputEl) {
            inputEl.classList.remove('otp-error-shake');
            void inputEl.offsetWidth;
            inputEl.classList.add('otp-error-shake');
            inputEl.select();
        }
        showStaffToast(`❌ Invalid OTP "${enteredOtp}"! Ask customer for the 4-digit OTP on their screen.`);
        return;
    }

    const verifyBtn = document.getElementById(`btn-verify-otp-${order.id}`);
    const originalBtnHTML = verifyBtn ? verifyBtn.innerHTML : '<i class="fa-solid fa-shield-check"></i> Verify &amp; Deliver';

    if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.classList.add('btn-loading');
        verifyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    }

    try {
        // Complete delivery asynchronously with canonical status 'delivered'
        await updateOrderStatus(order.id, 'delivered', verifyBtn);
        if (isMasterOtpMatch && !isCustomerOtpMatch) {
            regenerateMasterDeliveryOtpOnUse(order.id);
            showStaffToast(`🎉 Emergency Master OTP Verified! Order #${order.id} marked as Delivered!`);
        } else {
            showStaffToast(`🎉 OTP Verified! Order #${order.id} marked as Delivered successfully!`);
        }
    } catch (err) {
        console.error('Delivery verification write error:', err);
        showStaffToast(`❌ Delivery update failed: ${err.message || 'Database error'}`);
        alert(`Delivery Update Failed: Could not update Order #${order.id}.\n\n${err.message || 'Please check your connection and retry.'}`);
    } finally {
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.classList.remove('btn-loading');
            verifyBtn.innerHTML = originalBtnHTML;
        }
    }
}
window.verifyAndCompleteOrderDelivery = verifyAndCompleteOrderDelivery;

async function regenerateMasterDeliveryOtpOnUse(orderId, actionType = 'delivered') {
    const newMasterOtp = String(Math.floor(1000 + Math.random() * 9000));

    // 1. Immediately overwrite local cache to invalidate used OTP
    try {
        localStorage.setItem('masterDeliveryOtp', newMasterOtp);
    } catch (e) { }

    // 2. Sync updated masterDeliveryOtp to Firebase Firestore (both storeSettings and store_config)
    const db = getStaffFirestore();
    const updatePayload = {
        masterDeliveryOtp: newMasterOtp,
        emergency_master_otp: newMasterOtp,
        updatedAt: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    };

    if (db) {
        try {
            await Promise.allSettled([
                db.collection('settings').doc('storeSettings').set(updatePayload, { merge: true }),
                db.collection('settings').doc('store_config').set(updatePayload, { merge: true })
            ]);
        } catch (e) {
            console.warn('Firestore settings update error:', e);
        }
    }

    // 3. Sync to backend API
    try {
        await fetch(resolveApiUrl('/api/settings'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                masterDeliveryOtp: newMasterOtp,
                emergency_master_otp: newMasterOtp
            })
        });
    } catch (e) { }

    // 4. Log event in activity_logs collection
    const logAction = actionType === 'rejected'
        ? `Emergency Master OTP used and auto-rotated on rejection of Order #${orderId}`
        : `Master Delivery OTP used and auto-regenerated for Order #${orderId}`;
    let staffName = 'Staff';
    let staffPhone = '••••••••••';
    let role = 'Staff';

    if (currentStaffUser) {
        staffName = currentStaffUser.fullName || currentStaffUser.name || 'Staff';
        const rawPhone = String(currentStaffUser.phone || '').replace(/[^0-9]/g, '').slice(-10);
        const isMaster = (currentStaffUser.role === 'Master Admin' || rawPhone === '9414503886' || currentStaffUser.isMasterAdmin);
        role = isMaster ? 'Master Admin' : (currentStaffUser.role || 'Staff');
        staffPhone = isMaster ? '••••••••••' : (rawPhone ? `+91 ${rawPhone}` : '—');
    }

    const logEntry = {
        adminName: staffName,
        adminPhone: staffPhone,
        role: role,
        action: logAction,
        createdAt: new Date().toISOString()
    };

    if (db) {
        try {
            db.collection('activity_logs').add({
                ...logEntry,
                timestamp: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : null
            }).catch((err) => {
                console.warn('Firestore activity_logs write notice:', err.message);
            });
        } catch (e) { }
    }

    try {
        const storedLogs = JSON.parse(localStorage.getItem('perfetto_admin_activity_logs') || '[]');
        storedLogs.unshift({ id: 'local_' + Date.now(), ...logEntry });
        if (storedLogs.length > 100) storedLogs.length = 100;
        localStorage.setItem('perfetto_admin_activity_logs', JSON.stringify(storedLogs));
    } catch (e) { }
}

/**
 * Resolves the exact remote Firestore document ID for an order.
 * Strictly avoids relying on ephemeral display indexes like #1 or #2.
 */
async function resolveExactFirestoreOrderDocId(db, order, fallbackOrderId) {
    if (order && order.firestoreDocId && typeof order.firestoreDocId === 'string' && order.firestoreDocId.trim() !== '') {
        return order.firestoreDocId.trim();
    }
    if (order && order.docId && typeof order.docId === 'string' && order.docId.trim() !== '') {
        return order.docId.trim();
    }

    const cleanCandidateId = String(fallbackOrderId || (order && (order.orderId || order.id)) || '').replace(/^#/, '').trim();
    if (!cleanCandidateId) return '';

    if (!db) return cleanCandidateId;

    // 1. Direct document existence check by cleanCandidateId
    try {
        const directDoc = await db.collection('orders').doc(cleanCandidateId).get();
        if (directDoc.exists) {
            if (order) order.firestoreDocId = directDoc.id;
            return directDoc.id;
        }
    } catch (e) {
        console.warn('Direct Firestore doc lookup notice:', e.message);
    }

    // 2. Query Firestore by id or orderId in case cleanCandidateId is a display/custom ID
    try {
        const qSnap1 = await db.collection('orders').where('id', '==', cleanCandidateId).limit(1).get();
        if (!qSnap1.empty) {
            const foundId = qSnap1.docs[0].id;
            if (order) order.firestoreDocId = foundId;
            return foundId;
        }
        const qSnap2 = await db.collection('orders').where('orderId', '==', cleanCandidateId).limit(1).get();
        if (!qSnap2.empty) {
            const foundId = qSnap2.docs[0].id;
            if (order) order.firestoreDocId = foundId;
            return foundId;
        }
        const numId = Number(cleanCandidateId);
        if (!isNaN(numId)) {
            const qSnap3 = await db.collection('orders').where('id', '==', numId).limit(1).get();
            if (!qSnap3.empty) {
                const foundId = qSnap3.docs[0].id;
                if (order) order.firestoreDocId = foundId;
                return foundId;
            }
        }
    } catch (queryErr) {
        console.warn('Firestore query lookup notice:', queryErr.message);
    }

    return cleanCandidateId;
}

async function updateOrderStatus(orderId, newStatus, triggerBtn = null, extraPayload = {}) {
    const rawId = String(orderId || '').replace(/^#/, '').trim();
    if (isOrderActionInFlight(rawId)) return;
    setOrderActionInFlight(rawId, true);

    // Silence any active order ringtone loop when staff interacts/accepts
    stopOrderAlertAudio();

    let originalTriggerHTML = '';
    if (triggerBtn) {
        originalTriggerHTML = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        if (triggerBtn.classList) triggerBtn.classList.add('btn-loading');
    }

    let order = null;
    try {
        order = staffOrders.find(o => 
            String(o.id) === rawId || 
            String(o.orderId) === rawId || 
            String(o.id).replace(/^#/, '') === rawId || 
            String(o.orderId).replace(/^#/, '') === rawId
        );
        if (!order) {
            throw new Error(`Order #${rawId} not found in active kitchen queue.`);
        }
        setOrderActionInFlight(order, true);

        const isDelivered = (newStatus === 'completed' || newStatus === 'delivered');
        const isRejected = (newStatus === 'rejected');
        const effectiveStatus = isDelivered ? 'delivered' : (isRejected ? 'rejected' : newStatus);

        order.status = effectiveStatus;
        const nowIso = new Date().toISOString();
        order.updatedAt = nowIso;

        if (effectiveStatus === 'preparing' && !order.prepStartedAt) {
            order.prepStartedAt = nowIso;
        }

        let shouldCreditCashbackOnDelivery = false;
        if (isDelivered) {
            if (!order.deliveredAt) order.deliveredAt = nowIso;
            if (!order.completedAt) order.completedAt = nowIso;
            const isWalletSystemActive = (staffWalletConfig && staffWalletConfig.enabled !== false);
            if (!isWalletSystemActive) {
                // When system is disabled, skip rewards entirely
                order.rewardStatus = 'none';
                order.wonCashback = 0;
                order.earnedCashback = 0;
            } else {
                const prevRewardStatus = String(order.rewardStatus || (order.scratchCard && order.scratchCard.status) || '').trim().toLowerCase();
                const wasAlreadyCredited = (prevRewardStatus === 'credited' || prevRewardStatus === 'active_credited');
                const isCardScratched = Boolean(order.scratchRevealed || (order.scratchCard && order.scratchCard.revealed) || order.rewardStatus === 'pending_delivery');
                const wonRewardAmt = Number(order.wonCashback || order.earnedCashback || (order.scratchCard && (order.scratchCard.wonAmount || order.scratchCard.amount)) || 0);

                if (isCardScratched && wonRewardAmt > 0 && !wasAlreadyCredited) {
                    shouldCreditCashbackOnDelivery = true;
                    order.rewardStatus = 'credited';
                    order.scratchRevealed = true;
                    order.scratchClaimed = true;
                    if (!order.scratchCard) order.scratchCard = {};
                    order.scratchCard.status = 'credited';
                    order.scratchCard.revealed = true;
                    order.scratchCard.claimed = true;
                    order.scratchCard.claimedAt = nowIso;
                } else if (wasAlreadyCredited) {
                    order.rewardStatus = 'credited';
                    order.scratchRevealed = true;
                    order.scratchClaimed = true;
                    if (!order.scratchCard) order.scratchCard = {};
                    order.scratchCard.status = 'credited';
                    order.scratchCard.revealed = true;
                    order.scratchCard.claimed = true;
                } else {
                    // Unrevealed fallback: card awaits user scratching in Order History
                    order.rewardStatus = 'unscratched';
                    order.scratchRevealed = false;
                    order.scratchClaimed = false;
                    if (!order.scratchCard) order.scratchCard = {};
                    order.scratchCard.status = 'unscratched';
                    order.scratchCard.revealed = false;
                    order.scratchCard.claimed = false;
                }
            }
        }

        if (isRejected) {
            order.rejectedAt = nowIso;
            if (extraPayload && extraPayload.rejectionReason) {
                order.rejectionReason = String(extraPayload.rejectionReason).trim();
            }
            order.rewardStatus = 'voided';
            order.wonCashback = 0;
            order.earnedCashback = 0;
            if (order.scratchCard) {
                order.scratchCard.status = 'voided';
                order.scratchCard.wonAmount = 0;
                order.scratchCard.amount = 0;
                order.scratchCard.voided = true;
            }
        }

        if (!extraPayload || typeof extraPayload !== 'object') extraPayload = {};
        if (shouldCreditCashbackOnDelivery) {
            extraPayload.shouldCreditCashbackOnDelivery = true;
        }

        // 1. Save updated staffOrders to staff storage
        try {
            localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
        } catch (e) {
            console.error('Error saving updated order status:', e);
        }

        // 2. Selectively update order status in customer orders cache without wiping order history
        try {
            const rawCust = localStorage.getItem('perfettoCustomerOrders');
            if (rawCust) {
                const custOrders = JSON.parse(rawCust);
                if (Array.isArray(custOrders)) {
                    const cIdx = custOrders.findIndex(o => String(o.id || o.orderId) === rawId);
                    if (cIdx >= 0) {
                        custOrders[cIdx].status = effectiveStatus;
                        custOrders[cIdx].updatedAt = nowIso;
                        if (isDelivered) {
                            custOrders[cIdx].deliveredAt = nowIso;
                            custOrders[cIdx].completedAt = nowIso;
                            if (shouldCreditCashbackOnDelivery) {
                                custOrders[cIdx].rewardStatus = 'credited';
                                custOrders[cIdx].scratchClaimed = true;
                                custOrders[cIdx].scratchRevealed = true;
                                if (custOrders[cIdx].scratchCard) {
                                    custOrders[cIdx].scratchCard.status = 'credited';
                                    custOrders[cIdx].scratchCard.claimed = true;
                                    custOrders[cIdx].scratchCard.revealed = true;
                                    custOrders[cIdx].scratchCard.claimedAt = nowIso;
                                }
                            }
                        }
                        localStorage.setItem('perfettoCustomerOrders', JSON.stringify(custOrders));
                    }
                }
            }
        } catch (e) { }

        // 3. Persist to Firestore & backend API
        await syncOrderStatusToBackend(order.id, effectiveStatus, extraPayload);

        let msg = `Order #${order.id} updated to ${effectiveStatus.toUpperCase()}`;
        if (effectiveStatus === 'preparing') msg = `Order #${order.id} Accepted • Preparation started! 🍕`;
        if (effectiveStatus === 'ready') msg = `Order #${order.id} marked Ready for Pickup! ✅`;
        if (effectiveStatus === 'delivery') msg = `Order #${order.id} Dispatched • Out for Delivery 🛵`;
        if (isDelivered) msg = `Order #${order.id} Delivered successfully! 🎉`;
        if (isRejected) msg = `Order #${order.id} Declined / Rejected ❌`;

        showStaffToast(msg);
    } catch (err) {
        console.error('Error updating order status:', err);
        showStaffToast(`❌ Status update failed: ${err.message || 'Database error'}`);
        throw err;
    } finally {
        // 1. Unconditionally clear in-flight status across all order ID variants BEFORE re-rendering
        setOrderActionInFlight(rawId, false);
        if (order) setOrderActionInFlight(order, false);

        // 2. Restore trigger button if it exists and wasn't detached
        if (triggerBtn) {
            triggerBtn.disabled = false;
            if (triggerBtn.classList) triggerBtn.classList.remove('btn-loading');
            if (originalTriggerHTML) triggerBtn.innerHTML = originalTriggerHTML;
        }

        // 3. Re-render orders now that in-flight flags are completely cleared so buildOrderCardHTML generates active controls
        renderOrders();

        // 4. Directly guarantee card interactivity and remove any lingering disabled/pointer-events restrictions
        ensureOrderCardInteractive(order?.id || rawId);
    }
}
window.updateOrderStatus = updateOrderStatus;

/**
 * Ensures all nested interactive elements inside an order card (OTP input, action buttons)
 * are fully clickable, focusable, and responsive without requiring a page refresh.
 */
function ensureOrderCardInteractive(orderId) {
    if (!orderId) return;
    const cleanId = String(orderId).replace(/^#/, '').trim();
    const rawId = String(orderId).trim();

    // Look up card element by possible ID conventions
    const card = document.getElementById(`card-${cleanId}`) ||
                 document.getElementById(`card-${rawId}`) ||
                 document.getElementById(`card-#${cleanId}`);
    if (!card) return;

    // 1. Remove pointer-events restrictions on the card container
    card.style.pointerEvents = 'auto';

    // 2. Locate OTP input field, unblock disabled, readOnly, and pointer-events
    const otpInput = card.querySelector(`.staff-otp-input, input[id^="staff-otp-input-"], #staff-otp-input-${cleanId}, #staff-otp-input-${rawId}`);
    if (otpInput) {
        otpInput.removeAttribute('disabled');
        otpInput.disabled = false;
        otpInput.readOnly = false;
        otpInput.style.pointerEvents = 'auto';
    }

    // 3. Locate all action buttons inside card footer, unblock disabled, btn-loading, and pointer-events
    card.querySelectorAll('button, a').forEach(btn => {
        btn.removeAttribute('disabled');
        btn.disabled = false;
        if (btn.classList) {
            btn.classList.remove('btn-loading', 'is-disabled');
        }
        btn.style.pointerEvents = 'auto';
    });
}
window.ensureOrderCardInteractive = ensureOrderCardInteractive;

let pendingRejectOrderId = null;

function handleRejectOrder(orderId) {
    const order = staffOrders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
    if (!order) return;

    if (order.autoExpired || order.isAutoExpired || (typeof isOrder100MinsExpired === 'function' && isOrder100MinsExpired(order))) {
        console.log(`[STAFF] Order #${order.id} is auto-expired (>100 mins). Bypassing modal, OTP, and reason inputs; auto-expiring now...`);
        showStaffToast(`⏱ Order #${order.id} timed out (>100 mins). Automatically rejecting...`);
        if (typeof autoExpireOrder === 'function') {
            autoExpireOrder(order.id);
        } else if (typeof autoRejectExpiredOrder === 'function') {
            autoRejectExpiredOrder(order);
        }
        return;
    }

    pendingRejectOrderId = order.id;

    const modal = document.getElementById('staff-reject-modal');
    const orderTagEl = document.getElementById('reject-modal-order-tag');
    const customerEl = document.getElementById('reject-modal-customer-name');
    const totalEl = document.getElementById('reject-modal-order-total');
    const reasonInput = document.getElementById('reject-modal-reason');
    const reasonError = document.getElementById('reject-modal-reason-error');
    const otpInput = document.getElementById('reject-modal-master-otp');
    const otpError = document.getElementById('reject-modal-otp-error');

    if (orderTagEl) orderTagEl.textContent = `Order #${order.id}`;
    if (customerEl) customerEl.textContent = order.customerName || order.customer?.name || order.deliveryDetails?.name || 'Customer';
    if (totalEl) totalEl.textContent = `₹${order.total || order.costs?.total || 0}`;

    if (reasonInput) {
        reasonInput.value = '';
        reasonInput.classList.remove('otp-error-shake');
    }
    if (reasonError) {
        reasonError.style.display = 'none';
        reasonError.textContent = '';
    }

    if (otpInput) {
        otpInput.value = '';
        otpInput.classList.remove('otp-error-shake');
    }
    if (otpError) {
        otpError.style.display = 'none';
        otpError.textContent = '';
    }

    if (modal) {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
    }

    if (reasonInput) {
        setTimeout(() => reasonInput.focus(), 100);
    } else if (otpInput) {
        setTimeout(() => otpInput.focus(), 100);
    }
}
window.handleRejectOrder = handleRejectOrder;

function closeStaffRejectModal() {
    pendingRejectOrderId = null;
    const modal = document.getElementById('staff-reject-modal');
    const reasonInput = document.getElementById('reject-modal-reason');
    const reasonError = document.getElementById('reject-modal-reason-error');
    const otpInput = document.getElementById('reject-modal-master-otp');
    const otpError = document.getElementById('reject-modal-otp-error');

    if (reasonInput) {
        reasonInput.value = '';
        reasonInput.classList.remove('otp-error-shake');
    }
    if (reasonError) {
        reasonError.style.display = 'none';
        reasonError.textContent = '';
    }
    if (otpInput) {
        otpInput.value = '';
        otpInput.classList.remove('otp-error-shake');
    }
    if (otpError) {
        otpError.style.display = 'none';
        otpError.textContent = '';
    }
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}
window.closeStaffRejectModal = closeStaffRejectModal;

async function confirmRejectOrder() {
    if (!pendingRejectOrderId) {
        closeStaffRejectModal();
        return;
    }
    const orderIdToReject = pendingRejectOrderId;
    const rawId = String(orderIdToReject).replace(/^#/, '').trim();
    if (isOrderActionInFlight(rawId)) return;

    const reasonInput = document.getElementById('reject-modal-reason');
    const reasonError = document.getElementById('reject-modal-reason-error');
    const enteredReason = reasonInput ? reasonInput.value.trim() : '';

    const otpInput = document.getElementById('reject-modal-master-otp');
    const otpError = document.getElementById('reject-modal-otp-error');
    const enteredOtp = otpInput ? otpInput.value.trim().replace(/[^0-9]/g, '') : '';
    let masterOtp = getMasterDeliveryOtp();

    // 1. Strict Validation: Mandatory cancellation reason is required
    if (!enteredReason) {
        if (reasonInput) {
            reasonInput.classList.remove('otp-error-shake');
            void reasonInput.offsetWidth;
            reasonInput.classList.add('otp-error-shake');
            reasonInput.focus();
        }
        if (reasonError) {
            reasonError.style.display = 'block';
            reasonError.textContent = '⚠️ Mandatory cancellation reason is required to reject order.';
        }
        showStaffToast('⚠️ Please enter a cancellation reason.');
        return;
    }
    if (reasonError) {
        reasonError.style.display = 'none';
        reasonError.textContent = '';
    }

    // 2. Strict Validation: Must provide 4-digit Master OTP
    if (!enteredOtp || enteredOtp.length !== 4) {
        if (otpInput) {
            otpInput.classList.remove('otp-error-shake');
            void otpInput.offsetWidth;
            otpInput.classList.add('otp-error-shake');
            otpInput.focus();
        }
        if (otpError) {
            otpError.style.display = 'block';
            otpError.textContent = '⚠️ 4-Digit Admin Master Delivery OTP is strictly required to authorize rejection.';
        }
        showStaffToast('⚠️ Please enter Admin Master Delivery OTP to authorize rejection.');
        return;
    }

    // 2.1 Fetch latest Master OTP from Firestore doc if available for fresh check
    const db = getStaffFirestore();
    if (db) {
        try {
            const snap = await Promise.race([
                db.collection('settings').doc('storeSettings').get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
            ]);
            if (snap && snap.exists && snap.data()) {
                const data = snap.data();
                const remoteOtp = data.masterDeliveryOtp !== undefined ? data.masterDeliveryOtp : data.emergency_master_otp;
                if (remoteOtp) {
                    masterOtp = String(remoteOtp).replace(/[^0-9]/g, '').slice(0, 4);
                    try { localStorage.setItem('masterDeliveryOtp', masterOtp); } catch (e) { }
                }
            }
        } catch (e) { }
    }

    // 3. Validate against active Master OTP set by Admin
    if (enteredOtp !== masterOtp) {
        if (otpInput) {
            otpInput.classList.remove('otp-error-shake');
            void otpInput.offsetWidth;
            otpInput.classList.add('otp-error-shake');
            otpInput.select();
        }
        if (otpError) {
            otpError.style.display = 'block';
            otpError.textContent = `❌ Invalid Master Admin OTP "${enteredOtp}". Authorization denied.`;
        }
        showStaffToast(`❌ Invalid Master Delivery OTP "${enteredOtp}"! Rejection denied.`);
        return;
    }

    const confirmBtn = document.getElementById('btn-confirm-order-reject');
    const originalConfirmHTML = confirmBtn ? confirmBtn.innerHTML : '<i class="fa-solid fa-ban"></i> Confirm Reject';
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rejecting...';
    }

    try {
        // 4. Valid Master OTP! Update order status to "rejected", store mandatory reason, and void reward
        await updateOrderStatus(orderIdToReject, 'rejected', confirmBtn, {
            rejectionReason: enteredReason,
            masterOtp: enteredOtp
        });

        // 5. Auto-rotate the Emergency Master Delivery OTP immediately upon authorized rejection!
        await regenerateMasterDeliveryOtpOnUse(orderIdToReject, 'rejected');

        // Close modal after confirmed status update
        closeStaffRejectModal();

        showStaffToast(`✅ Master OTP Authorized! Order #${orderIdToReject} Rejected. Master OTP rotated.`);
    } catch (err) {
        console.error('Error rejecting order:', err);
        showStaffToast(`❌ Rejection failed: ${err.message || 'Database error'}`);
        if (otpError) {
            otpError.style.display = 'block';
            otpError.textContent = `❌ Error: ${err.message || 'Failed to save rejection in Firestore.'}`;
        }
        alert(`Rejection Failed: Could not reject Order #${orderIdToReject}.\n\n${err.message || 'Please check your connection and retry.'}`);
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalConfirmHTML;
        }
    }
}
window.confirmRejectOrder = confirmRejectOrder;

async function handleAdminDeleteOrder(orderId) {
    if (!orderId) return;

    const confirmed = await showStaffConfirmDialog({
        title: 'Delete Order Record',
        message: `Permanently delete Order #${orderId} from records?\n\nThis will purge it from the device and Cloud Firestore.`,
        icon: '<i class="fa-solid fa-trash-can" style="color: #ef4444;"></i>',
        iconBg: 'rgba(239, 68, 68, 0.15)',
        iconBorder: 'rgba(239, 68, 68, 0.4)',
        confirmText: 'Delete Order',
        confirmType: 'danger'
    });

    if (!confirmed) return;

    // 1. Instantly remove from local state and UI
    staffOrders = staffOrders.filter(o => String(o.id || o.orderId) !== String(orderId));
    try {
        localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
    } catch (e) { }
    renderOrders();

    // 2. Directly delete from Cloud Firestore client SDK
    if (staffFirestore) {
        try {
            await staffFirestore.collection('orders').doc(String(orderId)).delete();
            console.log('✅ Firestore order document deleted:', orderId);
        } catch (e) {
            console.warn('Firestore order deletion notice:', e.message);
        }
    }
    // 3. Dispatch backend API DELETE to synchronize server memory & secondary storage
    try {
        await apiCall(`/orders?orderId=${encodeURIComponent(orderId)}`, {
            method: 'DELETE',
            body: JSON.stringify({ orderId: String(orderId), id: String(orderId) })
        });
    } catch (e) {
        console.warn('Backend API delete notice:', e.message);
    }

    showStaffToast(`🗑️ Order #${orderId} deleted successfully.`);
}
window.handleAdminDeleteOrder = handleAdminDeleteOrder;

async function syncOrderStatusToBackend(orderId, newStatus, extraPayload = {}) {
    const rawId = String(orderId || '').replace(/^#/, '').trim();
    const order = staffOrders.find(o => 
        String(o.id) === rawId || 
        String(o.orderId) === rawId ||
        String(o.id).replace(/^#/, '') === rawId ||
        String(o.orderId).replace(/^#/, '') === rawId
    );

    const isDelivered = (newStatus === 'completed' || newStatus === 'delivered');
    const isRejected = (newStatus === 'rejected');
    const effectiveStatus = isDelivered ? 'delivered' : (isRejected ? 'rejected' : newStatus);

    const patchPayload = {
        orderId: rawId,
        id: rawId,
        status: effectiveStatus
    };

    if (isDelivered) {
        patchPayload.rewardStatus = 'active_credited';
        patchPayload.scratchClaimed = true;
        patchPayload.scratchRevealed = true;
    } else if (isRejected) {
        patchPayload.rewardStatus = 'voided';
        patchPayload.wonCashback = 0;
        const rejectReason = (extraPayload && extraPayload.rejectionReason) || order?.rejectionReason || '';
        if (rejectReason) patchPayload.rejectionReason = rejectReason;
        if (extraPayload && extraPayload.masterOtp) patchPayload.masterOtp = extraPayload.masterOtp;
        const refundAmount = Math.round(Number(
            order?.walletDeductedAmount ||
            order?.walletUsed ||
            order?.walletDiscount ||
            order?.usedWalletCash ||
            order?.appliedWalletDiscount ||
            order?.usedWallet ||
            0
        ));
        if (refundAmount > 0) {
            patchPayload.walletRefundProcessed = true;
            patchPayload.walletRefunded = true;
            patchPayload.walletRefundAmount = refundAmount;
            patchPayload.refundTimestamp = new Date().toISOString();
        }
    }

    const db = getStaffFirestore();
    let firestoreSucceeded = false;
    let firestoreError = null;

    if (db) {
        try {
            // Resolve exact Firestore document ID (not display index like #1 or #2)
            const exactDocId = await resolveExactFirestoreOrderDocId(db, order, rawId);
            if (!exactDocId) {
                throw new Error(`Could not resolve Firestore document ID for order ${rawId}`);
            }

            const serverTs = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                ? firebase.firestore.FieldValue.serverTimestamp()
                : new Date().toISOString();

            const FieldValue = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                ? firebase.firestore.FieldValue
                : null;

            const fsUpdate = {
                status: effectiveStatus,
                updatedAt: serverTs
            };

            if (isDelivered) {
                const cashbackAmount = Math.max(0, Math.round(
                    Number(
                        order?.cashbackReward ??
                        order?.scratchCardAmount ??
                        order?.wonCashback ??
                        order?.earnedCashback ??
                        order?.scratchCard?.wonAmount ??
                        order?.scratchCard?.amount ??
                        extraPayload?.cashbackReward ??
                        extraPayload?.scratchCardAmount ??
                        extraPayload?.wonCashback ??
                        extraPayload?.earnedCashback ??
                        0
                    )
                ));

                const isExplicitCreditRequest = Boolean(extraPayload?.shouldCreditCashbackOnDelivery);
                const wasAlreadyClaimed = !isExplicitCreditRequest && Boolean(
                    order?.rewardStatus === 'active_credited' ||
                    order?.rewardStatus === 'credited' ||
                    order?.scratchCard?.status === 'active_credited' ||
                    order?.scratchCard?.status === 'credited'
                );

                const rawPhone = order?.customerPhone || order?.phone || order?.customer?.phone || extraPayload?.customerPhone || '';
                const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);

                const isWalletSystemActive = (staffWalletConfig && staffWalletConfig.enabled !== false);
                const shouldCreditCashback = (isWalletSystemActive && cashbackAmount > 0 && (isExplicitCreditRequest || (!wasAlreadyClaimed && order?.rewardStatus !== 'voided')));

                const validityDays = Math.max(1, parseInt(
                    order?.scratchExpiryDays ??
                    order?.cashbackExpiryDays ??
                    order?.scratchCard?.expiryDays ??
                    order?.scratchCard?.cashbackExpiryDays ??
                    extraPayload?.scratchExpiryDays ??
                    extraPayload?.cashbackExpiryDays ??
                    staffWalletConfig?.cashbackExpiryDays ??
                    staffWalletConfig?.expiryDays ??
                    1,
                    10
                ));

                const nowMs = Date.now();
                const expiresAtMs = nowMs + (validityDays * 24 * 60 * 60 * 1000);
                const expiresAt = new Date(expiresAtMs).toISOString();
                const creditedAtIso = new Date(nowMs).toISOString();

                fsUpdate.status = 'delivered';
                fsUpdate.deliveredAt = serverTs;
                fsUpdate.completedAt = serverTs;

                if (isWalletSystemActive && cashbackAmount > 0) {
                    fsUpdate.rewardStatus = 'credited';
                    fsUpdate.scratchClaimed = true;
                    fsUpdate.scratchRevealed = true;
                    fsUpdate.wonCashback = cashbackAmount;
                    fsUpdate.earnedCashback = cashbackAmount;
                    fsUpdate.scratchExpiryDays = validityDays;
                    fsUpdate.scratchExpiresAt = expiresAtMs;
                    fsUpdate['scratchCard.status'] = 'credited';
                    fsUpdate['scratchCard.claimed'] = true;
                    fsUpdate['scratchCard.revealed'] = true;
                    fsUpdate['scratchCard.claimedAt'] = creditedAtIso;
                    fsUpdate['scratchCard.expiryDays'] = validityDays;
                    fsUpdate['scratchCard.expiresAt'] = expiresAtMs;
                    fsUpdate['scratchCard.expiresAtISO'] = expiresAt;
                } else if (!isWalletSystemActive) {
                    fsUpdate.rewardStatus = 'none';
                    fsUpdate.wonCashback = 0;
                    fsUpdate.earnedCashback = 0;
                    fsUpdate['scratchCard.status'] = 'none';
                }

                console.log(`[STAFF OTP] Executing atomic delivery batch for Order #${rawId} (Cashback: ₹${cashbackAmount}, Credit Eligible: ${shouldCreditCashback}, Validity: ${validityDays}d, Expires: ${expiresAt})...`);
                const batch = db.batch();
                const orderRef = db.collection('orders').doc(exactDocId);
                batch.set(orderRef, fsUpdate, { merge: true });

                if (shouldCreditCashback && cleanPhone && FieldValue) {
                    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

                    const ledgerRecord = {
                        id: txId,
                        amount: cashbackAmount,
                        initialAmount: cashbackAmount,
                        remainingAmount: cashbackAmount,
                        type: "CREDIT",
                        title: `Cashback for Order #${rawId}`,
                        description: `Cashback for Order #${rawId}`,
                        orderId: String(rawId),
                        timestamp: serverTs,
                        createdAt: serverTs,
                        creditedAt: creditedAtIso,
                        expiresAt: expiresAt,
                        expiryDays: validityDays,
                        status: "active"
                    };

                    const inDocTxEntry = {
                        id: txId,
                        type: 'credit',
                        amount: cashbackAmount,
                        initialAmount: cashbackAmount,
                        originalAmount: cashbackAmount,
                        remainingAmount: cashbackAmount,
                        orderId: String(rawId),
                        title: `Cashback for Order #${rawId}`,
                        description: `Cashback for Order #${rawId}`,
                        createdAt: creditedAtIso,
                        creditedAt: creditedAtIso,
                        expiresAt: expiresAt,
                        expiryDays: validityDays,
                        cashbackExpiryDays: validityDays,
                        status: 'active'
                    };

                    // 1. Wallets collection: wallets/{cleanPhone}
                    const walletRef = db.collection('wallets').doc(cleanPhone);
                    batch.set(walletRef, {
                        phone: cleanPhone,
                        balance: FieldValue.increment(cashbackAmount),
                        transactions: FieldValue.arrayUnion(inDocTxEntry),
                        lastCreditedAt: creditedAtIso,
                        updatedAt: serverTs
                    }, { merge: true });

                    const walletTxRef = walletRef.collection('transactions').doc(txId);
                    batch.set(walletTxRef, ledgerRecord);

                    // 2. Users collection: users/phone_{cleanPhone}
                    const userPhoneRef = db.collection('users').doc(`phone_${cleanPhone}`);
                    batch.set(userPhoneRef, {
                        phone: cleanPhone,
                        walletBalance: FieldValue.increment(cashbackAmount),
                        balance: FieldValue.increment(cashbackAmount),
                        walletTransactions: FieldValue.arrayUnion(inDocTxEntry),
                        lastCreditedAt: creditedAtIso,
                        updatedAt: serverTs
                    }, { merge: true });

                    const userPhoneTxRef = userPhoneRef.collection('transactions').doc(txId);
                    batch.set(userPhoneTxRef, ledgerRecord);

                    // 3. Users collection: users/{cleanPhone}
                    const userRawRef = db.collection('users').doc(cleanPhone);
                    batch.set(userRawRef, {
                        phone: cleanPhone,
                        walletBalance: FieldValue.increment(cashbackAmount),
                        balance: FieldValue.increment(cashbackAmount),
                        walletTransactions: FieldValue.arrayUnion(inDocTxEntry),
                        lastCreditedAt: creditedAtIso,
                        updatedAt: serverTs
                    }, { merge: true });

                    const userRawTxRef = userRawRef.collection('transactions').doc(txId);
                    batch.set(userRawTxRef, ledgerRecord);
                }

                await batch.commit();
                firestoreSucceeded = true;
                console.log(`✅ [STAFF OTP] Atomic delivery batch committed for Order #${exactDocId}`);
            } else if (isRejected) {
                fsUpdate.status = 'rejected';
                fsUpdate.rejectedAt = serverTs;
                fsUpdate.rewardStatus = 'voided';
                fsUpdate.wonCashback = 0;
                fsUpdate.earnedCashback = 0;
                if (order && order.scratchCard) {
                    fsUpdate['scratchCard.status'] = 'CANCELLED';
                    fsUpdate['scratchCard.voided'] = true;
                    fsUpdate['scratchCard.wonAmount'] = 0;
                    fsUpdate['scratchCard.amount'] = 0;
                }
                const rejectReason = (extraPayload && extraPayload.rejectionReason) || order?.rejectionReason || '';
                if (rejectReason) fsUpdate.rejectionReason = rejectReason;

                const refundAmount = Math.round(Number(
                    order?.walletDeductedAmount ||
                    order?.walletUsed ||
                    order?.walletDiscount ||
                    order?.usedWalletCash ||
                    order?.appliedWalletDiscount ||
                    order?.usedWallet ||
                    0
                ));

                const rawPhone = order?.customerPhone || order?.phone || order?.customer?.phone || extraPayload?.customerPhone || '';
                const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);

                const isAlreadyRefunded = Boolean(order?.walletRefundProcessed || order?.walletRefunded);
                const originalExpiresAt = order?.walletHoldExpiresAt || order?.walletOriginalExpiresAt || null;
                const recoveredExpiresAt = (typeof calculateRecoveredExpiry === 'function')
                    ? calculateRecoveredExpiry(originalExpiresAt)
                    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

                if (refundAmount > 0 && cleanPhone && FieldValue && !isAlreadyRefunded) {
                    fsUpdate.walletRefundProcessed = true;
                    fsUpdate.walletRefunded = true;
                    fsUpdate.walletRefundAmount = refundAmount;
                    fsUpdate.refundTimestamp = serverTs;
                    fsUpdate.walletRefundedAt = serverTs;

                    const batch = db.batch();
                    const orderRef = db.collection('orders').doc(exactDocId);
                    batch.set(orderRef, fsUpdate, { merge: true });

                    const txId = `tx_refund_${rawId}`;
                    const refundTxLog = {
                        id: txId,
                        orderId: String(rawId),
                        amount: refundAmount,
                        type: 'REFUND',
                        title: `+₹${refundAmount} Refund`,
                        description: `+₹${refundAmount} Refund for Order #${rawId}`,
                        status: 'completed',
                        expiresAt: recoveredExpiresAt,
                        originalExpiresAt: originalExpiresAt || null,
                        graceApplied: new Date(recoveredExpiresAt).getTime() > new Date(originalExpiresAt || 0).getTime(),
                        timestamp: serverTs,
                        createdAt: serverTs
                    };

                    const inDocTxEntry = {
                        id: txId,
                        type: 'REFUND',
                        amount: refundAmount,
                        orderId: String(rawId),
                        title: `+₹${refundAmount} Refund`,
                        description: `+₹${refundAmount} Refund for Order #${rawId}`,
                        status: 'completed',
                        expiresAt: recoveredExpiresAt,
                        originalExpiresAt: originalExpiresAt || null,
                        graceApplied: new Date(recoveredExpiresAt).getTime() > new Date(originalExpiresAt || 0).getTime(),
                        createdAt: new Date().toISOString()
                    };

                    // 1. Wallets collection
                    const walletRef = db.collection('wallets').doc(cleanPhone);
                    batch.set(walletRef, {
                        phone: cleanPhone,
                        balance: FieldValue.increment(refundAmount),
                        expiresAt: recoveredExpiresAt,
                        transactions: FieldValue.arrayUnion(inDocTxEntry),
                        updatedAt: serverTs
                    }, { merge: true });
                    batch.set(walletRef.collection('transactions').doc(txId), refundTxLog, { merge: true });

                    // 2. Users phone_
                    const userPhoneRef = db.collection('users').doc(`phone_${cleanPhone}`);
                    batch.set(userPhoneRef, {
                        phone: cleanPhone,
                        walletBalance: FieldValue.increment(refundAmount),
                        balance: FieldValue.increment(refundAmount),
                        expiresAt: recoveredExpiresAt,
                        expired: false,
                        walletTransactions: FieldValue.arrayUnion(inDocTxEntry),
                        updatedAt: serverTs
                    }, { merge: true });
                    batch.set(userPhoneRef.collection('transactions').doc(txId), refundTxLog, { merge: true });

                    // 3. Users raw
                    const userRawRef = db.collection('users').doc(cleanPhone);
                    batch.set(userRawRef, {
                        phone: cleanPhone,
                        walletBalance: FieldValue.increment(refundAmount),
                        balance: FieldValue.increment(refundAmount),
                        expiresAt: recoveredExpiresAt,
                        expired: false,
                        walletTransactions: FieldValue.arrayUnion(inDocTxEntry),
                        updatedAt: serverTs
                    }, { merge: true });
                    batch.set(userRawRef.collection('transactions').doc(txId), refundTxLog, { merge: true });

                    await batch.commit();
                    firestoreSucceeded = true;
                    console.log(`✅ [STAFF REJECT] Atomic wallet refund committed for Order #${exactDocId}`);
                } else if (refundAmount > 0 && isAlreadyRefunded) {
                    fsUpdate.walletRefundProcessed = true;
                    fsUpdate.walletRefunded = true;
                    fsUpdate.walletRefundAmount = refundAmount;
                    console.log(`[STAFF REJECT] Order #${exactDocId} already marked walletRefundProcessed=true. Skipping redundant wallet credit.`);
                    await db.collection('orders').doc(exactDocId).set(fsUpdate, { merge: true });
                    firestoreSucceeded = true;
                } else {
                    console.log(`Writing order ${exactDocId} status "${effectiveStatus}" to Firestore...`);
                    await db.collection('orders').doc(exactDocId).set(fsUpdate, { merge: true });
                    firestoreSucceeded = true;
                }
            } else {
                console.log(`Writing order ${exactDocId} status "${effectiveStatus}" to Firestore...`);
                await db.collection('orders').doc(exactDocId).set(fsUpdate, { merge: true });
                firestoreSucceeded = true;
                console.log(`Firestore order ${exactDocId} successfully updated to "${effectiveStatus}"`);
            }
        } catch (e) {
            firestoreError = e;
            console.error('Firestore live order update error:', e);
        }
    }

    // 2. Sync to backend API
    let apiSucceeded = false;
    let apiError = null;
    try {
        const response = await apiCall('/orders', {
            method: 'PATCH',
            body: JSON.stringify(patchPayload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server error (HTTP ${response.status})`);
        }
        apiSucceeded = true;
    } catch (err) {
        apiError = err;
        console.error('Order status backend sync error:', err.message);
    }

    // If both Firestore and backend API failed, throw so caller catch blocks can alert staff
    if (!firestoreSucceeded && !apiSucceeded) {
        const primaryErrorMsg = (firestoreError && firestoreError.message) || (apiError && apiError.message) || 'Network connection error';
        throw new Error(`Failed to persist order status to remote database: ${primaryErrorMsg}`);
    }
}

// --------------------------------------------------------------------------
// 10. TOAST NOTIFICATION CONTROLLER
// --------------------------------------------------------------------------
function showStaffToast(msg, iconClass = '') {
    const toast = document.getElementById('staff-toast') || document.getElementById('toast');
    const toastMsg = (toast ? toast.querySelector('#toast-message') : null) || document.getElementById('toast-message');
    const toastIcon = (toast ? toast.querySelector('#toast-icon') : null) || document.getElementById('toast-icon');

    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;
    if (toastIcon && iconClass) {
        toastIcon.className = `fa-solid ${iconClass}`;
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}
window.showStaffToast = showStaffToast;
window.showToast = showStaffToast;

// --------------------------------------------------------------------------
// 11. AUTOMATED 11:59 PM MIDNIGHT CLEANUP ROUTINE (COMPLETED ORDERS ONLY)
// --------------------------------------------------------------------------
function scheduleClientMidnightCleanup() {
    function getMsUntilNextMidnight() {
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0); // 11:59:00 PM
        let diff = target.getTime() - now.getTime();
        if (diff <= 0) {
            const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0);
            diff = tomorrow.getTime() - now.getTime();
        }
        return diff;
    }

    const msUntilRun = getMsUntilNextMidnight();
    console.log(`🌙 [Staff Portal Midnight Cleanup] Scheduled in ${Math.round(msUntilRun / 1000 / 60)} minutes.`);

    setTimeout(() => {
        executeStaffMidnightCleanup();
        // Reschedule for the next night
        scheduleClientMidnightCleanup();
    }, msUntilRun);
}

async function executeStaffMidnightCleanup() {
    const completedOrders = staffOrders.filter(isFinishedStaffOrder);
    if (completedOrders.length === 0) {
        console.log('🌙 [Staff Portal] Midnight Routine: No completed orders to purge.');
        return;
    }

    console.log(`🌙 [Staff Portal] 11:59 PM Midnight Routine: Purging ${completedOrders.length} completed order(s). Active pending orders remain protected.`);

    // 1. Purge completed orders locally (active pending orders remain untouched)
    staffOrders = staffOrders.filter(o => !isFinishedStaffOrder(o));

    try {
        localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
    } catch (e) { }

    renderOrders();
    showStaffToast('🌙 Midnight Cleanup: Completed orders cleared. Active orders retained.');

    // 2. Synchronously trigger cloud cleanup on backend & Firestore
    try {
        await apiCall('/orders?action=midnight_cleanup', { method: 'DELETE' });
    } catch (err) {
        console.warn('Backend midnight cleanup notice:', err.message);
    }
}

window.scheduleClientMidnightCleanup = scheduleClientMidnightCleanup;
window.executeStaffMidnightCleanup = executeStaffMidnightCleanup;

/**
 * Records an entry into Firestore 'activity_logs' collection and mirrors to local audit log cache.
 */
async function recordStaffActivityLog(actionText, details = {}) {
    let staffName = 'Admin';
    let staffPhone = '••••••••••';
    let role = 'Admin';

    if (currentStaffUser) {
        staffName = currentStaffUser.fullName || currentStaffUser.name || 'Admin';
        const rawPhone = String(currentStaffUser.phone || '').replace(/[^0-9]/g, '').slice(-10);
        const isMaster = (currentStaffUser.role === 'Master Admin' || rawPhone === MASTER_ADMIN_PHONE_NUM || currentStaffUser.isMasterAdmin);
        role = isMaster ? 'Master Admin' : (currentStaffUser.role || 'Admin');
        staffPhone = rawPhone ? `+91 ${rawPhone}` : (isMaster ? `+91 ${MASTER_ADMIN_PHONE_NUM}` : '—');
    }

    const logEntry = {
        adminName: staffName,
        adminPhone: staffPhone,
        role: role,
        action: actionText,
        portal: 'staff',
        createdAt: new Date().toISOString(),
        ...details
    };

    const db = getStaffFirestore();
    if (db) {
        try {
            await db.collection('activity_logs').add({
                ...logEntry,
                timestamp: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore.FieldValue.serverTimestamp() : null
            });
        } catch (err) {
            console.warn('Firestore activity_logs write notice:', err.message);
        }
    }

    try {
        const storedLogs = JSON.parse(localStorage.getItem('perfetto_admin_activity_logs') || '[]');
        storedLogs.unshift({ id: 'local_' + Date.now(), ...logEntry });
        if (storedLogs.length > 100) storedLogs.length = 100;
        localStorage.setItem('perfetto_admin_activity_logs', JSON.stringify(storedLogs));
    } catch (e) { }
}
window.recordStaffActivityLog = recordStaffActivityLog;

/**
 * Clears all completed, declined, and archived orders from Firestore and local cache.
 * Keeps all pending and active kitchen orders completely safe.
 * Role-Based Guard: Accessible ONLY to Admins (Master Admin Tiers 1/2/3 or Normal Admin).
 */
async function handleDeleteAllCompletedOrders() {
    // 0. Security Guard: Verify active session role
    if (!isStaffAdminUser(currentStaffUser)) {
        showStaffToast('⛔ Access Denied: Only Admins can clear orders.');
        return;
    }

    const isClearingRejected = currentStaffTab === 'rejected';
    const completedStatuses = isClearingRejected
        ? ['rejected', 'cancelled', 'canceled', 'declined']
        : ['completed', 'delivered'];
    const targetLabel = isClearingRejected ? 'rejected' : 'completed';
    const localCompleted = staffOrders.filter(o => completedStatuses.includes(String(o.status || '').toLowerCase()));

    if (localCompleted.length === 0) {
        showStaffToast(`ℹ️ No ${targetLabel} orders to clear.`);
        return;
    }

    // 1. Confirmation Modal Dialog
    const confirmMessage = `Are you sure you want to delete all ${targetLabel} orders? This action is irreversible.`;
    let confirmed = false;
    if (typeof showStaffConfirmDialog === 'function') {
        confirmed = await showStaffConfirmDialog({
            title: isClearingRejected ? 'Clear All Rejected Orders?' : 'Clear All Completed Orders?',
            message: confirmMessage,
            icon: '<i class="fa-solid fa-trash-can" style="color: #ef4444;"></i>',
            iconBg: 'rgba(239, 68, 68, 0.12)',
            iconBorder: 'rgba(239, 68, 68, 0.3)',
            confirmText: isClearingRejected ? 'Yes, Delete All Rejected' : 'Yes, Delete All Completed',
            cancelText: 'Cancel',
            confirmType: 'danger'
        });
    } else {
        confirmed = window.confirm(confirmMessage);
    }

    if (!confirmed) return;

    const btn = document.getElementById('btn-delete-all-completed');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Clearing...</span>';
    }

    try {
        const db = getStaffFirestore();
        const ordersToDelete = new Set();

        // 2. Query and Batch Delete from Firestore collection 'orders'
        if (db) {
            try {
                const snap = await db.collection('orders').get();
                snap.forEach(doc => {
                    const data = doc.data() || {};
                    const st = String(data.status || '').toLowerCase();
                    if (completedStatuses.includes(st)) {
                        ordersToDelete.add(doc.id);
                    }
                });
            } catch (err) {
                console.warn('Firestore orders read note during deletion:', err.message);
            }
        }

        // Add any known completed IDs from local state
        localCompleted.forEach(o => {
            const id = String(o.orderId || o.id || '').trim();
            if (id) ordersToDelete.add(id);
        });

        // Batch delete from Firestore in chunks of up to 400
        if (db && ordersToDelete.size > 0) {
            const idList = Array.from(ordersToDelete);
            for (let i = 0; i < idList.length; i += 400) {
                const chunk = idList.slice(i, i + 400);
                const batch = db.batch();
                chunk.forEach(id => {
                    batch.delete(db.collection('orders').doc(id));
                });
                await batch.commit();
            }
            console.log(`🗑️ [Clear All ${targetLabel}] Batch deleted ${ordersToDelete.size} order(s) from Firestore.`);
        }

        // 3. Clear completed orders array in local state & localStorage
        staffOrders = staffOrders.filter(o => !completedStatuses.includes(String(o.status || '').toLowerCase()));
        try {
            localStorage.setItem(STAFF_ORDERS_STORAGE_KEY, JSON.stringify(staffOrders));
        } catch (e) { }

        // 4. Trigger backend server cleanup for synchronized memory caches
        try {
            const rawPhone = String(currentStaffUser?.phone || '').replace(/[^0-9]/g, '').slice(-10);
            await apiCall('/orders?action=midnight_cleanup', {
                method: 'DELETE',
                headers: {
                    'x-staff-phone': rawPhone,
                    'x-staff-role': currentStaffUser?.role || 'Admin'
                }
            });
        } catch (apiErr) {
            console.warn('Backend cleanup notice:', apiErr.message);
        }

        // 5. Audit Log: Record entry in 'activity_logs'
        let adminRole = 'Admin';
        let adminPhone = '••••••••••';
        if (currentStaffUser) {
            const rawPhone = String(currentStaffUser.phone || '').replace(/[^0-9]/g, '').slice(-10);
            const isMaster = (currentStaffUser.role === 'Master Admin' || rawPhone === MASTER_ADMIN_PHONE_NUM || currentStaffUser.isMasterAdmin);
            adminRole = isMaster ? 'Master Admin' : (currentStaffUser.role || 'Admin');
            adminPhone = rawPhone ? `+91 ${rawPhone}` : (isMaster ? `+91 ${MASTER_ADMIN_PHONE_NUM}` : '—');
        }
        const auditLogAction = `Cleared all ${targetLabel} orders via Staff Portal by ${adminRole}/${adminPhone}`;
        await recordStaffActivityLog(auditLogAction, {
            deletedCount: ordersToDelete.size || localCompleted.length
        });

        // 6. Update UI list in real time without page reload
        renderOrders();

        // 7. Success toast notification
        showStaffToast(`All ${targetLabel} orders cleared successfully.`);
    } catch (err) {
        console.error('Error clearing orders:', err);
        showStaffToast('⚠️ Failed to clear orders: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            const btnLabel = currentStaffTab === 'rejected' ? 'Clear All Rejected' : 'Clear All Completed';
            btn.innerHTML = `<i class="fa-solid fa-trash-can"></i> <span>${btnLabel}</span>`;
            // Re-run renderOrders to ensure empty state guard applies dynamically
            renderOrders();
        }
    }
}
window.handleDeleteAllCompletedOrders = handleDeleteAllCompletedOrders;

// --------------------------------------------------------------------------
// 12. WEB AUDIO ALERT SYSTEM & INCOMING ORDER MODAL
// --------------------------------------------------------------------------

let staffOrderAlertAudio = null;
let isOrderAlertAudioPlaying = false;
let currentAlertingOrderId = null;
let staffAudioContext = null;
let staffVibrationInterval = null;
const staffDismissedAlertOrderIds = new Set();
const staffProcessedAudioOrderIds = new Set();

/**
 * Triggers hardware vibration alert pattern: 300ms on, 150ms off, 300ms on, 150ms off, 500ms on
 */
function triggerStaffVibration() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
            navigator.vibrate([300, 150, 300, 150, 500]);
        } catch (e) { }
    }
}

function startStaffVibrationLoop() {
    stopStaffVibrationLoop();
    triggerStaffVibration();
    staffVibrationInterval = setInterval(() => {
        if (isOrderAlertAudioPlaying) {
            triggerStaffVibration();
        } else {
            stopStaffVibrationLoop();
        }
    }, 2500);
}

function stopStaffVibrationLoop() {
    if (staffVibrationInterval) {
        clearInterval(staffVibrationInterval);
        staffVibrationInterval = null;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
            navigator.vibrate(0);
        } catch (e) { }
    }
}
window.startStaffVibrationLoop = startStaffVibrationLoop;
window.stopStaffVibrationLoop = stopStaffVibrationLoop;

/**
 * Dispatches a native browser push/system notification if granted
 */
function dispatchStaffOrderNotification(orderId, details) {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    let targetOrder = null;
    if (orderId) {
        targetOrder = staffOrders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
    }
    if (!targetOrder) {
        targetOrder = staffOrders.find(o => {
            const s = String(o.status || '').trim().toLowerCase();
            return s === 'placed' || s === 'pending' || s === 'new';
        });
    }

    const orderNumber = targetOrder ? (targetOrder.orderId || targetOrder.id) : (orderId || 'New');
    const customerName = targetOrder ? (targetOrder.customerName || targetOrder.customer?.name || targetOrder.name || 'Customer') : 'Customer';
    const itemsCount = targetOrder && Array.isArray(targetOrder.items) 
        ? targetOrder.items.reduce((acc, it) => acc + (it.qty || 1), 0)
        : 1;
    const totalAmount = targetOrder ? (targetOrder.total || targetOrder.finalPayable || targetOrder.totalAmount || 0) : 0;

    const title = `🔔 New Order Arrived! (#${orderNumber})`;
    const body = `Customer: ${customerName} | ${itemsCount} item(s) | ₹${totalAmount}`;

    try {
        const notif = new Notification(title, {
            body: body,
            icon: 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png',
            badge: 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png',
            tag: `perfetto-order-${orderNumber}`,
            renotify: true,
            requireInteraction: true
        });

        notif.onclick = function() {
            window.focus();
            try { this.close(); } catch (e) { }
        };
    } catch (e) {
        console.warn('System Notification error:', e);
    }
}
window.dispatchStaffOrderNotification = dispatchStaffOrderNotification;

/**
 * Initializes and retrieves the Web Audio Context for synthesized tone fallbacks
 */
function getStaffAudioContext() {
    if (!staffAudioContext && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
            try {
                staffAudioContext = new AudioCtx();
            } catch (e) { }
        }
    }
    return staffAudioContext;
}

/**
 * Generates a pleasant synthesized restaurant chime fallback using Web Audio API
 */
function playSynthesizedAlertBeep() {
    try {
        const ctx = getStaffAudioContext();
        if (!ctx) return;
        const scheduleChime = () => {
            try {
                const now = ctx.currentTime;
                const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 cheerful harmonic chime
                notes.forEach((freq, index) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + index * 0.12);
                    gain.gain.setValueAtTime(0.3, now + index * 0.12);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.12 + 0.35);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + index * 0.12);
                    osc.stop(now + index * 0.12 + 0.36);
                });
            } catch (e) { }
        };

        if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
            ctx.resume().then(scheduleChime).catch(() => {});
        } else {
            scheduleChime();
        }
    } catch (e) {
        console.warn('Synthesized audio chime notice:', e.message);
    }
}

/**
 * Resolves absolute origin sound asset URL to ensure reliable loading across all route depths
 */
function getStaffAudioSrc() {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return `${window.location.origin}/order-alert.mp3`;
    }
    return '/order-alert.mp3';
}

/**
 * Initializes persistent HTML5 Audio element configured for continuous looping order alert audio
 */
function getOrderAlertAudio() {
    if (!staffOrderAlertAudio && typeof document !== 'undefined') {
        const domEl = document.getElementById('staff-order-alert-audio');
        if (domEl) {
            staffOrderAlertAudio = domEl;
        }
    }
    if (!staffOrderAlertAudio && typeof Audio !== 'undefined') {
        try {
            staffOrderAlertAudio = new Audio(getStaffAudioSrc());
            staffOrderAlertAudio.loop = true;
            staffOrderAlertAudio.preload = 'auto';
            staffOrderAlertAudio.volume = 1.0;
            // Explicit preload request
            staffOrderAlertAudio.load();
            staffOrderAlertAudio.addEventListener('error', (err) => {
                console.warn('Staff HTML5 audio asset loading error, falling back to harmonic chime:', err);
                if (isOrderAlertAudioPlaying) {
                    startSynthesizedBeepLoop();
                }
            });
            // Fail-safe loop restart: if browser loop policy or buffer glitch terminates playback prematurely
            staffOrderAlertAudio.addEventListener('ended', () => {
                if (isOrderAlertAudioPlaying && isStaffSoundEnabled) {
                    console.log('🔄 [Staff Audio Engine] Siren track reached end, restarting continuous loop...');
                    try {
                        staffOrderAlertAudio.currentTime = 0;
                        const p = staffOrderAlertAudio.play();
                        if (p && typeof p.then === 'function') p.catch(() => {});
                    } catch (e) { }
                }
            });
        } catch (e) {
            console.warn('HTML5 Audio constructor notice:', e);
        }
    }
    if (staffOrderAlertAudio) {
        staffOrderAlertAudio.loop = true;
        staffOrderAlertAudio.preload = 'auto';
        staffOrderAlertAudio.muted = false;
        staffOrderAlertAudio.volume = 1.0;
    }
    return staffOrderAlertAudio;
}

/**
 * Starts continuous looping order alert audio ('/order-alert.mp3' with audio.loop = true)
 * Plays the alert track in a continuous loop for new incoming orders until accepted, rejected, or silenced.
 */
function startSynthesizedBeepLoop() {
    if (synthesizedBeepInterval) return;
    playSynthesizedAlertBeep();
    synthesizedBeepInterval = setInterval(() => {
        if (isOrderAlertAudioPlaying && isStaffSoundEnabled) {
            playSynthesizedAlertBeep();
        } else {
            clearInterval(synthesizedBeepInterval);
            synthesizedBeepInterval = null;
        }
    }, 2500);
}

function startOrderAlertAudio(orderId = '', details = '', orderData = null) {
    const cleanId = String(orderId || 'New').replace(/^#/, '').trim();
    if (isOrderAlertAudioPlaying && currentAlertingOrderId === cleanId) {
        return; // Already playing for this order
    }

    currentAlertingOrderId = cleanId;
    isOrderAlertAudioPlaying = true;
    staffProcessedAudioOrderIds.add(cleanId);
    console.log(`🔊 [Order Alert Loop] Triggering continuous looping order alert for Order #${currentAlertingOrderId}...`);

    // Show persistent visual pulsing alert strip
    const strip = document.getElementById('staff-incoming-alert-strip');
    const stripText = document.getElementById('staff-alert-strip-text');
    if (strip) {
        if (stripText) {
            stripText.textContent = `🚨 INCOMING ORDER #${currentAlertingOrderId} RECEIVED! TAP TO REVIEW`;
        }
        strip.style.display = 'block';
    }

    // Always display incoming order popup modal
    showIncomingOrderModal(orderId, details, orderData);

    // Dispatch Native Browser Notification & Hardware Vibration Alert
    dispatchStaffOrderNotification(orderId, details);
    startStaffVibrationLoop();

    // Fail-safe check: Is sound toggle currently ON?
    if (!isStaffSoundEnabled) {
        console.log('🔕 [Staff Audio] Sound toggle is currently OFF. Audio queued for Order #' + currentAlertingOrderId);
        pendingOrderAlertData = { orderId, details, orderData };
        checkAndShowStaffAudioBanner();
        return;
    }

    // Fail-safe auto-resume: check AudioContext state before alert playback
    const ctx = getStaffAudioContext();
    if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
        console.log(`⚡ [Staff Audio] AudioContext was ${ctx.state}. Executing auto-resume before alert playback...`);
        ctx.resume().catch(err => console.warn('AudioContext auto-resume notice:', err.message));
    }

    // 1. Play HTML5 Audio continuous loop
    let playedHtml5 = false;
    try {
        const audio = getOrderAlertAudio();
        if (audio) {
            audio.loop = true;
            audio.muted = false;
            audio.volume = 1.0;
            try {
                audio.currentTime = 0;
            } catch (e) { }
            const playPromise = audio.play();
            if (playPromise !== undefined && typeof playPromise.then === 'function') {
                playPromise.then(() => {
                    console.log('▶️ [Order Alert Loop] HTML5 Audio playing in continuous loop.');
                    isStaffAudioUnlocked = true;
                    isAudioAutoplayBlocked = false;
                    dismissStaffAudioBanner();
                }).catch((err) => {
                    if (err.name === 'AbortError') {
                        if (!isOrderAlertAudioPlaying) {
                            // User dismissed or stopped audio while play() was resolving. Normal behavior!
                            return;
                        }
                    }
                    console.warn('HTML5 Audio playback note:', err.message);
                    if (isOrderAlertAudioPlaying) {
                        isAudioAutoplayBlocked = true;
                        pendingOrderAlertData = { orderId, details, orderData };
                        checkAndShowStaffAudioBanner();
                        startSynthesizedBeepLoop();
                    }
                });
                playedHtml5 = true;
            }
        }
    } catch (e) {
        console.warn('HTML5 audio play exception:', e.message);
    }

    if (!playedHtml5) {
        startSynthesizedBeepLoop();
    }
}
window.startOrderAlertAudio = startOrderAlertAudio;
window.triggerIncomingOrderAlert = startOrderAlertAudio;
try {
    Object.defineProperty(window, 'isOrderAlertAudioPlaying', {
        get: () => isOrderAlertAudioPlaying,
        set: (v) => { isOrderAlertAudioPlaying = v; },
        configurable: true
    });
    Object.defineProperty(window, 'currentAlertingOrderId', {
        get: () => currentAlertingOrderId,
        set: (v) => { currentAlertingOrderId = v; },
        configurable: true
    });
    Object.defineProperty(window, 'isAudioAutoplayBlocked', {
        get: () => isAudioAutoplayBlocked,
        set: (v) => { isAudioAutoplayBlocked = v; },
        configurable: true
    });
} catch (e) { }

/**
 * Stops and resets the order alert audio immediately (audio.pause(), audio.currentTime = 0)
 * Called when staff accepts or rejects the order, pending queue becomes empty, or user logs out/leaves tab.
 */
function stopOrderAlertAudio() {
    console.log('🔇 [Order Alert Loop] Stopping and resetting order alert audio.');
    isOrderAlertAudioPlaying = false;
    currentAlertingOrderId = null;
    pendingOrderAlertData = null;

    // Stop hardware vibration pattern immediately
    stopStaffVibrationLoop();

    if (synthesizedBeepInterval) {
        clearInterval(synthesizedBeepInterval);
        synthesizedBeepInterval = null;
    }

    // 1. Hide persistent visual alert strip
    const strip = document.getElementById('staff-incoming-alert-strip');
    if (strip) {
        strip.style.display = 'none';
    }

    // 2. Stop and reset HTML5 Audio immediately
    try {
        if (staffOrderAlertAudio) {
            staffOrderAlertAudio.pause();
            staffOrderAlertAudio.currentTime = 0;
            staffOrderAlertAudio.loop = true;
            staffOrderAlertAudio.muted = false;
            staffOrderAlertAudio.volume = 1.0;
        }
    } catch (e) { }

    // 3. Hide Incoming Order Popup Modal
    hideIncomingOrderModal();
}

/**
 * Displays the real-time incoming order popup modal
 */
function showIncomingOrderModal(orderId, details, orderData = null) {
    const modal = document.getElementById('staff-incoming-order-modal');
    if (!modal) return;

    let targetOrder = orderData;
    if (!targetOrder && orderId) {
        targetOrder = staffOrders.find(o => String(o.id) === String(orderId) || String(o.orderId) === String(orderId));
    }
    if (!targetOrder) {
        targetOrder = staffOrders.find(o => {
            const s = String(o.status || '').trim().toLowerCase();
            return s === 'placed' || s === 'pending' || s === 'new';
        }) || staffOrders[0];
    }

    const orderTagEl = document.getElementById('incoming-modal-order-tag');
    const customerEl = document.getElementById('incoming-modal-customer-name');
    const itemsEl = document.getElementById('incoming-modal-items-summary');
    const totalEl = document.getElementById('incoming-modal-order-total');
    const totalRow = document.getElementById('incoming-modal-total-row');
    const paymentEl = document.getElementById('incoming-modal-payment-method');

    const displayId = targetOrder ? (targetOrder.orderId || targetOrder.id) : (orderId || 'New');
    if (orderTagEl) orderTagEl.textContent = `Order #${displayId}`;
    if (customerEl) customerEl.textContent = targetOrder ? (targetOrder.customerName || targetOrder.customer?.name || 'Customer') : 'Customer';

    if (itemsEl) {
        if (targetOrder && Array.isArray(targetOrder.items) && targetOrder.items.length > 0) {
            itemsEl.textContent = targetOrder.items.map(i => `${i.qty || 1}x ${i.name || 'Pizza'}`).join(', ');
        } else if (details) {
            itemsEl.textContent = details;
        } else {
            itemsEl.textContent = 'Incoming Pizza Order';
        }
    }

    if (totalEl) {
        totalEl.textContent = targetOrder ? `₹${targetOrder.total || 0}` : '—';
    }
    if (totalRow) {
        totalRow.style.display = 'flex';
    }

    if (paymentEl) {
        paymentEl.textContent = targetOrder ? (targetOrder.paymentMethod || 'Cash on Delivery') : 'Cash on Delivery';
    }

    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
    modal.setAttribute('aria-hidden', 'false');
}

/**
 * Hides the real-time incoming order popup modal and guarantees pointer events are unblocked
 */
function hideIncomingOrderModal() {
    const modal = document.getElementById('staff-incoming-order-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}
window.hideIncomingOrderModal = hideIncomingOrderModal;

/**
 * Dismisses the incoming order popup and silences the continuous audio loop,
 * while keeping the incoming order card fully visible and operable in the Pending Orders queue.
 */
function dismissIncomingOrderAlert() {
    const alertingId = currentAlertingOrderId;
    if (alertingId) {
        const cleanId = String(alertingId).replace(/^#/, '').trim();
        staffDismissedAlertOrderIds.add(cleanId);
        staffDismissedAlertOrderIds.add(String(alertingId));
        staffProcessedAudioOrderIds.add(cleanId);
        staffProcessedAudioOrderIds.add(String(alertingId));
    }
    stopOrderAlertAudio();
    hideIncomingOrderModal();

    // Reset autoplay suppression: user actively clicked "Dismiss" gesture
    isAudioAutoplayBlocked = false;
    isStaffAudioUnlocked = true;

    // Warm and maintain the Web Audio context on this genuine click gesture
    try {
        const ctx = getStaffAudioContext();
        if (ctx && (ctx.state === 'suspended' || ctx.state === 'interrupted')) {
            ctx.resume().catch(() => {});
        }
    } catch (e) { }

    // Ensure the pending orders tab is active and re-render the pending feed
    if (currentStaffTab !== 'pending') {
        switchStaffTab('pending');
    } else {
        renderOrders();
    }

    // Ensure interactive state on the dismissed order card
    if (alertingId) {
        ensureOrderCardInteractive(alertingId);
    }

    showStaffToast('Order alert silenced. Order is waiting in Pending queue.');
}
window.dismissIncomingOrderAlert = dismissIncomingOrderAlert;

// Desktop Keyboard Usability: Pressing Escape silences the incoming audio alert
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            const modal = document.getElementById('staff-incoming-order-modal');
            if (modal && modal.style.display !== 'none' && modal.getAttribute('aria-hidden') !== 'true') {
                dismissIncomingOrderAlert();
            }
        }
    });
}

/**
 * Accepts the incoming order from the modal and stops the continuous audio loop
 */
function acceptIncomingOrderFromModal() {
    const targetId = currentAlertingOrderId || (staffOrders.find(o => {
        const s = String(o.status || '').toLowerCase().trim();
        return s === 'placed' || s === 'pending' || s === 'new';
    })?.id);
    stopOrderAlertAudio();
    hideIncomingOrderModal();
    if (targetId) {
        updateOrderStatus(targetId, 'preparing');
    } else {
        showStaffToast('Order accepted! 🍕');
    }
}
window.acceptIncomingOrderFromModal = acceptIncomingOrderFromModal;

// --------------------------------------------------------------------------
// 13. CLEANUP & MEMORY LEAK PREVENTION (PAGE UNMOUNT / REFRESH)
// --------------------------------------------------------------------------
function cleanupAllStaffListeners() {
    try {
        if (typeof staffSettingsUnsubscribe === 'function') {
            staffSettingsUnsubscribe();
            staffSettingsUnsubscribe = null;
        }
        if (typeof staffConfigUnsubscribe === 'function') {
            staffConfigUnsubscribe();
            staffConfigUnsubscribe = null;
        }
        if (typeof staffOrdersUnsubscribe === 'function') {
            staffOrdersUnsubscribe();
            staffOrdersUnsubscribe = null;
        }
        if (typeof activeStaffSessionListener === 'function') {
            activeStaffSessionListener();
            activeStaffSessionListener = null;
        }
        if (typeof activeStaffSessionUsersListener === 'function') {
            activeStaffSessionUsersListener();
            activeStaffSessionUsersListener = null;
        }
        if (typeof activeStaffPendingApprovalListener === 'function') {
            activeStaffPendingApprovalListener();
            activeStaffPendingApprovalListener = null;
        }
        if (activeStaffSessionPoller) {
            clearInterval(activeStaffSessionPoller);
            activeStaffSessionPoller = null;
        }
        if (activeStaffPendingApprovalPoller) {
            clearInterval(activeStaffPendingApprovalPoller);
            activeStaffPendingApprovalPoller = null;
        }
        if (staffLiveTimersInterval) {
            clearInterval(staffLiveTimersInterval);
            staffLiveTimersInterval = null;
        }
        if (staffBackendSyncInterval) {
            clearInterval(staffBackendSyncInterval);
            staffBackendSyncInterval = null;
        }
        if (staffTimerWorker) {
            try {
                staffTimerWorker.postMessage('stop');
                staffTimerWorker.terminate();
            } catch (e) { }
            staffTimerWorker = null;
        }
        stopOrderAlertAudio();
    } catch (e) {
        console.warn('Error during staff listener cleanup:', e);
    }
}

window.addEventListener('beforeunload', cleanupAllStaffListeners);
window.addEventListener('pagehide', cleanupAllStaffListeners);

// Global Error & Promise Rejection Safety Boundaries
window.addEventListener('unhandledrejection', (event) => {
    console.warn('🛡️ [Staff Portal] Unhandled Promise Rejection intercepted:', event.reason);
    if (event.reason && (event.reason.message?.includes('Failed to fetch') || event.reason.message?.includes('NetworkError') || event.reason.name === 'AbortError')) {
        event.preventDefault();
    }
});

window.addEventListener('error', (event) => {
    console.warn('🛡️ [Staff Portal] Runtime Error intercepted:', event.message);
});

// Global window helpers and auto-init
window.startOrderAlertAudio = startOrderAlertAudio;
window.stopOrderAlertAudio = stopOrderAlertAudio;
window.triggerStaffOrderAlertSound = startOrderAlertAudio;
window.stopStaffOrderAlertSound = stopOrderAlertAudio;
window.playSynthesizedAlertBeep = playSynthesizedAlertBeep;
window.cleanupAllStaffListeners = cleanupAllStaffListeners;
window.toggleStaffSoundState = toggleStaffSoundState;
window.updateStaffSoundToggleUI = updateStaffSoundToggleUI;
window.startStaffAudioKeepAlive = startStaffAudioKeepAlive;
window.stopStaffAudioKeepAlive = stopStaffAudioKeepAlive;

// Prime Audio & apply deep-link tab routing on page load
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            getOrderAlertAudio();
            applyStaffTabFromUrl();
        });
    } else {
        getOrderAlertAudio();
        applyStaffTabFromUrl();
    }
}

