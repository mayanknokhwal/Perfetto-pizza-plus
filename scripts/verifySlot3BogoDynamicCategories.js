/**
 * verifySlot3BogoDynamicCategories.js
 * 
 * Verifies Part 2:
 * 1. Banner Slot #3 dynamic configuration:
 *    - buyCategory and freeCategory (or rewardCategory) loaded dynamically from Firestore / settings.
 *    - Preserves buyQty and freeQty without altering their parsing logic.
 * 2. Step 1 (Paid Items Selection):
 *    - Dynamically filters qualifying products by buyCategory (e.g. "Hot & Cold Coffee", "Momos", etc.).
 *    - Step 1 header dynamically displays: "PLEASE SELECT YOUR <buyQty> <BUYCATEGORY>".
 * 3. Step 2 (Free Reward Selection):
 *    - Dynamically filters qualifying free products by freeCategory (e.g. "Side Orders", "Shake", etc.).
 *    - Step 2 header dynamically displays: "CHOOSE YOUR <freeQty> FREE <FREECATEGORY>".
 * 4. Real Browser CDP verification:
 *    - Tests full DOM rendering and step transitions with multiple dynamic category pairings.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✓ PASS: ${testName}`);
    } else {
        console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    }
}

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9335;
const SERVER_PORT = 8091;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

class SimpleCDP {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.msgId = 0;
        this.callbacks = new Map();
    }

    async connect() {
        const WebSocket = require('ws');
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.on('open', () => resolve());
            this.ws.on('error', reject);
            this.ws.on('message', data => {
                const msg = JSON.parse(data.toString());
                if (msg.id && this.callbacks.has(msg.id)) {
                    const cb = this.callbacks.get(msg.id);
                    this.callbacks.delete(msg.id);
                    if (msg.error) cb.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
                    else cb.resolve(msg.result);
                }
            });
        });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++this.msgId;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async evaluate(expression) {
        const res = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
        }
        return res.result ? res.result.value : undefined;
    }

    close() {
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
        }
    }
}

async function runTests() {
    console.log('========================================================================');
    console.log('🧪 VERIFYING PART 2: DYNAMIC SLOT #3 BOGO CATEGORIES');
    console.log('========================================================================\n');

    // Section 1: Static Code Integrity Checks
    console.log('--- Step 1: Static Code Integrity Checks ---');
    const appJsContent = fs.readFileSync(path.resolve(__dirname, '..', 'app.js'), 'utf8');
    const publicAppJsContent = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'app.js'), 'utf8');
    const indexHtmlContent = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

    assert(appJsContent.includes('fetchBannerSlot3ConfigFromFirestore'), 'app.js contains fetchBannerSlot3ConfigFromFirestore helper');
    assert(publicAppJsContent.includes('fetchBannerSlot3ConfigFromFirestore'), 'public/app.js contains fetchBannerSlot3ConfigFromFirestore helper');
    assert(appJsContent.includes('bogo-step1-title'), 'app.js targets #bogo-step1-title for dynamic category header');
    assert(appJsContent.includes('bogo-step2-title'), 'app.js targets #bogo-step2-title for dynamic category header');
    assert(indexHtmlContent.includes('id="bogo-step1-title"'), 'index.html contains #bogo-step1-title element');
    assert(indexHtmlContent.includes('id="bogo-step2-title"'), 'index.html contains #bogo-step2-title element');

    // Section 2: Local Static Web Server
    console.log('\n--- Step 2: Starting Local Test Server ---');
    const rootDir = path.resolve(__dirname, '..');
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.webp': 'image/webp'
    };

    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
        const filePath = path.join(rootDir, reqPath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    });

    await new Promise(resolve => server.listen(SERVER_PORT, resolve));
    console.log(`Local test server running at http://127.0.0.1:${SERVER_PORT}`);

    // Section 3: Launch Chrome CDP Session
    console.log('\n--- Step 3: Launching Chrome CDP Instance ---');
    const tempProfile = path.resolve(__dirname, '..', 'scratch', 'chrome-slot3-test-profile');
    if (!fs.existsSync(tempProfile)) fs.mkdirSync(tempProfile, { recursive: true });

    const chromeProc = spawn(CHROME_PATH, [
        `--remote-debugging-port=${DEBUG_PORT}`,
        `--user-data-dir=${tempProfile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--headless=new',
        `http://127.0.0.1:${SERVER_PORT}/index.html`
    ], { stdio: 'ignore' });

    let cdp = null;
    try {
        let targets = null;
        for (let i = 0; i < 30; i++) {
            await sleep(500);
            try {
                targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
                if (targets && targets.length > 0) break;
            } catch (e) {}
        }

        if (!targets || targets.length === 0) {
            throw new Error('Failed to connect to Chrome debugging endpoint');
        }

        const pageTarget = targets.find(t => t.type === 'page');
        cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
        await cdp.connect();
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');

        await sleep(1500);

        // Section 4: Dynamic Category Test Pair 1: Coffee & Side Orders
        console.log('\n--- Step 4: Testing Dynamic Category Pairing: Hot & Cold Coffee + Side Orders ---');

        const testPair1Result = await cdp.evaluate(`
            (async () => {
                // Mock Slot #3 configuration: Buy 2 Coffee, Get 1 Side Orders FREE
                const mockSlot3 = {
                    id: 'b3',
                    bannerSlot: 3,
                    buyCategory: 'Hot & Cold Coffee',
                    buyQty: 2,
                    freeCategory: 'Side Orders',
                    rewardCategory: 'Side Orders',
                    freeQty: 1,
                    enabled: true,
                    url: ''
                };

                // Store in window.__currentActiveBanners and localStorage
                window.__currentActiveBanners = [
                    { id: 'b1', bannerSlot: 1 },
                    { id: 'b2', bannerSlot: 2 },
                    mockSlot3
                ];
                localStorage.setItem('perfetto_daily_banners', JSON.stringify(window.__currentActiveBanners));

                // Open BOGO combo modal with dynamic config
                await openBogoComboModal(mockSlot3);

                const modal = document.getElementById('bogo-combo-modal');
                const isModalVisible = modal && modal.style.display !== 'none';
                const step1Title = document.getElementById('bogo-step1-title')?.textContent?.trim() || '';
                const step1Target = document.getElementById('bogo-step1-target-val')?.textContent?.trim() || '';
                
                const step1Items = Array.from(document.querySelectorAll('#bogo-step1-items-grid .bogo-combo-item-card'));
                const step1Count = step1Items.length;

                // Check if all rendered items belong to coffee
                const currentState = typeof getCurrentBogoComboState === 'function' ? getCurrentBogoComboState() : null;
                const buyItems = currentState?.buyItems || [];
                const allItemsCoffee = buyItems.length > 0 && buyItems.every(i => isCategoryMatch(i.category, 'Hot & Cold Coffee'));

                return {
                    isModalVisible,
                    step1Title,
                    step1Target,
                    step1Count,
                    buyItemsLen: buyItems.length,
                    allItemsCoffee,
                    buyCategoryState: currentState?.config?.buyCategory,
                    freeCategoryState: currentState?.config?.freeCategory
                };
            })()
        `);

        assert(testPair1Result.isModalVisible === true, 'BOGO Combo modal opened successfully');
        assert(testPair1Result.step1Title === 'PLEASE SELECT YOUR 2 HOT & COLD COFFEE', `Step 1 title is dynamically updated to "PLEASE SELECT YOUR 2 HOT & COLD COFFEE" (Got: "${testPair1Result.step1Title}")`);
        assert(testPair1Result.step1Target === '2', `Step 1 target quantity is 2 (Preserved buyQty)`);
        assert(testPair1Result.buyItemsLen > 0, `Step 1 qualifying buy items populated (> 0 items, found ${testPair1Result.buyItemsLen})`);
        assert(testPair1Result.allItemsCoffee === true, 'All Step 1 qualifying items strictly belong to Coffee / Hot & Cold Coffee');

        // Test Step 2 Transition with Pair 1
        console.log('\n--- Step 5: Testing Step 2 Transition with Side Orders ---');
        const testPair1Step2Result = await cdp.evaluate(`
            (async () => {
                const currentState = getCurrentBogoComboState();
                const buyItems = currentState.buyItems;
                if (buyItems.length >= 2) {
                    const id1 = buyItems[0].id || buyItems[0].name;
                    const id2 = buyItems[1].id || buyItems[1].name;
                    onToggleBogoStep1Item(id1);
                    onToggleBogoStep1Item(id2);
                }

                // Advance to Step 2
                goToBogoStep(2);

                const step2Pane = document.getElementById('bogo-step2-pane');
                const isStep2Visible = step2Pane && step2Pane.style.display !== 'none';
                const step2Title = document.getElementById('bogo-step2-title')?.textContent?.trim() || '';
                const step2Target = document.getElementById('bogo-step2-target-val')?.textContent?.trim() || '';

                const rewardItems = currentState.rewardItems || [];
                const allItemsSideOrders = rewardItems.length > 0 && rewardItems.every(i => isCategoryMatch(i.category, 'Side Orders'));

                return {
                    isStep2Visible,
                    step2Title,
                    step2Target,
                    rewardItemsLen: rewardItems.length,
                    allItemsSideOrders
                };
            })()
        `);

        assert(testPair1Step2Result.isStep2Visible === true, 'Successfully transitioned to Step 2');
        assert(testPair1Step2Result.step2Title === 'CHOOSE YOUR 1 FREE SIDE ORDERS', `Step 2 title is dynamically updated to "CHOOSE YOUR 1 FREE SIDE ORDERS" (Got: "${testPair1Step2Result.step2Title}")`);
        assert(testPair1Step2Result.step2Target === '1', 'Step 2 target quantity is 1 (Preserved freeQty)');
        assert(testPair1Step2Result.rewardItemsLen > 0, `Step 2 qualifying reward items populated (> 0 items, found ${testPair1Step2Result.rewardItemsLen})`);
        assert(testPair1Step2Result.allItemsSideOrders === true, 'All Step 2 qualifying items strictly belong to Side Orders');

        // Section 5: Dynamic Category Test Pair 2: Momos & Shake
        console.log('\n--- Step 6: Testing Dynamic Category Pairing: Momos + Shake (Admin Dynamic Update) ---');

        const testPair2Result = await cdp.evaluate(`
            (async () => {
                closeBogoComboModal();

                // Admin dynamic change: Buy 2 Momos, Get 1 Shake FREE
                const mockSlot3Pair2 = {
                    id: 'b3',
                    bannerSlot: 3,
                    buyCategory: 'Momos',
                    buyQty: 2,
                    freeCategory: 'Shake',
                    rewardCategory: 'Shake',
                    freeQty: 1,
                    enabled: true,
                    url: ''
                };

                window.__currentActiveBanners = [
                    { id: 'b1', bannerSlot: 1 },
                    { id: 'b2', bannerSlot: 2 },
                    mockSlot3Pair2
                ];
                localStorage.setItem('perfetto_daily_banners', JSON.stringify(window.__currentActiveBanners));

                // Re-open BOGO combo modal with updated config
                await openBogoComboModal(mockSlot3Pair2);

                const step1Title = document.getElementById('bogo-step1-title')?.textContent?.trim() || '';
                const currentState = getCurrentBogoComboState();
                const buyItems = currentState?.buyItems || [];
                const allItemsMomos = buyItems.length > 0 && buyItems.every(i => isCategoryMatch(i.category, 'Momos'));

                // Select 2 momos and go to Step 2
                if (buyItems.length >= 2) {
                    const id1 = buyItems[0].id || buyItems[0].name;
                    const id2 = buyItems[1].id || buyItems[1].name;
                    onToggleBogoStep1Item(id1);
                    onToggleBogoStep1Item(id2);
                }
                goToBogoStep(2);

                const step2Title = document.getElementById('bogo-step2-title')?.textContent?.trim() || '';
                const rewardItems = currentState?.rewardItems || [];
                const allItemsShake = rewardItems.length > 0 && rewardItems.every(i => isCategoryMatch(i.category, 'Shake'));

                return {
                    step1Title,
                    allItemsMomos,
                    buyItemsLen: buyItems.length,
                    step2Title,
                    allItemsShake,
                    rewardItemsLen: rewardItems.length
                };
            })()
        `);

        assert(testPair2Result.step1Title === 'PLEASE SELECT YOUR 2 MOMOS', `Step 1 dynamically updated to "PLEASE SELECT YOUR 2 MOMOS" (Got: "${testPair2Result.step1Title}")`);
        assert(testPair2Result.allItemsMomos === true, 'All Step 1 qualifying items strictly belong to Momos');
        assert(testPair2Result.buyItemsLen > 0, `Qualifying momos items found (${testPair2Result.buyItemsLen})`);
        assert(testPair2Result.step2Title === 'CHOOSE YOUR 1 FREE SHAKE', `Step 2 dynamically updated to "CHOOSE YOUR 1 FREE SHAKE" (Got: "${testPair2Result.step2Title}")`);
        assert(testPair2Result.allItemsShake === true, 'All Step 2 qualifying items strictly belong to Shake');
        assert(testPair2Result.rewardItemsLen > 0, `Qualifying shake items found (${testPair2Result.rewardItemsLen})`);

        // Section 6: Dynamic Category Test Pair 3: Custom Quantities (Buy 3, Free 2)
        console.log('\n--- Step 7: Testing Custom Dynamic Quantities (Buy 3, Free 2) ---');

        const testPair3Result = await cdp.evaluate(`
            (async () => {
                closeBogoComboModal();

                const mockSlot3Pair3 = {
                    id: 'b3',
                    bannerSlot: 3,
                    buyCategory: 'Chinese',
                    buyQty: 3,
                    freeCategory: 'Desserts',
                    rewardCategory: 'Desserts',
                    freeQty: 2,
                    enabled: true
                };

                window.__currentActiveBanners = [
                    { id: 'b1', bannerSlot: 1 },
                    { id: 'b2', bannerSlot: 2 },
                    mockSlot3Pair3
                ];
                localStorage.setItem('perfetto_daily_banners', JSON.stringify(window.__currentActiveBanners));

                await openBogoComboModal(mockSlot3Pair3);

                const step1Title = document.getElementById('bogo-step1-title')?.textContent?.trim() || '';
                const step1Target = document.getElementById('bogo-step1-target-val')?.textContent?.trim() || '';
                const currentState = getCurrentBogoComboState();

                // Select 3 Chinese items
                const buyItems = currentState?.buyItems || [];
                if (buyItems.length >= 3) {
                    onToggleBogoStep1Item(buyItems[0].id || buyItems[0].name);
                    onToggleBogoStep1Item(buyItems[1].id || buyItems[1].name);
                    onToggleBogoStep1Item(buyItems[2].id || buyItems[2].name);
                }
                goToBogoStep(2);

                const step2Title = document.getElementById('bogo-step2-title')?.textContent?.trim() || '';
                const step2Target = document.getElementById('bogo-step2-target-val')?.textContent?.trim() || '';

                return {
                    step1Title,
                    step1Target,
                    step2Title,
                    step2Target
                };
            })()
        `);

        assert(testPair3Result.step1Title === 'PLEASE SELECT YOUR 3 CHINESE', `Step 1 dynamically reflects Buy Qty 3 ("${testPair3Result.step1Title}")`);
        assert(testPair3Result.step1Target === '3', 'Step 1 target val is 3');
        assert(testPair3Result.step2Title === 'CHOOSE YOUR 2 FREE DESSERTS', `Step 2 dynamically reflects Free Qty 2 ("${testPair3Result.step2Title}")`);
        assert(testPair3Result.step2Target === '2', 'Step 2 target val is 2');

    } finally {
        if (cdp) cdp.close();
        try { chromeProc.kill(); } catch (e) {}
        try { server.close(); } catch (e) {}
    }

    console.log('\n========================================================================');
    console.log(`📊 FINAL RESULTS: ${passedTests}/${totalTests} Tests Passed`);
    console.log('========================================================================\n');

    if (passedTests === totalTests) {
        console.log('🎉 ALL PART 2 DYNAMIC SLOT #3 BOGO TESTS PASSED PERFECTLY!\n');
        process.exit(0);
    } else {
        console.error('❌ SOME TESTS FAILED. PLEASE CHECK OUTPUT.\n');
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
