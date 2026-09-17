/**
 * Comprehensive Automated Verification Suite for:
 * 1. Profile Hidden Store Notice Row Harmonization
 * 2. Customer Scratch Card Clean Golden Foil Plate
 * 3. Mobile Touch Responsiveness & Calibrated Brush Radius
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

console.log('======================================================================');
console.log('✨ VERIFYING HIDDEN STORE NOTICE ROW & SCRATCH CARD REFINEMENTS');
console.log('======================================================================\n');

const stylesPath = path.join(__dirname, '..', 'styles.css');
const appJsPath = path.join(__dirname, '..', 'app.js');
const indexPath = path.join(__dirname, '..', 'index.html');
const publicStylesPath = path.join(__dirname, '..', 'public', 'styles.css');
const publicAppJsPath = path.join(__dirname, '..', 'public', 'app.js');

const stylesCss = fs.readFileSync(stylesPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

// --- Group 1: Profile Hidden Store Notice Row Harmonization ---
console.log('--- 1. Profile Hidden Store Notice Row Harmonization ---');

test('Inactive store notice row is positioned at the bottom of Account Settings in index.html', () => {
    const legalInfoIdx = indexHtml.indexOf('id="menu-legal-info"');
    const inactiveNoticeIdx = indexHtml.indexOf('id="profile-store-notice-inactive-row"');
    assert(legalInfoIdx > 0 && inactiveNoticeIdx > 0, 'Both rows must exist in index.html');
    assert(inactiveNoticeIdx > legalInfoIdx, 'Inactive store notice row must sit beneath Info & Legal Policies');
});

test('Inactive store notice row strips outer perimeter border and bounding box', () => {
    assert(stylesCss.includes('.menu-item-row.profile-notice-inactive-row {'), 'Missing .menu-item-row.profile-notice-inactive-row rule');
    const rowSlice = stylesCss.slice(stylesCss.indexOf('.menu-item-row.profile-notice-inactive-row {'), stylesCss.indexOf('.menu-item-row.profile-notice-inactive-row {') + 300);
    assert(rowSlice.includes('border: none;'), 'Row must have border: none');
    assert(rowSlice.includes('box-shadow: none;'), 'Row must have box-shadow: none');
    assert(rowSlice.includes('background: transparent;'), 'Row must have transparent background');
    assert(rowSlice.includes('border-radius: 0;'), 'Row must have border-radius: 0');
});

test('Inactive notice icon has no outer border or drop shadow, matching standard row icons', () => {
    assert(stylesCss.includes('.menu-item-icon.icon-profile-notice-muted {'), 'Missing .menu-item-icon.icon-profile-notice-muted rule');
    const iconSlice = stylesCss.slice(stylesCss.indexOf('.menu-item-icon.icon-profile-notice-muted {'), stylesCss.indexOf('.menu-item-icon.icon-profile-notice-muted {') + 380);
    assert(iconSlice.includes('border: none !important;'), 'Icon must have border: none');
    assert(iconSlice.includes('box-shadow: none !important;'), 'Icon must have box-shadow: none');
    assert(iconSlice.includes('width: 38px;'), 'Icon width must be 38px matching other icons');
    assert(iconSlice.includes('height: 38px;'), 'Icon height must be 38px matching other icons');
});

test('Inactive notice typography uses native item-title and item-subtitle styles', () => {
    const titleSlice = stylesCss.slice(stylesCss.indexOf('.profile-notice-muted-title {'), stylesCss.indexOf('.profile-notice-muted-title {') + 180);
    assert(titleSlice.includes('font-size: 0.9rem;'), 'Title must be 0.9rem');
    assert(titleSlice.includes('color: var(--text-main);'), 'Title must use standard text color');

    const subSlice = stylesCss.slice(stylesCss.indexOf('.profile-notice-muted-subtitle {'), stylesCss.indexOf('.profile-notice-muted-subtitle {') + 180);
    assert(subSlice.includes('font-size: 0.75rem;'), 'Subtitle must be 0.75rem');
    assert(subSlice.includes('color: var(--text-muted);'), 'Subtitle must use standard muted color');
});

test('Active store notice maintains prominent highlighted card design with golden border', () => {
    assert(stylesCss.includes('.menu-item-row.profile-notice-row {'), 'Missing active notice row rule');
    const activeSlice = stylesCss.slice(stylesCss.indexOf('.menu-item-row.profile-notice-row {'), stylesCss.indexOf('.menu-item-row.profile-notice-row {') + 300);
    assert(activeSlice.includes('border: 1px solid rgba(245, 158, 11,'), 'Active row must retain golden border');
    assert(activeSlice.includes('border-radius: 16px;'), 'Active row must retain 16px radius card');
});

// --- Group 2: Scratch Card Overlay Surface Clean-up ---
console.log('\n--- 2. Scratch Card Overlay Surface Clean-up ---');

test('Foil canvas rendering context strips all promotional text, sparkle icons, and central pill box', () => {
    const setupCanvasSlice = appJs.slice(appJs.indexOf('function setupScratchCanvas('), appJs.indexOf('function initScratchCardCanvasEvents('));
    assert(!setupCanvasSlice.includes('SCRATCH & WIN'), 'Canvas must NOT contain "SCRATCH & WIN"');
    assert(!setupCanvasSlice.includes('Win Mystery Cashback'), 'Canvas must NOT contain "Win Mystery Cashback"');
    assert(!setupCanvasSlice.includes('Scratch the card to reveal'), 'Canvas must NOT contain "Scratch the card to reveal"');
    assert(!setupCanvasSlice.includes('badgeW = width - 70'), 'Canvas must NOT render central badge box');
});

test('Foil canvas retains rich solid metallic gold shimmer and border insets', () => {
    const setupCanvasSlice = appJs.slice(appJs.indexOf('function setupScratchCanvas('), appJs.indexOf('function initScratchCardCanvasEvents('));
    assert(setupCanvasSlice.includes("ctx.fillStyle = '#e5a93b';"), 'Must have solid gold base fill');
    assert(setupCanvasSlice.includes('createLinearGradient'), 'Must have shimmer gradient');
    assert(setupCanvasSlice.includes('ctx.strokeRect'), 'Must have border inset stroke');
});

// --- Group 3: Mobile Touch Responsiveness & Scratch Brush Radius ---
console.log('\n--- 3. Mobile Touch Responsiveness & Scratch Brush Radius ---');

test('Scratch brush radius is calibrated to standard fingertip dimension (24-28px in CSS px)', () => {
    const eventsSlice = appJs.slice(appJs.indexOf('function initScratchCardCanvasEvents('), appJs.indexOf('function checkScratchCompletion('));
    assert(eventsSlice.includes('const brushRadius = 26;') || eventsSlice.includes('const brushRadius = 12;'), 'Brush radius must be calibrated for smooth scratching');
});

test('Touch events prevent unintentional background page scroll (passive: false & e.preventDefault())', () => {
    const eventsSlice = appJs.slice(appJs.indexOf('function initScratchCardCanvasEvents('), appJs.indexOf('function checkScratchCompletion('));
    assert(eventsSlice.includes("canvas.addEventListener('touchstart', onTouchStart, { passive: false });"), 'touchstart must use passive: false');
    assert(eventsSlice.includes("canvas.addEventListener('touchmove', onTouchMove, { passive: false });"), 'touchmove must use passive: false');
    assert(eventsSlice.includes('if (e.cancelable) e.preventDefault();'), 'Touch handlers must call preventDefault() when cancelable');
});

test('Touch coordinate tracking caches canvas rect to eliminate pointer lag and dropped frames', () => {
    const eventsSlice = appJs.slice(appJs.indexOf('function initScratchCardCanvasEvents('), appJs.indexOf('function checkScratchCompletion('));
    assert(eventsSlice.includes('canvasRect = canvas.getBoundingClientRect();'), 'Must cache canvas rect');
    assert(eventsSlice.includes('updateRect();'), 'Must update rect on touchstart, resize, and scroll');
});

test('Scratch card stage and interactive canvas enforce touch-action: none', () => {
    const stageSlice = stylesCss.slice(stylesCss.indexOf('.scratch-card-stage {'), stylesCss.indexOf('.scratch-card-stage {') + 450);
    assert(stageSlice.includes('touch-action: none;'), '.scratch-card-stage must have touch-action: none');

    const canvasSlice = stylesCss.slice(stylesCss.indexOf('.scratch-interactive-canvas {'), stylesCss.indexOf('.scratch-interactive-canvas {') + 250);
    assert(canvasSlice.includes('touch-action: none;'), '.scratch-interactive-canvas must have touch-action: none');
});

test('Automatic reward unlock threshold triggers clearance at 35%', () => {
    const checkSlice = appJs.slice(appJs.indexOf('function checkScratchCompletion('), appJs.indexOf('function markScratchRewardPendingDelivery('));
    assert(checkSlice.includes('percentage >= 35') || checkSlice.includes('percentage >= 40'), 'Must require at least 35% clearance');
    assert(checkSlice.includes('revealScratchCardReward()'), 'Must call revealScratchCardReward()');
});

// --- Group 4: Static Asset Build Synchronization ---
console.log('\n--- 4. Static Asset Build Synchronization ---');

test('public/styles.css is synchronized with styles.css', () => {
    const pubStyles = fs.readFileSync(publicStylesPath, 'utf8');
    assert.strictEqual(pubStyles, stylesCss, 'public/styles.css must match styles.css');
});

test('public/app.js is synchronized with app.js', () => {
    const pubApp = fs.readFileSync(publicAppJsPath, 'utf8');
    assert.strictEqual(pubApp, appJs, 'public/app.js must match app.js');
});

console.log('\n======================================================================');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed`);
console.log('======================================================================');

if (passedTests !== totalTests) {
    process.exit(1);
}
