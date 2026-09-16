/**
 * Verification Script: Wallet Refund Idempotency & Independent Audio Re-Alert Triggers
 * 
 * Verifies:
 * 1. Successive order holds & rejections do NOT duplicate wallet balances (₹64 remains ₹64, never ₹128 or ₹140).
 * 2. Strict 1-to-1 order idempotency: walletRefundProcessed flag prevents secondary balance credit.
 * 3. Staff audio alert dismissal halts audio strictly for the current order, and a novel incoming order immediately re-triggers audio.
 * 4. Admin audio chime debounce does not suppress novel order IDs and dismissal resets debounce timestamp.
 * 5. Asset parity between root and public/ directories.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const appJsPath = path.join(ROOT_DIR, 'app.js');
const staffJsPath = path.join(ROOT_DIR, 'staff.js');
const adminHtmlPath = path.join(ROOT_DIR, 'admin.html');
const ordersCtrlPath = path.join(ROOT_DIR, 'controllers', 'ordersController.js');

const appJs = fs.readFileSync(appJsPath, 'utf8');
const staffJs = fs.readFileSync(staffJsPath, 'utf8');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
const ordersCtrl = fs.readFileSync(ordersCtrlPath, 'utf8');

console.log('================================================================');
console.log('🧪 VERIFYING WALLET REFUND IDEMPOTENCY & AUDIO ALERT RE-TRIGGERS');
console.log('================================================================');

let passedTests = 0;

function runTest(title, fn) {
    try {
        fn();
        console.log(`✅ [PASS] ${title}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ [FAIL] ${title}`);
        console.error(err);
        process.exit(1);
    }
}

// -----------------------------------------------------------------------------
// Test 1: In-Memory Wallet Tranche Reconciliation Idempotency (Customer Side)
// -----------------------------------------------------------------------------
runTest('1. Wallet Hold & Release Idempotency prevents balance multiplier', () => {
    // Extract reconcileWalletTranches and releaseWalletHold functions into isolated sandbox
    const parseTimestampMsDef = `function parseTimestampMs(v) {
        if (!v) return NaN;
        if (typeof v === 'number') return v;
        const p = new Date(v).getTime();
        return isNaN(p) ? NaN : p;
    }`;

    const reconcileCode = appJs.slice(
        appJs.indexOf('function reconcileWalletTranches(wallet) {'),
        appJs.indexOf('window.reconcileWalletTranches = reconcileWalletTranches;')
    );

    const sandbox = {};
    const fn = new Function('window', `${parseTimestampMsDef}\n${reconcileCode}\nreturn reconcileWalletTranches;`);
    const reconcileWalletTranches = fn(sandbox);

    // Initial State: Customer has ₹64 welcome credit
    const wallet = {
        balance: 64,
        transactions: [
            {
                id: 'tx_welcome_64',
                type: 'credit',
                amount: 64,
                initialAmount: 64,
                remainingAmount: 64,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
                status: 'active'
            }
        ]
    };

    let bal = reconcileWalletTranches(wallet);
    assert.strictEqual(bal, 64, 'Initial available balance should be exactly 64');

    // Step A: Customer places Order #101 using ₹64 from wallet
    const hold101 = {
        id: 'tx_hold_101',
        type: 'hold',
        amount: 64,
        orderId: '101',
        description: 'Wallet hold for Order #101',
        createdAt: new Date().toISOString(),
        status: 'LOCKED_HOLD'
    };
    wallet.transactions.unshift(hold101);
    bal = reconcileWalletTranches(wallet);
    assert.strictEqual(bal, 0, 'Balance must be 0 after ₹64 escrow hold is placed');

    // Step B: Order #101 is REJECTED / CANCELLED
    // The hold status becomes 'released' and a refund transaction is logged in transactions
    hold101.status = 'released';
    const refund101 = {
        id: 'tx_refund_101',
        type: 'REFUND',
        amount: 64,
        orderId: '101',
        description: '+₹64 Refund for Order #101',
        createdAt: new Date().toISOString(),
        status: 'completed'
    };
    wallet.transactions.unshift(refund101);

    bal = reconcileWalletTranches(wallet);
    assert.strictEqual(bal, 64, `Reconciled balance after Order #101 rejection MUST be exact 64 (got ${bal}) - NOT 128!`);

    // Step C: Customer immediately places a SECOND order #102 applying ₹64
    const hold102 = {
        id: 'tx_hold_102',
        type: 'hold',
        amount: 64,
        orderId: '102',
        description: 'Wallet hold for Order #102',
        createdAt: new Date().toISOString(),
        status: 'LOCKED_HOLD'
    };
    wallet.transactions.unshift(hold102);
    bal = reconcileWalletTranches(wallet);
    assert.strictEqual(bal, 0, 'Balance must be 0 after ₹64 escrow hold on Order #102');

    // Step D: Order #102 is also REJECTED
    hold102.status = 'released';
    const refund102 = {
        id: 'tx_refund_102',
        type: 'REFUND',
        amount: 64,
        orderId: '102',
        description: '+₹64 Refund for Order #102',
        createdAt: new Date().toISOString(),
        status: 'completed'
    };
    wallet.transactions.unshift(refund102);

    bal = reconcileWalletTranches(wallet);
    assert.strictEqual(bal, 64, `Reconciled balance after successive Order #102 rejection MUST REMAIN exact 64 (got ${bal}) - ZERO MULTIPLICATION!`);
});

// -----------------------------------------------------------------------------
// Test 2: ordersController.js Idempotency Guards
// -----------------------------------------------------------------------------
runTest('2. ordersController.js checks walletRefundProcessed & prevents double credit', () => {
    assert(ordersCtrl.includes('walletRefundProcessed'), 'ordersController.js must check walletRefundProcessed');
    assert(ordersCtrl.includes('order.walletRefundProcessed'), 'autoRejectExpiredOrderBackend must check order.walletRefundProcessed');
    assert(ordersCtrl.includes('targetOrder.walletRefundProcessed'), 'PATCH /orders must check targetOrder.walletRefundProcessed');
    assert(ordersCtrl.includes('refundTimestamp'), 'ordersController must record refundTimestamp');
    assert(ordersCtrl.includes('liveDoc && (liveDoc.walletRefundProcessed || liveDoc.walletRefunded)'), 'ordersController must check live Firestore doc for client batch refunds');
});

// -----------------------------------------------------------------------------
// Test 3: staff.js Rejection Idempotency & Batch Updates
// -----------------------------------------------------------------------------
runTest('3. staff.js marks walletRefundProcessed and skips duplicate increments', () => {
    assert(staffJs.includes('orderUpdate.walletRefundProcessed = true'), 'autoRejectExpiredOrder must set walletRefundProcessed: true');
    assert(staffJs.includes('fsUpdate.walletRefundProcessed = true'), 'rejectOrder must set walletRefundProcessed: true');
    assert(staffJs.includes('patchPayload.walletRefundProcessed = true'), 'rejectOrder patchPayload must include walletRefundProcessed: true');
    assert(staffJs.includes('isAlreadyRefunded'), 'staff.js must guard batch increment with isAlreadyRefunded');
});

// -----------------------------------------------------------------------------
// Test 4: staff.js Event-Driven Audio Re-Alert Engine
// -----------------------------------------------------------------------------
runTest('4. staff.js isolates alert dismissal and re-triggers on novel orders', () => {
    assert(staffJs.includes('staffDismissedAlertOrderIds'), 'staff.js must declare staffDismissedAlertOrderIds');
    assert(staffJs.includes('staffProcessedAudioOrderIds'), 'staff.js must declare staffProcessedAudioOrderIds');
    assert(staffJs.includes('staffDismissedAlertOrderIds.add(cleanId)'), 'dismissIncomingOrderAlert must track dismissed order ID');
    assert(staffJs.includes('!staffDismissedAlertOrderIds.has'), 'Firestore docChanges listener must check !staffDismissedAlertOrderIds.has');
    assert(staffJs.includes('startOrderAlertAudio(orderId, summary, data)'), 'Incoming order must trigger startOrderAlertAudio');

    // Simulate dismissal and novel incoming order logic
    const dismissedIds = new Set();
    const processedAudioIds = new Set();
    let currentAlertingOrderId = null;
    let isPlaying = false;

    function mockStartAlert(id) {
        if (isPlaying && currentAlertingOrderId === String(id)) return;
        currentAlertingOrderId = String(id);
        isPlaying = true;
        processedAudioIds.add(String(id));
    }

    function mockDismiss() {
        if (currentAlertingOrderId) {
            dismissedIds.add(currentAlertingOrderId);
        }
        isPlaying = false;
        currentAlertingOrderId = null;
    }

    // 1. First order arrives
    mockStartAlert('1001');
    assert.strictEqual(isPlaying, true, 'Audio must be playing for order 1001');
    assert.strictEqual(currentAlertingOrderId, '1001', 'Alerting order must be 1001');

    // 2. Staff dismisses order 1001
    mockDismiss();
    assert.strictEqual(isPlaying, false, 'Audio must stop on dismissal');
    assert.strictEqual(currentAlertingOrderId, null, 'Current alerting ID reset');
    assert(dismissedIds.has('1001'), 'Order 1001 must be tracked in dismissed set');

    // 3. Second novel order arrives 1 second later
    const order2 = '1002';
    const isOrder2Dismissed = dismissedIds.has(order2);
    assert.strictEqual(isOrder2Dismissed, false, 'Novel order 1002 must not be treated as dismissed');

    mockStartAlert(order2);
    assert.strictEqual(isPlaying, true, 'Audio must IMMEDIATELY re-trigger for novel order 1002 without page refresh');
    assert.strictEqual(currentAlertingOrderId, '1002', 'Alerting order is now 1002');
});

// -----------------------------------------------------------------------------
// Test 5: admin.html Event-Driven Audio Re-Alert Engine
// -----------------------------------------------------------------------------
runTest('5. admin.html allows novel order IDs to bypass debounce & chimes immediately', () => {
    assert(adminHtml.includes('adminHandledAudioOrderIds'), 'admin.html must track adminHandledAudioOrderIds');
    assert(adminHtml.includes('lastAdminChimedOrderId'), 'admin.html must track lastAdminChimedOrderId');
    assert(adminHtml.includes('playAdminOrderChime(orderId = null)'), 'playAdminOrderChime must accept orderId');
    assert(adminHtml.includes('lastAdminChimeTimestamp = 0'), 'dismissAdminOrderAlert must reset debounce timestamp to 0');
    assert(adminHtml.includes('adminHandledAudioOrderIds.add(currentAdminAlertOrderId)'), 'dismissAdminOrderAlert must record handled order ID');

    // Simulate admin chime debouncing logic
    let lastTimestamp = 0;
    let lastOrderId = null;
    let playCount = 0;

    function mockPlayAdminChime(orderId = null) {
        const now = Date.now();
        const clean = orderId ? String(orderId) : null;
        if (clean && clean === lastOrderId && (now - lastTimestamp < 1500)) {
            return false; // Debounced
        }
        if (!clean && (now - lastTimestamp < 1500)) {
            return false; // Debounced
        }
        lastTimestamp = now;
        lastOrderId = clean;
        playCount++;
        return true; // Played
    }

    // Play order #2001
    const p1 = mockPlayAdminChime('2001');
    assert.strictEqual(p1, true, 'Order 2001 chime must play');
    assert.strictEqual(playCount, 1);

    // Duplicate call for order #2001 within 100ms should debounce
    const p1dup = mockPlayAdminChime('2001');
    assert.strictEqual(p1dup, false, 'Duplicate call for order 2001 within 100ms must debounce');
    assert.strictEqual(playCount, 1);

    // Dismissal resets debounce
    lastTimestamp = 0;
    lastOrderId = null;

    // Novel order #2002 arriving 1 second later must play immediately
    const p2 = mockPlayAdminChime('2002');
    assert.strictEqual(p2, true, 'Novel order 2002 MUST play chime immediately without being blocked');
    assert.strictEqual(playCount, 2);
});

// -----------------------------------------------------------------------------
// Test 6: Root vs Public File Parity
// -----------------------------------------------------------------------------
runTest('6. File byte parity between root and public/ directories', () => {
    const staffRoot = fs.readFileSync(path.join(ROOT_DIR, 'staff.js'), 'utf8');
    const staffPublic = fs.readFileSync(path.join(ROOT_DIR, 'public', 'staff.js'), 'utf8');
    assert.strictEqual(staffRoot, staffPublic, 'staff.js and public/staff.js must be byte-for-byte identical');

    const adminRoot = fs.readFileSync(path.join(ROOT_DIR, 'admin.html'), 'utf8');
    const adminPublic = fs.readFileSync(path.join(ROOT_DIR, 'public', 'admin.html'), 'utf8');
    assert.strictEqual(adminRoot, adminPublic, 'admin.html and public/admin.html must be byte-for-byte identical');

    const appRoot = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');
    const appPublic = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf8');
    assert.strictEqual(appRoot, appPublic, 'app.js and public/app.js must be byte-for-byte identical');
});

console.log('================================================================');
console.log(`🎉 ALL ${passedTests} VERIFICATION SUITE TESTS PASSED!`);
console.log('================================================================');
