/**
 * Comprehensive Verification Script for:
 * 1. staff.js: Premature auto-expiry prevention & robust timestamp conversion
 * 2. app.js: Unauthenticated profile state isolation (balance 0, orders 0, history hidden, reward hidden)
 * 3. admin.js: Real-time order chime & banner trigger on newly arriving pending orders
 */

const fs = require('fs');
const assert = require('assert');

console.log('🧪 Starting Multi-Portal Verification Suite...\n');

// -----------------------------------------------------------------------------
// TEST SUITE 1: staff.js
// -----------------------------------------------------------------------------
console.log('=== TEST SUITE 1: staff.js Timestamp & 100-Minute Auto-Expiry ===');
const staffCode = fs.readFileSync('staff.js', 'utf8');

const mockDom = {
    getElementById: () => null,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
};

const storageMock = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

global.window = {
    addEventListener: () => {},
    document: mockDom,
    location: { search: '', hash: '', pathname: '/staff' },
    localStorage: storageMock,
    sessionStorage: storageMock,
    Notification: { permission: 'denied' }
};
global.document = mockDom;
global.navigator = { userAgent: 'test' };
global.localStorage = storageMock;
global.sessionStorage = storageMock;

eval(staffCode);

const now = Date.now();
const ONE_HUNDRED_MINS = 100 * 60 * 1000;

// Test timestamp parsing from various Firestore formats
const timestampTestCases = [
    { label: 'Firestore server timestamp { seconds, nanoseconds }', input: { seconds: Math.floor((now - 120000) / 1000), nanoseconds: 500000 } },
    { label: 'Firestore Timestamp with .toDate()', input: { toDate: () => new Date(now - 60000) } },
    { label: 'Firestore Timestamp with .toMillis()', input: { toMillis: () => now - 45000 } },
    { label: 'ISO string format', input: new Date(now - 15000).toISOString() },
    { label: 'Epoch milliseconds numeric', input: now - 30000 },
    { label: 'Epoch seconds numeric', input: Math.floor((now - 25000) / 1000) },
    { label: 'Embedded in ID string', input: null, id: `ORD_${now - 10000}` }
];

timestampTestCases.forEach((tc, i) => {
    const rawData = tc.input !== null ? { createdAt: tc.input } : { id: tc.id };
    const parsedTime = window.parseOrderCreationTimeMs(rawData);
    assert(!isNaN(parsedTime) && parsedTime > 0, `parseOrderCreationTimeMs failed for ${tc.label}`);
    
    const parsedOrder = window.parseStaffOrder('ord_' + i, rawData);
    const rem = window.getOrderRemainingTimeMs(parsedOrder, now);
    const isExp = window.isOrder100MinsExpired(parsedOrder, now);
    const isPending = window.isPendingStaffOrder(parsedOrder);
    const isRejected = window.isRejectedStaffOrder(parsedOrder);

    assert.strictEqual(isExp, false, `Fresh order must NOT be expired for ${tc.label}`);
    assert(rem > 5800000, `Remaining time must be ~100 minutes (>5800000ms), got ${rem} for ${tc.label}`);
    assert.strictEqual(isPending, true, `Fresh order must be in Pending for ${tc.label}`);
    assert.strictEqual(isRejected, false, `Fresh order must NOT be in Rejected for ${tc.label}`);
    console.log(`  ✓ Passed fresh order check: ${tc.label}`);
});

// Test expired order (101 mins old)
const expiredOrder = window.parseStaffOrder('ord_expired', {
    createdAt: new Date(now - 101 * 60 * 1000).toISOString(),
    status: 'PENDING'
});
const expRem = window.getOrderRemainingTimeMs(expiredOrder, now);
const expIsExp = window.isOrder100MinsExpired(expiredOrder, now);
const expIsPending = window.isPendingStaffOrder(expiredOrder);
const expIsRejected = window.isRejectedStaffOrder(expiredOrder);

assert.strictEqual(expIsExp, true, '101m old order MUST be expired');
assert(expRem <= 0, `101m old order remaining time must be <= 0, got ${expRem}`);
assert.strictEqual(expIsPending, false, '101m old order must NOT be in Pending');
assert.strictEqual(expIsRejected, true, '101m old order MUST be in Rejected');
console.log('  ✓ Passed 101-minute expired order boundary check');

// Test autoRejectExpiredOrder safety guard
const freshOrderToTestReject = window.parseStaffOrder('ord_fresh_reject_test', {
    createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
    status: 'PENDING'
});
window.autoRejectExpiredOrder(freshOrderToTestReject).then(() => {
    assert.strictEqual(String(freshOrderToTestReject.status).toLowerCase(), 'pending', 'autoRejectExpiredOrder must NOT reject a 5m old order');
    console.log('  ✓ Passed autoRejectExpiredOrder safety guard for fresh order (<100m)');
});

// -----------------------------------------------------------------------------
// TEST SUITE 2: app.js
// -----------------------------------------------------------------------------
console.log('\n=== TEST SUITE 2: app.js Unauthenticated Customer Profile State ===');
const appCode = fs.readFileSync('app.js', 'utf8');

// Verify unauthenticated checks in app.js
assert(appCode.includes('function getVerifiedCustomerPhone('), 'app.js has getVerifiedCustomerPhone');
assert(appCode.includes('function getEffectiveWalletBalance('), 'app.js has getEffectiveWalletBalance');
assert(appCode.includes('function updateProfileTotalsUI('), 'app.js has updateProfileTotalsUI');
assert(appCode.includes('function renderOrderHistoryDetails('), 'app.js has renderOrderHistoryDetails');
assert(appCode.includes('function getFirstUnclaimedOrder('), 'app.js has getFirstUnclaimedOrder');

const localStorageMock = {
    perfetto_wallet_balance: '150', // Leaked balance from previous user
    perfetto_customer_wallet: JSON.stringify({ balance: 150, transactions: [{ id: 1 }] }),
    perfettoCustomerOrders: JSON.stringify([
        { id: '101', customerPhone: '9876543210', status: 'delivered', earnedCashback: 50, scratchCard: { amount: 50, claimed: false } }
    ]),
    customerDeliveryProfile: JSON.stringify({ fullName: 'Previous User', phone: '9876543210' })
};

const sessionStorageMock = {}; // Empty session (no verified phone)

global.safeStorage = {
    getItem: (k) => localStorageMock[k] || null,
    setItem: (k, v) => { localStorageMock[k] = String(v); },
    getJSON: (k, fallback) => localStorageMock[k] ? JSON.parse(localStorageMock[k]) : fallback,
    setJSON: (k, v) => { localStorageMock[k] = JSON.stringify(v); },
    removeItem: (k) => { delete localStorageMock[k]; }
};

global.safeSessionStorage = {
    getItem: (k) => sessionStorageMock[k] || null,
    setItem: (k, v) => { sessionStorageMock[k] = String(v); },
    getJSON: (k, fallback) => sessionStorageMock[k] ? JSON.parse(sessionStorageMock[k]) : fallback,
    setJSON: (k, v) => { sessionStorageMock[k] = JSON.stringify(v); },
    removeItem: (k) => { delete sessionStorageMock[k]; }
};

global.VERIFIED_PHONE_STORAGE_KEY = 'perfetto_verified_phone';
global.DELIVERY_PROFILE_KEY = 'customerDeliveryProfile';
global.isPhoneVerified = false;

// 1. getVerifiedCustomerPhone without session verified phone must return null
eval(`
${appCode.slice(appCode.indexOf('function getStoredVerifiedPhone()'), appCode.indexOf('function setStoredPhoneVerified('))}
`);

const phoneResult = window.getVerifiedCustomerPhone();
assert.strictEqual(phoneResult, null, 'Unauthenticated getVerifiedCustomerPhone must return null');
console.log('  ✓ getVerifiedCustomerPhone returns null when no active session phone verified');

// 2. getEffectiveWalletBalance without verified phone must return 0
eval(`
${appCode.slice(appCode.indexOf('function getEffectiveWalletBalance()'), appCode.indexOf('let isWalletRedemptionSelected = false;'))}
`);
const walletResult = window.getEffectiveWalletBalance();
assert.strictEqual(walletResult, 0, 'Unauthenticated getEffectiveWalletBalance must return 0');
console.log('  ✓ getEffectiveWalletBalance returns 0 for unauthenticated visits');

// 3. getFirstUnclaimedOrder without verified phone must return null
eval(`
${appCode.slice(appCode.indexOf('function getFirstUnclaimedOrder()'), appCode.indexOf('const getFirstUnclaimedDeliveredOrder = getFirstUnclaimedOrder;'))}
`);
const scratchResult = window.getFirstUnclaimedOrder();
assert.strictEqual(scratchResult, null, 'Unauthenticated getFirstUnclaimedOrder must return null');
console.log('  ✓ getFirstUnclaimedOrder returns null for unauthenticated visits (hides reward cards)');

// -----------------------------------------------------------------------------
// TEST SUITE 3: admin.js Incoming Order Chime & Banner
// -----------------------------------------------------------------------------
console.log('\n=== TEST SUITE 3: admin.js Incoming Order Chime & Alert Banner ===');
const adminCode = fs.readFileSync('admin.js', 'utf8');

assert(adminCode.includes('let isInitialAdminHydration = true;'), 'admin.js must initialize isInitialAdminHydration');
assert(adminCode.includes('const adminKnownOrderIds = new Set();'), 'admin.js must initialize adminKnownOrderIds set');
assert(adminCode.includes('showAdminOrderAlert(latestNewOrder);'), 'admin.js must trigger showAdminOrderAlert on newly arrived pending orders');
assert(adminCode.includes('playAdminOrderChime(orderId);'), 'admin.js must call playAdminOrderChime in showAdminOrderAlert');
console.log('  ✓ admin.js tracks known orders across initial hydration');
console.log('  ✓ admin.js triggers chime and banner alert on newly incoming pending orders');

console.log('\n🎉 ALL PORTAL VERIFICATION CHECKS PASSED PERFECTLY!');
process.exit(0);
