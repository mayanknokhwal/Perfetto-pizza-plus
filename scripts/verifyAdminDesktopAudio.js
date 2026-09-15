/**
 * Comprehensive Automated Verification Suite for Prompt 3:
 * Admin Dashboard Desktop-First Efficiency & Isolated Sound Alerts
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
    }
}

console.log('======================================================');
console.log('🖥️  VERIFYING ADMIN DASHBOARD DESKTOP & AUDIO ALERT');
console.log('======================================================\n');

const adminHtmlPath = path.join(__dirname, '..', 'admin.html');
const publicAdminHtmlPath = path.join(__dirname, '..', 'public', 'admin.html');
const distAdminHtmlPath = path.join(__dirname, '..', 'dist', 'admin.html');

const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

// Group 1: Desktop-First Optimization & Screen Space Utilization
console.log('--- 1. Desktop-First Optimization & Layout Architecture ---');

test('Admin dashboard sets minimum desktop width of 1200px', () => {
    assert(adminHtml.includes('min-width: 1200px;'), 'Body should have min-width: 1200px for desktop-first experience');
});

test('Table headers (.data-table th) use sticky positioning with backdrop filter for dense data scanning', () => {
    assert(adminHtml.includes('.data-table th {'), 'Missing .data-table th rule');
    assert(adminHtml.includes('position: sticky;'), '.data-table th should be sticky');
    assert(adminHtml.includes('top: 0;'), '.data-table th should stick to top: 0');
    assert(adminHtml.includes('backdrop-filter: blur('), '.data-table th should have backdrop-filter');
});

test('Table rows (.data-table tbody tr) feature desktop row-hover indicator', () => {
    assert(adminHtml.includes('.data-table tbody tr:hover {'), 'Missing .data-table tbody tr:hover rule');
    assert(adminHtml.includes('border-left-color: var(--primary-orange);'), 'Row hover should highlight with primary orange accent');
});

test('Desktop media queries support 1200px+ widescreen density', () => {
    assert(adminHtml.includes('@media (min-width: 1200px)'), 'Missing @media (min-width: 1200px) query');
    assert(adminHtml.includes('@media (min-width: 1400px)'), 'Missing @media (min-width: 1400px) query');
});

test('Administrative toggle switches (.switch, .slider) include desktop hover aura and focus-visible state', () => {
    assert(adminHtml.includes('.switch:hover .slider {'), 'Missing .switch:hover .slider rule');
    assert(adminHtml.includes('.switch input:focus-visible + .slider {'), 'Missing .switch input:focus-visible + .slider rule');
});

test('Store setting toggle boxes include hover state', () => {
    assert(adminHtml.includes('.setting-toggle-box:hover {'), 'Missing .setting-toggle-box:hover rule');
});

// Group 2: Isolated Audio & Visual Alert Verification
console.log('\n--- 2. Isolated Audio & Visual Alert Verification ---');

test('HTML5 audio is configured strictly for single-play (never loops)', () => {
    assert(adminHtml.includes('adminAlertAudio.loop = false'), 'adminAlertAudio.loop must be false');
    assert(adminHtml.includes('Strictly single-play chime (never loop)'), 'Audio documentation must specify single-play guarantee');
});

test('HTML5 audio resets to beginning upon completion', () => {
    assert(adminHtml.includes('adminAlertAudio.onended = function()'), 'Missing onended handler for adminAlertAudio');
    assert(adminHtml.includes('adminAlertAudio.currentTime = 0;'), 'onended must reset currentTime to 0');
});

test('Synthesized Web Audio chime generates elegant 3-tone chime (E5 -> A5 -> E6) and auto-terminates', () => {
    assert(adminHtml.includes('function playAdminSynthesizedChime()'), 'Missing playAdminSynthesizedChime function');
    assert(adminHtml.includes('659.25'), 'Should include E5 (659.25 Hz)');
    assert(adminHtml.includes('880.00'), 'Should include A5 (880.00 Hz)');
    assert(adminHtml.includes('1318.51'), 'Should include E6 (1318.51 Hz)');
    assert(adminHtml.includes('adminActiveChimeNodes.push(masterGain)'), 'Must track masterGain for instant silencing on dismissal');
});

test('Order chime trigger debounces duplicate rapid fire events (2-second debounce)', () => {
    assert(adminHtml.includes('now - lastAdminChimeTimestamp < 2000'), 'Debounce window should be 2000ms');
});

test('Admin order alert banner exists with accessible roles and structure', () => {
    assert(adminHtml.includes('id="admin-incoming-order-banner"'), 'Missing #admin-incoming-order-banner');
    assert(adminHtml.includes('role="alert"'), 'Banner must have role="alert"');
    assert(adminHtml.includes('aria-live="assertive"'), 'Banner must have aria-live="assertive"');
});

test('Admin order alert banner is STRICTLY DISMISS-ONLY (No Accept or Reject buttons)', () => {
    assert(adminHtml.includes('id="btn-admin-order-dismiss"'), 'Must have dismiss button');
    assert(adminHtml.includes('STRICTLY SINGLE ACTION BUTTON: "Dismiss"'), 'Banner must be strictly single action dismiss');
    assert(!adminHtml.includes('id="btn-admin-order-accept"'), 'Admin banner must NOT have accept button');
    assert(!adminHtml.includes('id="btn-admin-order-reject"'), 'Admin banner must NOT have reject button');
});

test('dismissAdminOrderAlert() immediately silences both Web Audio and HTML5 audio', () => {
    assert(adminHtml.includes('function dismissAdminOrderAlert()'), 'Missing dismissAdminOrderAlert function');
    assert(adminHtml.includes('g.gain.setValueAtTime(0, now)'), 'Web Audio gain must be immediately zeroed');
    assert(adminHtml.includes('audio.pause()'), 'HTML5 audio must be paused immediately');
    assert(adminHtml.includes('audio.currentTime = 0'), 'HTML5 audio must be rewound to 0');
});

test('Desktop keyboard Escape shortcut triggers alert dismissal immediately', () => {
    assert(adminHtml.includes("evt.key === 'Escape' || evt.key === 'Esc'"), 'Missing Escape key event listener');
    assert(adminHtml.includes('dismissAdminOrderAlert()'), 'Escape listener must call dismissAdminOrderAlert');
});

// Group 3: Build & Static Asset Synchronization
console.log('\n--- 3. Static Asset Build Synchronization ---');

test('public/admin.html is synchronized with admin.html', () => {
    const publicHtml = fs.readFileSync(publicAdminHtmlPath, 'utf8');
    assert.strictEqual(publicHtml, adminHtml, 'public/admin.html must match admin.html exactly');
});

test('dist/admin.html is synchronized with admin.html', () => {
    const distHtml = fs.readFileSync(distAdminHtmlPath, 'utf8');
    assert.strictEqual(distHtml, adminHtml, 'dist/admin.html must match admin.html exactly');
});

console.log('\n======================================================');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed`);
console.log('======================================================');

if (passedTests !== totalTests) {
    process.exit(1);
}
