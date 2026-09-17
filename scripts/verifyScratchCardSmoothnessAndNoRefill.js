const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('=== VERIFYING SCRATCH CARD CANVAS SMOOTHNESS, NO RE-FILL & TOUCH GESTURES ===\n');

let passCount = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`PASS: ${name}`);
        passCount++;
    } catch (err) {
        console.error(`FAIL: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

const appJs = fs.readFileSync('app.js', 'utf8');
const stylesCss = fs.readFileSync('styles.css', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

// Test 1: CSS & HTML touch-action and user-select rules
test('1. Canvas and stage enforce touch-action: none and user-select: none in HTML and CSS', () => {
    // HTML checks
    assert(indexHtml.includes('id="scratch-interactive-canvas"'), 'index.html must include scratch canvas');
    assert(indexHtml.includes('touch-action: none;'), 'index.html inline style must include touch-action: none');
    assert(indexHtml.includes('user-select: none;'), 'index.html inline style must include user-select: none');

    // CSS checks
    const stageSlice = stylesCss.slice(stylesCss.indexOf('.scratch-card-stage {'), stylesCss.indexOf('.scratch-card-stage {') + 400);
    assert(stageSlice.includes('touch-action: none;'), '.scratch-card-stage must have touch-action: none');
    assert(stageSlice.includes('user-select: none;'), '.scratch-card-stage must have user-select: none');

    const canvasSlice = stylesCss.slice(stylesCss.indexOf('#scratch-interactive-canvas,'), stylesCss.indexOf('#scratch-interactive-canvas,') + 300);
    assert(canvasSlice.includes('touch-action: none;'), '#scratch-interactive-canvas must have touch-action: none');
    assert(canvasSlice.includes('user-select: none;'), '#scratch-interactive-canvas must have user-select: none');
});

// Test 2: Touch event handlers call preventDefault and stopPropagation with passive: false
test('2. Touch handlers call preventDefault and stopPropagation with passive: false to eliminate mobile scroll conflict', () => {
    const eventsSlice = appJs.slice(appJs.indexOf('function initScratchCardCanvasEvents('), appJs.indexOf('function checkScratchCompletion('));

    // Event listener registration
    assert(eventsSlice.includes("canvas.addEventListener('touchstart', onTouchStart, { passive: false });"), 'touchstart must use passive: false');
    assert(eventsSlice.includes("canvas.addEventListener('touchmove', onTouchMove, { passive: false });"), 'touchmove must use passive: false');
    assert(eventsSlice.includes("window.addEventListener('touchend', onTouchEnd, { passive: false });"), 'touchend must use passive: false');

    // onTouchStart
    const touchStartSlice = eventsSlice.slice(eventsSlice.indexOf('function onTouchStart('), eventsSlice.indexOf('function onTouchMove('));
    assert(touchStartSlice.includes('e.preventDefault()'), 'onTouchStart must call e.preventDefault()');
    assert(touchStartSlice.includes('e.stopPropagation()'), 'onTouchStart must call e.stopPropagation()');
    assert(touchStartSlice.includes('hasScratchStarted = true'), 'onTouchStart must set hasScratchStarted = true');

    // onTouchMove
    const touchMoveSlice = eventsSlice.slice(eventsSlice.indexOf('function onTouchMove('), eventsSlice.indexOf('function onTouchEnd('));
    assert(touchMoveSlice.includes('e.preventDefault()'), 'onTouchMove must call e.preventDefault()');
    assert(touchMoveSlice.includes('e.stopPropagation()'), 'onTouchMove must call e.stopPropagation()');
    assert(touchMoveSlice.includes('hasScratchStarted = true'), 'onTouchMove must set hasScratchStarted = true');

    // onTouchEnd
    const touchEndSlice = eventsSlice.slice(eventsSlice.indexOf('function onTouchEnd('), eventsSlice.indexOf('function onMouseDown('));
    assert(touchEndSlice.includes('e.stopPropagation()'), 'onTouchEnd must call e.stopPropagation()');
});

// Test 3: Scratch brush radius is 26px with round lineCap, round lineJoin, and destination-out
test('3. Scratch brush uses 26px radius with round cap/join and destination-out composite mode', () => {
    const eventsSlice = appJs.slice(appJs.indexOf('function initScratchCardCanvasEvents('), appJs.indexOf('function checkScratchCompletion('));
    assert(eventsSlice.includes('const brushRadius = 26;'), 'Brush radius must be calibrated to 26px');
    assert(eventsSlice.includes("ctx.globalCompositeOperation = 'destination-out';"), 'Must use destination-out composite operation');
    assert(eventsSlice.includes("ctx.lineCap = 'round';"), 'Must use round lineCap');
    assert(eventsSlice.includes("ctx.lineJoin = 'round';"), 'Must use round lineJoin');
});

// Test 4: Threshold is 35% with 0.35s fade-out animation before clearing
test('4. Auto-reveal threshold triggers at 35% with 0.35s smooth fade-out animation', () => {
    const checkSlice = appJs.slice(appJs.indexOf('function checkScratchCompletion('), appJs.indexOf('function markScratchRewardPendingDelivery('));
    assert(checkSlice.includes('percentage >= 35'), 'Completion threshold must be 35%');

    const revealSlice = appJs.slice(appJs.indexOf('function revealScratchCardReward('), appJs.indexOf('// Trigger celebratory confetti blast'));
    assert(revealSlice.includes("canvas.style.transition = 'opacity 0.35s ease-out';"), 'Must set 0.35s ease-out transition');
    assert(revealSlice.includes("canvas.style.opacity = '0';"), 'Must animate opacity to 0');
    assert(revealSlice.includes("canvas.style.pointerEvents = 'none';"), 'Must disable pointer events during fade');
});

// Test 5: Canvas auto-refill guard: window.resize and setupScratchCanvas are blocked once scratching has initiated
test('5. Window resize and setupScratchCanvas are strictly blocked once scratching has started', () => {
    const modalSlice = appJs.slice(appJs.indexOf('function initScratchCardModal('), appJs.indexOf('function initScratchCardModal(') + 1200);
    assert(modalSlice.includes('!hasScratchStarted'), 'window.resize inside initScratchCardModal must check !hasScratchStarted before redrawing');

    const setupSlice = appJs.slice(appJs.indexOf('function setupScratchCanvas('), appJs.indexOf('function initScratchCardCanvasEvents('));
    assert(setupSlice.includes('if (hasScratchStarted && !forceReset)'), 'setupScratchCanvas must guard against redraw when hasScratchStarted is true');
});

// Test 6: VM runtime simulation verifying that setupScratchCanvas does not wipe scratch state when hasScratchStarted is true
test('6. Runtime simulation confirms setupScratchCanvas skips fillRect when hasScratchStarted is true', () => {
    let fillRectCallCount = 0;
    const mockCtx = {
        setTransform: () => {},
        scale: () => {},
        fillRect: () => { fillRectCallCount++; },
        createLinearGradient: () => ({ addColorStop: () => {} }),
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        strokeRect: () => {},
        save: () => {},
        restore: () => {},
        clearRect: () => {}
    };

    const mockCanvas = {
        id: 'scratch-interactive-canvas',
        getContext: () => mockCtx,
        width: 0,
        height: 0,
        style: {}
    };

    const mockStage = {
        id: 'scratch-card-stage',
        getBoundingClientRect: () => ({ width: 320, height: 215 }),
        offsetWidth: 320,
        offsetHeight: 215
    };

    const context = {
        window: { devicePixelRatio: 2 },
        document: {
            getElementById: (id) => {
                if (id === 'scratch-interactive-canvas') return mockCanvas;
                if (id === 'scratch-card-stage') return mockStage;
                return null;
            }
        },
        hasScratchStarted: false,
        initScratchCardCanvasEvents: () => {}
    };
    context.window.window = context.window;
    vm.createContext(context);

    const setupFnCode = appJs.slice(appJs.indexOf('function setupScratchCanvas('), appJs.indexOf('function initScratchCardCanvasEvents('));
    vm.runInContext(setupFnCode, context);

    // Initial setup on fresh modal: fillRect should be called to paint gold gradient
    context.hasScratchStarted = false;
    context.setupScratchCanvas({}, 25, false);
    const initialCalls = fillRectCallCount;
    assert(initialCalls > 0, 'Initial setup must paint gold overlay');

    // Scratching initiates: hasScratchStarted becomes true
    context.hasScratchStarted = true;

    // Simulate window resize or passive re-render triggering setupScratchCanvas without forceReset:
    context.setupScratchCanvas({}, 25, false);
    assert.strictEqual(fillRectCallCount, initialCalls, 'setupScratchCanvas MUST NOT call fillRect when hasScratchStarted is true (auto-refill bug prevented!)');

    // Force reset (modal open) should be allowed:
    context.setupScratchCanvas({}, 25, true);
    assert(fillRectCallCount > initialCalls, 'Force reset on new modal open should be permitted');
});

console.log(`\nALL ${passCount} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
