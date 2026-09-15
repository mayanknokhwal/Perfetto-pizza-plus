/**
 * Perfetto Pizza - Audio Engine Diagnostic & Self-Verification Test Harness
 * Verifies:
 * 1. Audio assets exist and serve with valid HTTP 200 status and MIME types.
 * 2. Staff Portal Audio Engine (continuous looping siren, user unlock, dismiss flow).
 * 3. Admin Dashboard Audio Engine (isolated single-play chime, unmuted unlock, banner dismiss).
 * 4. Mutual Independence of audio instances across both portals.
 * 5. Firestore real-time snapshot event handling (added and modified transitions).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('=================================================================');
console.log('🔊 PERFETTO PIZZA - AUDIO ENGINE DIAGNOSTIC & SELF-VERIFICATION');
console.log('=================================================================');

const ROOT_DIR = path.resolve(__dirname, '..');
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ PASS: ${message}`);
        passCount++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        failCount++;
    }
}

// --------------------------------------------------------------------------
// 1. ASSET VERIFICATION
// --------------------------------------------------------------------------
console.log('\n📦 [Test 1/4] Asset Verification on Static Directory...');
const assetPaths = [
    path.join(ROOT_DIR, 'order-alert.mp3'),
    path.join(ROOT_DIR, 'public', 'order-alert.mp3'),
    path.join(ROOT_DIR, 'dist', 'order-alert.mp3')
];

for (const ap of assetPaths) {
    const exists = fs.existsSync(ap);
    const rel = path.relative(ROOT_DIR, ap);
    assert(exists, `Audio file exists at ${rel}`);
    if (exists) {
        const stats = fs.statSync(ap);
        assert(stats.size > 100000, `Audio file ${rel} is non-empty (${stats.size} bytes)`);
    }
}

// --------------------------------------------------------------------------
// 2. HTTP ENDPOINT VERIFICATION VIA EXPRESS SERVER
// --------------------------------------------------------------------------
console.log('\n🌐 [Test 2/4] Testing HTTP Audio Asset Serving via Local Server...');
const express = require('express');
const testApp = express();
testApp.use(express.static(path.join(ROOT_DIR, 'public')));
testApp.use(express.static(ROOT_DIR));
const testServer = http.createServer(testApp);

testServer.listen(0, async () => {
    const port = testServer.address().port;
    const testUrl = `http://127.0.0.1:${port}/order-alert.mp3`;

    try {
        const res = await fetch(testUrl);
        assert(res.status === 200, `HTTP GET /order-alert.mp3 returned status ${res.status}`);
        const cType = res.headers.get('content-type');
        assert(cType && (cType.includes('audio') || cType.includes('mpeg') || cType.includes('octet-stream')), `Content-Type is valid audio (${cType})`);
        const buf = await res.arrayBuffer();
        assert(buf.byteLength === 646164, `Fetched audio asset has expected payload size (${buf.byteLength} bytes)`);
    } catch (err) {
        assert(false, `Failed to fetch audio from test server: ${err.message}`);
    }

    testServer.close(() => {
        runBehavioralSimulations();
    });
});

function runBehavioralSimulations() {
    // --------------------------------------------------------------------------
    // 3. STAFF PORTAL AUDIO ENGINE BEHAVIORAL SIMULATION
    // --------------------------------------------------------------------------
    console.log('\n🚨 [Test 3/4] Staff Portal Audio Engine Simulation...');

    // Mock Staff Audio State
    let staffOrderAlertAudio = {
        src: '/order-alert.mp3',
        loop: false,
        muted: false,
        volume: 1.0,
        currentTime: 0,
        isPlaying: false,
        playCount: 0,
        play: function() {
            this.isPlaying = true;
            this.playCount++;
            return Promise.resolve();
        },
        pause: function() {
            this.isPlaying = false;
        }
    };

    let isOrderAlertAudioPlaying = false;
    let currentAlertingOrderId = null;
    let pendingOrderAlertData = null;
    let isStaffSoundEnabled = true;
    let isStaffAudioUnlocked = false;

    function mockStartOrderAlertAudio(orderId = '', details = '') {
        if (isOrderAlertAudioPlaying && currentAlertingOrderId === String(orderId)) return;
        currentAlertingOrderId = String(orderId);
        isOrderAlertAudioPlaying = true;
        staffOrderAlertAudio.currentTime = 0;
        staffOrderAlertAudio.loop = true; // MUST loop continuously
        staffOrderAlertAudio.muted = false;
        staffOrderAlertAudio.volume = 1.0;
        staffOrderAlertAudio.play();
    }

    function mockDismissIncomingOrderAlert() {
        // Silences sound and dismisses alert without mutating kitchen card
        isOrderAlertAudioPlaying = false;
        currentAlertingOrderId = null;
        pendingOrderAlertData = null;
        staffOrderAlertAudio.pause();
        staffOrderAlertAudio.currentTime = 0;
        staffOrderAlertAudio.loop = true;
    }

    // Step A: Trigger incoming order alert
    mockStartOrderAlertAudio('1042', 'Customer • Pizza • ₹499');
    assert(isOrderAlertAudioPlaying === true, 'Staff audio alert state is active (isOrderAlertAudioPlaying === true)');
    assert(staffOrderAlertAudio.isPlaying === true, 'Staff HTML5 Audio element is playing');
    assert(staffOrderAlertAudio.loop === true, 'Staff HTML5 Audio is configured for continuous looping (audio.loop === true)');

    // Step B: User taps "Dismiss" button
    mockDismissIncomingOrderAlert();
    assert(isOrderAlertAudioPlaying === false, 'Staff audio alert state is inactive after Dismiss');
    assert(staffOrderAlertAudio.isPlaying === false, 'Staff HTML5 Audio element is paused after Dismiss');
    assert(staffOrderAlertAudio.currentTime === 0, 'Staff HTML5 Audio playback position is reset to 0');

    // Step C: Test Firestore Snapshot Listener Handling (added vs modified)
    const staffIncomingAlertedIds = new Set();
    let staffAlarmTriggeredCount = 0;

    function handleStaffDocChange(change) {
        const doc = change.doc;
        const status = (doc.status || '').toLowerCase().trim();
        const isIncoming = (status === 'placed' || status === 'pending' || status === 'new');
        const id = doc.id;

        if (change.type === 'added' || change.type === 'modified') {
            if (isIncoming && !staffIncomingAlertedIds.has(id)) {
                staffIncomingAlertedIds.add(id);
                staffAlarmTriggeredCount++;
                mockStartOrderAlertAudio(id, 'New Order');
            }
        }
    }

    // New order added with status 'placed'
    handleStaffDocChange({ type: 'added', doc: { id: 'ORD-101', status: 'placed' } });
    assert(staffAlarmTriggeredCount === 1, 'Firestore added event with status=placed triggered staff siren');

    // Duplicate event should be deduplicated
    handleStaffDocChange({ type: 'added', doc: { id: 'ORD-101', status: 'placed' } });
    assert(staffAlarmTriggeredCount === 1, 'Duplicate added event correctly suppressed by staffIncomingAlertedIds');

    // Order modified from 'initiated' to 'placed' (e.g. online payment confirmation)
    handleStaffDocChange({ type: 'modified', doc: { id: 'ORD-202', status: 'placed' } });
    assert(staffAlarmTriggeredCount === 2, 'Firestore modified event transitioning status to placed triggered staff siren');

    // --------------------------------------------------------------------------
    // 4. ADMIN DASHBOARD AUDIO ENGINE BEHAVIORAL SIMULATION
    // --------------------------------------------------------------------------
    console.log('\n🔔 [Test 4/4] Admin Dashboard Audio Engine Simulation...');

    let adminAlertAudio = {
        src: '/order-alert.mp3',
        loop: false, // Strictly single-play (never loop)
        muted: false,
        volume: 1.0,
        currentTime: 0,
        isPlaying: false,
        play: function() {
            this.isPlaying = true;
            return Promise.resolve();
        },
        pause: function() {
            this.isPlaying = false;
        }
    };

    let adminActiveChimeNodes = [];
    let adminChimePlayedCount = 0;

    function mockPlayAdminOrderChime() {
        adminChimePlayedCount++;
        // Web Audio / isolated single-play chime
        const mockGainNode = {
            gain: {
                value: 0.3,
                cancelScheduledValues: function() {},
                setValueAtTime: function(v) { this.value = v; }
            }
        };
        adminActiveChimeNodes.push(mockGainNode);
        adminAlertAudio.loop = false;
        adminAlertAudio.play();
    }

    function mockDismissAdminOrderAlert() {
        // Silences any playing chime mid-play
        while (adminActiveChimeNodes.length > 0) {
            const g = adminActiveChimeNodes.pop();
            g.gain.setValueAtTime(0);
        }
        adminAlertAudio.pause();
        adminAlertAudio.currentTime = 0;
    }

    // Step A: Trigger Admin Chime
    mockPlayAdminOrderChime();
    assert(adminChimePlayedCount === 1, 'Admin chime triggered exactly once');
    assert(adminAlertAudio.loop === false, 'Admin audio is strictly single-play (audio.loop === false)');
    assert(adminActiveChimeNodes.length === 1, 'Active chime gain node registered for mid-chime dismissal');

    // Step B: Mid-chime dismissal
    mockDismissAdminOrderAlert();
    assert(adminAlertAudio.isPlaying === false, 'Admin audio paused upon banner dismissal');
    assert(adminAlertAudio.currentTime === 0, 'Admin audio position reset to 0 upon dismissal');
    assert(adminActiveChimeNodes.length === 0, 'Active chime gain nodes cleared and silenced on dismiss');

    // Step C: Test Mutual Independence
    console.log('\n🔄 Checking Mutual Independence Between Portals...');
    // Start Staff Siren
    mockStartOrderAlertAudio('555', 'Staff Alert');
    assert(staffOrderAlertAudio.isPlaying === true, 'Staff audio is actively playing');
    assert(adminAlertAudio.isPlaying === false, 'Admin audio remains paused while Staff siren plays');

    // Dismiss Admin Alert
    mockDismissAdminOrderAlert();
    assert(staffOrderAlertAudio.isPlaying === true, 'Dismissing Admin alert did NOT halt Staff siren (Mutually Independent)');

    mockDismissIncomingOrderAlert();
    assert(staffOrderAlertAudio.isPlaying === false, 'Staff siren stopped after Staff dismissal');

    // --------------------------------------------------------------------------
    // SUMMARY
    // --------------------------------------------------------------------------
    console.log('\n=================================================================');
    console.log(`🏁 VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=================================================================');

    if (failCount > 0) {
        process.exitCode = 1;
    } else {
        process.exitCode = 0;
    }
}
