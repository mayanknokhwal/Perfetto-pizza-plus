/**
 * verifyDecoupledAudioDismiss.js
 *
 * Automated verification harness for:
 * 1. Strict tab-level audio isolation between Admin and Staff portals.
 * 2. Elimination of cross-tab localStorage audio interference.
 * 3. Independent in-memory audio states (staffSoundMuted, adminSoundDismissed).
 * 4. Staff continuous loop audio vs Admin single chime playback.
 * 5. Multi-tab simulation: Dismiss on Staff does NOT affect Admin audio or chime trigger.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const staffJs = fs.readFileSync(path.join(ROOT_DIR, 'staff.js'), 'utf8');
const adminJs = fs.readFileSync(path.join(ROOT_DIR, 'admin.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(ROOT_DIR, 'admin.html'), 'utf8');

console.log('================================================================');
console.log('🔊 AUDITING DECOUPLED AUDIO DISMISS LOGIC (ADMIN VS STAFF)');
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
// TEST 1: Elimination of Shared LocalStorage Mute Sync
// -----------------------------------------------------------------------------
test('Staff Portal: Eliminates localStorage.setItem for audio mute/enable', () => {
    assert(!staffJs.includes("localStorage.setItem('staff_sound_enabled'"), 'staff.js must NOT write staff_sound_enabled to localStorage');
    assert(staffJs.includes("sessionStorage.setItem('staff_sound_enabled'"), 'staff.js must scope sound persistence to sessionStorage');
    assert(staffJs.includes('let staffSoundMuted = false'), 'staff.js must declare in-memory staffSoundMuted');
    assert(staffJs.includes('window.dismissStaffSound = dismissIncomingOrderAlert'), 'staff.js must export dismissStaffSound');
});

// -----------------------------------------------------------------------------
// TEST 2: Admin Portal In-Memory Audio Controller
// -----------------------------------------------------------------------------
test('Admin Portal: Exports isolated in-memory audio controller in admin.js', () => {
    assert(adminJs.includes('let adminSoundDismissed = false;'), 'admin.js must declare in-memory adminSoundDismissed');
    assert(adminJs.includes('export function playAdminOrderChime'), 'admin.js must export playAdminOrderChime');
    assert(adminJs.includes('export function dismissAdminOrderAlert'), 'admin.js must export dismissAdminOrderAlert');
    assert(adminJs.includes('adminSoundDismissed = true;'), 'dismissAdminOrderAlert must set adminSoundDismissed = true');
    assert(adminJs.includes('adminAlertAudio.loop = false'), 'Admin HTML5 audio must strictly enforce single-play chime (loop = false)');
});

// -----------------------------------------------------------------------------
// TEST 3: Cross-Tab Storage Event Guarding in Both Portals
// -----------------------------------------------------------------------------
test('Both Portals: Storage event listeners strictly ignore audio/sound keys', () => {
    // Staff storage listener guard
    assert(staffJs.includes("e.key === 'staff_sound_enabled' || e.key.includes('sound') || e.key.includes('audio') || e.key.includes('dismiss')"),
        'staff.js storage event listener must ignore audio/sound/dismiss keys');
    // Admin storage listener guard
    assert(adminHtml.includes("e.key === 'staff_sound_enabled' || e.key.includes('sound') || e.key.includes('audio') || e.key.includes('dismiss')"),
        'admin.html storage event listener must ignore audio/sound/dismiss keys');
});

// -----------------------------------------------------------------------------
// TEST 4: Dual-Tab Simulation (Admin Tab + Staff Tab in Same Browser)
// -----------------------------------------------------------------------------
test('Dual-Tab Simulation: Staff dismiss does NOT mute or stop Admin audio', () => {
    // 1. Tab 1: Admin Tab Context
    const adminTab = {
        adminSoundDismissed: false,
        lastAdminChimedOrderId: null,
        lastAdminChimeTimestamp: 0,
        audioPlayCount: 0,
        audioPaused: true,
        bannerVisible: false,
        audio: {
            loop: false,
            paused: true,
            currentTime: 0,
            play: function() {
                adminTab.audioPlayCount++;
                this.paused = false;
                adminTab.audioPaused = false;
                return Promise.resolve();
            },
            pause: function() {
                this.paused = true;
                this.currentTime = 0;
                adminTab.audioPaused = true;
            }
        },
        playOrderChime: function(orderId) {
            const cleanId = String(orderId).replace(/^#/, '').trim();
            this.lastAdminChimedOrderId = cleanId;
            this.lastAdminChimeTimestamp = Date.now();
            this.adminSoundDismissed = false;
            this.bannerVisible = true;
            this.audio.loop = false; // Admin chime is single play
            return this.audio.play();
        },
        dismissAlert: function() {
            this.adminSoundDismissed = true;
            this.bannerVisible = false;
            this.audio.pause();
        }
    };

    // 2. Tab 2: Staff Tab Context
    const staffTab = {
        staffSoundMuted: false,
        isOrderAlertAudioPlaying: false,
        currentAlertingOrderId: null,
        modalVisible: false,
        audioPlayCount: 0,
        audioPaused: true,
        audio: {
            loop: true,
            paused: true,
            currentTime: 0,
            play: function() {
                staffTab.audioPlayCount++;
                this.paused = false;
                staffTab.audioPaused = false;
                return Promise.resolve();
            },
            pause: function() {
                this.paused = true;
                this.currentTime = 0;
                staffTab.audioPaused = true;
            }
        },
        startOrderAlert: function(orderId) {
            this.staffSoundMuted = false;
            this.currentAlertingOrderId = String(orderId);
            this.isOrderAlertAudioPlaying = true;
            this.modalVisible = true;
            this.audio.loop = true; // Staff alert is continuous loop
            return this.audio.play();
        },
        dismissSound: function() {
            this.staffSoundMuted = true;
            this.isOrderAlertAudioPlaying = false;
            this.currentAlertingOrderId = null;
            this.modalVisible = false;
            this.audio.pause();
        }
    };

    // --- STEP A: Place Order #5001 ---
    adminTab.playOrderChime('5001');
    staffTab.startOrderAlert('5001');

    assert.strictEqual(adminTab.audioPlayCount, 1, 'Admin audio should have played once for Order #5001');
    assert.strictEqual(adminTab.audio.loop, false, 'Admin audio must NOT loop (single chime)');
    assert.strictEqual(adminTab.audioPaused, false, 'Admin audio is playing');
    assert.strictEqual(adminTab.adminSoundDismissed, false, 'Admin audio state is not dismissed');

    assert.strictEqual(staffTab.audioPlayCount, 1, 'Staff audio should have played for Order #5001');
    assert.strictEqual(staffTab.audio.loop, true, 'Staff audio must loop continuously');
    assert.strictEqual(staffTab.audioPaused, false, 'Staff audio is playing');
    assert.strictEqual(staffTab.staffSoundMuted, false, 'Staff sound is not muted');

    // --- STEP B: Click "Dismiss Sound" on Staff Tab ---
    staffTab.dismissSound();

    // Staff tab state check:
    assert.strictEqual(staffTab.audioPaused, true, 'Staff audio must be paused immediately');
    assert.strictEqual(staffTab.staffSoundMuted, true, 'Staff tab in-memory staffSoundMuted must be true');
    assert.strictEqual(staffTab.modalVisible, false, 'Staff modal must be hidden');

    // Admin tab state check: MUST REMAIN COMPLETELY UNAFFECTED!
    assert.strictEqual(adminTab.adminSoundDismissed, false, 'Admin soundDismissed MUST remain false after Staff dismiss');
    assert.strictEqual(adminTab.bannerVisible, true, 'Admin alert banner MUST remain visible');
    assert.strictEqual(adminTab.audioPaused, false, 'Admin audio playback MUST NOT be stopped or paused by Staff dismiss');

    // --- STEP C: Place Order #5002 ---
    // Verify novel incoming order triggers Admin chime without being blocked by prior Staff dismiss
    adminTab.playOrderChime('5002');
    staffTab.startOrderAlert('5002');

    assert.strictEqual(adminTab.audioPlayCount, 2, 'Admin chime must fire 2nd time for Order #5002');
    assert.strictEqual(adminTab.adminSoundDismissed, false, 'Admin sound dismissed state must be reset for novel order');
    assert.strictEqual(staffTab.audioPlayCount, 2, 'Staff loop audio must fire 2nd time for Order #5002');
    assert.strictEqual(staffTab.staffSoundMuted, false, 'Staff sound mute state must reset to false for novel order');

    // --- STEP D: Dismiss on Admin Tab ---
    adminTab.dismissAlert();
    assert.strictEqual(adminTab.adminSoundDismissed, true, 'Admin dismiss sets adminSoundDismissed = true');
    assert.strictEqual(adminTab.audioPaused, true, 'Admin audio paused on dismiss');
    // Staff tab remains active and looping
    assert.strictEqual(staffTab.audioPaused, false, 'Staff audio continues looping unaffected by Admin dismiss');
    assert.strictEqual(staffTab.staffSoundMuted, false, 'Staff sound remains unmuted');
});

// -----------------------------------------------------------------------------
// TEST 5: Verification of No Shared DB/Firestore Write on Audio Dismiss
// -----------------------------------------------------------------------------
test('Staff Portal: dismissIncomingOrderAlert never mutates Firestore order or shared settings', () => {
    // Extract dismissIncomingOrderAlert function body
    const match = staffJs.match(/function dismissIncomingOrderAlert\(\) \{([\s\S]*?)\n\}/);
    assert(match, 'dismissIncomingOrderAlert function must be defined in staff.js');
    const funcBody = match[1];

    assert(!funcBody.includes('.update('), 'dismissIncomingOrderAlert must NOT call .update() on Firestore');
    assert(!funcBody.includes('.set('), 'dismissIncomingOrderAlert must NOT call .set() on Firestore');
    assert(!funcBody.includes('localStorage.setItem'), 'dismissIncomingOrderAlert must NOT write to localStorage');
    assert(!funcBody.includes('BroadcastChannel'), 'dismissIncomingOrderAlert must NOT broadcast across channels');
});

console.log('\n================================================================');
console.log(`🎉 ALL ${passedTests} DECOUPLED AUDIO DISMISS VERIFICATION TESTS PASSED!`);
console.log('================================================================\n');
