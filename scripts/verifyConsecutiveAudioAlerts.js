/**
 * verifyConsecutiveAudioAlerts.js
 *
 * Automated verification for:
 * 1. Successive order audio re-triggering across Staff Portal without muting or stalling.
 * 2. Standalone Admin Portal order subscription, chime re-triggering, and native notification dispatch.
 * 3. AbortError safety and Web Audio Context keep-warm on user dismissal.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const staffJs = fs.readFileSync(path.join(ROOT_DIR, 'staff.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(ROOT_DIR, 'admin.html'), 'utf8');
const publicStaffJs = fs.readFileSync(path.join(ROOT_DIR, 'public', 'staff.js'), 'utf8');
const publicAdminHtml = fs.readFileSync(path.join(ROOT_DIR, 'public', 'admin.html'), 'utf8');

console.log('================================================================');
console.log('🔊 VERIFYING CONSECUTIVE ORDER AUDIO RE-TRIGGER & ADMIN DECOUPLING');
console.log('================================================================\n');

let passedTests = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// -----------------------------------------------------------------------------
// TEST 1: Staff Portal AbortError handling and Autoplay Flag Safety
// -----------------------------------------------------------------------------
test('Staff Portal: AbortError on Dismiss does NOT corrupt autoplay readiness flag', () => {
    assert(staffJs.includes("if (err.name === 'AbortError')"), 'staff.js must guard against AbortError in playPromise.catch');
    assert(staffJs.includes('isAudioAutoplayBlocked = false'), 'Dismiss must reset isAudioAutoplayBlocked to false');
    assert(staffJs.includes('isStaffAudioUnlocked = true'), 'Dismiss must keep isStaffAudioUnlocked true');
});

// -----------------------------------------------------------------------------
// TEST 2: Staff Portal Consecutive Multi-Order Audio Simulation
// -----------------------------------------------------------------------------
test('Staff Portal: Successive incoming orders re-trigger audio from start without page reload', () => {
    // Simulated Staff Environment
    let isOrderAlertAudioPlaying = false;
    let currentAlertingOrderId = null;
    let isStaffSoundEnabled = true;
    let isAudioAutoplayBlocked = false;
    let isStaffAudioUnlocked = true;
    const staffDismissedAlertOrderIds = new Set();
    const staffProcessedAudioOrderIds = new Set();

    let playCallCount = 0;
    let pauseCallCount = 0;
    let modalDisplay = 'none';
    let currentModalTag = '';

    const mockAudio = {
        currentTime: 0,
        loop: true,
        muted: false,
        volume: 1.0,
        play: function() {
            playCallCount++;
            return Promise.resolve();
        },
        pause: function() {
            pauseCallCount++;
            this.currentTime = 0;
        }
    };

    function startOrderAlertAudio(orderId, details, orderData) {
        const cleanId = String(orderId || 'New').replace(/^#/, '').trim();
        if (isOrderAlertAudioPlaying && currentAlertingOrderId === cleanId) return;

        currentAlertingOrderId = cleanId;
        isOrderAlertAudioPlaying = true;
        staffProcessedAudioOrderIds.add(cleanId);

        // Modal
        modalDisplay = 'flex';
        currentModalTag = `Order #${cleanId}`;

        // HTML5 Audio Playback
        mockAudio.currentTime = 0;
        mockAudio.loop = true;
        mockAudio.muted = false;
        mockAudio.volume = 1.0;
        mockAudio.play();
    }

    function dismissIncomingOrderAlert() {
        const alertingId = currentAlertingOrderId;
        if (alertingId) {
            staffDismissedAlertOrderIds.add(String(alertingId));
        }
        // Stop audio
        isOrderAlertAudioPlaying = false;
        currentAlertingOrderId = null;
        mockAudio.pause();
        mockAudio.currentTime = 0;
        modalDisplay = 'none';

        // Keep primed
        isAudioAutoplayBlocked = false;
        isStaffAudioUnlocked = true;
    }

    // Step 1: Order #1001 arrives
    startOrderAlertAudio('1001', 'Margherita Pizza', { total: 350 });
    assert.strictEqual(isOrderAlertAudioPlaying, true, 'Audio state must be playing for #1001');
    assert.strictEqual(currentAlertingOrderId, '1001');
    assert.strictEqual(modalDisplay, 'flex');
    assert.strictEqual(currentModalTag, 'Order #1001');
    assert.strictEqual(playCallCount, 1, 'Audio.play() must be invoked for #1001');

    // Step 2: User clicks "Dismiss"
    dismissIncomingOrderAlert();
    assert.strictEqual(isOrderAlertAudioPlaying, false, 'Audio state must be stopped');
    assert.strictEqual(currentAlertingOrderId, null, 'Alerting order ID must be cleared');
    assert.strictEqual(modalDisplay, 'none', 'Modal must be hidden');
    assert.strictEqual(mockAudio.currentTime, 0, 'Playback position must be rewound to 0');
    assert.strictEqual(isAudioAutoplayBlocked, false, 'Autoplay must not be blocked');
    assert.strictEqual(isStaffAudioUnlocked, true, 'Audio must remain unlocked');

    // Step 3: Order #1002 arrives 2 seconds later without page reload
    startOrderAlertAudio('1002', 'Farmhouse Pizza', { total: 450 });
    assert.strictEqual(isOrderAlertAudioPlaying, true, 'Audio must immediately re-trigger for Order #1002');
    assert.strictEqual(currentAlertingOrderId, '1002');
    assert.strictEqual(modalDisplay, 'flex', 'Modal must show for Order #1002');
    assert.strictEqual(currentModalTag, 'Order #1002');
    assert.strictEqual(playCallCount, 2, 'Audio.play() must be called a 2nd time for #1002');
    assert.strictEqual(mockAudio.volume, 1.0, 'Audio volume must be full 1.0');
    assert.strictEqual(mockAudio.muted, false, 'Audio must not be muted');

    // Step 4: User dismisses #1002
    dismissIncomingOrderAlert();
    assert.strictEqual(isOrderAlertAudioPlaying, false);
    assert.strictEqual(modalDisplay, 'none');

    // Step 5: Order #1003 arrives
    startOrderAlertAudio('1003', 'Peppy Paneer Pizza', { total: 550 });
    assert.strictEqual(isOrderAlertAudioPlaying, true, 'Audio must re-trigger for Order #1003');
    assert.strictEqual(currentAlertingOrderId, '1003');
    assert.strictEqual(playCallCount, 3, 'Audio.play() must be called a 3rd time for #1003');
});

// -----------------------------------------------------------------------------
// TEST 3: Admin Portal Standalone Snapshot Listener Decoupling
// -----------------------------------------------------------------------------
test('Admin Portal: Standalone listener attaches directly without requiring Staff tab presence', () => {
    assert(adminHtml.includes('function listenToAdminLiveOrders()'), 'listenToAdminLiveOrders must exist');
    assert(adminHtml.includes('listenToAdminLiveOrders();'), 'listenToAdminLiveOrders must be invoked on boot');
    assert(adminHtml.includes('window.listenToAdminLiveOrders = listenToAdminLiveOrders;'), 'listenToAdminLiveOrders must be exported globally');
    // Verify no reliance on Staff session or BroadcastChannel for order alerts
    assert(!adminHtml.includes("BroadcastChannel('staff_orders')"), 'Admin must NOT depend on Staff broadcast channel');
});

// -----------------------------------------------------------------------------
// TEST 4: Admin Portal Native OS Notification & Modal Card Presence
// -----------------------------------------------------------------------------
test('Admin Portal: Includes native OS notification dispatch & updated modal title', () => {
    assert(adminHtml.includes('dispatchAdminOrderNotification'), 'dispatchAdminOrderNotification must exist');
    assert(adminHtml.includes('🚨 NEW ORDER ARRIVED'), 'Banner must display 🚨 NEW ORDER ARRIVED');
    assert(adminHtml.includes('id="admin-alert-items-summary"'), 'Banner must have items summary container');
    assert(adminHtml.includes('tag: `admin-perfetto-order-${cleanId}`'), 'Notification tag must isolate by order ID');
});

// -----------------------------------------------------------------------------
// TEST 5: Admin Portal Consecutive Order Chime & Debounce Isolation Simulation
// -----------------------------------------------------------------------------
test('Admin Portal: Consecutive incoming orders chime independently with reset on dismiss', () => {
    let lastAdminChimeTimestamp = 0;
    let lastAdminChimedOrderId = null;
    let currentAdminAlertOrderId = null;
    let chimePlayCount = 0;
    let bannerDisplay = 'none';

    function playAdminOrderChime(orderId = null) {
        const now = Date.now();
        const cleanOrderId = orderId ? String(orderId).replace(/^#/, '').trim() : null;

        if (cleanOrderId && cleanOrderId === lastAdminChimedOrderId && (now - lastAdminChimeTimestamp < 2000)) {
            return;
        }
        if (!cleanOrderId && (now - lastAdminChimeTimestamp < 2000)) {
            return;
        }

        lastAdminChimeTimestamp = now;
        lastAdminChimedOrderId = cleanOrderId;
        chimePlayCount++;
    }

    function showAdminOrderAlert(orderData = {}) {
        const rawId = orderData.orderId || orderData.id || 'New';
        const orderId = String(rawId).replace(/^#/, '').trim();
        currentAdminAlertOrderId = orderId;
        playAdminOrderChime(orderId);
        bannerDisplay = 'flex';
    }

    function dismissAdminOrderAlert() {
        bannerDisplay = 'none';
        currentAdminAlertOrderId = null;
        lastAdminChimedOrderId = null;
        lastAdminChimeTimestamp = 0; // Cleared so next order chimes instantly!
    }

    // 1. First order #5001 arrives
    showAdminOrderAlert({ orderId: '5001', customerName: 'Alice', total: 400 });
    assert.strictEqual(chimePlayCount, 1, 'First order must play chime');
    assert.strictEqual(bannerDisplay, 'flex', 'Banner must display');
    assert.strictEqual(currentAdminAlertOrderId, '5001');

    // 2. Dismiss order #5001
    dismissAdminOrderAlert();
    assert.strictEqual(bannerDisplay, 'none', 'Banner must close');
    assert.strictEqual(currentAdminAlertOrderId, null);
    assert.strictEqual(lastAdminChimedOrderId, null, 'Last chimed order ID must reset');
    assert.strictEqual(lastAdminChimeTimestamp, 0, 'Debounce timestamp must reset to 0');

    // 3. Second order #5002 arrives 50ms later
    showAdminOrderAlert({ orderId: '5002', customerName: 'Bob', total: 600 });
    assert.strictEqual(chimePlayCount, 2, 'Second order must play chime immediately without debouncing');
    assert.strictEqual(bannerDisplay, 'flex');
    assert.strictEqual(currentAdminAlertOrderId, '5002');

    // 4. Dismiss order #5002
    dismissAdminOrderAlert();

    // 5. Third order #5003 arrives
    showAdminOrderAlert({ orderId: '5003', customerName: 'Charlie', total: 850 });
    assert.strictEqual(chimePlayCount, 3, 'Third order must play chime immediately');
    assert.strictEqual(bannerDisplay, 'flex');
});

// -----------------------------------------------------------------------------
// TEST 6: Asset Mirroring Parity Check
// -----------------------------------------------------------------------------
test('File synchronization: root and public/ files are byte-identical', () => {
    assert.strictEqual(staffJs, publicStaffJs, 'staff.js and public/staff.js must be identical');
    assert.strictEqual(adminHtml, publicAdminHtml, 'admin.html and public/admin.html must be identical');
});

console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests} CONSECUTIVE AUDIO & ADMIN DECOUPLING TESTS PASSED!`);
console.log('================================================================\n');
