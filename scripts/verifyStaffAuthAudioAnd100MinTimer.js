/**
 * Verification script for Staff Portal:
 * 1. Silence Audio Until Full Staff Authentication
 * 2. 100-Minute Auto-Expiry Timer & Cancellation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting Staff Portal Auth Audio & 100-Min Expiry Verification...');

// Create mock DOM environment
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => {
        if (id === 'staff-login-overlay') {
            return global.mockOverlay || { style: { display: 'none', visibility: 'hidden', opacity: '0' } };
        }
        if (id === 'staff-audio-banner') {
            return { style: {} };
        }
        return null;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    activeElement: null
};
global.sessionStorage = {
    getItem: (k) => global._sessionStorage?.[k] || null,
    setItem: (k, v) => { global._sessionStorage = global._sessionStorage || {}; global._sessionStorage[k] = v; },
    removeItem: (k) => { if (global._sessionStorage) delete global._sessionStorage[k]; }
};
global.localStorage = {
    getItem: (k) => global._localStorage?.[k] || null,
    setItem: (k, v) => { global._localStorage = global._localStorage || {}; global._localStorage[k] = v; },
    removeItem: (k) => { if (global._localStorage) delete global._localStorage[k]; }
};
global.navigator = { userAgent: 'NodeTest' };
global.location = { origin: 'http://localhost:8080', search: '', pathname: '/staff' };

// Load staff.js
const staffJsContent = fs.readFileSync(path.join(__dirname, '../staff.js'), 'utf-8');
eval(staffJsContent);

console.log('✅ staff.js loaded into runtime environment.');

// Test 1: Authentication Guard on Audio Loop
console.log('\n--- TEST 1: Authentication Guard on Audio Loop ---');
global.mockOverlay = { style: { display: 'flex', visibility: 'visible', opacity: '1' } };
assert.strictEqual(window.isStaffAuthenticated(), false, 'isStaffAuthenticated() should return false when login overlay is visible');
assert.strictEqual(window.isStaffLoggedIn, false, 'isStaffLoggedIn should evaluate to false when login overlay is visible');

// Verify audio alert trigger is silenced when unauthenticated
window.startOrderAlertAudio('123', 'Test Order');
assert.strictEqual(window.isOrderAlertAudioPlaying, false, 'isOrderAlertAudioPlaying must remain false when unauthenticated');
console.log('✓ Unauthenticated audio trigger properly blocked and silenced.');

// Test 2: Authenticated Staff Evaluation
console.log('\n--- TEST 2: Authenticated Staff Evaluation ---');
global.mockOverlay = { style: { display: 'none', visibility: 'hidden', opacity: '0' } };
global.currentStaffUser = {
    phone: '9414503886',
    role: 'Master Admin',
    status: 'active',
    isApproved: true
};
assert.strictEqual(window.isStaffAuthenticated(), true, 'Master Admin should be authenticated');
assert.strictEqual(window.isStaffLoggedIn, true, 'isStaffLoggedIn should be true for Master Admin');

global.currentStaffUser = {
    phone: '9876543210',
    role: 'Staff',
    status: 'active',
    isApproved: true
};
assert.strictEqual(window.isStaffAuthenticated(), true, 'Active approved staff should be authenticated');
assert.strictEqual(window.isStaffLoggedIn, true, 'isStaffLoggedIn should be true for approved staff');

global.currentStaffUser = {
    phone: '9876543210',
    role: 'Staff',
    status: 'pending',
    isApproved: false
};
assert.strictEqual(window.isStaffAuthenticated(), false, 'Pending unapproved staff should NOT be authenticated');

// Test 3: 100-Minute Auto-Expiry Calculations & Formatting
console.log('\n--- TEST 3: 100-Minute Countdown Formatter ---');
// 100 minutes = 6,000,000 ms
assert.strictEqual(window.format100MinCountdown(100 * 60 * 1000), '1h 40m', '100m should format as 1h 40m');
assert.strictEqual(window.format100MinCountdown(90 * 60 * 1000), '1h 30m', '90m should format as 1h 30m');
assert.strictEqual(window.format100MinCountdown(60 * 60 * 1000), '1h 0m', '60m should format as 1h 0m');
assert.strictEqual(window.format100MinCountdown(59 * 60 * 1000 + 35 * 1000), '59m 35s', '59m 35s should format as 59m 35s');
assert.strictEqual(window.format100MinCountdown(5 * 60 * 1000 + 4 * 1000), '5m 04s', '5m 4s should format as 5m 04s');
assert.strictEqual(window.format100MinCountdown(0), 'Expired', '0ms should format as Expired');
assert.strictEqual(window.format100MinCountdown(-5000), 'Expired', 'Negative ms should format as Expired');

// Test max remaining time never exceeds 1h 40m
assert.strictEqual(window.format100MinCountdown(150 * 60 * 1000), '1h 40m', 'Over 100m should be capped at 1h 40m');
console.log('✓ format100MinCountdown formatted accurately and capped at 1h 40m.');

// Test 4: Order Remaining Time Calculation
console.log('\n--- TEST 4: getOrderRemainingTimeMs ---');
const now = Date.now();
const recentOrder = {
    id: 'recent_1',
    status: 'PENDING',
    createdAt: new Date(now - 10 * 60 * 1000).toISOString() // 10 mins ago
};
const expiredOrder = {
    id: 'expired_1',
    status: 'PENDING',
    createdAt: new Date(now - 105 * 60 * 1000).toISOString() // 105 mins ago
};

const recentRemMs = window.getOrderRemainingTimeMs(recentOrder, now);
assert.strictEqual(Math.round(recentRemMs / 60000), 90, 'Order created 10m ago should have 90m remaining');

const expiredRemMs = window.getOrderRemainingTimeMs(expiredOrder, now);
assert.ok(expiredRemMs <= 0, 'Order created 105m ago should have <= 0 ms remaining');

// Test 5: Tab Partitioning (Pending vs Rejected/Expired)
console.log('\n--- TEST 5: Tab Partitioning ---');
assert.strictEqual(window.isPendingStaffOrder(recentOrder), true, 'Recent order should be in Pending tab');
assert.strictEqual(window.isPendingStaffOrder(expiredOrder), false, 'Expired order (>100 mins) must NOT be in Pending tab');

assert.strictEqual(window.isRejectedStaffOrder(expiredOrder), true, 'Expired order (>100 mins) must be categorized in Rejected tab');
assert.strictEqual(window.isRejectedStaffOrder(recentOrder), false, 'Recent order must NOT be in Rejected tab');

// Test 6: Auto-cancellation reason
console.log('\n--- TEST 6: Auto-cancellation Reason ---');
window.autoRejectExpiredOrder(expiredOrder);
assert.strictEqual(expiredOrder.status, 'REJECTED', 'Expired order status must become REJECTED');
assert.strictEqual(expiredOrder.rejectionReason, 'Auto-expired: 100 minutes timeout', 'Rejection reason must be "Auto-expired: 100 minutes timeout"');
assert.strictEqual(expiredOrder.autoExpired, true, 'autoExpired flag must be true');

console.log('\n🎉 ALL UNIT & INTEGRATION TESTS PASSED!');
process.exit(0);
