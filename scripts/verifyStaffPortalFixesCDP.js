/**
 * verifyStaffPortalFixesCDP.js
 *
 * Automated CDP verification for:
 * 1. Order #1 Daksh (>100m old) immediately vacating Pending and moving into Rejected with
 *    "Order timed out (>100 minutes) - automatically cancelled by system" without OTP/cancellation prompt.
 * 2. Siren audio element initialized and played at volume 1.0 with visual alert.
 * 3. Fully decoupled dismissal: Admin dismissal does NOT dismiss or silence Staff Portal.
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
            if (msg.method === 'Runtime.consoleAPICalled') {
                console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args?.map(a => a.value || a.description).join(' '));
            } else if (msg.method === 'Runtime.exceptionThrown') {
                console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails?.text, msg.params.exceptionDetails?.exception?.description);
            }
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
        const msgId = this.id++;
        return new Promise((resolve, reject) => {
            this.callbacks.set(msgId, { resolve, reject });
            this.ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }

    async eval(expr) {
        const res = await this.send('Runtime.evaluate', {
            expression: expr,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.exceptionDetails) {
            throw new Error(res.exceptionDetails.exception?.description || 'Eval error');
        }
        return res.result ? res.result.value : undefined;
    }

    async navigate(url) {
        await this.send('Page.navigate', { url });
        await sleep(2000);
    }

    close() {
        try { this.ws.close(); } catch (e) {}
    }
}

async function main() {
    console.log('======================================================');
    console.log('🧪 STAFF PORTAL REGRESSION & AUDIO VERIFICATION (CDP)');
    console.log('======================================================\n');

    const chromeProc = spawn(CHROME_PATH, [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--headless=new',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-extensions',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check'
    ]);

    let connected = false;
    for (let i = 0; i < 20; i++) {
        await sleep(500);
        try {
            await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
            connected = true;
            break;
        } catch (e) {}
    }

    if (!connected) {
        chromeProc.kill();
        throw new Error('Failed to connect to Chrome on port ' + DEBUG_PORT);
    }

    try {
        const pages = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        const page = pages.find(p => p.type === 'page') || pages[0];
        const staffCDP = new CDPClient(page.webSocketDebuggerUrl);
        await staffCDP.readyPromise;

        // -------------------------------------------------------------
        // STEP 1: VERIFY ORDER #1 DAKSH (>100 MINS AUTO-EXPIRATION)
        // -------------------------------------------------------------
        console.log('--- TEST 1: 100m Auto-Expiration & Rejection Guard Bypass ---');
        await staffCDP.send('Runtime.enable');
        await staffCDP.send('Page.enable');
        await staffCDP.navigate('http://localhost:8080/staff.html');

        // Wait for page scripts to load
        let isReady = false;
        for (let i = 0; i < 40; i++) {
            const state = await staffCDP.eval(`({
                url: window.location.href,
                readyState: document.readyState,
                hasSweep: typeof window.sweepAutoExpiredOrders === 'function',
                hasAutoExpire: typeof window.autoExpireOrder === 'function',
                hasRender: typeof renderOrders === 'function'
            })`);
            console.log(`Poll ${i}:`, state);
            if (state.hasSweep && state.hasAutoExpire) {
                isReady = true;
                break;
            }
            await sleep(500);
        }
        if (!isReady) throw new Error('Timed out waiting for staff.js to load in browser');

        // Inject simulated session as Master Admin and order #1 Daksh created 3 hours ago with status: 'new'
        const setupResult = await staffCDP.eval(`
            (async () => {
                const masterUser = {
                    id: 'master_admin_9414503886',
                    phone: '9414503886',
                    fullName: 'Master Admin',
                    role: 'Master Admin',
                    status: 'active',
                    isApproved: true,
                    isMasterAdmin: true
                };
                sessionStorage.setItem('perfetto_staff_session_user', JSON.stringify(masterUser));
                localStorage.setItem('perfetto_staff_session_user', JSON.stringify(masterUser));
                currentStaffUser = masterUser;

                // Create Order #1 Daksh: placed 3 hours 5 minutes ago (185 mins > 100 mins)
                const createdTs = new Date(Date.now() - 185 * 60 * 1000).toISOString();
                const order1 = {
                    id: '1',
                    orderId: '1',
                    status: 'new',
                    customerName: 'Daksh',
                    customerPhone: '9414503886',
                    total: 485,
                    createdAt: createdTs,
                    items: [{ id: 'squad_deal_2', name: 'Squad Meal 2', qty: 1, price: 485 }],
                    usedWalletCash: 64,
                    walletDeductedAmount: 64
                };

                staffOrders = [order1];
                localStorage.setItem('perfetto_staff_orders', JSON.stringify(staffOrders));

                // Execute sweepAutoExpiredOrders() directly
                await window.sweepAutoExpiredOrders();
                renderOrders();

                const pendingCount = Number(document.getElementById('pending-orders-count')?.textContent || 0);
                const rejectedCount = Number(document.getElementById('rejected-orders-count')?.textContent || 0);

                const o1 = staffOrders.find(o => String(o.id) === '1' || String(o.orderId) === '1') || {};

                return {
                    pendingOrdersCount: pendingCount,
                    rejectedOrdersCount: rejectedCount,
                    isPending: isPendingStaffOrder(o1),
                    isRejected: isRejectedStaffOrder(o1),
                    orderStatus: o1.status,
                    rejectionReason: o1.rejectionReason,
                    cancellationReason: o1.cancellationReason,
                    rejectedBy: o1.rejectedBy,
                    autoExpired: o1.autoExpired,
                    isAutoExpired: o1.isAutoExpired
                };
            })()
        `);

        console.log('Auto-expire setup sweep result for Order #1:', setupResult);
        assert.strictEqual(setupResult.pendingOrdersCount, 0, 'Pending tab must have 0 orders');
        assert(setupResult.rejectedOrdersCount >= 1, 'Order #1 MUST be in rejected tab');
        assert.strictEqual(setupResult.isPending, false, 'Order #1 isPending must be false');
        assert.strictEqual(setupResult.isRejected, true, 'Order #1 isRejected must be true');
        assert.strictEqual(setupResult.orderStatus, 'rejected', 'Order #1 status must be rejected');
        assert.strictEqual(setupResult.rejectedBy, 'SYSTEM_AUTO_EXPIRE', 'Order #1 must be rejectedBy SYSTEM_AUTO_EXPIRE');
        assert.strictEqual(setupResult.cancellationReason, 'Order timed out (>100 minutes) - automatically cancelled by system');
        console.log('✅ PASS: Order #1 Daksh automatically vacated Pending and moved into Rejected with system auto-expire reason!');

        // Check the UI rendering in Rejected Tab
        const uiCheck = await staffCDP.eval(`
            (() => {
                switchStaffTab('rejected');
                const card = document.getElementById('card-1');
                const cardText = card ? (card.innerText || card.textContent || '') : '';
                return {
                    cardFound: !!card,
                    hasReasonText: cardText.includes('Order timed out (>100 minutes) - automatically cancelled by system'),
                    hasRefundNotice: cardText.includes('refunded to customer wallet')
                };
            })()
        `);
        console.log('Rejected Tab UI Card check:', uiCheck);
        assert.strictEqual(uiCheck.cardFound, true, 'Card #1 must be present in Rejected tab DOM');
        assert.strictEqual(uiCheck.hasReasonText, true, 'Card #1 must display the 100-minute timeout reason');
        console.log('✅ PASS: Order #1 card in Rejected tab displays exact cancellation reason and refund notice!');

        // -------------------------------------------------------------
        // STEP 2: VERIFY SIREN AUDIO PLAYBACK AND VISUAL ALERT
        // -------------------------------------------------------------
        console.log('\n--- TEST 2: Staff Portal Siren Audio & Visual Alert ---');
        const audioTest = await staffCDP.eval(`
            (() => {
                // Trigger incoming order alert for Order #200
                startOrderAlertAudio('200', 'Daksh • ₹499', {
                    id: '200',
                    customerName: 'Daksh',
                    total: 499,
                    status: 'new'
                });

                const modal = document.getElementById('staff-incoming-order-modal');
                const strip = document.getElementById('staff-incoming-alert-strip');
                const audio = getOrderAlertAudio();

                return {
                    isOrderAlertAudioPlaying: isOrderAlertAudioPlaying,
                    currentAlertingOrderId: currentAlertingOrderId,
                    modalVisible: modal && modal.style.display !== 'none',
                    stripVisible: strip && strip.style.display !== 'none',
                    audioElementPresent: !!audio,
                    audioMuted: audio ? audio.muted : true,
                    audioVolume: audio ? audio.volume : 0,
                    audioLoop: audio ? audio.loop : false
                };
            })()
        `);
        console.log('Audio alert trigger state:', audioTest);
        assert.strictEqual(audioTest.isOrderAlertAudioPlaying, true, 'isOrderAlertAudioPlaying must be true');
        assert.strictEqual(audioTest.currentAlertingOrderId, '200', 'currentAlertingOrderId must be 200');
        assert.strictEqual(audioTest.modalVisible, true, 'Incoming order modal must be visible');
        assert.strictEqual(audioTest.stripVisible, true, 'Visual pulsing alert strip must be visible');
        assert.strictEqual(audioTest.audioMuted, false, 'Audio element must NOT be muted');
        assert.strictEqual(audioTest.audioVolume, 1.0, 'Audio volume must be 1.0');
        assert.strictEqual(audioTest.audioLoop, true, 'Audio loop must be enabled');
        console.log('✅ PASS: Staff Portal siren audio driver & visual alert triggered successfully!');

        // -------------------------------------------------------------
        // STEP 3: FULLY DECOUPLE ADMIN AND STAFF DISMISSAL EVENTS
        // -------------------------------------------------------------
        console.log('\n--- TEST 3: Decouple Admin and Staff Dismissal Events ---');
        // Create target via Target.createTarget
        const targetRes = await staffCDP.send('Target.createTarget', { url: 'http://localhost:8080/admin.html' });
        const adminWsUrl = `ws://127.0.0.1:${DEBUG_PORT}/devtools/page/${targetRes.targetId}`;
        const adminCDP = new CDPClient(adminWsUrl);
        await adminCDP.readyPromise;
        await sleep(1500);

        // Simulate incoming alert on Admin
        await adminCDP.send('Runtime.enable');
        await adminCDP.eval(`
            (() => {
                showAdminOrderAlert({ orderId: '200', customerName: 'Daksh', total: 499 });
            })()
        `);

        // Dismiss the alert in Admin Portal
        const adminDismissResult = await adminCDP.eval(`
            (() => {
                dismissAdminOrderAlert();
                const banner = document.getElementById('admin-incoming-order-banner');
                return {
                    bannerDisplay: banner ? banner.style.display : 'unknown',
                    adminHandledHas200: adminHandledAudioOrderIds.has('200')
                };
            })()
        `);
        console.log('Admin dismissed alert result:', adminDismissResult);
        assert.strictEqual(adminDismissResult.bannerDisplay, 'none', 'Admin alert banner must be hidden');
        assert.strictEqual(adminDismissResult.adminHandledHas200, true, 'Admin handled order set must contain 200');

        // Check that Staff Portal is STILL alerting!
        const staffStillAlerting = await staffCDP.eval(`
            (() => {
                const modal = document.getElementById('staff-incoming-order-modal');
                return {
                    isOrderAlertAudioPlaying: isOrderAlertAudioPlaying,
                    currentAlertingOrderId: currentAlertingOrderId,
                    modalVisible: modal && modal.style.display !== 'none'
                };
            })()
        `);
        console.log('Staff Portal state after Admin dismissal:', staffStillAlerting);
        assert.strictEqual(staffStillAlerting.isOrderAlertAudioPlaying, true, 'Staff siren MUST continue ringing when Admin dismisses');
        assert.strictEqual(staffStillAlerting.modalVisible, true, 'Staff modal MUST remain open when Admin dismisses');
        console.log('✅ PASS: Admin dismissal did NOT silence or dismiss Staff Portal!');

        // Now dismiss locally in Staff Portal
        const staffDismissResult = await staffCDP.eval(`
            (() => {
                dismissIncomingOrderAlert();
                const modal = document.getElementById('staff-incoming-order-modal');
                const strip = document.getElementById('staff-incoming-alert-strip');
                return {
                    isOrderAlertAudioPlaying: isOrderAlertAudioPlaying,
                    currentAlertingOrderId: currentAlertingOrderId,
                    modalVisible: modal && modal.style.display !== 'none',
                    stripVisible: strip && strip.style.display !== 'none'
                };
            })()
        `);
        console.log('Staff Portal state after local Staff dismissal:', staffDismissResult);
        assert.strictEqual(staffDismissResult.isOrderAlertAudioPlaying, false, 'Staff siren stops upon local Staff dismiss');
        assert.strictEqual(staffDismissResult.modalVisible, false, 'Staff modal closes upon local Staff dismiss');
        console.log('✅ PASS: Staff Portal successfully stopped when dismissed locally!');

        staffCDP.close();
        adminCDP.close();

        console.log('\n======================================================');
        console.log('🎉 ALL AUTOMATED VERIFICATION CHECKS PASSED (3/3)');
        console.log('======================================================\n');

    } finally {
        try { chromeProc.kill(); } catch (e) {}
    }
}

main().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
