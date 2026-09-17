const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('=== VERIFYING WALLET TRANSACTION LEDGER & DATE FORMATTING ===\n');

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
test('1. app.js and public/app.js are synchronized', () => {
    assert.strictEqual(appJs, publicAppJs, "public/app.js must match app.js");
});

// Setup mock DOM and VM context
const containerMock = { innerHTML: '' };
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
    Map,
    Set,
    localStorage: mockLocalStorage,
    window: {},
    document: {
        getElementById: (id) => {
            if (id === 'profile-wallet-tx-list') return containerMock;
            return null;
        }
    },
    escapeHtml: (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    getAppLanguage: () => 'en',
    t: (k) => k,
    getSlab1Threshold: () => 199,
    customerWalletConfig: {},
    formatStepDownExpiryCountdown: () => '24h remaining',
    updateProfileWalletUI: () => {},
    updateCheckoutWalletUI: () => {},
    updateCartUI: () => {}
};
context.window = context;
vm.createContext(context);

// Load wallet functions into VM
vm.runInContext(`
${appJs.slice(appJs.indexOf('function parseTimestampMs'), appJs.indexOf('window.parseTimestampMs = parseTimestampMs;'))}
window.parseTimestampMs = parseTimestampMs;

this.currentCustomerWallet = { balance: 0, nonExpiredBalance: 0, transactions: [] };

${appJs.slice(appJs.indexOf('function reconcileWalletTranches'), appJs.indexOf('window.reconcileWalletTranches = reconcileWalletTranches;'))}
window.reconcileWalletTranches = reconcileWalletTranches;

${appJs.slice(appJs.indexOf('function calculateValidWalletBalance'), appJs.indexOf('function getCustomerFirestore()'))}

${appJs.slice(appJs.indexOf('let customerUserRealtimeUnsubscribe'), appJs.indexOf('window.listenToCustomerWalletRealtime = listenToCustomerWalletRealtime;'))}
window.listenToCustomerWalletRealtime = listenToCustomerWalletRealtime;

${appJs.slice(appJs.indexOf('function renderProfileWalletTxList()'), appJs.indexOf('window.renderProfileWalletTxList = renderProfileWalletTxList;'))}
window.renderProfileWalletTxList = renderProfileWalletTxList;
`, context);

// Test 2: Order #1 (₹15) and Order #2 (₹28) render with positive sign and green credit badge
test('2. Order #1 (₹15) and Order #2 (₹28) render with positive sign "+ ₹" and green credit badge', () => {
    context.currentCustomerWallet = {
        balance: 43,
        nonExpiredBalance: 43,
        transactions: [
            {
                id: 'tx_order_2',
                orderId: '2',
                type: 'CASHBACK_EARNED',
                amount: 28,
                initialAmount: 28,
                remainingAmount: 28,
                description: 'credited +₹28 for Order #2',
                createdAt: new Date('2026-09-17T14:27:00').toISOString()
            },
            {
                id: 'tx_order_1',
                orderId: '1',
                type: 'CASHBACK_EARNED',
                amount: 15,
                initialAmount: 15,
                remainingAmount: 15,
                description: 'credited +₹15 for Order #1',
                createdAt: new Date('2026-09-17T14:15:00').toISOString()
            }
        ]
    };

    context.renderProfileWalletTxList();
    const rendered = containerMock.innerHTML;

    assert(rendered.includes('+₹28'), 'Must render +₹28');
    assert(rendered.includes('+₹15'), 'Must render +₹15');
    assert(!rendered.includes('-₹28'), 'Must NOT render -₹28');
    assert(!rendered.includes('-₹15'), 'Must NOT render -₹15');
    assert(rendered.includes('tx-credit'), 'Must have tx-credit class');
    assert(rendered.includes('amount-credit'), 'Must have amount-credit class');
    assert(!rendered.includes('tx-debit'), 'Must not have tx-debit class for cashback');
});

// Test 3: Robust classification of all credit types (CREDIT, CASHBACK_EARNED, wonCashback, reward)
test('3. Uppercase CREDIT, CASHBACK_EARNED, and reward unlock render as credits', () => {
    context.currentCustomerWallet = {
        balance: 50,
        transactions: [
            { id: 't1', type: 'CREDIT', amount: 20, createdAt: new Date().toISOString() },
            { id: 't2', type: 'CASHBACK_EARNED', amount: 30, createdAt: new Date().toISOString() }
        ]
    };

    context.renderProfileWalletTxList();
    const rendered = containerMock.innerHTML;

    assert(rendered.includes('+₹20'), 'CREDIT must render +₹20');
    assert(rendered.includes('+₹30'), 'CASHBACK_EARNED must render +₹30');
    assert(!rendered.includes('-₹20'), 'CREDIT must NOT render -₹20');
    assert(!rendered.includes('-₹30'), 'CASHBACK_EARNED must NOT render -₹30');
});

// Test 4: Debit and checkout redemptions render with negative sign and red styling
test('4. DEBIT and ORDER_PAYMENT render with negative sign "- ₹" and red styling', () => {
    context.currentCustomerWallet = {
        balance: 10,
        transactions: [
            { id: 'd1', type: 'DEBIT', amount: 25, orderId: '3', createdAt: new Date().toISOString() },
            { id: 'd2', type: 'ORDER_PAYMENT', amount: 15, orderId: '4', createdAt: new Date().toISOString() }
        ]
    };

    context.renderProfileWalletTxList();
    const rendered = containerMock.innerHTML;

    assert(rendered.includes('-₹25'), 'DEBIT must render -₹25');
    assert(rendered.includes('-₹15'), 'ORDER_PAYMENT must render -₹15');
    assert(rendered.includes('tx-debit'), 'Must have tx-debit class');
    assert(rendered.includes('amount-debit'), 'Must have amount-debit class');
});

// Test 5: Robust date parsing eliminates "Invalid Date" across all formats
test('5. Timestamp formats (Firestore Timestamp, {seconds,nanoseconds}, ISO string, epoch) never produce "Invalid Date"', () => {
    const firestoreTimestampMock = {
        toDate: () => new Date('2026-09-17T14:28:00')
    };

    context.currentCustomerWallet = {
        balance: 100,
        transactions: [
            { id: 'ts1', type: 'CREDIT', amount: 10, createdAt: firestoreTimestampMock },
            { id: 'ts2', type: 'CREDIT', amount: 20, createdAt: { seconds: 1726564080, nanoseconds: 0 } },
            { id: 'ts3', type: 'CREDIT', amount: 30, createdAt: '2026-09-17T14:28:00.000Z' },
            { id: 'ts4', type: 'CREDIT', amount: 40, createdAt: 1726564080000 },
            { id: 'ts5', type: 'CREDIT', amount: 50, createdAt: null } // completely missing date
        ]
    };

    context.renderProfileWalletTxList();
    const rendered = containerMock.innerHTML;

    assert(!rendered.includes('Invalid Date'), 'Output must NEVER contain "Invalid Date"');
    assert(rendered.includes('17 Sept'), 'Must contain formatted date "17 Sept"');
});

// Test 6: Stopping secondary async overwrite
test('6. Secondary async snapshot does not overwrite or downgrade parsed credit transactions', () => {
    // Initial state with Order #1 and Order #2 credits
    context.currentCustomerWallet = {
        balance: 43,
        nonExpiredBalance: 43,
        transactions: [
            { id: 'tx_order_2', orderId: '2', type: 'CASHBACK_EARNED', amount: 28, description: 'credited +₹28 for Order #2' },
            { id: 'tx_order_1', orderId: '1', type: 'CASHBACK_EARNED', amount: 15, description: 'credited +₹15 for Order #1' }
        ]
    };

    // Secondary user document snapshot arrives with partial/raw array
    context.applyLiveWalletData({
        walletBalance: 43,
        walletTransactions: [
            { id: 'tx_order_2', orderId: '2', amount: 28 }, // missing type or raw
            { id: 'tx_order_1', orderId: '1', amount: 15 }
        ]
    }, 'users');

    context.renderProfileWalletTxList();
    const rendered = containerMock.innerHTML;

    assert(rendered.includes('+₹28'), 'Must still render +₹28 after secondary async snapshot');
    assert(rendered.includes('+₹15'), 'Must still render +₹15 after secondary async snapshot');
    assert(!rendered.includes('-₹28'), 'Must NOT degrade to -₹28');
    assert(!rendered.includes('-₹15'), 'Must NOT degrade to -₹15');
});

console.log(`\nALL ${passCount} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
