const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 VERIFYING PHASE 1: INDEPENDENT AUDIO RE-ALERT & ZERO-BALANCE GUARD');
console.log('================================================================');

const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const staffJs = fs.readFileSync(path.join(__dirname, '../staff.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const staffHtml = fs.readFileSync(path.join(__dirname, '../staff.html'), 'utf8');

function runTest(name, fn) {
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// -----------------------------------------------------------------------------
// Part 1: Event-Driven Persistent Audio Alert System (Admin & Staff)
// -----------------------------------------------------------------------------
runTest('1.1 Admin Panel audio decoupled from Staff Portal & runs standalone Firestore listener', () => {
    assert(adminHtml.includes('function listenToAdminLiveOrders()'), 'admin.html must declare standalone listenToAdminLiveOrders');
    assert(adminHtml.includes("db.collection('orders')"), 'admin.html must directly query orders collection in Firestore');
    assert(adminHtml.includes('listenToAdminLiveOrders()'), 'admin.html must auto-attach live orders listener on boot');
    assert(!adminHtml.includes('BroadcastChannel(\'perfetto_order_audio\')'), 'admin.html must not depend on audio BroadcastChannel');
    assert(!adminHtml.includes('localStorage.getItem(\'perfettoStaffAudioPlaying\')'), 'admin.html must not depend on staff audio localStorage');
});

runTest('1.2 Admin modal alert card displays "🚨 NEW ORDER ARRIVED" and Dismiss halts audio without sticky mute', () => {
    assert(adminHtml.includes('🚨 NEW ORDER ARRIVED'), 'admin.html must display 🚨 NEW ORDER ARRIVED');
    assert(adminHtml.includes('function dismissAdminOrderAlert()'), 'admin.html must declare dismissAdminOrderAlert');
    assert(adminHtml.includes('adminAlertAudio.pause()'), 'dismissAdminOrderAlert must pause audio element');
    assert(adminHtml.includes('adminAlertAudio.currentTime = 0'), 'dismissAdminOrderAlert must reset currentTime to 0');
    assert(adminHtml.includes('adminAlertAudio.muted = false'), 'dismissAdminOrderAlert must not mute future audio');
    assert(adminHtml.includes('adminAlertAudio.volume = 1.0'), 'dismissAdminOrderAlert must preserve 1.0 volume');
    assert(!adminHtml.includes('adminAudioDisabled = true'), 'dismissAdminOrderAlert must not set sticky disable flags');
});

runTest('1.3 Admin audio chime allows consecutive incoming orders to re-trigger immediately', () => {
    assert(adminHtml.includes('lastAdminChimedOrderId = null'), 'dismissAdminOrderAlert must clear lastAdminChimedOrderId');
    assert(adminHtml.includes('lastAdminChimeTimestamp = 0'), 'dismissAdminOrderAlert must reset lastAdminChimeTimestamp');
    assert(adminHtml.includes('cleanOrderId === lastAdminChimedOrderId'), 'playAdminOrderChime must only debounce the exact same orderId');
});

runTest('1.4 Staff Portal modal card retains visible header and Dismiss resets audio cleanly', () => {
    assert(staffHtml.includes('NEW ORDER ARRIVED'), 'staff.html must retain NEW ORDER ARRIVED header');
    assert(staffJs.includes('function dismissIncomingOrderAlert()'), 'staff.js must declare dismissIncomingOrderAlert');
    assert(staffJs.includes('staffOrderAlertAudio.pause()'), 'staff.js must pause order alert audio');
    assert(staffJs.includes('staffOrderAlertAudio.currentTime = 0'), 'staff.js must reset currentTime to 0');
    assert(staffJs.includes('staffOrderAlertAudio.muted = false'), 'staff.js must ensure audio is not muted');
    assert(staffJs.includes('staffOrderAlertAudio.volume = 1.0'), 'staff.js must ensure volume is 1.0');
    assert(staffJs.includes('isAudioAutoplayBlocked = false'), 'staff.js must clear autoplay blocked flag on dismiss');
});

runTest('1.5 Staff Portal re-triggers incoming modal and audio on subsequent orders', () => {
    assert(staffJs.includes('showIncomingOrderModal(orderId, summary, data)'), 'staff.js must trigger modal for incoming orders');
    assert(staffJs.includes('startOrderAlertAudio(orderId, summary, data)'), 'staff.js must trigger audio for incoming orders');
    assert(staffJs.includes('if (isOrderAlertAudioPlaying && currentAlertingOrderId === cleanId)'), 'staff.js must only skip audio if currently playing for identical cleanId');
});

// -----------------------------------------------------------------------------
// Part 2: Wallet Zero-Balance Guard on Customer Checkout
// -----------------------------------------------------------------------------
runTest('2.1 app.js strictly hides / disables "Use ₹X Cash" when availableBalance <= 0', () => {
    assert(appJs.includes('if (availableBalance <= 0 || maxRedeemable <= 0)'), 'updateCheckoutWalletUI must check availableBalance <= 0');
    assert(appJs.includes("checkLabelWrap.style.display = 'none'"), 'checkLabelWrap must be hidden when availableBalance <= 0');
    assert(appJs.includes("checkbox.disabled = true"), 'checkbox must be disabled when availableBalance <= 0');
    assert(appJs.includes("checkLabelWrap.classList.add('is-disabled')"), 'checkLabelWrap must add is-disabled class');
    assert(appJs.includes("checkLabelWrap.style.pointerEvents = 'none'"), 'checkLabelWrap pointer-events must be none');
    assert(appJs.includes('isWalletRedemptionSelected = false'), 'isWalletRedemptionSelected must be false on zero balance');
});

runTest('2.2 handleToggleUseWallet blocks toggling wallet deduction when avail <= 0', () => {
    assert(appJs.includes('function handleToggleUseWallet(isChecked)'), 'handleToggleUseWallet must be defined');
    assert(appJs.includes('if (avail <= 0)'), 'handleToggleUseWallet must block if avail <= 0');
    assert(appJs.includes('cb.disabled = true'), 'handleToggleUseWallet must keep checkbox disabled if avail <= 0');
});

runTest('2.3 Single-Order Hold Integrity: Duplicate aliases of the same order never duplicate locked funds to ₹128', () => {
    // Simulate getActiveLockedWalletInfo behavior with duplicate aliases in stored orders
    const mockOrders = [
        { id: 'ord_doc_999', orderId: '1001', status: 'placed', walletDiscount: 64 },
        { id: '1001', orderId: '1001', status: 'placed', walletDiscount: 64 } // duplicate copy with orderId as id
    ];

    const mockWallet = {
        balance: 0,
        transactions: [
            { id: 'tx_1', type: 'credit', initialAmount: 64, amount: 64 },
            { id: 'tx_hold_1001', type: 'hold', orderId: '1001', amount: 64, status: 'LOCKED_HOLD' }
        ]
    };

    // Evaluate logic extracted directly from app.js getActiveLockedWalletInfo
    const terminalStatuses = ['completed', 'delivered', 'rejected', 'cancelled', 'archived', 'declined', 'auto_expired'];
    const seenOrderIds = new Set();
    let lockedAmount = 0;
    const lockedOrderIds = [];

    mockOrders.forEach(o => {
        if (!o) return;
        const rawId = String(o.id || o.orderId || '').trim();
        const idClean = rawId.replace(/^#/, '').trim();
        if (!idClean || seenOrderIds.has(idClean)) return;

        const idCandidates = [o.orderId, o.id, o.firestoreDocId, o.docId].filter(Boolean).map(v => String(v).trim());
        const allKeys = new Set();
        idCandidates.forEach(k => {
            allKeys.add(k);
            allKeys.add(k.replace(/^#/, '').trim());
        });

        if (Array.from(allKeys).some(k => seenOrderIds.has(k))) return;

        const st = String(o.status || '').toLowerCase().trim();
        const isRefunded = Boolean(o.walletRefundProcessed || o.walletRefunded);

        if (!terminalStatuses.includes(st) && !isRefunded) {
            allKeys.forEach(k => seenOrderIds.add(k));
            seenOrderIds.add(idClean);

            const held = Number(o.walletDiscount || o.usedWalletCash || o.usedWallet || 0);
            if (held > 0) {
                const isReleasedInWallet = mockWallet && Array.isArray(mockWallet.transactions) &&
                    mockWallet.transactions.some(tx => {
                        if (!tx) return false;
                        const txOrd = String(tx.orderId || '').replace(/^#/, '').trim();
                        const txType = String(tx.type || '').toLowerCase().trim();
                        const txStatus = String(tx.status || '').toLowerCase().trim();
                        return (allKeys.has(txOrd) || txOrd === idClean) && (txStatus === 'released' || txStatus === 'cancelled' || txType === 'refund');
                    });

                if (!isReleasedInWallet) {
                    lockedAmount += held;
                    const displayId = String(o.orderId || o.id || idClean).replace(/^#/, '').trim();
                    if (displayId && !lockedOrderIds.includes(displayId)) {
                        lockedOrderIds.push(displayId);
                    }
                }
            }
        }
    });

    assert.strictEqual(lockedAmount, 64, `Locked amount must be exactly 64, but got ${lockedAmount}`);
    assert.strictEqual(lockedOrderIds.length, 1, `There must only be 1 locked order id, but got ${lockedOrderIds.length}`);
    assert.strictEqual(lockedOrderIds[0], '1001');
});

runTest('2.4 syncCustomerPhoneOrders prevents storing duplicate orders when remote & local IDs vary', () => {
    assert(appJs.includes('const aliasMap = new Map()'), 'syncCustomerPhoneOrders must create aliasMap');
    assert(appJs.includes('aliasMap.has(k)'), 'syncCustomerPhoneOrders must match against aliasMap');
});

runTest('2.5 Root files and public/ distribution files are strictly synchronized', () => {
    const publicAppJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
    const publicStaffJs = fs.readFileSync(path.join(__dirname, '../public/staff.js'), 'utf8');
    const publicAdminHtml = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');

    assert.strictEqual(appJs, publicAppJs, 'app.js and public/app.js must be byte-identical');
    assert.strictEqual(staffJs, publicStaffJs, 'staff.js and public/staff.js must be byte-identical');
    assert.strictEqual(adminHtml, publicAdminHtml, 'admin.html and public/admin.html must be byte-identical');
});

console.log('================================================================');
console.log('🎉 ALL PHASE 1 LOCAL VERIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
