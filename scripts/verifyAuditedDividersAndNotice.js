/**
 * verifyAuditedDividersAndNotice.js
 * 
 * Verifies Part 1 requirements:
 * 1. Strict Isolation: No staff/admin files touched.
 * 2. Profile Header: Only single centered "Edit Profile" action button (no duplicate header logout).
 * 3. Account Settings Dividers: Single hairline divider between consecutive rows, no double borders, no trailing border on Log Out.
 * 4. Store Notice Subtext: Single-line ellipsis truncation with uniform row height matching standard items.
 * 5. Live verification in Headless Chrome via CDP in mobile viewport.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

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
const DEBUG_PORT = 9345;
const SERVER_PORT = 8097;

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

    send(method, params = {}) {
        const id = this.id++;
        return new Promise((resolve, reject) => {
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
            throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
        }
        return res.result?.value;
    }

    close() {
        try {
            this.ws.close();
        } catch (e) {}
    }
}

async function run() {
    console.log('=================================================================');
    console.log('🔍 AUDIT & IDEMPOTENT VERIFICATION: PART 1');
    console.log('=================================================================\n');

    // 1. Strict Isolation Check
    console.log('📋 [1/3] Static Code Structure & Isolation Audit...');
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    const touchedStaffOrAdmin = gitStatus.split('\n').some(line => line.includes('staff.') || line.includes('admin.'));
    assert(!touchedStaffOrAdmin, 'STRICT ISOLATION: No staff or admin files have been modified');

    // Static HTML/CSS check
    const rootIndex = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const pubIndex = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const rootCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

    assert(!rootIndex.includes('id="btn-header-logout"'), 'index.html: No duplicate header logout button');
    assert(!pubIndex.includes('id="btn-header-logout"'), 'public/index.html: No duplicate header logout button');
    assert(rootIndex.includes('id="btn-toggle-edit-profile"'), 'index.html: Single Edit Profile action button present');
    assert(pubIndex.includes('id="btn-toggle-edit-profile"'), 'public/index.html: Single Edit Profile action button present');
    assert(rootIndex.includes('account-settings-card settings-list'), 'index.html: Account settings classes applied');
    assert(pubIndex.includes('account-settings-card settings-list'), 'public/index.html: Account settings classes applied');

    // 2. Start Local HTTP Server
    console.log('\n🌐 [2/3] Starting Local Server & Headless Chrome Simulation...');
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.webp': 'image/webp',
        '.mp3': 'audio/mpeg'
    };

    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
        const filePath = path.join(__dirname, '..', reqPath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
            res.end(fs.readFileSync(filePath));
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    await new Promise(resolve => server.listen(SERVER_PORT, resolve));
    console.log(`  Local server listening on http://localhost:${SERVER_PORT}`);

    // Launch Chrome in mobile viewport
    const tempProfile = path.join(__dirname, '..', '.temp_audit_cdp_profile');
    const chrome = spawn(CHROME_PATH, [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--headless=new',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-gpu',
        '--window-size=390,844',
        `--user-data-dir=${tempProfile}`
    ]);

    await sleep(1500);

    let client = null;
    try {
        const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
        const pageTarget = targets.find(t => t.type === 'page');
        if (!pageTarget) throw new Error('No page target found in Chrome');

        client = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await client.readyPromise;
        await client.send('Page.enable');
        await client.send('Runtime.enable');

        await client.send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            mobile: true
        });

        await client.send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/index.html` });
        await sleep(2500);

        console.log('\n📱 [3/3] Inspecting Profile View & Divider Borders in Real Chrome...');

        // Switch to Profile Tab
        await client.evaluate(`
            if (typeof window.switchTab === 'function') {
                window.switchTab('profile');
            }
        `);
        await sleep(500);

        // A. Header Logout check
        const headerButtons = await client.evaluate(`
            (() => {
                const headerActions = document.querySelector('.profile-header-actions');
                const editBtn = document.getElementById('btn-toggle-edit-profile');
                const logoutBtn = document.getElementById('btn-header-logout');
                return {
                    hasEditBtn: Boolean(editBtn),
                    hasLogoutBtn: Boolean(logoutBtn),
                    btnCount: headerActions ? headerActions.querySelectorAll('button').length : 0
                };
            })()
        `);
        assert(headerButtons.hasEditBtn, 'Profile Header: "Edit Profile" action button is rendered');
        assert(!headerButtons.hasLogoutBtn, 'Profile Header: Secondary "Log Out" button is completely removed');
        assert(headerButtons.btnCount === 1, 'Profile Header: Strictly ONE action button rendered under customer name/number');

        // B. State 1: Active Store Notice State
        console.log('\n  --- Testing State 1: Store Notice ACTIVE ---');
        const activeNoticeState = await client.evaluate(`
            (() => {
                // Set active store notice with long text
                localStorage.setItem('perfetto_store_notice', JSON.stringify({
                    active: true,
                    content: 'Important Notice: Festive special extra crispy crusts available today with 20% off on all large gourmet pizzas across all locations!'
                }));
                if (typeof window.updateStoreNoticeUI === 'function') {
                    window.updateStoreNoticeUI();
                }

                const activeRow = document.getElementById('profile-store-notice-row');
                const inactiveRow = document.getElementById('profile-store-notice-inactive-row');
                const orderHistory = document.getElementById('menu-order-history');
                const savedAddresses = document.getElementById('menu-saved-addresses');
                const legalInfo = document.getElementById('menu-legal-info');
                const logoutRow = document.getElementById('menu-item-logout');
                const noticeSubtitle = document.getElementById('profile-notice-preview-text');

                const getBorders = (el) => {
                    if (!el) return null;
                    const s = window.getComputedStyle(el);
                    return {
                        top: s.borderTopWidth,
                        bottom: s.borderBottomWidth,
                        display: s.display,
                        height: el.offsetHeight
                    };
                };

                const subStyle = noticeSubtitle ? window.getComputedStyle(noticeSubtitle) : null;

                return {
                    activeVisible: activeRow && window.getComputedStyle(activeRow).display !== 'none',
                    inactiveVisible: inactiveRow && window.getComputedStyle(inactiveRow).display !== 'none',
                    orderHistory: getBorders(orderHistory),
                    savedAddresses: getBorders(savedAddresses),
                    legalInfo: getBorders(legalInfo),
                    logoutRow: getBorders(logoutRow),
                    noticeSubtitle: subStyle ? {
                        whiteSpace: subStyle.whiteSpace,
                        overflow: subStyle.overflow,
                        textOverflow: subStyle.textOverflow,
                        maxWidth: subStyle.maxWidth
                    } : null
                };
            })()
        `);

        assert(activeNoticeState.activeVisible, 'Active Notice: #profile-store-notice-row is visible at top');
        assert(!activeNoticeState.inactiveVisible, 'Active Notice: Bottom #profile-store-notice-inactive-row is hidden');
        assert(activeNoticeState.orderHistory.top === '0px' && activeNoticeState.orderHistory.bottom === '1px', 'Order History: top 0px, bottom 1px');
        assert(activeNoticeState.savedAddresses.top === '0px' && activeNoticeState.savedAddresses.bottom === '1px', 'Saved Addresses: top 0px, bottom 1px');
        assert(activeNoticeState.legalInfo.top === '0px' && activeNoticeState.legalInfo.bottom === '1px', 'Legal Info: top 0px, bottom 1px');
        assert(activeNoticeState.logoutRow.top === '0px' && activeNoticeState.logoutRow.bottom === '0px', 'Log Out: NO redundant top border, NO trailing bottom border');
        assert(activeNoticeState.noticeSubtitle.whiteSpace === 'nowrap', 'Active Notice Subtitle: white-space is nowrap');
        assert(activeNoticeState.noticeSubtitle.overflow === 'hidden', 'Active Notice Subtitle: overflow is hidden');
        assert(activeNoticeState.noticeSubtitle.textOverflow === 'ellipsis', 'Active Notice Subtitle: text-overflow is ellipsis');

        // C. State 2: Inactive Store Notice State
        console.log('\n  --- Testing State 2: Store Notice INACTIVE ---');
        const inactiveNoticeState = await client.evaluate(`
            (() => {
                // Set inactive store notice
                localStorage.setItem('perfetto_store_notice', JSON.stringify({
                    active: false,
                    content: 'Store guidelines, terms reference & updates and extra long notice test string that definitely exceeds single line without ellipsis'
                }));
                if (typeof window.updateStoreNoticeUI === 'function') {
                    window.updateStoreNoticeUI();
                }

                const activeRow = document.getElementById('profile-store-notice-row');
                const inactiveRow = document.getElementById('profile-store-notice-inactive-row');
                const orderHistory = document.getElementById('menu-order-history');
                const savedAddresses = document.getElementById('menu-saved-addresses');
                const legalInfo = document.getElementById('menu-legal-info');
                const logoutRow = document.getElementById('menu-item-logout');
                const inactiveSubtitle = document.getElementById('profile-notice-inactive-preview-text');

                const getBorders = (el) => {
                    if (!el) return null;
                    const s = window.getComputedStyle(el);
                    return {
                        top: s.borderTopWidth,
                        bottom: s.borderBottomWidth,
                        display: s.display,
                        height: el.offsetHeight
                    };
                };

                const subStyle = inactiveSubtitle ? window.getComputedStyle(inactiveSubtitle) : null;

                return {
                    activeVisible: activeRow && window.getComputedStyle(activeRow).display !== 'none',
                    inactiveVisible: inactiveRow && window.getComputedStyle(inactiveRow).display !== 'none',
                    orderHistory: getBorders(orderHistory),
                    savedAddresses: getBorders(savedAddresses),
                    legalInfo: getBorders(legalInfo),
                    inactiveRow: getBorders(inactiveRow),
                    logoutRow: getBorders(logoutRow),
                    inactiveSubtitle: subStyle ? {
                        whiteSpace: subStyle.whiteSpace,
                        overflow: subStyle.overflow,
                        textOverflow: subStyle.textOverflow,
                        maxWidth: subStyle.maxWidth
                    } : null
                };
            })()
        `);

        assert(!inactiveNoticeState.activeVisible, 'Inactive Notice: #profile-store-notice-row is hidden');
        assert(inactiveNoticeState.inactiveVisible, 'Inactive Notice: Bottom #profile-store-notice-inactive-row is displayed');
        assert(inactiveNoticeState.legalInfo.top === '0px' && inactiveNoticeState.legalInfo.bottom === '1px', 'Legal Info: top 0px, bottom 1px');
        assert(inactiveNoticeState.inactiveRow.top === '0px' && inactiveNoticeState.inactiveRow.bottom === '1px', 'Inactive Notice: top 0px, bottom 1px');
        assert(inactiveNoticeState.logoutRow.top === '0px' && inactiveNoticeState.logoutRow.bottom === '0px', 'Log Out: NO redundant top border, NO trailing bottom border');
        assert(inactiveNoticeState.inactiveSubtitle.whiteSpace === 'nowrap', 'Inactive Notice Subtitle: white-space is nowrap');
        assert(inactiveNoticeState.inactiveSubtitle.overflow === 'hidden', 'Inactive Notice Subtitle: overflow is hidden');
        assert(inactiveNoticeState.inactiveSubtitle.textOverflow === 'ellipsis', 'Inactive Notice Subtitle: text-overflow is ellipsis');

        // Uniform row height check across standard items
        const heights = [
            inactiveNoticeState.orderHistory.height,
            inactiveNoticeState.savedAddresses.height,
            inactiveNoticeState.legalInfo.height,
            inactiveNoticeState.inactiveRow.height,
            inactiveNoticeState.logoutRow.height
        ];
        const minH = Math.min(...heights);
        const maxH = Math.max(...heights);
        const heightVariance = maxH - minH;
        assert(heightVariance <= 6, `Uniform row height: heights are symmetric within 6px (min=${minH}px, max=${maxH}px)`);

    } finally {
        if (client) client.close();
        try {
            chrome.kill('SIGKILL');
        } catch (e) {}
        server.close();

        // Clean up temporary profile directory
        await sleep(1000);
        try {
            if (fs.existsSync(tempProfile)) {
                fs.rmSync(tempProfile, { recursive: true, force: true });
            }
        } catch (e) {}
    }

    console.log('\n=================================================================');
    console.log(`SUMMARY: ${passedTests}/${totalTests} tests passed.`);
    console.log('=================================================================');

    if (passedTests === totalTests) {
        console.log('🎉 ALL PART 1 AUDIT CHECKS PASSED PERFECTLY!\n');
        process.exit(0);
    } else {
        console.error('❌ SOME CHECKS FAILED!\n');
        process.exit(1);
    }
}

run().catch(err => {
    console.error('Fatal error running verification:', err);
    process.exit(1);
});
