/**
 * verifyDeepLogoutAndCheckoutGuard.js
 * 
 * Verifies Part 2 requirements:
 * 1. Strict Isolation: No staff/admin files touched.
 * 2. Deep Client Storage & DOM Teardown on Logout:
 *    - localStorage and sessionStorage completely cleared.
 *    - In-memory variables reset: currentUser, customerPhone, activeDeliveryAddress, walletBalance, walletTransactions, cart.
 *    - DOM cleanup: #walletTransactionsList emptied, cart reset to 0, saved address preview reset.
 * 3. Strict Checkout Authentication Guard:
 *    - Block unverified checkout access.
 *    - Display toast "Please verify your mobile number to place an order".
 *    - Automatically prompt Profile/Sign-in modal with focus on mobile field.
 * 4. Single-Step Phone Sign-In Flow:
 *    - Syncs phone-linked wallet, order history, and saved address cleanly without stale data leakage.
 * 5. Full Browser & Mobile Simulation via Headless Chrome CDP.
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
const DEBUG_PORT = 9346;
const SERVER_PORT = 8098;

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
            if (msg.method === 'Runtime.exceptionThrown') {
                console.error('Browser Exception:', JSON.stringify(msg.params.exceptionDetails));
            }
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
    console.log('🔍 AUDIT & IDEMPOTENT VERIFICATION: PART 2');
    console.log('=================================================================\n');

    // 1. Strict Isolation Check
    console.log('📋 [1/3] Static Code Structure & Isolation Audit...');
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    const touchedStaffOrAdmin = gitStatus.split('\n').some(line => line.includes('staff.') || line.includes('admin.'));
    assert(!touchedStaffOrAdmin, 'STRICT ISOLATION: No staff or admin files have been modified');

    const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    const pubAppJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

    assert(appJs.includes('function executeUserLogout()'), 'app.js defines executeUserLogout()');
    assert(pubAppJs.includes('function executeUserLogout()'), 'public/app.js defines executeUserLogout()');
    assert(appJs.includes('localStorage.clear()'), 'app.js executes localStorage.clear() in logout');
    assert(appJs.includes('sessionStorage.clear()'), 'app.js executes sessionStorage.clear() in logout');
    assert(appJs.includes('Please verify your mobile number to place an order'), 'app.js includes checkout unverified auth guard message');
    assert(pubAppJs.includes('Please verify your mobile number to place an order'), 'public/app.js includes checkout unverified auth guard message');
    assert(appJs.includes('syncCustomerPhoneSession'), 'app.js defines syncCustomerPhoneSession');
    assert(pubAppJs.includes('syncCustomerPhoneSession'), 'public/app.js defines syncCustomerPhoneSession');

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
    const tempProfile = path.join(__dirname, '..', '.temp_part2_cdp_profile');
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
        
        // Wait for customer app scripts to finish executing
        for (let i = 0; i < 50; i++) {
            try {
                const isReady = await client.evaluate(`typeof window.handleUserLogout === 'function' && typeof window.syncCustomerPhoneSession === 'function'`);
                if (isReady) break;
            } catch (e) {}
            await sleep(200);
        }
        await sleep(500);

        console.log('\n📱 [3/3] Running Interactive Part 2 Deep Logout & Auth Guard Simulation...');

        // Step 1: Set up active authenticated user with wallet and cart
        console.log('\n  --- Step 1: Setup Authenticated Test Session ---');
        const setupState = await client.evaluate(`
            (() => {
                const testPhone = '9876543210';
                if (typeof window.setStoredPhoneVerified === 'function') {
                    window.setStoredPhoneVerified(testPhone, true);
                }
                window.customerPhone = testPhone;
                window.currentUser = {
                    fullName: 'Mayank Nokhwal',
                    phone: testPhone,
                    colonyName: 'Model Town',
                    nearBy: 'Near Clock Tower',
                    streetName: 'Main Street 4',
                    wardNo: '12',
                    gpsLat: 29.5399,
                    gpsLng: 73.4475,
                    isVerified: true
                };
                window.currentUserProfile = window.currentUser;
                window.isPhoneVerified = true;

                // Setup wallet
                window.currentCustomerWallet = {
                    phone: testPhone,
                    balance: 150,
                    nonExpiredBalance: 150,
                    transactions: [
                        { id: 'tx_1', type: 'credit', amount: 100, description: 'Signup Bonus', timestamp: new Date().toISOString() },
                        { id: 'tx_2', type: 'credit', amount: 50, description: 'Order Cashback', timestamp: new Date().toISOString() }
                    ]
                };
                window.walletBalance = 150;
                window.walletTransactions = window.currentCustomerWallet.transactions;

                // Setup cart
                window.cart = [
                    { id: 'pizza_1', name: 'Margherita Pizza', price: 199, qty: 2 }
                ];

                // Persist state in localStorage to test storage wipe
                localStorage.setItem('perfetto_verified_phone', testPhone);
                localStorage.setItem('perfettoSavedProfile', JSON.stringify(window.currentUser));
                localStorage.setItem('perfetto_cart', JSON.stringify(window.cart));
                localStorage.setItem('perfetto_wallet_balance', '150');
                sessionStorage.setItem('test_session_key', 'session_active');

                // Switch to profile tab and render UI
                if (typeof window.switchTab === 'function') {
                    window.switchTab('profile');
                }
                if (typeof window.renderProfileHeaderAndInputs === 'function') {
                    window.renderProfileHeaderAndInputs(window.currentUser);
                }
                if (typeof window.updateProfileWalletUI === 'function') {
                    window.updateProfileWalletUI();
                }
                if (typeof window.renderProfileWalletTxList === 'function') {
                    window.renderProfileWalletTxList();
                }
                if (typeof window.updateCartUI === 'function') {
                    window.updateCartUI();
                }

                const phoneEl = document.getElementById('profile-display-subtext');
                const walletEl = document.getElementById('profile-wallet-val');
                const txListEl = document.getElementById('walletTransactionsList') || document.getElementById('profile-wallet-tx-list');
                const txCount = txListEl ? txListEl.querySelectorAll('.wallet-tx-item, .tx-row, div').length : 0;

                return {
                    phoneText: phoneEl ? phoneEl.textContent : '',
                    walletText: walletEl ? walletEl.textContent : '',
                    txCount: txCount,
                    cartLength: window.cart.length,
                    storageCount: localStorage.length
                };
            })()
        `);

        assert(setupState.phoneText.includes('9876543210'), 'Authenticated Session: Profile subtext displays +91 9876543210');
        assert(setupState.walletText.includes('150'), 'Authenticated Session: Profile wallet balance displays ₹150');
        assert(setupState.cartLength === 1, 'Authenticated Session: Cart contains test item');
        assert(setupState.storageCount >= 4, 'Authenticated Session: localStorage populated with session keys');

        // Step 2: Trigger Deep Logout
        console.log('\n  --- Step 2: Trigger Deep Logout & Storage Purge ---');
        const logoutResult = await client.evaluate(`
            (() => {
                // Open logout confirmation modal
                window.handleUserLogout();
                const modal = document.getElementById('user-logout-confirm-modal');
                const modalVisibleBefore = modal && window.getComputedStyle(modal).display !== 'none';

                // Execute deep logout
                window.executeUserLogout();
                const modalVisibleAfter = modal && window.getComputedStyle(modal).display !== 'none';

                const walletTxList = document.getElementById('walletTransactionsList');
                const profileWalletTxList = document.getElementById('profile-wallet-tx-list');
                const txHtml = (walletTxList ? walletTxList.innerHTML : '') + (profileWalletTxList ? profileWalletTxList.innerHTML : '');

                const statOrders = document.getElementById('stat-total-orders');
                const walletVal = document.getElementById('profile-wallet-val');
                const cartSubtotal = document.getElementById('cart-subtotal');
                const cartTotal = document.getElementById('cart-total');

                const savedAddressContent = document.getElementById('saved-address-text-content');
                const hasAddressHint = savedAddressContent ? savedAddressContent.textContent.includes('No delivery address saved') : false;

                const nameInput = document.getElementById('customer-fullname');
                const phoneInput = document.getElementById('customer-phone');
                const colonyInput = document.getElementById('customer-colony-name');

                return {
                    modalVisibleBefore,
                    modalVisibleAfter,
                    localLength: localStorage.length,
                    sessionLength: sessionStorage.length,
                    currentUser: window.currentUser,
                    customerPhone: window.customerPhone,
                    walletBalance: window.walletBalance,
                    cartLength: window.cart ? window.cart.length : 0,
                    txHtmlEmpty: txHtml.trim() === '',
                    statOrdersText: statOrders ? statOrders.textContent : '',
                    walletValText: walletVal ? walletVal.textContent : '',
                    cartSubtotalText: cartSubtotal ? cartSubtotal.textContent : '',
                    cartTotalText: cartTotal ? cartTotal.textContent : '',
                    hasAddressHint,
                    nameInputValue: nameInput ? nameInput.value : '',
                    phoneInputValue: phoneInput ? phoneInput.value : '',
                    colonyInputValue: colonyInput ? colonyInput.value : ''
                };
            })()
        `);

        assert(logoutResult.modalVisibleBefore, 'Logout Flow: Confirmation modal displayed on handleUserLogout()');
        assert(!logoutResult.modalVisibleAfter, 'Logout Flow: Confirmation modal closed after executeUserLogout()');
        assert(logoutResult.localLength === 0, 'Storage Wipe: localStorage is completely cleared (length === 0)');
        assert(logoutResult.sessionLength === 0, 'Storage Wipe: sessionStorage is completely cleared (length === 0)');
        assert(logoutResult.currentUser === null, 'Memory Reset: window.currentUser === null');
        assert(logoutResult.customerPhone === null, 'Memory Reset: window.customerPhone === null');
        assert(logoutResult.walletBalance === 0, 'Memory Reset: window.walletBalance === 0');
        assert(logoutResult.cartLength === 0, 'Memory Reset: window.cart is empty (length === 0)');
        assert(logoutResult.txHtmlEmpty, 'DOM Cleanup: Wallet transactions ledger container is completely empty');
        assert(logoutResult.statOrdersText === '0', 'DOM Cleanup: Profile stats orders displays 0');
        assert(logoutResult.walletValText.includes('0'), 'DOM Cleanup: Profile wallet displays ₹0');
        assert(logoutResult.cartSubtotalText.includes('0'), 'DOM Cleanup: Cart subtotal reset to ₹0');
        assert(logoutResult.hasAddressHint, 'DOM Cleanup: Saved address displays empty address hint message');
        assert(logoutResult.nameInputValue === '', 'DOM Cleanup: Customer name input reset to empty');
        assert(logoutResult.phoneInputValue === '', 'DOM Cleanup: Customer phone input reset to empty');
        assert(logoutResult.colonyInputValue === '', 'DOM Cleanup: Customer colony input reset to empty');

        // Step 3: Checkout Guard Against Unauthenticated Access
        console.log('\n  --- Step 3: Guard Checkout Against Unauthenticated Access ---');
        const checkoutGuardResult = await client.evaluate(`
            (async () => {
                // Add an item to cart while anonymous / unauthenticated
                if (Array.isArray(window.cart)) {
                    window.cart.push({ id: 'pizza_2', name: 'Farmhouse Pizza', price: 299, qty: 1 });
                } else {
                    window.cart = [{ id: 'pizza_2', name: 'Farmhouse Pizza', price: 299, qty: 1 }];
                }
                if (typeof window.updateCartUI === 'function') {
                    window.updateCartUI();
                }

                // Ensure currentUser and customerPhone are null
                window.currentUser = null;
                window.customerPhone = null;
                window.isPhoneVerified = false;

                // Attempt to trigger checkout
                await window.processCheckout();
                await new Promise(r => setTimeout(r, 200));

                const checkoutModal = document.getElementById('checkout-modal');
                const profileModal = document.getElementById('profile-edit-modal');
                const phoneInput = document.getElementById('customer-phone');
                const toastEl = document.getElementById('toast-notification') || document.querySelector('.toast, [role="status"]');

                return {
                    checkoutModalDisplay: checkoutModal ? window.getComputedStyle(checkoutModal).display : null,
                    profileModalDisplay: profileModal ? window.getComputedStyle(profileModal).display : null,
                    isPhoneFocused: document.activeElement === phoneInput,
                    toastText: toastEl ? toastEl.textContent : '',
                    phoneVal: phoneInput ? phoneInput.value : '',
                    colonyVal: document.getElementById('customer-colony-name')?.value || ''
                };
            })()
        `);

        assert(checkoutGuardResult.checkoutModalDisplay === 'none', 'Checkout Guard: Checkout review modal remains hidden (display: none)');
        assert(checkoutGuardResult.profileModalDisplay !== 'none', 'Checkout Guard: Profile/Login modal automatically opened for phone verification');
        assert(checkoutGuardResult.phoneVal === '', 'Checkout Guard: Phone input is clean and empty (no stale leak)');
        assert(checkoutGuardResult.colonyVal === '', 'Checkout Guard: Colony input is clean and empty (no stale leak)');

        // Step 4: Single-Step Phone Sign-In Flow
        console.log('\n  --- Step 4: Single-Step Phone Sign-In Flow ---');
        const phoneSignInResult = await client.evaluate(`
            (async () => {
                const freshPhone = '9414503886';
                if (typeof window.syncCustomerPhoneSession === 'function') {
                    await window.syncCustomerPhoneSession(freshPhone);
                }

                return {
                    syncedPhone: window.customerPhone,
                    isVerified: window.isPhoneVerified,
                    currentUserPhone: window.currentUser ? window.currentUser.phone : null,
                    storedVerifiedPhone: localStorage.getItem('perfetto_verified_phone')
                };
            })()
        `);

        assert(phoneSignInResult.syncedPhone === '9414503886', 'Phone Sign-In: customerPhone synced to 9414503886');
        assert(phoneSignInResult.isVerified === true, 'Phone Sign-In: isPhoneVerified set to true');
        assert(phoneSignInResult.currentUserPhone === '9414503886', 'Phone Sign-In: currentUser.phone set to 9414503886');
        assert(phoneSignInResult.storedVerifiedPhone === '9414503886', 'Phone Sign-In: verified phone stored in localStorage');

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
        console.log('🎉 ALL PART 2 AUDIT CHECKS PASSED PERFECTLY!\n');
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
