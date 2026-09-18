const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('======================================================================');
console.log('🧪 VERIFYING WALLET LIFECYCLE: HOLD-TO-DEBIT & SCRATCHED CASHBACK');
console.log('======================================================================\n');

let passCount = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`PASS: ${name}`);
        passCount++;
    } catch (err) {
        console.error(`FAIL: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

const appJs = fs.readFileSync('app.js', 'utf8');
const staffJs = fs.readFileSync('staff.js', 'utf8');

// 1. Static assertions on staff.js
test('1. staff.js transitions wallet hold to completed debit on delivery', () => {
    assert(staffJs.includes("status: 'COMPLETED'"), "staff.js must set status to COMPLETED on delivery");
    assert(staffJs.includes("type: 'debit'"), "staff.js must transition hold to debit on delivery");
    assert(staffJs.includes("Used for Order #"), "staff.js must set title/desc to 'Used for Order #'");
    assert(staffJs.includes("walletHoldStatus = 'COMPLETED'"), "staff.js must update walletHoldStatus");
});

// 2. Static assertions on app.js
test('2. app.js contains authoritative tranche summation filter', () => {
    assert(appJs.includes("const activeBalance = tranches.reduce("), "app.js must compute activeBalance using tranches.reduce");
    assert(appJs.includes('st === "UNLOCKED"') || appJs.includes("st === 'UNLOCKED'"), "app.js filter must check UNLOCKED status");
    assert(appJs.includes('tp === "CASHBACK_EARNED"') || appJs.includes("tp === 'CASHBACK_EARNED'"), "app.js filter must check CASHBACK_EARNED type");
    assert(appJs.includes("!isExp && !isRed"), "app.js filter must verify not expired and not redeemed");
});

// Setup VM environment to test reconcileWalletTranches and renderProfileWalletTxList in action
const domMocks = {
    'profile-wallet-tx-list': { innerHTML: '' },
    'profile-wallet-val': { textContent: '' },
    'profile-wallet-expiry-tag': { style: { display: 'none' }, classList: { add() {}, remove() {} } },
    'profile-wallet-expiry-text': { textContent: '' },
    'profile-wallet-card': { classList: { add() {}, remove() {} } },
    'profile-wallet-status-pill': { classList: { add() {}, remove() {} }, setAttribute() {} },
    'profile-wallet-rules-text': { textContent: '', setAttribute() {} },
    'profile-wallet-expiring-alert': { style: { display: 'none' } },
    'profile-wallet-expiring-amount': { textContent: '' },
    'profile-wallet-expiring-countdown': { textContent: '' },
    'checkout-wallet-card': { style: { display: 'none' } },
    'checkout-total': { textContent: '' },
    'checkout-wallet-locked-notice': { style: { display: 'none' }, innerHTML: '' }
};

const context = {
    console,
    Date,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Set,
    JSON,
    isNaN,
    parseInt,
    parseFloat,
    document: {
        getElementById(id) {
            return domMocks[id] || { style: {}, classList: { add() {}, remove() {} }, innerHTML: '', textContent: '' };
        }
    },
    window: {},
    localStorage: {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = String(v); },
        removeItem(k) { delete this._data[k]; }
    },
    navigator: { vibrate() {} },
    customerFirestore: null,
    customerWalletConfig: { enabled: true, expiryDays: 15, cashbackExpiryDays: 15 },
    currentCustomerWallet: { balance: 0, transactions: [] },
    getFirstUnclaimedDeliveredOrder: () => null,
    updateCheckoutWalletUI: () => {},
    currentUserProfile: { phone: '9876543210' },
    escapeHtml: (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
};

vm.createContext(context);

// Load wallet helpers from app.js
vm.runInContext(`
${appJs.slice(appJs.indexOf('function parseTimestampMs'), appJs.indexOf('window.parseTimestampMs = parseTimestampMs;'))}
window.parseTimestampMs = parseTimestampMs;

${appJs.slice(appJs.indexOf('function formatStepDownExpiryCountdown'), appJs.indexOf('window.formatStepDownExpiryCountdown = formatStepDownExpiryCountdown;'))}
window.formatStepDownExpiryCountdown = formatStepDownExpiryCountdown;

${appJs.slice(appJs.indexOf('function getSlab1Threshold'), appJs.indexOf('window.getSlab1Threshold = getSlab1Threshold;'))}
window.getSlab1Threshold = getSlab1Threshold;

${appJs.slice(appJs.indexOf('function reconcileWalletTranches'), appJs.indexOf('window.reconcileWalletTranches = reconcileWalletTranches;'))}
window.reconcileWalletTranches = reconcileWalletTranches;

${appJs.slice(appJs.indexOf('function getActiveCreditTranches'), appJs.indexOf('window.getActiveCreditTranches = getActiveCreditTranches;'))}
window.getActiveCreditTranches = getActiveCreditTranches;

${appJs.slice(appJs.indexOf('function getEarliestExpiringWalletBatch'), appJs.indexOf('window.getEarliestExpiringWalletBatch = getEarliestExpiringWalletBatch;'))}
window.getEarliestExpiringWalletBatch = getEarliestExpiringWalletBatch;

${appJs.slice(appJs.indexOf('function getEffectiveWalletBalance'), appJs.indexOf('window.getEffectiveWalletBalance = getEffectiveWalletBalance;'))}
window.getEffectiveWalletBalance = getEffectiveWalletBalance;

${appJs.slice(appJs.indexOf('function updateProfileWalletUI'), appJs.indexOf('window.updateProfileWalletUI = updateProfileWalletUI;'))}
window.updateProfileWalletUI = updateProfileWalletUI;

${appJs.slice(appJs.indexOf('function renderProfileWalletTxList'), appJs.indexOf('window.renderProfileWalletTxList = renderProfileWalletTxList;'))}
window.renderProfileWalletTxList = renderProfileWalletTxList;

${appJs.slice(appJs.indexOf('function commitWalletHold'), appJs.indexOf('window.commitWalletHold = commitWalletHold;'))}
window.commitWalletHold = commitWalletHold;
`, context);

// Test 3: Problem 1 - Transition hold to completed debit and renderProfileWalletTxList check
test('3. Transitioned hold displays as -₹43 completed debit in red without Locked Hold badge', () => {
    const now = Date.now();
    context.currentCustomerWallet = {
        balance: 0,
        transactions: [
            {
                id: 'tx_hold_1',
                type: 'debit',
                amount: 43,
                orderId: '1',
                status: 'COMPLETED',
                title: 'Used for Order #1',
                description: 'Used for Order #1',
                createdAt: new Date(now - 10000).toISOString()
            }
        ]
    };

    context.renderProfileWalletTxList();
    const html = domMocks['profile-wallet-tx-list'].innerHTML;

    assert(html.includes('-₹43'), "Transaction list must display negative deduction -₹43");
    assert(html.includes('amount-debit'), "Amount must have amount-debit class (red)");
    assert(html.includes('tx-debit'), "Row must have tx-debit class");
    assert(html.includes('Used for Order #1'), "Title must display 'Used for Order #1'");
    assert(!html.includes('Locked Hold'), "Must NOT display 'Locked Hold' badge for completed debit");
    assert(!html.includes('+₹43'), "Must NOT display positive +₹43");
});

// Test 4: Problem 2 - Unlocked scratch cashback aggregates to main balance
test('4. Unlocked scratch cashback (+₹10, 23h expiry) aggregates to main balance of ₹10 and does not get eaten by prior ₹43 debit', () => {
    const now = Date.now();
    const in23Hours = new Date(now + 23 * 60 * 60 * 1000).toISOString();

    context.currentCustomerWallet = {
        balance: 0,
        transactions: [
            // Newly unlocked scratch reward
            {
                id: 'tx_scratch_1',
                type: 'CASHBACK_EARNED',
                amount: 10,
                status: 'UNLOCKED',
                title: 'Thanks Cashback',
                description: 'Thanks Cashback (+₹10)',
                expiresAt: in23Hours,
                createdAt: new Date(now).toISOString()
            },
            // Prior completed order debit
            {
                id: 'tx_hold_1',
                type: 'debit',
                amount: 43,
                orderId: '1',
                status: 'COMPLETED',
                title: 'Used for Order #1',
                description: 'Used for Order #1',
                createdAt: new Date(now - 60000).toISOString()
            }
        ]
    };

    const reconciledBal = context.reconcileWalletTranches(context.currentCustomerWallet);
    assert.strictEqual(reconciledBal, 10, "Reconciled balance must be exactly 10");
    assert.strictEqual(context.currentCustomerWallet.balance, 10, "Wallet balance must be 10");

    context.updateProfileWalletUI();
    assert.strictEqual(domMocks['profile-wallet-val'].textContent, 10, "Profile top balance must display 10");

    context.renderProfileWalletTxList();
    const html = domMocks['profile-wallet-tx-list'].innerHTML;
    assert(html.includes('+₹10'), "Transaction list must display +₹10 for scratch reward");
    assert(html.includes('-₹43'), "Transaction list must display -₹43 for completed debit");
    assert(html.includes('amount-credit'), "Scratch reward must have amount-credit class");
    assert(html.includes('amount-debit'), "Order debit must have amount-debit class");
    assert(!html.includes('Locked Hold'), "Must NOT have any Locked Hold badge");
});

// Test 5: commitWalletHold works when called with orderId #1 or 1
test('5. commitWalletHold transitions LOCKED_HOLD to COMPLETED debit and updates UI', () => {
    const now = Date.now();
    context.currentCustomerWallet = {
        balance: 0,
        transactions: [
            {
                id: 'tx_hold_1',
                type: 'hold',
                amount: 43,
                orderId: '1',
                status: 'LOCKED_HOLD',
                description: 'Wallet hold for Order #1',
                createdAt: new Date(now - 30000).toISOString()
            }
        ]
    };

    // Initially should be hold
    context.renderProfileWalletTxList();
    assert(domMocks['profile-wallet-tx-list'].innerHTML.includes('Locked Hold'), "Must initially be Locked Hold");

    // Call commitWalletHold with '#1'
    context.commitWalletHold('#1');

    const tx = context.currentCustomerWallet.transactions[0];
    assert.strictEqual(tx.status, 'COMPLETED', "Status must become COMPLETED");
    assert.strictEqual(tx.type, 'debit', "Type must become debit");
    assert.strictEqual(tx.title, 'Used for Order #1', "Title must be 'Used for Order #1'");

    const html = domMocks['profile-wallet-tx-list'].innerHTML;
    assert(!html.includes('Locked Hold'), "Must NOT show Locked Hold after commitWalletHold");
    assert(html.includes('-₹43'), "Must show -₹43 after commitWalletHold");
});

console.log(`\nALL ${passCount} TESTS PASSED SUCCESSFULLY!`);
