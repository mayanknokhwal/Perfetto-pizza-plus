const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING WALLET ESCROW HOLD & DELIVERY-GATED SCRATCH CARD LIFECYCLE ===\n');

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
const ordersCtrl = fs.readFileSync('controllers/ordersController.js', 'utf8');
const stylesCss = fs.readFileSync('styles.css', 'utf8');

// Test 1: Backend ordersController escrow hold on order creation
test('1. ordersController records escrow hold on order creation', () => {
    assert(ordersCtrl.includes("type: 'hold'"), "ordersController should create hold transaction");
    assert(ordersCtrl.includes("status: 'LOCKED_HOLD'"), "ordersController should set status to LOCKED_HOLD");
    assert(ordersCtrl.includes("Wallet hold for Order #"), "ordersController should include clear hold description");
});

// Test 2: Backend ordersController releases hold and logs positive refund on rejection
test('2. ordersController unholds and logs positive refund on rejection/cancellation', () => {
    assert(ordersCtrl.includes("type: 'REFUND'"), "ordersController should log REFUND type on rejection");
    assert(ordersCtrl.includes("+₹${refundAmount} Refund"), "ordersController should include positive refund description");
    assert(ordersCtrl.includes("curBal + refundAmount"), "ordersController should restore user balance on rejection");
});

// Test 3: Backend ordersController delivery-gated scratch card crediting
test('3. ordersController credits scratch card only on delivery and handles wallet usage', () => {
    assert(ordersCtrl.includes("active_credited"), "ordersController should credit on delivery");
    assert(ordersCtrl.includes("usedWallet > 0"), "ordersController should check usedWallet on order creation");
});

// Test 4: Staff rejection releases wallet hold and restores customer balance
test('4. staff.js handles wallet refund rollback and hold release on rejection', () => {
    assert(staffJs.includes("FieldValue.increment(refundAmount)"), "staff.js should increment wallet balance on rejection");
    assert(staffJs.includes("type: 'REFUND'"), "staff.js should log positive REFUND transaction in staff.js");
    assert(staffJs.includes("voided"), "staff.js should void scratch card on rejection");
});

// Test 5: app.js reconcileWalletTranches counts LOCKED_HOLD in debits
test('5. app.js reconcileWalletTranches counts LOCKED_HOLD and excludes released holds', () => {
    assert(appJs.includes("tx.type === 'hold' && tx.status === 'LOCKED_HOLD'"), "reconcileWalletTranches must include LOCKED_HOLD in debits");
    assert(appJs.includes("tx.status !== 'released'"), "reconcileWalletTranches must exclude released holds");
});

// Test 6: app.js getActiveLockedWalletInfo checks active orders for held funds
test('6. app.js getActiveLockedWalletInfo checks active orders', () => {
    assert(appJs.includes("function getActiveLockedWalletInfo"), "getActiveLockedWalletInfo must be defined");
    assert(appJs.includes("lockedAmount += held"), "getActiveLockedWalletInfo must sum held amounts");
    assert(appJs.includes("terminalStatuses"), "getActiveLockedWalletInfo must filter out terminal statuses");
});

// Test 7: app.js updateCheckoutWalletUI shows locked notice
test('7. app.js updateCheckoutWalletUI displays inline locked funds notice', () => {
    assert(appJs.includes("checkout-wallet-locked-notice"), "updateCheckoutWalletUI must create locked notice element");
    assert(appJs.includes("is currently locked in"), "updateCheckoutWalletUI must display locked explanation");
});

// Test 8: app.js handleToggleUseWallet prevents double spend with toast
test('8. app.js handleToggleUseWallet blocks toggling when funds are locked in active order', () => {
    assert(appJs.includes("handleToggleUseWallet"), "handleToggleUseWallet must be defined");
    assert(appJs.includes("Your previous wallet balance of ₹"), "handleToggleUseWallet must show informative toast");
});

// Test 9: app.js debitCustomerWallet creates escrow hold
test('9. app.js debitCustomerWallet creates LOCKED_HOLD transaction', () => {
    assert(appJs.includes("status: 'LOCKED_HOLD'"), "debitCustomerWallet must set LOCKED_HOLD");
    assert(appJs.includes("tx_hold_"), "debitCustomerWallet must prefix hold transaction IDs");
});

// Test 10: app.js commitWalletHold and releaseWalletHold functions
test('10. app.js exports commitWalletHold and releaseWalletHold', () => {
    assert(appJs.includes("function commitWalletHold"), "commitWalletHold must be defined");
    assert(appJs.includes("function releaseWalletHold"), "releaseWalletHold must be defined");
    assert(appJs.includes("holdTx.status = 'released'"), "releaseWalletHold must release hold");
});

// Test 11: app.js renderProfileWalletTxList displays +₹XX Refund in green without negative sign
test('11. app.js renderProfileWalletTxList displays positive refund with green styling and badge', () => {
    assert(appJs.includes("const isRefund = (tx.type === 'REFUND' || tx.type === 'refund');"), "renderProfileWalletTxList must recognize REFUND transactions");
    assert(appJs.includes("tx-badge-refund"), "renderProfileWalletTxList must include refund badge");
    assert(appJs.includes("amount-refund"), "renderProfileWalletTxList must include amount-refund class");
    assert(appJs.includes("${amountPrefix}₹${amt}${amountSuffix}"), "renderProfileWalletTxList must format positive amount with prefix");
});

// Test 12: app.js scratch card messaging for delivery-gating
test('12. app.js displays delivery-gated reward message and tags status pending_delivery', () => {
    assert(appJs.includes("Reward Unlocked! Cashback will be credited to your wallet once your order is delivered."), "app.js must display delivery-gated messaging");
    assert(appJs.includes("markScratchRewardPendingDelivery"), "app.js must tag reward as pending_delivery");
});

// Test 13: CSS styles for refund, hold, and locked notice
test('13. styles.css contains styling for refund, hold, and inline locked notice', () => {
    assert(stylesCss.includes(".wallet-tx-item.tx-refund"), "styles.css must style tx-refund item");
    assert(stylesCss.includes(".wallet-tx-amount.amount-refund"), "styles.css must style amount-refund in green");
    assert(stylesCss.includes(".tx-badge-refund"), "styles.css must style tx-badge-refund");
    assert(stylesCss.includes(".tx-badge-hold"), "styles.css must style tx-badge-hold");
    assert(stylesCss.includes(".wallet-locked-inline-notice"), "styles.css must style wallet-locked-inline-notice");
});

// Test 14: Order history auto-credits on delivery and releases hold on cancellation
test('14. app.js renderOrderHistoryDetails commits hold on delivery and releases hold on cancellation', () => {
    assert(appJs.includes("commitWalletHold(targetOrderId)"), "renderOrderHistoryDetails must commit hold on delivery");
    assert(appJs.includes("releaseWalletHold(targetOrderId, heldAmount)"), "renderOrderHistoryDetails must release hold on cancellation");
});

console.log(`\nALL ${passCount} TESTS PASSED SUCCESSFULLY!`);
