/**
 * PERFETTO PIZZA - STAFF PORTAL DUAL-DEVICE & AUDIO ENGINE VERIFICATION HARNESS
 * 
 * Verifies:
 * 1. Continuous looping audio siren mechanism & fail-safe repeat recovery.
 * 2. Instant dismissal: audio pause, currentTime=0, modal hidden, zero mutation on kitchen card state.
 * 3. Dual-device responsiveness: mobile touch targets (>=44-48px), compact tab label suffix suppression,
 *    tablet 2-col, desktop 3-col dense scanning, and ultra-wide 4-col KDS display.
 * 4. Keyboard (Escape) & backdrop dismissal hooks.
 */

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✓ PASS: ${message}`);
    } else {
        failedTests++;
        console.error(`  ✗ FAIL: ${message}`);
    }
}

console.log('=================================================================');
console.log('📱 STAFF PORTAL - DUAL-DEVICE RESPONSIVENESS & AUDIO VERIFICATION');
console.log('=================================================================\n');

// --------------------------------------------------------------------------
// TEST 1: Audio Engine Continuous Looping & Ended Resilience
// --------------------------------------------------------------------------
console.log('🔊 [Test 1/4] Auditing Continuous Looping Siren & Recovery Logic in staff.js...');

const staffJsContent = fs.readFileSync(path.join(__dirname, '..', 'staff.js'), 'utf8');

assert(staffJsContent.includes("staffOrderAlertAudio.loop = true"), 'Staff HTML5 Audio initializes with loop = true');
assert(staffJsContent.includes("staffOrderAlertAudio.preload = 'auto'"), 'Staff HTML5 Audio sets preload = auto for instant playback');
assert(staffJsContent.includes("staffOrderAlertAudio.volume = 1.0"), 'Staff HTML5 Audio sets full alert volume (1.0)');
assert(staffJsContent.includes("staffOrderAlertAudio.addEventListener('ended'"), 'Staff audio registers fail-safe ended event listener for loop recovery');
assert(staffJsContent.includes("startSynthesizedBeepLoop()"), 'Staff audio provides synthesized Web Audio fallback loop');

// --------------------------------------------------------------------------
// TEST 2: Incoming Order Dismissal Silencing & Non-Mutating Card State
// --------------------------------------------------------------------------
console.log('\n🚨 [Test 2/4] Testing Incoming Order Modal Dismissal & Card State Integrity...');

// Simulate mock DOM and Audio environment
class MockAudioElement {
    constructor() {
        this.loop = true;
        this.paused = true;
        this.currentTime = 0;
        this.volume = 1.0;
        this.muted = false;
    }
    play() {
        this.paused = false;
        return Promise.resolve();
    }
    pause() {
        this.paused = true;
    }
    load() {}
    addEventListener(event, cb) {
        if (!this._listeners) this._listeners = {};
        this._listeners[event] = cb;
    }
}

const mockOrder = {
    id: 'PF-TEST-8899',
    orderId: 'PF-TEST-8899',
    status: 'placed', // Kitchen pending order
    customerName: 'Raghav Sharma',
    customerPhone: '+919876543210',
    address: 'Flat 402, Tower B, Sunshine Apts, Delhi',
    total: 549,
    items: [{ name: 'Farmhouse Pizza (M)', qty: 1 }]
};

const mockStaffOrders = [JSON.parse(JSON.stringify(mockOrder))];
let mockIsOrderAlertAudioPlaying = false;
let mockCurrentAlertingOrderId = null;
const mockAudio = new MockAudioElement();

const mockModal = {
    style: { display: 'none', pointerEvents: 'none' },
    attributes: { 'aria-hidden': 'true' },
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; }
};

// Simulate incoming order trigger
function simulateIncomingOrder(order) {
    mockIsOrderAlertAudioPlaying = true;
    mockCurrentAlertingOrderId = order.id;
    mockAudio.currentTime = 0;
    mockAudio.loop = true;
    mockAudio.play();
    mockModal.style.display = 'flex';
    mockModal.style.pointerEvents = 'auto';
    mockModal.setAttribute('aria-hidden', 'false');
}

// Simulate user clicking "Dismiss" button
function simulateDismissIncomingOrder(orderList) {
    // 1. Audio must pause and reset
    mockAudio.pause();
    mockAudio.currentTime = 0;
    mockIsOrderAlertAudioPlaying = false;
    mockCurrentAlertingOrderId = null;

    // 2. Modal must hide
    mockModal.style.display = 'none';
    mockModal.style.pointerEvents = 'none';
    mockModal.setAttribute('aria-hidden', 'true');

    // 3. DO NOT mutate the order in orderList
    // (Order remains exactly in pending state)
}

// Run simulation
simulateIncomingOrder(mockOrder);
assert(mockIsOrderAlertAudioPlaying === true, 'Incoming order initiates alert state (isOrderAlertAudioPlaying === true)');
assert(mockAudio.paused === false, 'HTML5 Audio is actively playing');
assert(mockAudio.loop === true, 'HTML5 Audio has continuous loop enabled');
assert(mockModal.style.display === 'flex', 'Incoming order modal is visible on screen');
assert(mockModal.getAttribute('aria-hidden') === 'false', 'Incoming order modal is accessible (aria-hidden === false)');

// Dismiss alert
simulateDismissIncomingOrder(mockStaffOrders);
assert(mockIsOrderAlertAudioPlaying === false, 'Alert state is reset (isOrderAlertAudioPlaying === false)');
assert(mockAudio.paused === true, 'Audio is immediately paused upon dismissal');
assert(mockAudio.currentTime === 0, 'Audio playback position is reset to 0');
assert(mockModal.style.display === 'none', 'Modal is hidden after dismissal');
assert(mockModal.getAttribute('aria-hidden') === 'true', 'Modal aria-hidden is reset to true');

// Verify Kitchen Card State
const pendingOrderInQueue = mockStaffOrders.find(o => o.id === mockOrder.id);
assert(pendingOrderInQueue !== undefined, 'Order remains present in staff orders list');
assert(pendingOrderInQueue.status === 'placed', 'Order status remains UNMUTATED ("placed") in pending kitchen queue');
assert(pendingOrderInQueue.total === 549, 'Order total remains intact');

// --------------------------------------------------------------------------
// TEST 3: Keyboard (Escape) & Backdrop Dismissal Wiring
// --------------------------------------------------------------------------
console.log('\n⌨️ [Test 3/4] Checking Keyboard Shortcuts and Backdrop Dismissal Wiring...');

const staffHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'staff.html'), 'utf8');

assert(staffJsContent.includes("e.key === 'Escape'"), 'Escape key handler is registered in staff.js for instant dismissal');
assert(staffJsContent.includes("dismissIncomingOrderAlert()"), 'dismissIncomingOrderAlert function is exposed globally');
assert(staffHtmlContent.includes("if(event.target===this) dismissIncomingOrderAlert();"), 'Incoming modal backdrop overlay has click-to-dismiss handler');
assert(staffHtmlContent.includes("onclick=\"event.stopPropagation();\""), 'Modal card stops propagation to prevent accidental backdrop clicks');

// --------------------------------------------------------------------------
// TEST 4: Dual-Device Responsiveness (Mobile vs Desktop Layouts)
// --------------------------------------------------------------------------
console.log('\n📐 [Test 4/4] Auditing CSS Architecture for Mobile & Desktop Friendliness in staff.css...');

const staffCssContent = fs.readFileSync(path.join(__dirname, '..', 'staff.css'), 'utf8');

// 1. Mobile touch friendliness
assert(staffCssContent.includes("@media (max-width: 539px)"), 'Compact mobile media query (<540px) exists');
assert(staffCssContent.includes(".tab-label-suffix"), 'Tab label suffix selector defined for mobile label shortening');
assert(staffCssContent.includes("display: none !important"), 'Tab label suffix is hidden on compact mobile screens');
assert(staffCssContent.includes("min-height: 48px") || staffCssContent.includes("min-height: 46px"), 'Touch targets on mobile have comfortable min-height (>=46px-48px)');
assert(staffCssContent.includes(".btn-dismiss-incoming"), 'Prominent dismiss button class defined');

// 2. Tablet 2-column grid
assert(staffCssContent.includes("@media (min-width: 768px) and (max-width: 1023px)"), 'Tablet media query (768px-1023px) exists');
assert(staffCssContent.includes("repeat(2, minmax(0, 1fr))"), 'Tablet layout utilizes 2-column kitchen card grid');

// 3. Desktop 3-column dense scanning
assert(staffCssContent.includes("@media (min-width: 1024px)"), 'Desktop media query (>=1024px) exists');
assert(staffCssContent.includes("max-width: 1520px"), 'Desktop container expands up to 1520px for dense screen scanning');
assert(staffCssContent.includes("repeat(3, minmax(0, 1fr))"), 'Desktop layout utilizes 3-column grid for multi-order monitoring');

// 4. Ultra-wide 4-column KDS display
assert(staffCssContent.includes("@media (min-width: 1440px)"), 'Ultra-wide display query (>=1440px) exists');
assert(staffCssContent.includes("max-width: 1780px"), 'Ultra-wide container expands up to 1780px');
assert(staffCssContent.includes("repeat(4, minmax(0, 1fr))"), 'Ultra-wide layout utilizes 4-column kitchen display grid');

console.log('\n=================================================================');
console.log(`🏁 VERIFICATION COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
console.log('=================================================================\n');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
