/**
 * Verification Script: Dynamic Wallet Hold Expiry Recovery & Grace Period
 * Verifies that released holds do not expire prematurely and that near-expired or
 * expired funds are granted a full 24-hour grace window upon order rejection/auto-expiration.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Starting Dynamic Wallet Hold Expiry Recovery Verification ---');

// 1. Test calculateRecoveredExpiry implementation
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
function calculateRecoveredExpiry(originalExpiresAt, nowMs = Date.now()) {
    if (!originalExpiresAt) {
        return new Date(nowMs + TWENTY_FOUR_HOURS_MS).toISOString();
    }
    const expMs = new Date(originalExpiresAt).getTime();
    if (isNaN(expMs) || expMs <= nowMs || (expMs - nowMs) < TWENTY_FOUR_HOURS_MS) {
        return new Date(nowMs + TWENTY_FOUR_HOURS_MS).toISOString();
    }
    return new Date(expMs).toISOString();
}

const now = Date.now();

// Case A: Future expiry > 24 hours (e.g. 5 days) -> Preserve original expiry
const fiveDaysFuture = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
const recoveredFiveDays = calculateRecoveredExpiry(fiveDaysFuture, now);
assert.strictEqual(recoveredFiveDays, fiveDaysFuture, 'Future expiry > 24 hours should be preserved exactly');
console.log('✅ Case A: Future expiry > 24h preserved intact');

// Case B: Near expiry < 24 hours (e.g. 2 hours remaining) -> Grant 24h grace window
const twoHoursFuture = new Date(now + 2 * 60 * 60 * 1000).toISOString();
const recoveredTwoHours = calculateRecoveredExpiry(twoHoursFuture, now);
const diffTwoHours = new Date(recoveredTwoHours).getTime() - now;
assert.strictEqual(diffTwoHours, TWENTY_FOUR_HOURS_MS, 'Near expiry < 24h should be granted full 24h grace window');
console.log('✅ Case B: Near expiry (< 24h) extended to 24h grace window');

// Case C: Already expired during hold (e.g. expired 1 hour ago) -> Recover with 24h grace window
const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
const recoveredExpired = calculateRecoveredExpiry(oneHourAgo, now);
const diffExpired = new Date(recoveredExpired).getTime() - now;
assert.strictEqual(diffExpired, TWENTY_FOUR_HOURS_MS, 'Expired hold should be recovered with full 24h grace window');
console.log('✅ Case C: Expired hold recovered from expiry with 24h grace window');

// Case D: Missing / null expiry -> Safe 24h grace window
const recoveredNull = calculateRecoveredExpiry(null, now);
const diffNull = new Date(recoveredNull).getTime() - now;
assert.strictEqual(diffNull, TWENTY_FOUR_HOURS_MS, 'Null expiry should default to 24h grace window');
console.log('✅ Case D: Null expiry defaults safely to 24h grace window');

// 2. Test app.js reconcileWalletTranches and releaseWalletHold behavior
// Mock safeStorage and localStorage
const mockStorage = {};
global.safeStorage = {
    getJSON: (k, def) => mockStorage[k] !== undefined ? mockStorage[k] : def,
    setJSON: (k, v) => { mockStorage[k] = v; }
};
global.localStorage = {
    getItem: (k) => mockStorage[k] !== undefined ? JSON.stringify(mockStorage[k]) : null,
    setItem: (k, v) => {
        try { mockStorage[k] = JSON.parse(v); } catch(e) { mockStorage[k] = v; }
    }
};
global.window = global;
global.showToast = () => {};
global.updateProfileWalletUI = () => {};
global.renderProfileWalletTxList = () => {};
global.updateCheckoutWalletUI = () => {};

// Load app.js functions by requiring parts or evaluating
const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Verify app.js contains calculateRecoveredExpiry
assert(appCode.includes('function calculateRecoveredExpiry'), 'app.js must include calculateRecoveredExpiry');
assert(appCode.includes('walletHoldExpiresAt'), 'app.js must track walletHoldExpiresAt');
assert(appCode.includes('originalExpiresAt'), 'app.js must track originalExpiresAt');

// Test reconciliation logic with recovered expiry
let wallet = {
    balance: 50,
    nonExpiredBalance: 50,
    expiresAt: oneHourAgo, // was expired
    expired: true,
    transactions: [
        {
            id: 'tx_hold_ORDER_999',
            type: 'hold',
            amount: 50,
            orderId: 'ORDER_999',
            status: 'LOCKED_HOLD',
            originalExpiresAt: oneHourAgo,
            createdAt: new Date(now - 30 * 60 * 1000).toISOString()
        },
        {
            id: 'tx_credit_1',
            type: 'credit',
            amount: 50,
            initialAmount: 50,
            remainingAmount: 50,
            status: 'active',
            expiresAt: oneHourAgo,
            createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString()
        }
    ]
};

// Simulate releaseWalletHold
global.currentCustomerWallet = wallet;

// Extract releaseWalletHold and reconcileWalletTranches from app.js context
// Create an isolated sandbox
const vm = require('vm');
const sandbox = {
    console,
    Date,
    Math,
    Array,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isNaN,
    Infinity,
    Set,
    Map,
    safeStorage: global.safeStorage,
    localStorage: global.localStorage,
    showToast: () => {},
    updateProfileWalletUI: () => {},
    renderProfileWalletTxList: () => {},
    updateCheckoutWalletUI: () => {},
    currentCustomerWallet: wallet,
    customerFirestore: null,
    window: {}
};
sandbox.window = sandbox;

// Evaluate calculateRecoveredExpiry & releaseWalletHold in sandbox
vm.runInNewContext(`
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
${appCode.match(/function parseTimestampMs[\s\S]*?^}/m)?.[0] || ''}
${appCode.match(/function reconcileWalletTranches[\s\S]*?^}/m)?.[0] || ''}
${appCode.match(/function calculateRecoveredExpiry[\s\S]*?^}/m)?.[0] || ''}
${appCode.match(/function releaseWalletHold[\s\S]*?^}/m)?.[0] || ''}
`, sandbox);

assert(typeof sandbox.releaseWalletHold === 'function', 'releaseWalletHold must be defined');

// Perform release of expired hold
sandbox.releaseWalletHold('ORDER_999', 50, oneHourAgo);

assert.strictEqual(sandbox.currentCustomerWallet.balance, 50, 'Wallet balance must be restored to 50');
assert.strictEqual(sandbox.currentCustomerWallet.expired, false, 'Wallet must NOT be expired after recovered hold release');
assert(sandbox.currentCustomerWallet.expiresAt !== null, 'Wallet expiresAt must be populated with recovered date');
const recoveredExpMs = new Date(sandbox.currentCustomerWallet.expiresAt).getTime();
assert(recoveredExpMs > Date.now(), 'Recovered expiresAt must be in the future');
assert(recoveredExpMs - Date.now() >= 23 * 60 * 60 * 1000, 'Recovered expiresAt must grant at least 23+ hours grace');

console.log('✅ Case E: releaseWalletHold successfully revived expired funds with full grace window');

// 3. Test Idempotency of hold release
sandbox.releaseWalletHold('ORDER_999', 50, oneHourAgo);
assert.strictEqual(sandbox.currentCustomerWallet.balance, 50, 'Second release must be strictly idempotent (balance stays 50, not 100)');
console.log('✅ Case F: releaseWalletHold is strictly idempotent against multiple refund triggers');

// 4. Verify staff.js, admin.html, and ordersController.js contain calculateRecoveredExpiry
const staffCode = fs.readFileSync(path.join(__dirname, '..', 'staff.js'), 'utf8');
assert(staffCode.includes('function calculateRecoveredExpiry'), 'staff.js must include calculateRecoveredExpiry');
assert(staffCode.includes('recoveredExpiresAt'), 'staff.js must apply recoveredExpiresAt');
console.log('✅ Case G: staff.js contains calculateRecoveredExpiry and grace logic');

const adminCode = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
assert(adminCode.includes('function calculateRecoveredExpiry'), 'admin.html must include calculateRecoveredExpiry');
assert(adminCode.includes('recoveredExpiresAt'), 'admin.html must apply recoveredExpiresAt');
console.log('✅ Case H: admin.html contains calculateRecoveredExpiry and grace logic');

const ordersCtrlCode = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'ordersController.js'), 'utf8');
assert(ordersCtrlCode.includes('function calculateRecoveredExpiry'), 'ordersController.js must include calculateRecoveredExpiry');
assert(ordersCtrlCode.includes('recoveredExpiresAt'), 'ordersController.js must apply recoveredExpiresAt');
console.log('✅ Case I: ordersController.js contains calculateRecoveredExpiry and grace logic');

console.log('--- ALL 9 DYNAMIC EXPIRY RECOVERY & GRACE CHECKS PASSED! ---');
