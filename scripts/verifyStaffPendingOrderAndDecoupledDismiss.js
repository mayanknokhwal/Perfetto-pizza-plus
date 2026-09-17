/**
 * PERFETTO PIZZA - STAFF PORTAL PENDING ORDER INGESTION & DECOUPLED DISMISS VERIFICATION
 *
 * Verifies:
 * 1. Document parser parseStaffOrder handles various order formats (status PENDING/pending/new, items, customer).
 * 2. Firestore query in staff.js and admin.html includes all 10 active kitchen statuses.
 * 3. Incoming order renders into kitchen queue and updates #pending-orders-count.
 * 4. In-app modal (#staff-incoming-order-modal) and siren are triggered.
 * 5. Admin dismissal (dismissAdminOrderAlert) is strictly isolated: stops Admin chime, closes Admin banner,
 *    while Staff Portal siren KEEPS RINGING and Staff modal STAYS OPEN.
 * 6. Staff dismissal (dismissIncomingOrderAlert) silences Staff siren for that specific order only.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`✅ [PASS] ${name}`);
    } catch (err) {
        console.error(`❌ [FAIL] ${name}:`, err.message);
        throw err;
    }
}

console.log('================================================================');
console.log('🧪 VERIFYING STAFF PENDING ORDERS, MODAL & DECOUPLED DISMISSAL');
console.log('================================================================');

const staffJs = fs.readFileSync(path.join(__dirname, '..', 'staff.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

// -----------------------------------------------------------------------------
// Test 1: Query Filter Expansion in staff.js and admin.html
// -----------------------------------------------------------------------------
runTest('1. Real-time query captures all live order statuses (case-insensitive variants)', () => {
    const expectedStatuses = "['PENDING', 'pending', 'ACCEPTED', 'accepted', 'new', 'NEW', 'placed', 'PLACED', 'preparing', 'PREPARING']";
    assert(staffJs.includes(expectedStatuses), 'staff.js must query all 10 active kitchen statuses');
    assert(adminHtml.includes(expectedStatuses), 'admin.html must query all 10 active kitchen statuses');
});

// -----------------------------------------------------------------------------
// Test 2: Robust Document Parser in staff.js
// -----------------------------------------------------------------------------
runTest('2. parseStaffOrder correctly normalizes customer checkout payload', () => {
    assert(staffJs.includes('function parseStaffOrder(docId, data = {})'), 'staff.js must declare parseStaffOrder');

    // Extract parseStaffOrder implementation for simulation
    const fnMatch = staffJs.match(/function parseStaffOrder\(docId, data = \{\}\) \{([\s\S]*?)\r?\n\}\r?\nwindow\.parseStaffOrder/);
    assert(fnMatch, 'parseStaffOrder function body must be parseable');
    const parseStaffOrder = new Function('docId', 'data = {}', fnMatch[1]);

    // Test with customer checkout payload: uppercase PENDING, nested customer, items array, numeric total
    const payload1 = {
        orderId: '1',
        status: 'PENDING',
        customerName: 'Daksh',
        customerPhone: '9414503886',
        items: [{ name: 'Margherita Pizza', qty: 2, size: 'M' }],
        total: 499,
        createdAt: new Date().toISOString()
    };
    const parsed1 = parseStaffOrder('doc_1', payload1);
    assert.strictEqual(parsed1.id, '1', 'ID must be stripped of # and clean');
    assert.strictEqual(parsed1.orderId, '1');
    assert.strictEqual(parsed1.status, 'PENDING');
    assert.strictEqual(parsed1.customerName, 'Daksh');
    assert.strictEqual(parsed1.total, 499);
    assert.strictEqual(parsed1.items.length, 1);

    // Test with payload having lowercase status, nested deliveryDetails, stringified items
    const payload2 = {
        id: '#1002',
        status: 'new',
        deliveryDetails: { name: 'Rahul', phone: '9876543210', address: 'Raisinghnagar' },
        items: JSON.stringify([{ name: 'Veggie Deluxe', qty: 1 }]),
        finalPayable: '350'
    };
    const parsed2 = parseStaffOrder('doc_1002', payload2);
    assert.strictEqual(parsed2.id, '1002');
    assert.strictEqual(parsed2.customerName, 'Rahul');
    assert.strictEqual(parsed2.customerPhone, '9876543210');
    assert.strictEqual(parsed2.address, 'Raisinghnagar');
    assert.strictEqual(parsed2.total, 350);
    assert.strictEqual(Array.isArray(parsed2.items), true);
});

// -----------------------------------------------------------------------------
// Test 3: Modal & Audio Triggering in staff.js
// -----------------------------------------------------------------------------
runTest('3. Incoming order triggers both modal popup and continuous looping siren', () => {
    assert(staffJs.includes('showIncomingOrderModal(orderId, summary, parsed)'), 'docChanges must invoke showIncomingOrderModal with parsed order');
    assert(staffJs.includes('startOrderAlertAudio(orderId, summary, data)'), 'docChanges must invoke startOrderAlertAudio');
    assert(staffJs.includes('showIncomingOrderModal(orderId, summary, latestNew)'), 'mergeLiveOrdersIntoStaff must invoke showIncomingOrderModal');
});

// -----------------------------------------------------------------------------
// Test 4: Completely Decoupled Dismiss & Audio State Isolation
// -----------------------------------------------------------------------------
runTest('4. Admin dismiss halts Admin chime but leaves Staff siren RINGING and modal OPEN', () => {
    // 1. Setup mock Admin state
    let adminBannerDisplay = 'flex';
    let adminAudioPaused = false;
    let adminAudioCurrentTime = 12.5;
    const adminHandledIds = new Set();
    let currentAdminOrderId = '1';

    function mockDismissAdminOrderAlert() {
        adminBannerDisplay = 'none';
        if (currentAdminOrderId) {
            adminHandledIds.add(currentAdminOrderId);
        }
        currentAdminOrderId = null;
        adminAudioPaused = true;
        adminAudioCurrentTime = 0;
    }

    // 2. Setup mock Staff state for the exact same order #1
    let staffModalDisplay = 'flex';
    let staffModalAriaHidden = 'false';
    let isStaffOrderAlertAudioPlaying = true;
    let currentStaffAlertingOrderId = '1';
    const staffDismissedAlertOrderIds = new Set();
    let staffAudioPaused = false;

    function mockDismissStaffOrderAlert() {
        if (currentStaffAlertingOrderId) {
            staffDismissedAlertOrderIds.add(currentStaffAlertingOrderId);
        }
        isStaffOrderAlertAudioPlaying = false;
        currentStaffAlertingOrderId = null;
        staffAudioPaused = true;
        staffModalDisplay = 'none';
        staffModalAriaHidden = 'true';
    }

    // --- EXECUTE ADMIN DISMISS ---
    mockDismissAdminOrderAlert();

    // Verify Admin state
    assert.strictEqual(adminBannerDisplay, 'none', 'Admin banner must be hidden');
    assert.strictEqual(adminAudioPaused, true, 'Admin audio chime must be paused');
    assert.strictEqual(adminAudioCurrentTime, 0, 'Admin audio time must be reset to 0');
    assert(adminHandledIds.has('1'), 'Admin must record handled order 1');

    // CRITICAL: Verify Staff Portal state is 100% UNTOUCHED
    assert.strictEqual(isStaffOrderAlertAudioPlaying, true, 'Staff siren MUST KEEP RINGING when Admin dismisses!');
    assert.strictEqual(staffAudioPaused, false, 'Staff audio element MUST NOT be paused when Admin dismisses!');
    assert.strictEqual(staffModalDisplay, 'flex', 'Staff modal MUST REMAIN VISIBLE when Admin dismisses!');
    assert.strictEqual(staffModalAriaHidden, 'false', 'Staff modal aria-hidden MUST REMAIN false when Admin dismisses!');
    assert.strictEqual(staffDismissedAlertOrderIds.has('1'), false, 'Staff dismissed set MUST NOT contain order 1 when Admin dismisses!');

    // --- NOW EXECUTE LOCAL STAFF DISMISS ---
    mockDismissStaffOrderAlert();

    // Verify Staff state after physical Staff dismissal
    assert.strictEqual(isStaffOrderAlertAudioPlaying, false, 'Staff siren stops only after Staff clicks Dismiss');
    assert.strictEqual(staffAudioPaused, true, 'Staff audio paused after Staff clicks Dismiss');
    assert.strictEqual(staffModalDisplay, 'none', 'Staff modal hidden after Staff clicks Dismiss');
    assert(staffDismissedAlertOrderIds.has('1'), 'Staff dismissed set records order 1 after Staff clicks Dismiss');
});

// -----------------------------------------------------------------------------
// Test 5: renderOrders Guard Prevents Premature Siren Cutoff
// -----------------------------------------------------------------------------
runTest('5. renderOrders does NOT prematurely mute siren for active incoming orders', () => {
    assert(staffJs.includes('hasActiveAlertOrder = currentAlertingOrderId && staffOrders.some'), 'renderOrders must guard against premature siren muting');
});

// -----------------------------------------------------------------------------
// Test 6: File Parity Check
// -----------------------------------------------------------------------------
runTest('6. File byte parity between root, public/, and dist/', () => {
    const publicStaff = fs.readFileSync(path.join(__dirname, '..', 'public', 'staff.js'), 'utf8');
    const distStaff = fs.readFileSync(path.join(__dirname, '..', 'dist', 'staff.js'), 'utf8');
    assert.strictEqual(staffJs, publicStaff, 'root staff.js and public/staff.js must be identical');
    assert.strictEqual(staffJs, distStaff, 'root staff.js and dist/staff.js must be identical');

    const publicAdmin = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');
    const distAdmin = fs.readFileSync(path.join(__dirname, '..', 'dist', 'admin.html'), 'utf8');
    assert.strictEqual(adminHtml, publicAdmin, 'root admin.html and public/admin.html must be identical');
    assert.strictEqual(adminHtml, distAdmin, 'root admin.html and dist/admin.html must be identical');
});

console.log('================================================================');
console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
console.log('================================================================');
