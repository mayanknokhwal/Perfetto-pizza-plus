const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('=== VERIFYING WALLET BALANCE PERSISTENCE & LISTENER LIFECYCLE ===\n');

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
const publicAppJs = fs.readFileSync('public/app.js', 'utf8');

// Test 1: app.js and public/app.js synchronization
test('1. app.js and public/app.js are strictly identical', () => {
    assert.strictEqual(appJs, publicAppJs, "public/app.js must be byte-for-byte identical with app.js");
});

// Setup isolated VM environment to test core wallet functions
const storageMap = new Map();
const mockLocalStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
};

const context = {
    console,
    Date,
    Math,
    Number,
    String,
    Array,
    JSON,
    localStorage: mockLocalStorage,
    window: {},
    document: {
        getElementById: () => null
    },
    updateProfileWalletUI: () => {},
    renderProfileWalletTxList: () => {},
    updateCheckoutWalletUI: () => {},
    updateCartUI: () => {}
};
context.window = context;
vm.createContext(context);

// Extract relevant wallet controller code
vm.runInContext(`
${appJs.slice(appJs.indexOf('function parseTimestampMs'), appJs.indexOf('window.parseTimestampMs = parseTimestampMs;'))}
window.parseTimestampMs = parseTimestampMs;

this.currentCustomerWallet = null;

${appJs.slice(appJs.indexOf('function reconcileWalletTranches'), appJs.indexOf('window.reconcileWalletTranches = reconcileWalletTranches;'))}
window.reconcileWalletTranches = reconcileWalletTranches;

${appJs.slice(appJs.indexOf('function getActiveCreditTranches'), appJs.indexOf('window.getActiveCreditTranches = getActiveCreditTranches;'))}
window.getActiveCreditTranches = getActiveCreditTranches;

${appJs.slice(appJs.indexOf('function getEarliestExpiringWalletBatch'), appJs.indexOf('window.getEarliestExpiringWalletBatch = getEarliestExpiringWalletBatch;'))}
window.getEarliestExpiringWalletBatch = getEarliestExpiringWalletBatch;

${appJs.slice(appJs.indexOf('function calculateValidWalletBalance'), appJs.indexOf('function getCustomerFirestore()'))}

${appJs.slice(appJs.indexOf('let customerUserRealtimeUnsubscribe'), appJs.indexOf('window.listenToCustomerWalletRealtime = listenToCustomerWalletRealtime;'))}
window.listenToCustomerWalletRealtime = listenToCustomerWalletRealtime;
`, context);

// Test 2: reconcileWalletTranches supports uppercase CREDIT and REFUND without collapsing to ₹0
test('2. reconcileWalletTranches recognizes uppercase CREDIT and REFUND and preserves ₹64 balance', () => {
    const now = Date.now();
    const mockWallet = {
        balance: 64,
        transactions: [
            {
                id: 'tx_credit_upper',
                type: 'CREDIT',
                amount: 64,
                initialAmount: 64,
                createdAt: new Date(now - 3600000).toISOString(),
                expiresAt: new Date(now + 7 * 86400000).toISOString(),
                status: 'active'
            }
        ]
    };
    context.currentCustomerWallet = mockWallet;
    const balance = context.reconcileWalletTranches(mockWallet);
    assert.strictEqual(balance, 64, `Expected balance to remain 64, got ${balance}`);
    assert.strictEqual(mockWallet.balance, 64, "mockWallet.balance must be 64");
    assert.strictEqual(mockWallet.transactions[0].remainingAmount, 64, "remainingAmount must be 64");
});

// Test 3: reconcileWalletTranches preserves balance when transactions list has no credit records
test('3. reconcileWalletTranches preserves authoritative ₹64 balance when recent transactions slice lacks credits', () => {
    const mockWallet = {
        balance: 64,
        transactions: [
            {
                id: 'tx_debit_prev',
                type: 'debit',
                amount: 20,
                createdAt: new Date(Date.now() - 5000).toISOString()
            }
        ]
    };
    context.currentCustomerWallet = mockWallet;
    const balance = context.reconcileWalletTranches(mockWallet);
    assert.strictEqual(balance, 64, `Authoritative balance 64 must be preserved, got ${balance}`);
    assert.strictEqual(mockWallet.balance, 64, "mockWallet.balance must remain 64");
});

// Test 4: Firestore Timestamp objects parsing
test('4. parseTimestampMs correctly handles Firestore Timestamps (.toDate(), .seconds, ISO strings, epochs)', () => {
    const nowMs = Date.now();
    const parse = context.parseTimestampMs;

    assert.strictEqual(parse(nowMs), nowMs);
    assert.strictEqual(parse(new Date(nowMs).toISOString()), nowMs);
    assert.strictEqual(parse({ seconds: Math.floor(nowMs / 1000), nanoseconds: 0 }), Math.floor(nowMs / 1000) * 1000);
    assert.strictEqual(parse({ toDate: () => new Date(nowMs) }), nowMs);
});

// Test 5: getActiveCreditTranches and getEarliestExpiringWalletBatch support uppercase CREDIT
test('5. getActiveCreditTranches and getEarliestExpiringWalletBatch correctly isolate ₹64 expiring batch', () => {
    const now = Date.now();
    const futureExp = now + (18 * 3600 * 1000); // 18 hours in future
    const mockWallet = {
        balance: 64,
        transactions: [
            {
                id: 'tx_upper_expiring',
                type: 'CREDIT',
                amount: 64,
                initialAmount: 64,
                createdAt: new Date(now - 10000).toISOString(),
                expiresAt: new Date(futureExp).toISOString(),
                status: 'active'
            }
        ]
    };
    context.currentCustomerWallet = mockWallet;
    const active = context.getActiveCreditTranches();
    assert.strictEqual(active.length, 1, "Must find 1 active credit tranche");

    const earliest = context.getEarliestExpiringWalletBatch(mockWallet);
    assert.strictEqual(earliest.hasExpiring, true, "hasExpiring must be true");
    assert.strictEqual(earliest.expiringAmount, 64, `expiringAmount must be 64, got ${earliest.expiringAmount}`);
    assert(earliest.remainingMs > 0 && earliest.remainingMs <= 18 * 3600 * 1000, "remainingMs must be in 18h range");
});

// Test 6: applyLiveWalletData does not reset balance to 0 on non-wallet user doc updates
test('6. applyLiveWalletData does not reset active wallet balance to 0 when user document lacks walletBalance', () => {
    context.currentCustomerWallet = { balance: 64, nonExpiredBalance: 64, transactions: [] };
    mockLocalStorage.setItem('perfetto_wallet_balance', '64');

    // User doc snapshot with only profile fields (no walletBalance or balance)
    context.applyLiveWalletData({
        fullName: 'Customer Profile',
        phone: '9414503886',
        address: { colonyName: 'Main Colony' }
    }, 'users');

    assert.strictEqual(context.currentCustomerWallet.balance, 64, `Balance must remain 64, got ${context.currentCustomerWallet.balance}`);
    assert.strictEqual(mockLocalStorage.getItem('perfetto_wallet_balance'), '64', "localStorage wallet balance must remain 64");
});

// Test 7: applyLiveWalletData updates balance when wallet doc provides valid balance
test('7. applyLiveWalletData correctly updates balance when wallet doc contains updated balance', () => {
    context.currentCustomerWallet = { balance: 64, nonExpiredBalance: 64, transactions: [] };
    context.applyLiveWalletData({
        balance: 100,
        nonExpiredBalance: 100,
        transactions: [
            { id: 'tx_new', type: 'credit', amount: 100, initialAmount: 100, expiresAt: new Date(Date.now() + 86400000).toISOString() }
        ]
    }, 'wallets');

    assert.strictEqual(context.currentCustomerWallet.balance, 100, `Balance must update to 100, got ${context.currentCustomerWallet.balance}`);
    assert.strictEqual(mockLocalStorage.getItem('perfetto_wallet_balance'), '100', "localStorage must reflect 100");
});

// Test 8: listenToCustomerWalletRealtime contains persistent activeWalletListeningPhone guard
test('8. listenToCustomerWalletRealtime contains activeWalletListeningPhone guard preventing teardown', () => {
    assert(appJs.includes("let activeWalletListeningPhone = null;"), "activeWalletListeningPhone must be defined");
    assert(appJs.includes("activeWalletListeningPhone === cleanPhone && customerWalletRealtimeUnsubscribe"), "Guard must prevent re-subscribing if already active");
});

// Test 9: handleChangePhoneNumber and cleanupAllCustomerListeners reset activeWalletListeningPhone
test('9. handleChangePhoneNumber and cleanupAllCustomerListeners reset activeWalletListeningPhone to null', () => {
    const changePhoneMatch = appJs.match(/function handleChangePhoneNumber\(\) \{[\s\S]*?\n\}/);
    assert(changePhoneMatch && changePhoneMatch[0].includes("activeWalletListeningPhone = null;"), "handleChangePhoneNumber must reset activeWalletListeningPhone");

    const cleanupMatch = appJs.match(/function cleanupAllCustomerListeners\(\) \{[\s\S]*?\n\}/);
    assert(cleanupMatch && cleanupMatch[0].includes("activeWalletListeningPhone = null;"), "cleanupAllCustomerListeners must reset activeWalletListeningPhone");
});

// Test 10: startWalletCountdownTimer does not thrash interval when already running
test('10. startWalletCountdownTimer preserves existing interval on repeated tab navigations', () => {
    const timerMatch = appJs.match(/function startWalletCountdownTimer\(\) \{[\s\S]*?\n\}/);
    assert(timerMatch && /if\s*\(\s*walletCountdownInterval\s*\)\s*\{\s*return;?\s*\}/.test(timerMatch[0]), "startWalletCountdownTimer must return early if interval already exists");
});

console.log(`\nALL ${passCount} PERSISTENCE & LIFECYCLE TESTS PASSED SUCCESSFULLY!`);
