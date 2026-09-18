const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('======================================================================');
console.log('🧪 VERIFYING WALLET HOLD DEDUCTIONS & CHECKOUT LOCKOUT ON ACTIVE HOLDS');
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

// 1. Static assertions
test('1. app.js contains strict usableBalance formula subtracting totalActiveHolds', () => {
    assert(appJs.includes("const totalCredits = activeTranches.reduce((sum, t) => sum + Number(t.amount || 0), 0);"), "Must compute totalCredits from activeTranches");
    assert(appJs.includes("const totalActiveHolds = activeHolds.reduce((sum, h) => sum + Number(h.amount || 0), 0);"), "Must compute totalActiveHolds from activeHolds");
    assert(appJs.includes("usableBalance = Math.max(0,"), "Must compute usableBalance with Math.max(0, ...)");
    assert(appJs.includes("totalActiveHolds"), "Must subtract totalActiveHolds from credits");
});

test('2. app.js hard-locks checkout checkbox when usableBalance <= 0 or funds are held', () => {
    assert(appJs.includes("availableBalance <= 0 || maxRedeemable <= 0 || hasActiveLock"), "updateCheckoutWalletUI must guard against zero balance and active lock");
    assert(appJs.includes("checkbox.checked = false;"), "Checkbox must be unchecked when locked or zero balance");
    assert(appJs.includes("checkbox.disabled = true;"), "Checkbox must be disabled when locked or zero balance");
});

test('3. app.js records WALLET_HOLD with status LOCKED on order placement', () => {
    assert(appJs.includes("type: 'WALLET_HOLD'"), "Must set type to WALLET_HOLD");
    assert(appJs.includes("status: 'LOCKED'"), "Must set status to LOCKED");
    assert(appJs.includes("createWalletHoldRecord"), "Must define createWalletHoldRecord");
});

// Setup VM environment to test end-to-end simulation
const domMocks = {
    'profile-wallet-tx-list': { innerHTML: '' },
    'profile-wallet-val': { textContent: '' },
    'profile-wallet-expiry-tag': { style: { display: 'none' }, classList: { add() {}, remove() {} } },
    'profile-wallet-expiry-text': { textContent: '' },
    'profile-wallet-card': { style: {}, classList: { add() {}, remove() {} } },
    'profile-wallet-status-pill': { classList: { add() {}, remove() {} }, setAttribute() {} },
    'profile-wallet-rules-text': { textContent: '', setAttribute() {} },
    'profile-wallet-expiring-alert': { style: { display: 'none' } },
    'profile-wallet-expiring-amount': { textContent: '' },
    'profile-wallet-expiring-countdown': { textContent: '' },
    'checkout-wallet-card': { style: { display: 'none' }, appendChild(el) {} },
    'checkout-wallet-available-val': { textContent: '' },
    'checkbox-use-wallet': { checked: false, disabled: false },
    'checkout-wallet-use-label': { textContent: '' },
    'checkout-wallet-checkbox-label': { style: {}, classList: { add() {}, remove() {} } },
    'checkout-wallet-hint': { style: { display: 'none' }, classList: { add() {}, remove() {} } },
    'checkout-wallet-hint-text': { textContent: '' },
    'checkout-wallet-discount-row': { style: { display: 'none' } },
    'checkout-wallet-discount': { textContent: '' },
    'checkout-total': { textContent: '' },
    'checkout-wallet-locked-notice': { style: { display: 'none' }, innerHTML: '' },
    'cart-cashback-bar': { style: { display: 'none' }, classList: { add() {}, remove() {} } },
    'cart-cashback-content': { innerHTML: '' }
};

const localStorageMock = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; }
};

const safeStorageMock = {
    getJSON(key, defaultVal) {
        const raw = localStorageMock.getItem(key);
        if (!raw) return defaultVal;
        try { return JSON.parse(raw); } catch (e) { return defaultVal; }
    },
    setJSON(key, val) {
        localStorageMock.setItem(key, JSON.stringify(val));
    }
};

let toastMessages = [];

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
            return domMocks[id] || { style: {}, classList: { add() {}, remove() {} }, innerHTML: '', textContent: '', appendChild() {} };
        },
        createElement(tag) {
            return { id: '', className: '', style: {}, classList: { add() {}, remove() {} }, innerHTML: '', textContent: '' };
        }
    },
    window: {},
    localStorage: localStorageMock,
    safeStorage: safeStorageMock,
    customerFirestore: null,
    customerWalletConfig: { enabled: true, expiryDays: 15, cashbackExpiryDays: 15, slabs: [{ minOrder: 199, cashback: 10 }] },
    currentCustomerWallet: { balance: 0, transactions: [] },
    cart: [{ id: 'pizza_1', name: 'Margherita', price: 299, qty: 1 }],
    appliedWalletDiscountAmount: 0,
    isWalletRedemptionSelected: false,
    currentUserProfile: { fullName: 'Test User', phone: '9876543210' },
    currentCustomerGps: null,
    formatPrice: (amt) => `₹${amt}`,
    showToast: (msg) => { toastMessages.push(msg); },
    getAppLanguage: () => 'en',
    getSavedDeliveryProfile: () => ({ fullName: 'Test User', phone: '9876543210', colonyName: 'Main', nearBy: 'Park', streetName: '1st', wardNo: '5' }),
    calculateDynamicDeliveryInfo: () => ({ isFreeDelivery: true, finalDeliveryFee: 0, distanceKm: 1 }),
    evaluateCustomerStoreStatus: () => ({ isOpen: true }),
    checkAndUpdateShopStatusUI: () => {},
    closeCheckoutModal: () => {},
    saveOrderToBackendAPI: () => {},
    saveCartToStorage: () => {},
    updateCartUI: () => {},
    getFirstUnclaimedDeliveredOrder: () => null,
    t: (k, params) => k,
    openOrderOtpSuccessModal: () => {},
    generateSlabRewardAmount: () => 10,
    getClampedCashbackExpiryDays: () => 15,
    escapeHtml: (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
};

vm.createContext(context);

// Extract and evaluate relevant routines from app.js in sandbox
const functionsToLoad = [
    ['function parseTimestampMs', 'window.parseTimestampMs = parseTimestampMs;'],
    ['function formatStepDownExpiryCountdown', 'window.formatStepDownExpiryCountdown = formatStepDownExpiryCountdown;'],
    ['function getSlab1Threshold', 'window.getSlab1Threshold = getSlab1Threshold;'],
    ['function getCashbackRewardBoundaries', 'window.getCashbackRewardBoundaries = getCashbackRewardBoundaries;'],
    ['function reconcileWalletTranches', 'window.reconcileWalletTranches = reconcileWalletTranches;'],
    ['function getActiveCreditTranches', 'window.getActiveCreditTranches = getActiveCreditTranches;'],
    ['function getEarliestExpiringWalletBatch', 'window.getEarliestExpiringWalletBatch = getEarliestExpiringWalletBatch;'],
    ['function getEffectiveWalletBalance', 'window.getEffectiveWalletBalance = getEffectiveWalletBalance;'],
    ['function getTotalFundedWalletCredit', 'window.getTotalFundedWalletCredit = getTotalFundedWalletCredit;'],
    ['function getActiveLockedWalletInfo', 'window.getActiveLockedWalletInfo = getActiveLockedWalletInfo;'],
    ['function updateCheckoutCashbackTeaser', 'window.updateCheckoutCashbackTeaser = updateCheckoutCashbackTeaser;'],
    ['function updateCheckoutWalletUI', 'window.updateCheckoutWalletUI = updateCheckoutWalletUI;'],
    ['function handleToggleUseWallet', 'window.handleToggleUseWallet = handleToggleUseWallet;'],
    ['async function createWalletHoldRecord', 'window.debitCustomerWallet = debitCustomerWallet;'],
    ['function commitWalletHold', 'window.commitWalletHold = commitWalletHold;'],
    ['function releaseWalletHold', 'window.releaseWalletHold = releaseWalletHold;'],
    ['function updateProfileWalletUI', 'window.updateProfileWalletUI = updateProfileWalletUI;'],
    ['function renderProfileWalletTxList', 'window.renderProfileWalletTxList = renderProfileWalletTxList;'],
    ['function executeOrderPlacement', 'window.executeOrderPlacement = executeOrderPlacement;']
];

let codeToRun = '';
functionsToLoad.forEach(([startMarker, endMarker]) => {
    const sIdx = appJs.indexOf(startMarker);
    assert(sIdx !== -1, `Could not find marker: ${startMarker}`);
    const eIdx = appJs.indexOf(endMarker, sIdx);
    assert(eIdx !== -1, `Could not find end marker: ${endMarker}`);
    codeToRun += appJs.slice(sIdx, eIdx + endMarker.length) + '\n';
});

vm.runInContext(codeToRun, context);

test('4. Customer with ₹66 cashback credit has usableBalance of ₹66 initially', () => {
    const now = Date.now();
    context.currentCustomerWallet = {
        balance: 66,
        phone: '9876543210',
        transactions: [
            {
                id: 'tx_scratch_initial',
                type: 'CASHBACK_EARNED',
                amount: 66,
                status: 'UNLOCKED',
                title: 'Welcome Cashback',
                expiresAt: new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString(),
                createdAt: new Date(now - 1000).toISOString()
            }
        ]
    };
    const bal = context.reconcileWalletTranches(context.currentCustomerWallet);
    assert.strictEqual(bal, 66, "Initial available balance must be ₹66");

    context.updateProfileWalletUI();
    assert.strictEqual(context.document.getElementById('profile-wallet-val').textContent, 66, "Profile top balance must be 66");

    context.updateCheckoutWalletUI();
    assert.strictEqual(domMocks['checkbox-use-wallet'].disabled, false, "Checkbox should be enabled when balance available");
});

test('5. Order placement with ₹66 wallet discount atomically creates WALLET_HOLD (status: LOCKED) and usable balance immediately drops to ₹0', () => {
    context.isWalletRedemptionSelected = true;
    context.appliedWalletDiscountAmount = 66;

    // Execute order placement for Order #1
    context.executeOrderPlacement(context.getSavedDeliveryProfile(), 'Cash on Delivery', 'Cash on Delivery', '1', false);

    // Verify WALLET_HOLD transaction created in currentCustomerWallet.transactions
    const holdTx = context.currentCustomerWallet.transactions.find(tx => tx.orderId === '1');
    assert(holdTx, "Hold transaction must exist for order 1");
    assert.strictEqual(holdTx.type, 'WALLET_HOLD', "Hold transaction type must be WALLET_HOLD");
    assert.strictEqual(holdTx.status, 'LOCKED', "Hold transaction status must be LOCKED");
    assert.strictEqual(holdTx.amount, 66, "Hold transaction amount must be ₹66");

    // Verify usable balance immediately dropped to ₹0
    const usableBal = context.getEffectiveWalletBalance();
    assert.strictEqual(usableBal, 0, "Effective usable balance must drop to 0 after hold");

    // Verify profile wallet display dropped to 0
    context.updateProfileWalletUI();
    assert.strictEqual(domMocks['profile-wallet-val'].textContent, 0, "Profile top wallet balance must display 0");

    // Verify profile transaction list renders the hold entry
    context.renderProfileWalletTxList();
    const txHtml = domMocks['profile-wallet-tx-list'].innerHTML;
    assert(txHtml.includes('Wallet hold for Order #1'), "Transaction list must display 'Wallet hold for Order #1'");
    assert(txHtml.includes('Locked Hold'), "Transaction list must display 'Locked Hold' badge");
});

test('6. On subsequent checkout, checkbox is hard-disabled (disabled = true, checked = false) and full total required', () => {
    // Customer adds another item to cart
    context.cart = [{ id: 'pizza_2', name: 'Farmhouse', price: 349, qty: 1 }];

    // Trigger updateCheckoutWalletUI
    context.updateCheckoutWalletUI();

    const cb = domMocks['checkbox-use-wallet'];
    assert.strictEqual(cb.disabled, true, "Checkbox MUST be completely disabled");
    assert.strictEqual(cb.checked, false, "Checkbox MUST be unchecked");
    assert.strictEqual(context.isWalletRedemptionSelected, false, "isWalletRedemptionSelected must be forced to false");
    assert.strictEqual(context.appliedWalletDiscountAmount, 0, "appliedWalletDiscountAmount must be 0");
    assert.strictEqual(domMocks['checkout-total'].textContent, '₹349', "Full total of ₹349 must be required without double-spend discount");

    // Verify attempting to toggle fails and triggers toast notification
    toastMessages = [];
    context.handleToggleUseWallet(true);
    assert.strictEqual(cb.checked, false, "Checkbox must remain false after attempted toggle");
    assert.strictEqual(cb.disabled, true, "Checkbox must remain disabled after attempted toggle");
    assert(toastMessages.some(m => m.includes('locked in active Order #1')), "Must show toast explaining funds are locked in active Order #1");
});

test('7. Subsequent order submission strictly rejects any wallet discount while hold is active', () => {
    // Maliciously set isWalletRedemptionSelected = true
    context.isWalletRedemptionSelected = true;
    context.appliedWalletDiscountAmount = 66;

    context.executeOrderPlacement(context.getSavedDeliveryProfile(), 'Cash on Delivery', 'Cash on Delivery', '2', false);

    const orders = safeStorageMock.getJSON('perfettoCustomerOrders', []);
    const order2 = orders.find(o => o.orderId === '2');
    assert(order2, "Order #2 must be recorded");
    assert.strictEqual(order2.walletDiscount, 0, "Order #2 must have ₹0 wallet discount");
    assert.strictEqual(order2.usedWalletCash, 0, "Order #2 must have ₹0 used wallet cash");
    assert.strictEqual(order2.total, 349, "Order #2 total must be full price ₹349");
});

console.log(`\nALL ${passCount} TESTS PASSED SUCCESSFULLY!`);
