/**
 * Perfetto Pizza - Comprehensive Phase 2 Verification Suite
 * Tests:
 * 1. 100-Minute Auto-Expiry Threshold across client & backend
 * 2. 24-Hour Fair Grace Wallet Expiry Recovery
 * 3. Active Escrow Hold Expiration Freeze & Protection
 * 4. Hold & Refund Idempotency (Strict 1-to-1 order bounds)
 * 5. Countdown Pill Rendering (Staff & Customer UI)
 * 6. Root & Public file synchronization byte parity
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 VERIFYING PHASE 2: 100M AUTO-EXPIRY, 24H GRACE & IDEMPOTENCY');
console.log('================================================================\n');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
    testsTotal++;
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// -----------------------------------------------------------------------------
// Test 1: 100-Minute Threshold Evaluation
// -----------------------------------------------------------------------------
runTest('1. 100-Minute Inactivity Threshold in staff.js, admin.html, app.js, and ordersController.js', () => {
    const staffJs = fs.readFileSync(path.join(__dirname, '..', 'staff.js'), 'utf8');
    const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const ordersCtrl = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'ordersController.js'), 'utf8');

    // Threshold constant check
    assert(staffJs.includes('ONE_HUNDRED_MINS_EXPIRATION_MS = 100 * 60 * 1000'), 'staff.js must define 100m expiration ms');
    assert(adminHtml.includes('ONE_HUNDRED_MINS_EXPIRATION_MS = 100 * 60 * 1000'), 'admin.html must define 100m expiration ms');
    assert(appJs.includes('ONE_HUNDRED_MINS_EXPIRATION_MS = 100 * 60 * 1000'), 'app.js must define 100m expiration ms');
    assert(ordersCtrl.includes('ONE_HUNDRED_MINS_EXPIRATION_MS = 100 * 60 * 1000'), 'ordersController.js must define 100m expiration ms');

    // Auto-rejection reason check
    assert(staffJs.includes('100-minute fulfillment timeout'), 'staff.js must use 100-minute rejection reason');
    assert(adminHtml.includes('100-minute fulfillment timeout'), 'admin.html must use 100-minute rejection reason');
    assert(appJs.includes('100-minute fulfillment timeout'), 'app.js must use 100-minute rejection reason');
    assert(ordersCtrl.includes('100-minute fulfillment timeout'), 'ordersController.js must use 100-minute rejection reason');
});

// -----------------------------------------------------------------------------
// Test 2: Order Expiry Calculation Logic (at 99m vs 100m)
// -----------------------------------------------------------------------------
runTest('2. Inactivity evaluation triggers at >= 100 mins and ignores terminal orders', () => {
    const { isOrder100MinsExpired } = require('../controllers/ordersController');
    const now = Date.now();

    // 99 minutes ago -> not expired
    const order99m = { id: 'test_99', status: 'pending', createdAt: new Date(now - 99 * 60 * 1000).toISOString() };
    assert.strictEqual(isOrder100MinsExpired(order99m), false, 'Order placed 99 mins ago should NOT be expired');

    // 100.5 minutes ago -> expired
    const order101m = { id: 'test_101', status: 'pending', createdAt: new Date(now - (100.5 * 60 * 1000)).toISOString() };
    assert.strictEqual(isOrder100MinsExpired(order101m), true, 'Order placed 100.5 mins ago MUST be expired');

    // Delivered order at 150 mins ago -> not expired (terminal)
    const orderDelivered = { id: 'test_del', status: 'delivered', createdAt: new Date(now - 150 * 60 * 1000).toISOString() };
    assert.strictEqual(isOrder100MinsExpired(orderDelivered), false, 'Delivered order must not be marked expired');

    // Auto-expired order -> not re-expired
    const orderAlreadyExp = { id: 'test_exp', status: 'rejected', autoExpired: true, createdAt: new Date(now - 150 * 60 * 1000).toISOString() };
    assert.strictEqual(isOrder100MinsExpired(orderAlreadyExp), false, 'Already auto-expired order must not re-trigger');
});

// -----------------------------------------------------------------------------
// Test 3: 24-Hour Fair Grace Expiry Recovery
// -----------------------------------------------------------------------------
runTest('3. Dynamic 24-Hour Fair Grace Recovery preserves or extends expiration correctly', () => {
    const ordersCtrl = require('../controllers/ordersController');
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    // A: Tranche with NO prior expiry -> gets now + 24h
    const expNull = ordersCtrl.calculateRecoveredExpiry(null, now);
    const expNullMs = new Date(expNull).getTime();
    assert(Math.abs(expNullMs - (now + TWENTY_FOUR_HOURS_MS)) < 1000, 'Null expiry should receive 24 hours grace');

    // B: Tranche that EXPIRED 2 hours ago -> receives now + 24h
    const pastExp = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const expRecovered = ordersCtrl.calculateRecoveredExpiry(pastExp, now);
    const expRecoveredMs = new Date(expRecovered).getTime();
    assert(Math.abs(expRecoveredMs - (now + TWENTY_FOUR_HOURS_MS)) < 1000, 'Past expired tranche should receive 24 hours grace');

    // C: Tranche with only 2 hours remaining (< 24h) -> extends to now + 24h
    const shortExp = new Date(now + 2 * 60 * 60 * 1000).toISOString();
    const expExtended = ordersCtrl.calculateRecoveredExpiry(shortExp, now);
    const expExtendedMs = new Date(expExtended).getTime();
    assert(Math.abs(expExtendedMs - (now + TWENTY_FOUR_HOURS_MS)) < 1000, 'Tranche with <24h remaining should be extended to full 24 hours');

    // D: Tranche with 5 days remaining (> 24h) -> retains original 5 days expiry!
    const fiveDaysFuture = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
    const expKept = ordersCtrl.calculateRecoveredExpiry(fiveDaysFuture, now);
    assert.strictEqual(expKept, fiveDaysFuture, 'Tranche with >24h remaining must retain original immutable expiry');
});

// -----------------------------------------------------------------------------
// Test 4: Live Countdown Pill HTML Generation
// -----------------------------------------------------------------------------
runTest('4. Countdown Pill renders correct urgency classes and formatting', () => {
    const adminJs = require('../admin.js');
    const now = Date.now();

    // 10 minutes elapsed (90 mins remaining) -> pill-active
    const orderFresh = { status: 'pending', createdAt: new Date(now - 10 * 60 * 1000).toISOString() };
    const htmlFresh = adminJs.getOrderCountdownPillHTML(orderFresh, now);
    assert(htmlFresh.includes('pill-active'), 'Pill for fresh order should have class pill-active');
    assert(htmlFresh.includes('1h 30m') || htmlFresh.includes('90m'), 'Pill should display ~1h 30m');

    // 85 minutes elapsed (15 mins remaining) -> pill-urgent
    const orderUrgent = { status: 'pending', createdAt: new Date(now - 85 * 60 * 1000).toISOString() };
    const htmlUrgent = adminJs.getOrderCountdownPillHTML(orderUrgent, now);
    assert(htmlUrgent.includes('pill-urgent'), 'Pill with <20m left should have class pill-urgent');
    assert(htmlUrgent.includes('15m'), 'Pill should display 15m');

    // 105 minutes elapsed -> pill-expired
    const orderExpired = { status: 'pending', createdAt: new Date(now - 105 * 60 * 1000).toISOString() };
    const htmlExpired = adminJs.getOrderCountdownPillHTML(orderExpired, now);
    assert(htmlExpired.includes('pill-expired'), 'Pill after 100m should have class pill-expired');
    assert(htmlExpired.includes('Expired'), 'Pill text should be Expired');

    // Terminal order -> empty string
    const orderDelivered = { status: 'completed', createdAt: new Date(now - 10 * 60 * 1000).toISOString() };
    const htmlDelivered = adminJs.getOrderCountdownPillHTML(orderDelivered, now);
    assert.strictEqual(htmlDelivered, '', 'Completed orders should not render countdown pills');
});

// -----------------------------------------------------------------------------
// Test 5: End-to-End Hold Expiry Recovery & Idempotency Lifecycle
// -----------------------------------------------------------------------------
runTest('5. Expired Hold receives 24h grace credit without duplicate multiplication', () => {
    const appJsContent = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

    // Extract reconcileWalletTranches
    const vm = require('vm');
    const sandbox = {
        console,
        Date,
        Math,
        Array,
        String,
        Number,
        Boolean,
        Set,
        Infinity,
        isNaN,
        parseInt,
        parseFloat,
        currentCustomerWallet: null,
        window: {}
    };
    vm.createContext(sandbox);

    // Extract helper functions
    vm.runInContext(`
        const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
        ${appJsContent.substring(appJsContent.indexOf('function parseTimestampMs'), appJsContent.indexOf('window.parseTimestampMs = parseTimestampMs;'))}
        window.parseTimestampMs = parseTimestampMs;

        ${appJsContent.substring(appJsContent.indexOf('function calculateRecoveredExpiry'), appJsContent.indexOf('window.calculateRecoveredExpiry = calculateRecoveredExpiry;'))}
        window.calculateRecoveredExpiry = calculateRecoveredExpiry;

        ${appJsContent.substring(appJsContent.indexOf('function reconcileWalletTranches'), appJsContent.indexOf('window.reconcileWalletTranches = reconcileWalletTranches;'))}
        window.reconcileWalletTranches = reconcileWalletTranches;

        ${appJsContent.substring(appJsContent.indexOf('function releaseWalletHold'), appJsContent.indexOf('window.releaseWalletHold = releaseWalletHold;'))}
        window.releaseWalletHold = releaseWalletHold;
        
        function updateProfileWalletUI() {}
        function renderProfileWalletTxList() {}
        function updateCheckoutWalletUI() {}
    `, sandbox);

    const { reconcileWalletTranches, releaseWalletHold, calculateRecoveredExpiry } = sandbox.window;
    const now = Date.now();

    // Setup wallet with ₹100 cashback credit that expired while order was in escrow
    const expiredAt = new Date(now - 30 * 60 * 1000).toISOString(); // expired 30m ago
    const wallet = {
        balance: 100,
        expiresAt: expiredAt,
        transactions: [
            {
                id: 'tx_cashback_1',
                type: 'credit',
                amount: 100,
                remainingAmount: 100,
                expiresAt: expiredAt,
                createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'tx_hold_order_999',
                type: 'hold',
                amount: 100,
                orderId: 'order_999',
                status: 'LOCKED_HOLD',
                expiresAt: expiredAt,
                createdAt: new Date(now - 90 * 60 * 1000).toISOString()
            }
        ]
    };

    sandbox.currentCustomerWallet = wallet;

    // 1. Balance while hold is locked is 0
    let bal = reconcileWalletTranches(wallet, now);
    assert.strictEqual(bal, 0, 'Balance must be 0 while ₹100 is locked in hold');

    // 2. Order is auto-expired & releaseWalletHold is called with expired timestamp
    releaseWalletHold('order_999', 100, expiredAt);

    // Wallet top-level expiry must have received 24-hour grace
    const newWalletExpMs = new Date(wallet.expiresAt).getTime();
    assert(newWalletExpMs > now + 23 * 60 * 60 * 1000, 'Wallet top-level expiry must be extended by 24h grace');
    assert.strictEqual(wallet.expired, false, 'Wallet must not be marked expired');

    // Reconciled balance must be exact 100 (from the grace refund credit, not 200)
    bal = reconcileWalletTranches(wallet, now);
    assert.strictEqual(bal, 100, `Reconciled balance after expired hold release must be exactly 100 (got ${bal})`);

    // 3. Duplicate releaseWalletHold invocation must be strictly idempotent
    releaseWalletHold('order_999', 100, expiredAt);
    bal = reconcileWalletTranches(wallet, now);
    assert.strictEqual(bal, 100, `Reconciled balance after duplicate release call must remain strictly 100 (got ${bal})`);
});

// -----------------------------------------------------------------------------
// Test 6: Root and Public Distribution Parity
// -----------------------------------------------------------------------------
runTest('6. File byte parity between root and public/ distribution files', () => {
    const files = [
        'app.js',
        'staff.js',
        'admin.js',
        'admin.html',
        'staff.html',
        'styles.css',
        'staff.css'
    ];

    for (const f of files) {
        const rootPath = path.join(__dirname, '..', f);
        const publicPath = path.join(__dirname, '..', 'public', f);
        assert(fs.existsSync(rootPath), `Root file ${f} must exist`);
        assert(fs.existsSync(publicPath), `Public file ${f} must exist`);

        const rootBuf = fs.readFileSync(rootPath);
        const publicBuf = fs.readFileSync(publicPath);
        assert(rootBuf.equals(publicBuf), `File ${f} in root and public/ must be byte-identical!`);
    }
});

console.log('================================================================');
console.log(`🎉 ALL ${testsPassed}/${testsTotal} PHASE 2 VERIFICATION TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================\n');
process.exit(0);
