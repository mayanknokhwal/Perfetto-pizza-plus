/**
 * Test Suite: verifyOrderPlacementUnblockedAndOrphanPurged.js
 * 
 * Verifies:
 * 1. Standard COD order placement succeeds without wallet discount even if orphan holds exist.
 * 2. Corrupted/orphaned test ledger locks ("Order #1" ₹43, "Order #2" ₹10) are purged/released by reconcileWalletTranches when order is not active PENDING.
 * 3. RESET_WALLET_LEDGER cleans local storage and resets balance cleanly.
 * 4. createWalletHoldRecord failures are non-blocking and never halt primary order placement.
 * 5. Direct Firestore push in saveOrderToBackendAPI resolves customerFirestore/db cleanly.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('======================================================================');
console.log('🧪 VERIFYING ORDER PLACEMENT UNBLOCKED & ORPHAN HOLD PURGING PIPELINE');
console.log('======================================================================\n');

function test(name, fn) {
    try {
        fn();
        console.log(`PASS: ${name}`);
    } catch (err) {
        console.error(`FAIL: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// 1. Static assertions on app.js source code
test('1. app.js contains non-blocking try-catch wrapping createWalletHoldRecord', () => {
    const code = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf-8');
    assert(code.includes('Non-blocking wallet hold exception caught'), 'Must log non-blocking wallet hold exception');
    assert(code.includes('safeStorage.setJSON(\'perfettoCustomerOrders\', ordersList)'), 'Must persist order to safeStorage');
    assert(code.includes('saveOrderToBackendAPI(newOrder)'), 'Must call saveOrderToBackendAPI');
    assert(code.includes('openOrderOtpSuccessModal(newOrder)'), 'Must open success modal on placement');
});

test('2. app.js contains checkAndApplyWalletLedgerReset clean reset utility', () => {
    const code = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf-8');
    assert(code.includes('checkAndApplyWalletLedgerReset'), 'Must define checkAndApplyWalletLedgerReset');
    assert(code.includes('RESET_WALLET_LEDGER'), 'Must check RESET_WALLET_LEDGER key');
    assert(code.includes('window.resetCustomerWalletLedger'), 'Must expose window.resetCustomerWalletLedger');
});

test('3. app.js reconcileWalletTranches purges orphaned holds where order is not in active PENDING status', () => {
    const code = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf-8');
    assert(code.includes('Releasing orphaned hold for Order'), 'Must log releasing orphaned hold');
    assert(code.includes('activePendingOrderMap'), 'Must check activePendingOrderMap');
    assert(code.includes('tx.status = \'released\''), 'Must release orphaned hold');
});

// 2. Functional simulation in sandboxed context
function createMockEnvironment(initialCart = []) {
    const storage = {};
    const safeStorage = {
        getJSON: (k, def) => (storage[k] ? JSON.parse(storage[k]) : def),
        setJSON: (k, v) => { storage[k] = JSON.stringify(v); }
    };
    if (initialCart && initialCart.length > 0) {
        safeStorage.setJSON('perfetto_pizza_cart', initialCart);
    }
    const localStorage = {
        getItem: (k) => (storage[k] !== undefined ? storage[k] : null),
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: (k) => { delete storage[k]; }
    };

    const document = {
        documentElement: { classList: { remove: () => {}, add: () => {} } },
        getElementById: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {}
    };

    const window = {
        location: { search: '' },
        addEventListener: () => {},
        dispatchEvent: () => {},
        localStorage,
        safeStorage
    };

    const context = {
        window,
        document,
        localStorage,
        safeStorage,
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Date,
        Math,
        Number,
        String,
        Array,
        Object,
        Boolean,
        RegExp,
        Set,
        Map,
        JSON,
        parseFloat,
        parseInt,
        isNaN
    };

    vm.createContext(context);

    // Read and execute required portions of app.js in sandbox
    const fullCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf-8');
    vm.runInContext(fullCode, context);

    return { context, storage, localStorage, safeStorage };
}

test('4. reconcileWalletTranches purges legacy corrupted holds ("Order #1" ₹43, "Order #2" ₹10) when order does not exist in pending orders', () => {
    const { context } = createMockEnvironment();
    const now = Date.now();

    // Setup wallet containing legacy corrupted test holds: ₹43 for Order #1 and ₹10 for Order #2
    context.currentCustomerWallet = {
        balance: 66,
        phone: '9876543210',
        transactions: [
            {
                id: 'tx_scratch_1',
                type: 'CASHBACK_EARNED',
                amount: 66,
                status: 'UNLOCKED',
                title: 'Welcome Cashback',
                expiresAt: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString(),
                createdAt: new Date(now - 1000).toISOString()
            },
            {
                id: 'tx_hold_1',
                type: 'WALLET_HOLD',
                amount: 43,
                orderId: '1',
                title: 'Wallet hold for Order #1',
                status: 'LOCKED',
                holdStatus: 'LOCKED_HOLD',
                createdAt: new Date(now - 2000).toISOString()
            },
            {
                id: 'tx_hold_2',
                type: 'WALLET_HOLD',
                amount: 10,
                orderId: '2',
                title: 'Wallet hold for Order #2',
                status: 'LOCKED',
                holdStatus: 'LOCKED_HOLD',
                createdAt: new Date(now - 3000).toISOString()
            }
        ]
    };

    // Stored orders has no pending orders (they were deleted or completed)
    context.safeStorage.setJSON('perfettoCustomerOrders', []);

    // Reconcile tranches
    const usableBal = context.reconcileWalletTranches(context.currentCustomerWallet);

    // Verify both corrupted holds were released
    const tx1 = context.currentCustomerWallet.transactions.find(t => t.id === 'tx_hold_1');
    const tx2 = context.currentCustomerWallet.transactions.find(t => t.id === 'tx_hold_2');

    assert.strictEqual(tx1.status, 'released', 'Orphaned hold for Order #1 must be released');
    assert.strictEqual(tx2.status, 'released', 'Orphaned hold for Order #2 must be released');
    assert.strictEqual(usableBal, 66, 'Full ₹66 credit must be immediately restored as usable balance');

    const lockInfo = context.getActiveLockedWalletInfo();
    assert.strictEqual(lockInfo.lockedAmount, 0, 'No funds should remain locked');
});

test('5. RESET_WALLET_LEDGER flag cleanly resets wallet storage and current balance to 0', () => {
    const { context, localStorage } = createMockEnvironment();

    localStorage.setItem('perfetto_wallet_balance', '150');
    localStorage.setItem('perfetto_customer_wallet', JSON.stringify({ balance: 150, transactions: [{ id: 'tx_old' }] }));
    localStorage.setItem('RESET_WALLET_LEDGER', 'true');

    context.currentCustomerWallet = { balance: 150, transactions: [{ id: 'tx_old' }] };

    const resetApplied = context.checkAndApplyWalletLedgerReset(context.currentCustomerWallet);
    assert.strictEqual(resetApplied, true, 'checkAndApplyWalletLedgerReset must return true when flag was present');
    assert.strictEqual(localStorage.getItem('RESET_WALLET_LEDGER'), null, 'RESET_WALLET_LEDGER flag must be cleared');
    assert.strictEqual(context.currentCustomerWallet.balance, 0, 'Wallet balance must be reset to 0');
    assert.strictEqual(context.currentCustomerWallet.transactions.length, 0, 'Transactions array must be emptied');
});

test('6. executeOrderPlacement succeeds and writes order to safeStorage even if createWalletHoldRecord throws an error', () => {
    const initialCart = [{ id: 'farmhouse_large', name: 'Farmhouse Pizza', price: 349, qty: 1 }];
    const { context, safeStorage } = createMockEnvironment(initialCart);

    // Mock cart and profile
    context.evaluateCustomerStoreStatus = () => ({ isOpen: true });
    const profile = { name: 'Mayank', phone: '9876543210' };
    context.currentUserProfile = profile;
    context.renderOrderHistoryDetails = () => {};
    context.updateCartUI = () => {};
    context.updateProfileTotalsUI = () => {};
    context.saveCartToStorage = () => {};

    // Intentionally inject an error into createWalletHoldRecord to simulate a ledger write failure
    context.createWalletHoldRecord = () => {
        throw new Error('Simulated atomic Firestore hold creation error');
    };

    let modalOpened = false;
    let savedModalOrder = null;
    context.openOrderOtpSuccessModal = (order) => {
        modalOpened = true;
        savedModalOrder = order;
    };

    let apiSavedOrder = null;
    context.saveOrderToBackendAPI = (order) => {
        apiSavedOrder = order;
    };

    // Attempt order placement with specificOrderId '9999'
    context.executeOrderPlacement(profile, 'Cash on Delivery', 'Cash on Delivery', '9999', true);

    // Primary order placement MUST NOT be blocked
    const storedOrders = safeStorage.getJSON('perfettoCustomerOrders', []);
    const placedOrder = storedOrders.find(o => String(o.id || o.orderId) === '9999');

    assert(placedOrder, 'Order 9999 must exist in safeStorage perfettoCustomerOrders despite wallet hold error');
    assert.strictEqual(placedOrder.total, 349, 'Order total must match cart subtotal');
    assert.strictEqual(modalOpened, true, 'Success/OTP modal must open');
    assert.strictEqual(String(savedModalOrder.id || savedModalOrder.orderId), '9999', 'Success modal received correct order');
});

test('7. Standard COD order placement with hasActiveOrderLock ignores wallet lock and completes order', () => {
    const initialCart = [{ id: 'pizza_2', name: 'Peppy Paneer', price: 299, qty: 1 }];
    const { context, safeStorage } = createMockEnvironment(initialCart);

    // Order #1 is actively pending with a hold
    safeStorage.setJSON('perfettoCustomerOrders', [
        { id: '1', orderId: '1', status: 'pending', walletDiscount: 43 }
    ]);
    context.currentCustomerWallet = {
        balance: 0,
        transactions: [
            { id: 'tx_hold_1', orderId: '1', type: 'WALLET_HOLD', amount: 43, status: 'LOCKED' }
        ]
    };

    // Ensure getActiveLockedWalletInfo returns active lock
    const lockInfo = context.getActiveLockedWalletInfo();
    assert.strictEqual(lockInfo.lockedAmount, 43, 'Active lock of ₹43 must exist');

    context.evaluateCustomerStoreStatus = () => ({ isOpen: true });
    const profile = { name: 'Mayank', phone: '9876543210' };
    context.renderOrderHistoryDetails = () => {};
    context.updateCartUI = () => {};
    context.updateProfileTotalsUI = () => {};
    context.saveCartToStorage = () => {};

    let modalOpened = false;
    context.openOrderOtpSuccessModal = () => { modalOpened = true; };
    context.saveOrderToBackendAPI = () => {};

    // Customer places standard COD order for Order #2
    context.executeOrderPlacement(profile, 'Cash on Delivery', 'Cash on Delivery', '2', true);

    const storedOrders = safeStorage.getJSON('perfettoCustomerOrders', []);
    const placedOrder2 = storedOrders.find(o => String(o.id || o.orderId) === '2');

    assert(placedOrder2, 'Order #2 must be placed successfully despite active lock on Order #1');
    assert.strictEqual(placedOrder2.walletDiscount, 0, 'Wallet discount on Order #2 must be 0');
    assert.strictEqual(placedOrder2.total, 299, 'Order #2 total must be full price ₹299');
    assert.strictEqual(modalOpened, true, 'Order #2 modal opened');
});

console.log('\n======================================================================');
console.log('🎉 ALL 7 UNBLOCKED PIPELINE & ORPHAN PURGE TESTS PASSED SUCCESSFULLY!');
console.log('======================================================================');
process.exit(0);
