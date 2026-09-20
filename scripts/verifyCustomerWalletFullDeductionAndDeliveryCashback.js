/**
 * Verification test for:
 * 1. Full Multi-Credit FIFO Deduction (e.g. ₹60 + ₹14 = ₹74)
 * 2. Post-Delivery-Only Cashback Unlocking (LOCKED_PENDING_DELIVERY, credited: false until DELIVERED; voided on REJECTED)
 * 3. Clean Single Refund Reconciliation on Rejection (exact walletAmountApplied, idempotent, no duplicate inflation)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser globals
global.window = global;
global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
};
global.safeStorage = {
    getJSON(k, def) {
        const v = global.localStorage.getItem(k);
        return v ? JSON.parse(v) : def;
    },
    setJSON(k, val) {
        global.localStorage.setItem(k, JSON.stringify(val));
    }
};
global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
};
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.location = { href: '', search: '', pathname: '/' };
global.location = global.window.location;
global.navigator = {};
global.customerFirestore = null;
global.currentUserProfile = { phone: '9876543210' };

// Load app.js functions by requiring or evaluating the required segments
const appCode = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

// Evaluate necessary parts of app.js in this sandbox
eval(appCode);

async function runAllTests() {
    console.log('======================================================================');
    console.log('🧪 VERIFYING FULL MULTI-CREDIT FIFO DEDUCTION & POST-DELIVERY CASHBACK');
    console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Full Multi-Credit FIFO Deduction
// -----------------------------------------------------------------------------
console.log('Test 1: Full Multi-Credit FIFO Deduction (₹60 + ₹14 = ₹74 total applied)');
{
    const now = Date.now();
    // Credit 1: ₹60, expiring in 1 day (earliest)
    const credit1 = {
        id: 'tx_c1',
        type: 'credit',
        amount: 60,
        initialAmount: 60,
        remainingAmount: 60,
        createdAt: new Date(now - 10000).toISOString(),
        expiresAt: new Date(now + 24 * 3600 * 1000).toISOString(),
        status: 'active'
    };
    // Credit 2: ₹14, expiring in 7 days (later)
    const credit2 = {
        id: 'tx_c2',
        type: 'credit',
        amount: 14,
        initialAmount: 14,
        remainingAmount: 14,
        createdAt: new Date(now - 5000).toISOString(),
        expiresAt: new Date(now + 7 * 24 * 3600 * 1000).toISOString(),
        status: 'active'
    };

    currentCustomerWallet.phone = '9876543210';
    currentCustomerWallet.balance = 74;
    currentCustomerWallet.transactions = [credit2, credit1];

    const initialBal = reconcileWalletTranches(currentCustomerWallet);
    assert.strictEqual(initialBal, 74, `Initial wallet balance should be 74, got ${initialBal}`);

    // Place order applying full ₹74
    await createWalletHoldRecord('9876543210', 74, '101');

    assert.strictEqual(credit1.remainingAmount, 0, 'Credit 1 remainingAmount should be 0');
    assert.strictEqual(credit1.isRedeemed, true, 'Credit 1 isRedeemed should be true');
    assert.strictEqual(credit2.remainingAmount, 0, 'Credit 2 remainingAmount should be 0');
    assert.strictEqual(credit2.isRedeemed, true, 'Credit 2 isRedeemed should be true');

    const balAfterHold = reconcileWalletTranches(currentCustomerWallet);
    assert.strictEqual(balAfterHold, 0, `Usable wallet balance after applying ₹74 must be exactly 0, got ${balAfterHold}`);
    console.log('✅ PASS: Multi-credit FIFO deduction successfully exhausted all ₹74 credits down to ₹0');
}

// -----------------------------------------------------------------------------
// TEST 2: Post-Delivery-Only Cashback Unlocking
// -----------------------------------------------------------------------------
console.log('\nTest 2: Post-Delivery-Only Cashback Unlocking (LOCKED_PENDING_DELIVERY)');
{
    currentCustomerWallet.phone = '9876543210';
    currentCustomerWallet.balance = 0;
    currentCustomerWallet.transactions = [];

    const testOrder = {
        id: '102',
        orderId: '102',
        status: 'PENDING',
        customerPhone: '9876543210',
        wonCashback: 10,
        earnedCashback: 10
    };

    // Customer scratches mystery reward
    markScratchRewardPendingDelivery(testOrder, 10);

    assert.strictEqual(testOrder.rewardStatus, 'LOCKED_PENDING_DELIVERY', 'Order rewardStatus must be LOCKED_PENDING_DELIVERY');
    assert.strictEqual(testOrder.credited, false, 'credited must be false');
    assert.strictEqual(testOrder.scratchCard.status, 'LOCKED_PENDING_DELIVERY', 'Scratch card status must be LOCKED_PENDING_DELIVERY');
    assert.strictEqual(testOrder.scratchCard.credited, false, 'Scratch card credited must be false');

    // Add a locked pending delivery transaction to wallet
    currentCustomerWallet.transactions.push({
        id: 'tx_reward_102',
        type: 'cashback',
        amount: 10,
        initialAmount: 10,
        remainingAmount: 10,
        status: 'LOCKED_PENDING_DELIVERY',
        credited: false
    });

    const balPending = reconcileWalletTranches(currentCustomerWallet);
    assert.strictEqual(balPending, 0, `Wallet balance must remain 0 while cashback is LOCKED_PENDING_DELIVERY, got ${balPending}`);

    const fundedCredit = getTotalFundedWalletCredit(currentCustomerWallet);
    assert.strictEqual(fundedCredit, 0, `getTotalFundedWalletCredit must not count LOCKED_PENDING_DELIVERY, got ${fundedCredit}`);

    const activeTranches = getActiveCreditTranches();
    assert.strictEqual(activeTranches.length, 0, `getActiveCreditTranches must exclude LOCKED_PENDING_DELIVERY, got ${activeTranches.length}`);

    console.log('✅ PASS: Locked pending cashback is strictly excluded from usable wallet balance prior to delivery');
}

// -----------------------------------------------------------------------------
// TEST 3: Cashback Revocation on Rejection / Cancellation
// -----------------------------------------------------------------------------
console.log('\nTest 3: Cashback Revocation on Order Rejection / Cancellation');
{
    const storedOrders = [{
        id: '103',
        orderId: '103',
        status: 'PENDING',
        customerPhone: '9876543210',
        rewardStatus: 'LOCKED_PENDING_DELIVERY',
        wonCashback: 10,
        credited: false,
        scratchCard: {
            status: 'LOCKED_PENDING_DELIVERY',
            wonAmount: 10,
            credited: false
        }
    }];
    global.localStorage.setItem('perfettoCustomerOrders', JSON.stringify(storedOrders));

    // Staff rejects order
    handleRealtimeCustomerOrderUpdate('103', {
        id: '103',
        status: 'rejected'
    });

    const updated = JSON.parse(global.localStorage.getItem('perfettoCustomerOrders'))[0];
    assert.strictEqual(updated.rewardStatus, 'voided', 'rewardStatus should be voided');
    assert.strictEqual(updated.wonCashback, 0, 'wonCashback should be 0');
    assert.strictEqual(updated.credited, false, 'credited should be false');
    assert.strictEqual(updated.scratchCard.status, 'voided', 'scratchCard status should be voided');

    console.log('✅ PASS: Pending cashback was properly voided upon order rejection');
}

// -----------------------------------------------------------------------------
// TEST 4: Clean Refund Reconciliation on Rejection (Single & Idempotent)
// -----------------------------------------------------------------------------
console.log('\nTest 4: Clean Refund Reconciliation on Rejection');
{
    const now = Date.now();
    currentCustomerWallet.phone = '9876543210';
    currentCustomerWallet.balance = 50;
    currentCustomerWallet.transactions = [
        {
            id: 'tx_hold_104',
            type: 'WALLET_HOLD',
            amount: 50,
            orderId: '104',
            status: 'LOCKED'
        }
    ];

    // First release
    releaseWalletHold('104', 50);

    const refundCount1 = currentCustomerWallet.transactions.filter(t => String(t.type).toUpperCase() === 'REFUND').length;
    assert.strictEqual(refundCount1, 1, 'Should have exactly 1 refund transaction');
    assert.strictEqual(currentCustomerWallet.balance, 50, `Balance after refund should be 50, got ${currentCustomerWallet.balance}`);

    // Second release (duplicate attempt)
    releaseWalletHold('104', 50);
    const refundCount2 = currentCustomerWallet.transactions.filter(t => String(t.type).toUpperCase() === 'REFUND').length;
    assert.strictEqual(refundCount2, 1, 'Should STILL have exactly 1 refund transaction (idempotent)');
    assert.strictEqual(currentCustomerWallet.balance, 50, `Balance should remain 50, not inflate, got ${currentCustomerWallet.balance}`);

    console.log('✅ PASS: Refund reconciliation is strictly idempotent without double-crediting or balance inflation');
}

    console.log('\n======================================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================================\n');
    process.exit(0);
}

runAllTests().catch(err => {
    console.error(err);
    process.exit(1);
});
