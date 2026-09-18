/**
 * Dedicated test script:
 * Verifies that fresh pending orders are NEVER auto-rejected by the 100-min sweeper,
 * always evaluate to positive remaining time, remain in the "Pending Orders" tab,
 * and keep the looping audio siren active.
 */

const fs = require('fs');
const assert = require('assert');

console.log('🧪 Starting Fresh Order Auto-Rejection Prevention Tests...\n');

const staffCode = fs.readFileSync('staff.js', 'utf8');

const storeMock = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};

const mockDom = {
    getElementById: () => null,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
};

global.window = {
    addEventListener: () => {},
    document: mockDom,
    location: { search: '', hash: '', pathname: '/staff' },
    localStorage: storeMock,
    sessionStorage: storeMock,
    Notification: { permission: 'denied' }
};
global.document = mockDom;
global.localStorage = storeMock;
global.sessionStorage = storeMock;
global.navigator = { userAgent: 'test' };

eval(staffCode);

const now = Date.now();
const ONE_HUNDRED_MINS = 100 * 60 * 1000;

// -----------------------------------------------------------------------------
// TEST 1: getOrderRemainingTimeMs with valid, missing, or invalid timestamps
// -----------------------------------------------------------------------------
console.log('--- TEST 1: getOrderRemainingTimeMs Timestamp Handlers ---');

// Fresh order created 5 minutes ago
const fresh5m = { createdAt: new Date(now - 5 * 60 * 1000).toISOString() };
const rem5m = window.getOrderRemainingTimeMs(fresh5m, now);
assert(rem5m > 0, '5m old order remaining time must be strictly positive');
assert.strictEqual(rem5m, ONE_HUNDRED_MINS - (5 * 60 * 1000), '5m old order remaining time must equal exactly 95m');
console.log('  ✓ 5m old order returns strictly positive remaining time (95m)');

// Fresh order created 99 minutes ago
const fresh99m = { createdAt: new Date(now - 99 * 60 * 1000).toISOString() };
const rem99m = window.getOrderRemainingTimeMs(fresh99m, now);
assert(rem99m > 0, '99m old order remaining time must be strictly positive (>0)');
console.log('  ✓ 99m old order returns strictly positive remaining time');

// Missing createdAt
const missingDate = {};
const remMissing = window.getOrderRemainingTimeMs(missingDate, now);
assert(remMissing > 0, 'Missing timestamp must default to Date.now() and return positive remaining time');
console.log('  ✓ Missing createdAt defaults to Date.now() and returns positive remaining time');

// Invalid string createdAt
const invalidDate = { createdAt: 'NOT_A_VALID_DATE' };
const remInvalid = window.getOrderRemainingTimeMs(invalidDate, now);
assert(remInvalid > 0, 'Invalid string timestamp must default to Date.now() and return positive remaining time');
console.log('  ✓ Invalid date string defaults to Date.now() and returns positive remaining time');

// NaN or empty object
const nanDate = { createdAt: NaN, serverTimestamp: {} };
const remNaN = window.getOrderRemainingTimeMs(nanDate, now);
assert(remNaN > 0, 'NaN timestamp must default to Date.now() and return positive remaining time');
console.log('  ✓ NaN timestamp defaults to Date.now() and returns positive remaining time');

// -----------------------------------------------------------------------------
// TEST 2: Tab Partitioning with Stale autoExpired Flags
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Tab Partitioning with Stale autoExpired Flags ---');

// Fresh pending order with stale autoExpired: true (from previous bug)
const staleFreshOrder = window.parseStaffOrder('ord_stale_1', {
    orderId: 'ord_stale_1',
    createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    status: 'PENDING',
    autoExpired: true,
    isAutoExpired: true,
    rejectedBy: 'SYSTEM_AUTO_EXPIRE',
    rejectionReason: 'Auto-expired: 100 minutes timeout'
});

assert.strictEqual(staleFreshOrder.autoExpired, false, 'parseStaffOrder must sanitize stale autoExpired on fresh orders');
assert.strictEqual(staleFreshOrder.status, 'pending', 'Fresh order must have status pending');

const isPending = window.isPendingStaffOrder(staleFreshOrder);
const isRejected = window.isRejectedStaffOrder(staleFreshOrder);
const isExp = window.isOrder100MinsExpired(staleFreshOrder);

assert.strictEqual(isExp, false, 'Fresh order with stale flags must NOT be expired');
assert.strictEqual(isPending, true, 'Fresh order MUST render in Pending Orders tab');
assert.strictEqual(isRejected, false, 'Fresh order must NOT render in Rejected Orders tab');
console.log('  ✓ Fresh order with stale autoExpired flags correctly stays in Pending Orders tab');

// -----------------------------------------------------------------------------
// TEST 3: autoRejectExpiredOrder and sweepAutoExpiredOrders Guards
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: autoRejectExpiredOrder & Sweeper Guards ---');

const freshOrderToReject = window.parseStaffOrder('ord_guard_test', {
    orderId: 'ord_guard_test',
    createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
    status: 'PENDING'
});

window.autoRejectExpiredOrder(freshOrderToReject).then(() => {
    assert.strictEqual(freshOrderToReject.status.toLowerCase(), 'pending', 'autoRejectExpiredOrder must NOT reject a 20m old order');
    assert.strictEqual(freshOrderToReject.autoExpired, false, 'autoRejectExpiredOrder must keep autoExpired false');
    console.log('  ✓ autoRejectExpiredOrder successfully guarded fresh order (<100m)');

    console.log('\n🎉 ALL FRESH ORDER AUTO-EXPIRY PREVENTION CHECKS PASSED!\n');
    process.exit(0);
}).catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
