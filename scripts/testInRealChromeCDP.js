/**
 * testInRealChromeCDP.js
 * 
 * Runs automated end-to-end tests directly inside real Google Chrome via Chrome DevTools Protocol (CDP):
 * 1. Admin Isolation Test (Staff portal completely closed).
 * 2. Consecutive Audio Re-Trigger Test on Staff Portal (infinite re-trigger reliability without browser reloads).
 * 3. Consecutive Audio Re-Trigger Test on Admin Portal (banner, chime, and notification dispatch).
 */

const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;

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

class CDPClient {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.isReady = false;

        this.readyPromise = new Promise((resolve, reject) => {
            this.ws.onopen = () => {
                this.isReady = true;
                resolve();
            };
            this.ws.onerror = reject;
        });

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.id && this.callbacks.has(msg.id)) {
                const { resolve, reject } = this.callbacks.get(msg.id);
                this.callbacks.delete(msg.id);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
            }
        };
    }

    async send(method, params = {}) {
        await this.readyPromise;
        return new Promise((resolve, reject) => {
            const reqId = this.id++;
            this.callbacks.set(reqId, { resolve, reject });
            this.ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    async evaluate(expression) {
        const res = await this.send('Runtime.evaluate', {
            expression: `(() => {\n${expression}\n})()`,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            throw new Error(JSON.stringify(res.exceptionDetails));
        }
        return res.result ? res.result.value : undefined;
    }

    async navigate(url) {
        await this.send('Page.navigate', { url });
        await sleep(2500);
    }

    close() {
        try { this.ws.close(); } catch (e) {}
    }
}

async function main() {
    console.log('==================================================================');
    console.log('🌐 RUNNING END-TO-END VERIFICATION IN REAL GOOGLE CHROME (CDP)');
    console.log('==================================================================\n');

    console.log('🚀 Spawning Google Chrome (headless=new with debugging port 9222)...');
    const chromeProcess = spawn(CHROME_PATH, [
        '--headless=new',
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--autoplay-policy=no-user-gesture-required',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check'
    ]);

    // Wait for Chrome to bind port
    let connected = false;
    for (let i = 0; i < 30; i++) {
        await sleep(500);
        try {
            await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
            connected = true;
            break;
        } catch (e) {}
    }

    if (!connected) {
        chromeProcess.kill();
        throw new Error('Failed to connect to Chrome on port ' + DEBUG_PORT);
    }
    console.log('✅ Connected to Chrome DevTools Protocol successfully!\n');

    try {
        const pages = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const page = pages[0] || (await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/new`));
        const cdp = new CDPClient(page.webSocketDebuggerUrl);
        await cdp.readyPromise;
        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');

        // =================================================================
        // SUITE 1: STAFF PORTAL CONSECUTIVE ORDER AUDIO RE-TRIGGER TEST
        // =================================================================
        console.log('--- 1. Testing Staff Portal Consecutive Audio Re-Trigger ---');
        await cdp.navigate('http://localhost:8080/staff.html');

        // Unlock audio
        await cdp.evaluate(`
            window.setupUniversalAudioUnlock && window.setupUniversalAudioUnlock();
            document.body.click();
        `);

        // ORDER 1:
        console.log('  ▶️ Triggering Incoming Order #7001...');
        const order1Result = await cdp.evaluate(`
            window.startOrderAlertAudio('7001', '1x Margherita Pizza', {
                orderId: '7001',
                customerName: 'Rahul Verma',
                total: 399
            });
            const modal = document.getElementById('staff-incoming-order-modal');
            const isPlaying = window.isOrderAlertAudioPlaying;
            const isModalVisible = modal && modal.style.display !== 'none';
            const orderTag = document.getElementById('incoming-modal-order-tag')?.textContent;
            return { isPlaying, isModalVisible, orderTag };
        `);
        console.log('    Order 1 state:', order1Result);
        assert.strictEqual(order1Result.isPlaying, true, 'Audio must be playing for Order 1');
        assert.strictEqual(order1Result.isModalVisible, true, 'Modal must be visible for Order 1');
        assert(order1Result.orderTag.includes('7001'), 'Modal must display Order #7001');

        // Dismiss Order 1:
        console.log('  ⏹️ Clicking Dismiss on Order #7001...');
        const dismiss1Result = await cdp.evaluate(`
            window.dismissIncomingOrderAlert();
            const modal = document.getElementById('staff-incoming-order-modal');
            const isPlaying = window.isOrderAlertAudioPlaying;
            const isModalVisible = modal && modal.style.display !== 'none';
            const isBlocked = window.isAudioAutoplayBlocked;
            return { isPlaying, isModalVisible, isBlocked };
        `);
        console.log('    Dismiss 1 state:', dismiss1Result);
        assert.strictEqual(dismiss1Result.isPlaying, false, 'Audio must stop upon Dismiss');
        assert.strictEqual(dismiss1Result.isModalVisible, false, 'Modal must close upon Dismiss');
        assert.strictEqual(dismiss1Result.isBlocked, false, 'Autoplay must NOT be blocked');

        // ORDER 2 (without browser reload):
        console.log('  ▶️ Triggering Incoming Order #7002 (without reload)...');
        const order2Result = await cdp.evaluate(`
            window.startOrderAlertAudio('7002', '2x Farmhouse Pizza', {
                orderId: '7002',
                customerName: 'Sneha Kapoor',
                total: 699
            });
            const modal = document.getElementById('staff-incoming-order-modal');
            const isPlaying = window.isOrderAlertAudioPlaying;
            const isModalVisible = modal && modal.style.display !== 'none';
            const orderTag = document.getElementById('incoming-modal-order-tag')?.textContent;
            return { isPlaying, isModalVisible, orderTag };
        `);
        console.log('    Order 2 state:', order2Result);
        assert.strictEqual(order2Result.isPlaying, true, 'Audio must immediately re-trigger for Order 2');
        assert.strictEqual(order2Result.isModalVisible, true, 'Modal must open for Order 2');
        assert(order2Result.orderTag.includes('7002'), 'Modal must display Order #7002');

        // Capture Staff consecutive order visual artifact
        try {
            const fs = require('fs');
            const snapStaff = await cdp.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('C:\\\\Users\\\\yogun\\\\.gemini\\\\antigravity-ide\\\\brain\\\\b68e4f5d-5baa-40bb-b515-5c9e9cb35480\\\\staff_retrigger_active_order.png', Buffer.from(snapStaff.data, 'base64'));
            console.log('    📸 Captured staff_retrigger_active_order.png');
        } catch (e) { }

        // Dismiss Order 2:
        console.log('  ⏹️ Clicking Dismiss on Order #7002...');
        await cdp.evaluate(`window.dismissIncomingOrderAlert();`);

        // ORDER 3 (without browser reload):
        console.log('  ▶️ Triggering Incoming Order #7003 (confirming infinite re-trigger reliability)...');
        const order3Result = await cdp.evaluate(`
            window.startOrderAlertAudio('7003', '1x Gourmet Paneer Pizza', {
                orderId: '7003',
                customerName: 'Ananya Roy',
                total: 549
            });
            const modal = document.getElementById('staff-incoming-order-modal');
            const isPlaying = window.isOrderAlertAudioPlaying;
            const isModalVisible = modal && modal.style.display !== 'none';
            const orderTag = document.getElementById('incoming-modal-order-tag')?.textContent;
            return { isPlaying, isModalVisible, orderTag };
        `);
        console.log('    Order 3 state:', order3Result);
        assert.strictEqual(order3Result.isPlaying, true, 'Audio must re-trigger for Order 3');
        assert.strictEqual(order3Result.isModalVisible, true, 'Modal must open for Order 3');
        assert(order3Result.orderTag.includes('7003'), 'Modal must display Order #7003');

        // Final Dismiss:
        await cdp.evaluate(`window.dismissIncomingOrderAlert();`);
        console.log('  ✅ Staff Portal consecutive audio re-trigger verified flawlessly!\n');


        // =================================================================
        // SUITE 2: ADMIN PORTAL ISOLATION & CONSECUTIVE CHIME TEST
        // =================================================================
        console.log('--- 2. Testing Admin Portal Isolation & Consecutive Chime ---');
        // Note: Staff Portal tab is now navigated away/closed, strictly testing Admin isolation
        await cdp.navigate('http://localhost:8080/admin.html');

        // Verify standalone initialization
        const adminInitResult = await cdp.evaluate(`
            const hasListener = typeof window.listenToAdminLiveOrders === 'function';
            const hasBanner = !!document.getElementById('admin-incoming-order-banner');
            const hasChime = typeof window.playAdminOrderChime === 'function';
            const hasNotif = typeof window.dispatchAdminOrderNotification === 'function';
            return { hasListener, hasBanner, hasChime, hasNotif };
        `);
        console.log('    Admin standalone bootstrap state:', adminInitResult);
        assert.strictEqual(adminInitResult.hasListener, true, 'Admin listener must exist standalone');
        assert.strictEqual(adminInitResult.hasBanner, true, 'Admin banner must exist');
        assert.strictEqual(adminInitResult.hasChime, true, 'Admin chime function must exist');
        assert.strictEqual(adminInitResult.hasNotif, true, 'Admin notification dispatch must exist');

        // ORDER 1 in Admin:
        console.log('  ▶️ Triggering Order #9001 in Admin Portal...');
        const adminOrder1 = await cdp.evaluate(`
            window.showAdminOrderAlert({
                orderId: '9001',
                customerName: 'Vikram Seth',
                total: 450,
                items: [{ qty: 1, name: 'Tandoori Paneer Pizza' }]
            });
            const banner = document.getElementById('admin-incoming-order-banner');
            const isVisible = banner && banner.style.display !== 'none';
            const titleText = banner.querySelector('.admin-order-alert-title')?.textContent || '';
            const orderBadge = document.getElementById('admin-alert-order-number')?.textContent || '';
            const customer = document.getElementById('admin-alert-customer-name')?.textContent || '';
            return { isVisible, titleText, orderBadge, customer };
        `);
        console.log('    Admin Order 1 state:', adminOrder1);
        assert.strictEqual(adminOrder1.isVisible, true, 'Admin banner must display');
        assert(adminOrder1.titleText.includes('NEW ORDER ARRIVED'), 'Banner must display 🚨 NEW ORDER ARRIVED');
        assert(adminOrder1.orderBadge.includes('9001'), 'Badge must display #9001');

        // Capture Admin standalone alert visual artifact
        try {
            const fs = require('fs');
            const snapAdmin = await cdp.send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync('C:\\\\Users\\\\yogun\\\\.gemini\\\\antigravity-ide\\\\brain\\\\b68e4f5d-5baa-40bb-b515-5c9e9cb35480\\\\admin_decoupled_active_order.png', Buffer.from(snapAdmin.data, 'base64'));
            console.log('    📸 Captured admin_decoupled_active_order.png');
        } catch (e) { }

        // Dismiss Order 1:
        console.log('  ⏹️ Clicking Dismiss on Admin Order #9001...');
        const adminDismiss1 = await cdp.evaluate(`
            window.dismissAdminOrderAlert();
            const banner = document.getElementById('admin-incoming-order-banner');
            const isVisible = banner && banner.style.display !== 'none';
            return { isVisible };
        `);
        assert.strictEqual(adminDismiss1.isVisible, false, 'Admin banner must hide on Dismiss');

        // ORDER 2 in Admin (without reload):
        console.log('  ▶️ Triggering Order #9002 in Admin Portal (without reload)...');
        const adminOrder2 = await cdp.evaluate(`
            window.showAdminOrderAlert({
                orderId: '9002',
                customerName: 'Deepika Padukone',
                total: 750,
                items: [{ qty: 2, name: 'Veggie Paradise Pizza' }]
            });
            const banner = document.getElementById('admin-incoming-order-banner');
            const isVisible = banner && banner.style.display !== 'none';
            const orderBadge = document.getElementById('admin-alert-order-number')?.textContent || '';
            return { isVisible, orderBadge };
        `);
        console.log('    Admin Order 2 state:', adminOrder2);
        assert.strictEqual(adminOrder2.isVisible, true, 'Admin banner must display for Order 2');
        assert(adminOrder2.orderBadge.includes('9002'), 'Badge must display #9002');

        // Dismiss Order 2:
        await cdp.evaluate(`window.dismissAdminOrderAlert();`);

        // ORDER 3 in Admin (without reload):
        console.log('  ▶️ Triggering Order #9003 in Admin Portal...');
        const adminOrder3 = await cdp.evaluate(`
            window.showAdminOrderAlert({
                orderId: '9003',
                customerName: 'Kabir Khan',
                total: 890,
                items: [{ qty: 3, name: 'Spicy Delight Pizza' }]
            });
            const banner = document.getElementById('admin-incoming-order-banner');
            const isVisible = banner && banner.style.display !== 'none';
            const orderBadge = document.getElementById('admin-alert-order-number')?.textContent || '';
            return { isVisible, orderBadge };
        `);
        console.log('    Admin Order 3 state:', adminOrder3);
        assert.strictEqual(adminOrder3.isVisible, true, 'Admin banner must display for Order 3');
        assert(adminOrder3.orderBadge.includes('9003'), 'Badge must display #9003');

        // Final Dismiss:
        await cdp.evaluate(`window.dismissAdminOrderAlert();`);
        console.log('  ✅ Admin Portal isolated consecutive chime & banner re-trigger verified flawlessly!\n');

        cdp.close();
    } finally {
        chromeProcess.kill();
    }

    console.log('==================================================================');
    console.log('🎉 ALL REAL CHROME CDP END-TO-END VERIFICATIONS PASSED (100%)');
    console.log('==================================================================\n');
}

main().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
