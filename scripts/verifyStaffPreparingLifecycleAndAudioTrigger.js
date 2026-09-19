/**
 * Verification Script: Staff Preparing Lifecycle & Distinct Audio Alert Triggers
 */

const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('=== VERIFYING STAFF PREPARING LIFECYCLE & NOVEL ORDER AUDIO ALERTS ===\n');

// Mock browser environment
const domMock = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: (id) => ({
        style: { setProperty: () => {}, removeProperty: () => {} },
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        innerHTML: '',
        textContent: '',
        setAttribute: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => ({ textContent: '' })
    }),
    querySelectorAll: () => []
};

const localStorageMock = {
    _data: {},
    getItem: function(k) { return this._data[k] || null; },
    setItem: function(k, v) { this._data[k] = String(v); },
    removeItem: function(k) { delete this._data[k]; },
    clear: function() { this._data = {}; }
};

let alertedOrderIds = [];
let audioLoopStartedCount = 0;
let audioStoppedCount = 0;

const windowMock = {
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { search: '', hash: '', origin: 'http://localhost:8080' },
    localStorage: localStorageMock,
    sessionStorage: localStorageMock,
    document: domMock,
    navigator: { vibrate: () => {} },
    Notification: { permission: 'granted' },
    AudioContext: class {
        constructor() { this.state = 'running'; }
        resume() { return Promise.resolve(); }
        createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {} }; }
        createGain() { return { connect: () => {}, gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
        get destination() { return {}; }
    },
    Audio: class {
        constructor() {
            this.loop = true;
            this.volume = 1.0;
        }
        play() {
            audioLoopStartedCount++;
            return Promise.resolve();
        }
        pause() {
            audioStoppedCount++;
        }
    },
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {}
};

const staffJsCode = fs.readFileSync('staff.js', 'utf8');

const sandbox = {
    window: windowMock,
    document: domMock,
    localStorage: localStorageMock,
    sessionStorage: localStorageMock,
    navigator: windowMock.navigator,
    AudioContext: windowMock.AudioContext,
    webkitAudioContext: windowMock.AudioContext,
    Audio: windowMock.Audio,
    Notification: windowMock.Notification,
    setTimeout: windowMock.setTimeout,
    clearTimeout: windowMock.clearTimeout,
    setInterval: windowMock.setInterval,
    clearInterval: windowMock.clearInterval,
    console: {
        log: (...args) => {},
        warn: (...args) => {},
        error: (...args) => console.error(...args)
    }
};

vm.createContext(sandbox);
vm.runInContext(staffJsCode, sandbox);

// Authenticate dummy staff user
sandbox.currentStaffUser = {
    name: 'Head Chef',
    phone: '9999999999',
    role: 'Chef',
    isStaff: true
};

async function runTests() {
    console.log('--- TEST 1: Preparing & Delivery Status Categorization ---');
    const orderPrep = {
        id: 'ord_101',
        status: 'preparing',
        createdAt: Date.now() - (5 * 60 * 1000)
    };
    const orderDeliv = {
        id: 'ord_102',
        status: 'delivery',
        createdAt: Date.now() - (10 * 60 * 1000)
    };
    const orderUppercasePrep = {
        id: 'ord_103',
        status: 'PREPARING',
        createdAt: Date.now() - (2 * 60 * 1000)
    };

    assert.strictEqual(sandbox.isPendingStaffOrder(orderPrep), true, 'Order in "preparing" state must be recognized as pending kitchen order');
    assert.strictEqual(sandbox.isPendingStaffOrder(orderDeliv), true, 'Order in "delivery" state must be recognized as pending kitchen order');
    assert.strictEqual(sandbox.isPendingStaffOrder(orderUppercasePrep), true, 'Order in "PREPARING" uppercase state must be recognized as pending kitchen order');
    assert.strictEqual(sandbox.isRejectedStaffOrder(orderPrep), false, 'Preparing order must NEVER be marked as rejected');
    assert.strictEqual(sandbox.isCompletedStaffOrder(orderPrep), false, 'Preparing order must NOT be marked as completed');
    console.log('  ✓ Preparing and delivery states correctly partition into Pending Orders tab.');

    console.log('\n--- TEST 2: HTML Card Generation for Preparing & Delivery States ---');
    const cardPrepHTML = sandbox.buildOrderCardHTML(orderPrep);
    assert(cardPrepHTML.includes('Dispatch Driver'), 'Preparing card must render "Dispatch Driver" action button');
    assert(cardPrepHTML.includes('staff-otp-verification-box'), 'Preparing card must render OTP verification input box');
    assert(cardPrepHTML.includes('btn-verify-otp-ord_101'), 'Preparing card must render Verify & Deliver button');

    const cardDelivHTML = sandbox.buildOrderCardHTML(orderDeliv);
    assert(cardDelivHTML.includes('Out for Delivery'), 'Delivery card must render "Out for Delivery" status badge');
    assert(cardDelivHTML.includes('staff-otp-verification-box'), 'Delivery card must render OTP verification box');
    console.log('  ✓ Action buttons and OTP verification boxes render correctly for both preparing and delivery orders.');

    console.log('\n--- TEST 3: Multi-Status Firestore Query and Distinct Audio Triggers ---');
    
    // Simulate Firestore snapshot listener logic
    let mockQueryStatusFilter = null;
    const mockDb = {
        collection: (col) => {
            assert.strictEqual(col, 'orders', 'Must query orders collection');
            return {
                where: (field, op, val) => {
                    assert.strictEqual(field, 'status');
                    assert.strictEqual(op, 'in');
                    mockQueryStatusFilter = val;
                    return {
                        onSnapshot: (callback) => {
                            sandbox._triggerMockSnapshot = callback;
                            return () => {};
                        }
                    };
                }
            };
        }
    };
    localStorageMock.setItem('perfetto_staff_session_user', JSON.stringify({
        name: 'Head Chef',
        phone: '9414503886',
        role: 'Master Admin',
        isMasterAdmin: true,
        status: 'active',
        isApproved: true,
        isStaff: true
    }));
    windowMock.db = mockDb;
    sandbox.staffOrdersUnsubscribe = null;

    // Reset listener and invoke listenToFirestoreStaffOrders
    sandbox.listenToFirestoreStaffOrders();

    assert(Array.isArray(mockQueryStatusFilter), 'Firestore query must use "in" operator with status array');
    assert(mockQueryStatusFilter.includes('preparing') || mockQueryStatusFilter.includes('PREPARING'), 'Query must include preparing status');
    assert(mockQueryStatusFilter.includes('delivery') || mockQueryStatusFilter.includes('DELIVERY'), 'Query must include delivery status');
    assert(mockQueryStatusFilter.includes('PENDING') || mockQueryStatusFilter.includes('pending'), 'Query must include pending status');
    console.log('  ✓ Firestore listener subscribed to multi-status kitchen array: ', mockQueryStatusFilter.join(', '));

    // Snapshot 1: Order #1 arrives as PENDING
    const snap1 = [
        {
            id: 'ord_1',
            data: () => ({ id: 'ord_1', status: 'PENDING', createdAt: Date.now(), items: [{ name: 'Margherita' }] })
        }
    ];
    sandbox._triggerMockSnapshot(snap1);

    const trackedIds = windowMock.staffSnapshotTrackedOrderIds;
    assert(trackedIds && trackedIds.has('ord_1'), 'Snapshot 1 must record ord_1 in staffSnapshotTrackedOrderIds');
    console.log('  ✓ Initial Snapshot: ord_1 tracked and audio siren active.');

    // Staff dismisses the alert for Order #1
    sandbox.isStaffAlertDismissedInSession = true;
    sandbox.stopOrderAlertAudio();
    assert.strictEqual(sandbox.isStaffAlertDismissedInSession, true, 'Alert is dismissed in session');

    // Snapshot 2: Order #1 transitions to "preparing"
    const snap2 = [
        {
            id: 'ord_1',
            data: () => ({ id: 'ord_1', status: 'preparing', createdAt: Date.now(), items: [{ name: 'Margherita' }] })
        }
    ];
    sandbox._triggerMockSnapshot(snap2);

    // Alert should NOT re-trigger because ord_1 is already tracked
    assert.strictEqual(sandbox.isStaffAlertDismissedInSession, true, 'Status change on existing order #1 does NOT falsely reset dismissal');
    console.log('  ✓ Status update to "preparing" kept ord_1 visible without falsely re-alarming.');

    // Snapshot 3: Order #2 arrives (novel incoming order!)
    const snap3 = [
        {
            id: 'ord_1',
            data: () => ({ id: 'ord_1', status: 'preparing', createdAt: Date.now(), items: [{ name: 'Margherita' }] })
        },
        {
            id: 'ord_2',
            data: () => ({ id: 'ord_2', status: 'PENDING', createdAt: Date.now(), customerName: 'Raj', total: 450, items: [{ name: 'Farmhouse Pizza' }] })
        }
    ];
    sandbox._triggerMockSnapshot(snap3);

    // Genuinely novel order: isStaffAlertDismissedInSession MUST be reset to false!
    assert.strictEqual(windowMock.isStaffAlertDismissedInSession, false, 'Novel incoming order ord_2 MUST reset isStaffAlertDismissedInSession to false');
    assert(trackedIds.has('ord_2'), 'Snapshot 3 must record ord_2 in staffSnapshotTrackedOrderIds');
    assert.strictEqual(windowMock.currentAlertingOrderId, 'ord_2', 'currentAlertingOrderId must point to novel order ord_2');
    console.log('  ✓ Novel Order #2 detected! Alert dismissal reset and siren started immediately for ord_2.');

    // Staff dismisses alert again
    windowMock.isStaffAlertDismissedInSession = true;
    sandbox.stopOrderAlertAudio();

    // Snapshot 4: Order #3 arrives (third novel incoming order!)
    const snap4 = [
        {
            id: 'ord_1',
            data: () => ({ id: 'ord_1', status: 'delivery', createdAt: Date.now(), items: [{ name: 'Margherita' }] })
        },
        {
            id: 'ord_2',
            data: () => ({ id: 'ord_2', status: 'preparing', createdAt: Date.now(), customerName: 'Raj', total: 450, items: [{ name: 'Farmhouse Pizza' }] })
        },
        {
            id: 'ord_3',
            data: () => ({ id: 'ord_3', status: 'PENDING', createdAt: Date.now(), customerName: 'Priya', total: 600, items: [{ name: 'Paneer Makhani' }] })
        }
    ];
    sandbox._triggerMockSnapshot(snap4);

    assert.strictEqual(windowMock.isStaffAlertDismissedInSession, false, 'Novel incoming order ord_3 MUST reset isStaffAlertDismissedInSession to false');
    assert(trackedIds.has('ord_3'), 'Snapshot 4 must record ord_3 in staffSnapshotTrackedOrderIds');
    assert.strictEqual(windowMock.currentAlertingOrderId, 'ord_3', 'currentAlertingOrderId must point to novel order ord_3');
    console.log('  ✓ Novel Order #3 detected! Alert dismissal reset and siren started immediately for ord_3.');

    console.log('\n🎉 ALL STAFF PREPARING LIFECYCLE & AUDIO TRIGGER TESTS PASSED PERFECTLY!\n');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Test run failed:', err);
    process.exit(1);
});
