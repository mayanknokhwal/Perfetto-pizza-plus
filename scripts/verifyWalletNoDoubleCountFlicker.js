const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('=== VERIFYING WALLET NO TRANSIENT DOUBLE-COUNT FLICKER (₹43 STABILITY) ===\n');

let passCount = 0;
async function test(name, fn) {
    try {
        await fn();
        console.log(`PASS: ${name}`);
        passCount++;
    } catch (err) {
        console.error(`FAIL: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

async function runVerification() {
    const appJs = fs.readFileSync('app.js', 'utf8');
    const publicAppJs = fs.readFileSync('public/app.js', 'utf8');

    // Test 1: Byte-for-byte synchronization
    await test('1. app.js and public/app.js are strictly identical', () => {
        assert.strictEqual(appJs, publicAppJs, "public/app.js must be byte-for-byte identical with app.js");
    });

    // Setup VM sandbox matching customer app environment
    const storageMap = new Map();
    const mockLocalStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, String(v)),
        removeItem: (k) => storageMap.delete(k),
        clear: () => storageMap.clear()
    };

    const domElements = new Map();
    function getOrCreateElement(id) {
        if (!domElements.has(id)) {
            domElements.set(id, {
                id,
                textContent: '',
                innerHTML: '',
                style: {},
                classList: {
                    add: () => {},
                    remove: () => {},
                    contains: () => false
                },
                setAttribute: () => {},
                appendChild: () => {}
            });
        }
        return domElements.get(id);
    }

    const context = {
        console,
        Date,
        Math,
        Number,
        String,
        Array,
        JSON,
        Set,
        Map,
        RegExp,
        localStorage: mockLocalStorage,
        window: {},
        document: {
            getElementById: (id) => getOrCreateElement(id),
            createElement: (tag) => ({ style: {}, classList: { add: () => {} }, appendChild: () => {} })
        },
        safeStorage: {
            getJSON: (k) => {
                try { return JSON.parse(mockLocalStorage.getItem(k)); } catch (e) { return null; }
            },
            setJSON: (k, v) => mockLocalStorage.setItem(k, JSON.stringify(v))
        },
        customerWalletConfig: { enabled: true, minCartValue: 200, validityDays: 7 },
        currentUserProfile: { phone: '9876543210', fullName: 'Perfetto Customer' },
        activeScratchOrder: null,
        cart: [],
        showToast: () => {},
        formatPrice: (amt) => `₹${amt}`,
        getClampedCashbackExpiryDays: () => 7
    };
    context.window = context;
    vm.createContext(context);

    // Extract relevant wallet controller code from app.js
    vm.runInContext(`
    ${appJs.slice(appJs.indexOf('function parseTimestampMs'), appJs.indexOf('window.parseTimestampMs = parseTimestampMs;'))}
    window.parseTimestampMs = parseTimestampMs;

    this.currentCustomerWallet = null;

    ${appJs.slice(appJs.indexOf('function reconcileWalletTranches'), appJs.indexOf('window.reconcileWalletTranches = reconcileWalletTranches;'))}
    window.reconcileWalletTranches = reconcileWalletTranches;

    ${appJs.slice(appJs.indexOf('function getActiveCreditTranches'), appJs.indexOf('window.getActiveCreditTranches = getActiveCreditTranches;'))}
    window.getActiveCreditTranches = getActiveCreditTranches;

    ${appJs.slice(appJs.indexOf('function getEffectiveWalletBalance'), appJs.indexOf('window.getEffectiveWalletBalance = getEffectiveWalletBalance;'))}
    window.getEffectiveWalletBalance = getEffectiveWalletBalance;

    ${appJs.slice(appJs.indexOf('function isOrderRewardAlreadyCredited'), appJs.indexOf('window.isOrderRewardAlreadyCredited = isOrderRewardAlreadyCredited;'))}
    window.isOrderRewardAlreadyCredited = isOrderRewardAlreadyCredited;

    ${appJs.slice(appJs.indexOf('async function creditCustomerWallet'), appJs.indexOf('window.creditCustomerWallet = creditCustomerWallet;'))}
    window.creditCustomerWallet = creditCustomerWallet;
    `, context);

    // Test 2: Initial authoritative wallet balance calculation is exactly ₹43 (Order #1 ₹15 + Order #2 ₹28)
    await test('2. Authoritative initial wallet balance calculation is strictly ₹43', () => {
        const now = Date.now();
        const mockWallet = {
            phone: '9876543210',
            balance: 43,
            nonExpiredBalance: 43,
            transactions: [
                {
                    id: 'tx_order_2',
                    type: 'CASHBACK_EARNED',
                    amount: 28,
                    initialAmount: 28,
                    remainingAmount: 28,
                    orderId: '2',
                    description: 'credited +₹28 for Order #2',
                    createdAt: new Date(now - 100000).toISOString(),
                    expiresAt: new Date(now + 7 * 86400000).toISOString(),
                    status: 'active'
                },
                {
                    id: 'tx_order_1',
                    type: 'credit',
                    amount: 15,
                    initialAmount: 15,
                    remainingAmount: 15,
                    orderId: '1',
                    description: 'credited +₹15 for Order #1',
                    createdAt: new Date(now - 200000).toISOString(),
                    expiresAt: new Date(now + 7 * 86400000).toISOString(),
                    status: 'active'
                }
            ]
        };

        context.currentCustomerWallet = mockWallet;
        const balance = context.getEffectiveWalletBalance();
        assert.strictEqual(balance, 43, `Initial balance must be exactly 43, got ${balance}`);
    });

    // Test 3: isOrderRewardAlreadyCredited detects committed reward across orderId variations (#2 vs 2, descriptions)
    await test('3. isOrderRewardAlreadyCredited identifies already credited order reward', () => {
        const isCreditedNum = context.isOrderRewardAlreadyCredited('2');
        assert.strictEqual(isCreditedNum, true, "Order ID '2' should be identified as already credited in wallet");

        const isCreditedHash = context.isOrderRewardAlreadyCredited('#2');
        assert.strictEqual(isCreditedHash, true, "Order ID '#2' should be identified as already credited in wallet");

        const isCreditedOrder1 = context.isOrderRewardAlreadyCredited('1');
        assert.strictEqual(isCreditedOrder1, true, "Order ID '1' should be identified as already credited in wallet");

        const isCreditedOrder3 = context.isOrderRewardAlreadyCredited('3');
        assert.strictEqual(isCreditedOrder3, false, "Uncredited Order ID '3' should return false");

        // Also check with order document status flags
        const mockOrderWithFlags = { id: '3', orderId: '3', rewardStatus: 'credited' };
        assert.strictEqual(context.isOrderRewardAlreadyCredited('3', mockOrderWithFlags), true, "Order with rewardStatus 'credited' must return true");
    });

    // Test 4: creditCustomerWallet aborts immediately for already credited order without modifying transactions
    await test('4. creditCustomerWallet skips duplicate credit and preserves balance at ₹43', async () => {
        const prevTxCount = context.currentCustomerWallet.transactions.length;
        
        // Attempt duplicate credit for Order #2
        await context.creditCustomerWallet('9876543210', 28, '2');

        assert.strictEqual(context.currentCustomerWallet.transactions.length, prevTxCount, "Transaction count must not increase on duplicate credit");
        const balAfter = context.getEffectiveWalletBalance();
        assert.strictEqual(balAfter, 43, `Balance must remain strictly 43, got ${balAfter} (should NOT double-count to 71)`);
    });

    // Test 5: reconcileWalletTranches deduplicates redundant credit tranches for the same orderId
    await test('5. reconcileWalletTranches deduplicates duplicate credit tranches preventing ₹71 flash', () => {
        const now = Date.now();
        const pollutedWallet = {
            balance: 71, // Artificially inflated
            transactions: [
                // Duplicate 1 of Order #2
                {
                    id: 'tx_order_2_dup',
                    type: 'credit',
                    amount: 28,
                    initialAmount: 28,
                    orderId: '2',
                    createdAt: new Date(now - 50000).toISOString(),
                    expiresAt: new Date(now + 7 * 86400000).toISOString(),
                    status: 'active'
                },
                // Duplicate 2 of Order #2
                {
                    id: 'tx_order_2',
                    type: 'CASHBACK_EARNED',
                    amount: 28,
                    initialAmount: 28,
                    orderId: '#2',
                    createdAt: new Date(now - 100000).toISOString(),
                    expiresAt: new Date(now + 7 * 86400000).toISOString(),
                    status: 'active'
                },
                // Order #1
                {
                    id: 'tx_order_1',
                    type: 'credit',
                    amount: 15,
                    initialAmount: 15,
                    orderId: '1',
                    createdAt: new Date(now - 200000).toISOString(),
                    expiresAt: new Date(now + 7 * 86400000).toISOString(),
                    status: 'active'
                }
            ]
        };

        context.currentCustomerWallet = pollutedWallet;
        const reconciled = context.reconcileWalletTranches(pollutedWallet);
        assert.strictEqual(reconciled, 43, `Reconciled balance must deduplicate Order #2 and return 43, got ${reconciled}`);
        assert.strictEqual(pollutedWallet.balance, 43, "pollutedWallet.balance must be corrected to 43");
    });

    // Test 6: getActiveCreditTranches deduplicates tranches and preserves active unexpired tranches
    await test('6. getActiveCreditTranches yields deduplicated active credit tranches', () => {
        const tranches = context.getActiveCreditTranches();
        assert.strictEqual(tranches.length, 2, `Expected exactly 2 distinct active tranches (Order #1 and #2), got ${tranches.length}`);
        const sum = tranches.reduce((acc, t) => acc + (t.remainingAmount || t.initialAmount || t.amount), 0);
        assert.strictEqual(sum, 43, `Active tranches sum must be exactly 43, got ${sum}`);
    });

    console.log(`\nALL ${passCount} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
}

runVerification();
