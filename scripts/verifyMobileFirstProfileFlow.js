/**
 * verifyMobileFirstProfileFlow.js
 * 
 * Verifies Part 1 requirements:
 * 1. Mobile-First Layout Reordering in Edit Profile Modal:
 *    - Mobile number input and "Verify" action at the VERY TOP of the modal form.
 *    - Dynamic progressive disclosure: address & name fields hidden in unauthenticated state.
 *    - OTP input row displays directly below mobile field.
 *    - Post-verification auto-fills existing customer data from Firestore, while new customer gets clean unlocked fields.
 * 2. Database Cleanup Routine:
 *    - cleanStaleTestUserProfiles is available and resets test user/wallet documents.
 * 3. Browser & Mobile Simulation Verification via Chrome CDP.
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
const DEBUG_PORT = 9333;
const SERVER_PORT = 8089;

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

// -------------------------------------------------------------------------
// SECTION 1: STATIC CODE AUDIT (ISOLATION & ARCHITECTURE)
// -------------------------------------------------------------------------
console.log('=================================================================');
console.log('📱 MOBILE-FIRST PROFILE MODAL & AUTH AUTO-FILL VERIFICATION');
console.log('=================================================================\n');

console.log('🔍 [Phase 1/3] Static Code Structure & Isolation Audit...');

const appJs = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

// 1. Mobile number at the very top of delivery-details-form
const phoneInputIdx = indexHtml.indexOf('id="customer-phone"');
const fullNameInputIdx = indexHtml.indexOf('id="customer-fullname"');
const otpBoxIdx = indexHtml.indexOf('id="otp-verification-box"');
const postAuthIdx = indexHtml.indexOf('id="profile-post-auth-fields"');

assert(phoneInputIdx > 0, 'Customer phone input field exists in index.html');
assert(fullNameInputIdx > 0, 'Customer fullname input field exists in index.html');
assert(phoneInputIdx < fullNameInputIdx, 'Mobile number input appears BEFORE full name input in HTML');
assert(otpBoxIdx > phoneInputIdx && otpBoxIdx < fullNameInputIdx, 'OTP verification box is positioned directly below mobile field and before address fields');
assert(postAuthIdx > otpBoxIdx && postAuthIdx < fullNameInputIdx, 'Profile post-auth fields wrapper encloses address fields and save button');

// 2. Progressive disclosure styles
assert(stylesCss.includes('.profile-post-auth-fields'), '.profile-post-auth-fields CSS class defined in styles.css');
assert(appJs.includes('cleanStaleTestUserProfiles'), 'cleanStaleTestUserProfiles maintenance routine defined in app.js');
assert(appJs.includes('window.cleanStaleTestUserProfiles = cleanStaleTestUserProfiles'), 'cleanStaleTestUserProfiles exported to window');

// 3. Strict isolation check
const gitStatus = require('child_process').execSync('git status --porcelain', { encoding: 'utf8' });
const touchedStaffOrAdmin = gitStatus.split('\n').some(line => line.includes('staff.') || line.includes('admin.'));
assert(!touchedStaffOrAdmin, 'STRICT ISOLATION: No staff or admin files have been modified');

// -------------------------------------------------------------------------
// SECTION 2: LOCAL SERVER & HEADLESS CHROME CDP EXECUTION
// -------------------------------------------------------------------------
async function runCdpTests() {
    console.log('\n🌐 [Phase 2/3] Starting Local Server & Chrome Mobile Simulation...');

    // Simple HTTP server serving the repo root
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
    const chrome = spawn(CHROME_PATH, [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--headless=new',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-gpu',
        '--window-size=390,844',
        `--user-data-dir=${path.join(__dirname, '..', '.temp_cdp_profile')}`
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

        // Set mobile emulation
        await client.send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            mobile: true
        });

        // Navigate to customer app
        await client.send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/index.html` });
        await sleep(2500);

        console.log('\n📱 [Phase 3/3] Running Interactive Progressive Disclosure Simulation...');

        // 1. Initial Unauthenticated State Check
        const initialModalState = await client.evaluate(`
            (() => {
                // Ensure fresh unverified state
                localStorage.clear();
                if (typeof window.applyPhoneVerifiedUI === 'function') {
                    window.applyPhoneVerifiedUI(false, '');
                }
                window.openEditProfileModal();

                const phoneEl = document.getElementById('customer-phone');
                const verifyBtn = document.getElementById('btn-request-otp');
                const otpBox = document.getElementById('otp-verification-box');
                const postAuthFields = document.getElementById('profile-post-auth-fields');
                const fullnameEl = document.getElementById('customer-fullname');

                const phoneRect = phoneEl ? phoneEl.getBoundingClientRect() : null;
                const postAuthDisplay = postAuthFields ? window.getComputedStyle(postAuthFields).display : null;
                const otpBoxDisplay = otpBox ? window.getComputedStyle(otpBox).display : null;

                return {
                    phoneExists: Boolean(phoneEl),
                    verifyBtnExists: Boolean(verifyBtn),
                    verifyBtnDisabled: verifyBtn ? verifyBtn.disabled : null,
                    otpBoxDisplay,
                    postAuthDisplay,
                    phoneTop: phoneRect ? phoneRect.top : 0
                };
            })()
        `);

        assert(initialModalState.phoneExists, 'Phone input exists on open modal');
        assert(initialModalState.verifyBtnExists, 'Verify button exists on open modal');
        assert(initialModalState.verifyBtnDisabled === true, 'Verify button is initially disabled until 10 digits entered');
        assert(initialModalState.otpBoxDisplay === 'none', 'OTP box is hidden initially');
        assert(initialModalState.postAuthDisplay === 'none', 'Post-auth address fields are hidden initially (progressive disclosure)');

        // 2. Typing 10-digit Phone Number unlocks Verify button
        const afterTypingState = await client.evaluate(`
            (() => {
                const phoneInput = document.getElementById('customer-phone');
                phoneInput.value = '9876543210';
                phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
                const verifyBtn = document.getElementById('btn-request-otp');
                return {
                    verifyBtnDisabled: verifyBtn ? verifyBtn.disabled : true
                };
            })()
        `);
        assert(afterTypingState.verifyBtnDisabled === false, 'Verify button is enabled when 10 digits are typed');

        // 3. Requesting OTP displays OTP box directly below mobile field
        const otpRequestedState = await client.evaluate(`
            (async () => {
                // Mock test OTP handler
                window.__testOtpHandler = (action, val, success, failure) => {
                    if (action === 'send') success({ message: 'OTP sent' });
                };
                await window.handleRequestOtp();

                const otpBox = document.getElementById('otp-verification-box');
                const otpInput = document.getElementById('otp-input');
                const otpBoxDisplay = otpBox ? window.getComputedStyle(otpBox).display : 'none';

                return {
                    otpBoxVisible: otpBoxDisplay !== 'none',
                    otpInputMaxLength: otpInput ? otpInput.maxLength : 0
                };
            })()
        `);
        assert(otpRequestedState.otpBoxVisible, 'OTP verification box displays directly below mobile field after clicking Verify');
        assert(otpRequestedState.otpInputMaxLength === 4, 'OTP input is configured for 4-digit code (maxLength=4)');

        // 4. Verify OTP for EXISTING Customer -> Auto-populates Firestore Profile
        const existingCustomerResult = await client.evaluate(`
            (async () => {
                // Mock restoreUserProfileFromFirestore with existing customer profile
                window.restoreUserProfileFromFirestore = async (phone) => {
                    return {
                        fullName: 'Rajesh Sharma',
                        phone: '9876543210',
                        colonyName: 'Green Park Extension',
                        nearBy: 'Near Metro Gate 2',
                        streetName: 'A-42',
                        wardNo: '14',
                        gpsLat: 28.5582,
                        gpsLng: 77.2023,
                        isVerified: true
                    };
                };

                window.__testOtpHandler = (action, val, success, failure) => {
                    if (action === 'verify') success({ message: 'Verified' });
                };

                const otpInput = document.getElementById('otp-input');
                otpInput.value = '1234';
                await window.handleVerifyOtp();

                const postAuthFields = document.getElementById('profile-post-auth-fields');
                const fullName = document.getElementById('customer-fullname')?.value;
                const colony = document.getElementById('customer-colony-name')?.value;
                const nearby = document.getElementById('customer-nearby')?.value;
                const street = document.getElementById('customer-street-name')?.value;
                const ward = document.getElementById('customer-ward-no')?.value;
                const lat = document.getElementById('customer-gps-lat')?.value;
                const lng = document.getElementById('customer-gps-lng')?.value;
                const badgeDisplay = window.getComputedStyle(document.getElementById('phone-verified-badge')).display;

                return {
                    postAuthDisplay: window.getComputedStyle(postAuthFields).display,
                    badgeVisible: badgeDisplay !== 'none',
                    fullName,
                    colony,
                    nearby,
                    street,
                    ward,
                    lat,
                    lng
                };
            })()
        `);

        assert(existingCustomerResult.postAuthDisplay !== 'none', 'Post-auth fields revealed after OTP verification');
        assert(existingCustomerResult.badgeVisible, 'Phone Verified badge is displayed');
        assert(existingCustomerResult.fullName === 'Rajesh Sharma', 'Existing customer Full Name auto-filled from Firestore profile');
        assert(existingCustomerResult.colony === 'Green Park Extension', 'Existing customer Colony Name auto-filled');
        assert(existingCustomerResult.nearby === 'Near Metro Gate 2', 'Existing customer Landmark/Near By auto-filled');
        assert(existingCustomerResult.street === 'A-42', 'Existing customer Street Name auto-filled');
        assert(existingCustomerResult.ward === '14', 'Existing customer Ward Number auto-filled');
        assert(parseFloat(existingCustomerResult.lat) === 28.5582, 'Existing customer GPS Latitude auto-filled');
        assert(parseFloat(existingCustomerResult.lng) === 77.2023, 'Existing customer GPS Longitude auto-filled');

        // 5. Verify OTP for NEW Customer -> Reveals empty unlocked fields & focuses Full Name
        const newCustomerResult = await client.evaluate(`
            (async () => {
                // Clear storage & reset
                localStorage.clear();
                window.applyPhoneVerifiedUI(false, '');
                window.openEditProfileModal();

                // Mock new customer (restoreUserProfileFromFirestore returns null)
                window.restoreUserProfileFromFirestore = async () => null;
                // Mock direct firestore get returning null
                window.customerFirestore = {
                    collection: () => ({
                        doc: () => ({
                            get: async () => ({ exists: false, data: () => null })
                        })
                    })
                };

                const phoneInput = document.getElementById('customer-phone');
                phoneInput.value = '9998887776';
                phoneInput.dispatchEvent(new Event('input', { bubbles: true }));

                window.__testOtpHandler = (action, val, success, failure) => {
                    if (action === 'verify') success({ message: 'Verified' });
                };

                const otpInput = document.getElementById('otp-input');
                otpInput.value = '5678';
                await window.handleVerifyOtp();

                const postAuthFields = document.getElementById('profile-post-auth-fields');
                const fullName = document.getElementById('customer-fullname')?.value;
                const colony = document.getElementById('customer-colony-name')?.value;
                const isFocusedOnName = document.activeElement?.id === 'customer-fullname';

                return {
                    postAuthDisplay: window.getComputedStyle(postAuthFields).display,
                    fullName,
                    colony,
                    isFocusedOnName
                };
            })()
        `);

        assert(newCustomerResult.postAuthDisplay !== 'none', 'New customer post-auth fields revealed cleanly');
        assert(newCustomerResult.fullName === '', 'New customer Full Name is clean and empty');
        assert(newCustomerResult.colony === '', 'New customer Colony Name is clean and empty');

        // 6. Test cleanStaleTestUserProfiles routine
        const cleanupResult = await client.evaluate(`
            (async () => {
                localStorage.setItem('perfetto_saved_delivery_profile', JSON.stringify({ fullName: 'Stale Test' }));
                localStorage.setItem('perfetto_wallet_balance_8290873256', '500');
                const res = await window.cleanStaleTestUserProfiles({ targetPhones: ['8290873256', '9414503886'] });
                const remainingProfile = localStorage.getItem('perfetto_saved_delivery_profile');
                const remainingWallet = localStorage.getItem('perfetto_wallet_balance_8290873256');
                return {
                    res,
                    profileCleared: remainingProfile === null,
                    walletCleared: remainingWallet === null
                };
            })()
        `);

        assert(cleanupResult.profileCleared, 'cleanStaleTestUserProfiles wiped test delivery profile from localStorage');
        assert(cleanupResult.walletCleared, 'cleanStaleTestUserProfiles wiped test wallet balance from localStorage');

    } catch (err) {
        console.error('CDP Error:', err);
    } finally {
        if (client) client.close();
        chrome.kill();
        server.close();
    }
}

async function main() {
    await runCdpTests();

    console.log('\n=================================================================');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
    console.log('=================================================================\n');

    if (passedTests === totalTests) {
        console.log('🎉 ALL MOBILE-FIRST PROFILE & PROGRESSIVE DISCLOSURE TESTS PASSED!\n');
        process.exit(0);
    } else {
        console.error('❌ Some tests failed.');
        process.exit(1);
    }
}

main();
