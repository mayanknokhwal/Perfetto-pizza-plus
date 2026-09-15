const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING WALLET EXPIRY LOCKS & STEP-DOWN COUNTDOWN TIMER ===\n');

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

// 1. Load app.js in a mocked environment
const appJs = fs.readFileSync('app.js', 'utf8');
const stylesCss = fs.readFileSync('styles.css', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

// Set up mock window and document environment
const mockLocalStorage = {};
global.localStorage = {
    getItem: (k) => mockLocalStorage[k] || null,
    setItem: (k, v) => { mockLocalStorage[k] = String(v); },
    removeItem: (k) => { delete mockLocalStorage[k]; }
};

global.window = {
    localStorage: global.localStorage,
    addEventListener: () => {}
};
global.document = {
    getElementById: (id) => null,
    addEventListener: () => {}
};

// Evaluate relevant helper functions from app.js
const vm = require('vm');
const context = {
    console,
    Date,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    Number,
    String,
    Array,
    JSON,
    localStorage: global.localStorage,
    window: global.window,
    document: global.document,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {}
};
vm.createContext(context);

// Extract required functions from app.js
vm.runInContext(`
${appJs.slice(appJs.indexOf('function getClampedCashbackExpiryDays'), appJs.indexOf('let customerWalletConfig ='))}

${appJs.slice(appJs.indexOf('function formatStepDownExpiryCountdown'), appJs.indexOf('let customerWalletConfig ='))}

this.customerWalletConfig = { enabled: true, expiryDays: 15, cashbackExpiryDays: 15 };

${appJs.slice(appJs.indexOf('function reconcileWalletTranches'), appJs.indexOf('window.reconcileWalletTranches = reconcileWalletTranches;'))}
window.reconcileWalletTranches = reconcileWalletTranches;

this.currentCustomerWallet = null;

${appJs.slice(appJs.indexOf('function getActiveCreditTranches'), appJs.indexOf('function getEffectiveWalletBalance'))}

${appJs.slice(appJs.indexOf('function getEarliestExpiringWalletBatch'), appJs.indexOf('function getEffectiveWalletBalance'))}
`, context);

const formatStepDown = context.formatStepDownExpiryCountdown;
const reconcileWallet = context.reconcileWalletTranches;
const getActiveCreditTranches = context.getActiveCreditTranches;
const getEarliestExpiring = context.getEarliestExpiringWalletBatch;

// -------------------------------------------------------------
// Test 1: Step-Down Countdown - Greater than 24 hours
// -------------------------------------------------------------
test('1. Step-down countdown formats > 24 hours as standard day threshold', () => {
    const twoDaysMs = 48 * 60 * 60 * 1000;
    const result2d = formatStepDown(twoDaysMs, false, false);
    assert.strictEqual(result2d, 'Expires in 2 days', `Expected "Expires in 2 days", got "${result2d}"`);

    const result2dCompact = formatStepDown(twoDaysMs, false, true);
    assert.strictEqual(result2dCompact, 'Expires in 2d', `Expected "Expires in 2d", got "${result2dCompact}"`);

    const oneDayPlusMs = 25 * 60 * 60 * 1000;
    const result1dPlus = formatStepDown(oneDayPlusMs, false, false);
    assert.strictEqual(result1dPlus, 'Expires in 2 days', `Expected "Expires in 2 days", got "${result1dPlus}"`);
});

// -------------------------------------------------------------
// Test 2: Step-Down Countdown - Between 24 hours and 1 hour
// -------------------------------------------------------------
test('2. Step-down countdown formats between 24h and 1h as hourly only (no minutes)', () => {
    // 18 hours test (required by prompt)
    const eighteenHoursMs = 18 * 60 * 60 * 1000 + 35 * 60 * 1000; // 18h 35m
    const result18h = formatStepDown(eighteenHoursMs, false, false);
    assert.strictEqual(result18h, 'Expires in 18h', `Expected "Expires in 18h", got "${result18h}"`);

    // 23 hours test
    const twentyThreeHoursMs = 23 * 60 * 60 * 1000 + 50 * 60 * 1000;
    const result23h = formatStepDown(twentyThreeHoursMs, false, false);
    assert.strictEqual(result23h, 'Expires in 23h', `Expected "Expires in 23h", got "${result23h}"`);

    // 1 hour test
    const oneHourMs = 1 * 60 * 60 * 1000 + 15 * 60 * 1000;
    const result1h = formatStepDown(oneHourMs, false, false);
    assert.strictEqual(result1h, 'Expires in 1h', `Expected "Expires in 1h", got "${result1h}"`);
});

// -------------------------------------------------------------
// Test 3: Step-Down Countdown - Less than 1 hour (final 60 minutes)
// -------------------------------------------------------------
test('3. Step-down countdown formats < 1 hour as minute-level resolution descending from 59m', () => {
    // 42 minutes test (required by prompt)
    const fortyTwoMinMs = 42 * 60 * 1000 + 30 * 1000;
    const result42m = formatStepDown(fortyTwoMinMs, false, false);
    assert.strictEqual(result42m, 'Expires in 42m', `Expected "Expires in 42m", got "${result42m}"`);

    // 59 minutes test
    const fiftyNineMinMs = 59 * 60 * 1000 + 10 * 1000;
    const result59m = formatStepDown(fiftyNineMinMs, false, false);
    assert.strictEqual(result59m, 'Expires in 59m', `Expected "Expires in 59m", got "${result59m}"`);

    // 1 minute test
    const oneMinMs = 45 * 1000; // 45 seconds -> minimum 1m
    const result1m = formatStepDown(oneMinMs, false, false);
    assert.strictEqual(result1m, 'Expires in 1m', `Expected "Expires in 1m", got "${result1m}"`);
});

// -------------------------------------------------------------
// Test 4: Step-Down Countdown - Expired
// -------------------------------------------------------------
test('4. Step-down countdown returns "Expired" when remainingMs <= 0', () => {
    assert.strictEqual(formatStepDown(0, false, false), 'Expired');
    assert.strictEqual(formatStepDown(-1000, false, false), 'Expired');
    assert.strictEqual(formatStepDown(0, true, false), 'समाप्त हो गया');
});

// -------------------------------------------------------------
// Test 5: Item-Level Expiry Immutability Audit
// -------------------------------------------------------------
test('5. Item-level expiry immutability: changing admin settings does not alter earlier records', () => {
    const fixedCreationTime = Date.now() - (2 * 24 * 60 * 60 * 1000); // Created 2 days ago
    const fixedExpiresAt = new Date(fixedCreationTime + (10 * 24 * 60 * 60 * 1000)).toISOString(); // 10 days validity

    const mockWallet = {
        balance: 100,
        transactions: [
            {
                id: 'tx_immutable_1',
                type: 'credit',
                amount: 100,
                initialAmount: 100,
                createdAt: new Date(fixedCreationTime).toISOString(),
                expiresAt: fixedExpiresAt,
                expiryDays: 10,
                status: 'active'
            }
        ]
    };

    // Initial reconciliation under 15-day config
    context.customerWalletConfig.expiryDays = 15;
    context.customerWalletConfig.cashbackExpiryDays = 15;
    reconcileWallet(mockWallet);

    assert.strictEqual(mockWallet.transactions[0].expiresAt, fixedExpiresAt, "Original expiresAt must match");

    // Admin updates setting to 30 days
    context.customerWalletConfig.expiryDays = 30;
    context.customerWalletConfig.cashbackExpiryDays = 30;
    reconcileWallet(mockWallet);

    // Existing transaction's expiresAt must remain completely unchanged!
    assert.strictEqual(mockWallet.transactions[0].expiresAt, fixedExpiresAt, "expiresAt must NOT change when admin setting changes to 30");

    // Admin updates setting to 3 days
    context.customerWalletConfig.expiryDays = 3;
    context.customerWalletConfig.cashbackExpiryDays = 3;
    reconcileWallet(mockWallet);

    assert.strictEqual(mockWallet.transactions[0].expiresAt, fixedExpiresAt, "expiresAt must NOT change when admin setting changes to 3");
});

// -------------------------------------------------------------
// Test 6: Earliest Expiring Batch Identification & Isolation
// -------------------------------------------------------------
test('6. Accurately identifies earliest expiring batch and isolates amount', () => {
    const now = Date.now();
    const mockWallet = {
        balance: 200,
        transactions: [
            {
                id: 'tx_batch_c',
                type: 'credit',
                amount: 100,
                initialAmount: 100,
                createdAt: new Date(now - 1000).toISOString(),
                expiresAt: new Date(now + 10 * 24 * 3600 * 1000).toISOString(), // 10 days
                status: 'active'
            },
            {
                id: 'tx_batch_a',
                type: 'credit',
                amount: 40,
                initialAmount: 40,
                createdAt: new Date(now - 2000).toISOString(),
                expiresAt: new Date(now + 18 * 3600 * 1000 + 30 * 60 * 1000).toISOString(), // 18h 30m (EARLIEST)
                status: 'active'
            },
            {
                id: 'tx_batch_b',
                type: 'credit',
                amount: 60,
                initialAmount: 60,
                createdAt: new Date(now - 3000).toISOString(),
                expiresAt: new Date(now + 3 * 24 * 3600 * 1000).toISOString(), // 3 days
                status: 'active'
            }
        ]
    };

    context.currentCustomerWallet = mockWallet;
    reconcileWallet(mockWallet);

    const earliest = getEarliestExpiring(mockWallet);
    assert.strictEqual(earliest.hasExpiring, true, "Should have an expiring batch");
    assert.strictEqual(earliest.expiringAmount, 40, `Expected expiring amount to be ₹40, got ₹${earliest.expiringAmount}`);
    assert.strictEqual(mockWallet.balance, 200, "Total balance must remain 200");

    // Check countdown formatting for this earliest batch
    const countdown = formatStepDown(earliest.remainingMs);
    assert.strictEqual(countdown, 'Expires in 18h', `Expected "Expires in 18h", got "${countdown}"`);
});

// -------------------------------------------------------------
// Test 7: Auto-debiting upon Expiry Progression
// -------------------------------------------------------------
test('7. Auto-debits expired portion, updates available balance, and advances to next earliest batch', () => {
    const now = Date.now();
    // Simulate that Batch A (₹40) has now expired (expiresAt in the past)
    const mockWallet = {
        balance: 200,
        transactions: [
            {
                id: 'tx_batch_a',
                type: 'credit',
                amount: 40,
                initialAmount: 40,
                createdAt: new Date(now - 20 * 3600 * 1000).toISOString(),
                expiresAt: new Date(now - 1000).toISOString(), // EXPIRED 1s ago
                status: 'active'
            },
            {
                id: 'tx_batch_b',
                type: 'credit',
                amount: 60,
                initialAmount: 60,
                createdAt: new Date(now - 3000).toISOString(),
                expiresAt: new Date(now + 3 * 24 * 3600 * 1000).toISOString(), // 3 days
                status: 'active'
            },
            {
                id: 'tx_batch_c',
                type: 'credit',
                amount: 100,
                initialAmount: 100,
                createdAt: new Date(now - 1000).toISOString(),
                expiresAt: new Date(now + 10 * 24 * 3600 * 1000).toISOString(), // 10 days
                status: 'active'
            }
        ]
    };

    context.currentCustomerWallet = mockWallet;
    const reconciledBal = reconcileWallet(mockWallet);

    // Batch A should be debited/expired: balance should drop from 200 to 160
    assert.strictEqual(reconciledBal, 160, `Expected reconciled balance to be 160, got ${reconciledBal}`);
    assert.strictEqual(mockWallet.transactions[0].status, 'expired', "Batch A status must be expired");
    assert.strictEqual(mockWallet.transactions[0].remainingAmount, 0, "Batch A remaining amount must be 0");

    // Next earliest expiring batch should now be Batch B (₹60, expires in 3 days)
    const nextEarliest = getEarliestExpiring(mockWallet);
    assert.strictEqual(nextEarliest.hasExpiring, true);
    assert.strictEqual(nextEarliest.expiringAmount, 60, `Expected next expiring amount to be 60, got ${nextEarliest.expiringAmount}`);
    const nextCountdown = formatStepDown(nextEarliest.remainingMs);
    assert.strictEqual(nextCountdown, 'Expires in 3 days');
});

// -------------------------------------------------------------
// Test 8: DOM Elements in index.html
// -------------------------------------------------------------
test('8. DOM structure in index.html contains profile-wallet-expiring-alert and child elements', () => {
    assert(indexHtml.includes('id="profile-wallet-expiring-alert"'), "profile-wallet-expiring-alert must exist in index.html");
    assert(indexHtml.includes('id="profile-wallet-expiring-amount"'), "profile-wallet-expiring-amount must exist in index.html");
    assert(indexHtml.includes('id="profile-wallet-expiring-countdown"'), "profile-wallet-expiring-countdown must exist in index.html");
    assert(indexHtml.includes('class="expiring-amount-red"'), "expiring-amount-red class must exist in index.html");
});

// -------------------------------------------------------------
// Test 9: CSS Red Highlight Styling in styles.css
// -------------------------------------------------------------
test('9. CSS rules in styles.css contain red-accent styling for expiring indicator and urgent badges', () => {
    assert(stylesCss.includes('.wallet-expiring-alert'), ".wallet-expiring-alert CSS rule must exist");
    assert(stylesCss.includes('.expiring-amount-red'), ".expiring-amount-red CSS rule must exist");
    assert(stylesCss.includes('color: #dc2626'), "Must use clear red accent tone #dc2626");
    assert(stylesCss.includes('.wallet-expiry-tag.is-urgent'), ".wallet-expiry-tag.is-urgent must exist");
    assert(stylesCss.includes('.tx-badge-validity.is-urgent'), ".tx-badge-validity.is-urgent must exist");
});

// -------------------------------------------------------------
// Test 10: Timer & Teardown Wiring in app.js
// -------------------------------------------------------------
test('10. app.js contains startWalletCountdownTimer and cleans it up in cleanupAllCustomerListeners', () => {
    assert(appJs.includes('function startWalletCountdownTimer()'), "startWalletCountdownTimer must be defined");
    assert(appJs.includes('walletCountdownInterval'), "walletCountdownInterval must exist");
    assert(appJs.includes('clearInterval(walletCountdownInterval)'), "clearInterval must be called in cleanupAllCustomerListeners");
    assert(appJs.includes('window.startWalletCountdownTimer = startWalletCountdownTimer'), "startWalletCountdownTimer must be exposed to window");
});

console.log(`\nALL ${passCount} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
