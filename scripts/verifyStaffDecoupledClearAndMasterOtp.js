const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

console.log('=== VERIFYING STAFF DECOUPLED CLEAR BUTTONS & EMERGENCY MASTER OTP ===\n');

let passCount = 0;
async function test(name, fn) {
    try {
        await fn();
        console.log(`PASS: ${name}`);
        passCount++;
    } catch (err) {
        console.error(`FAIL: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

async function runTests() {
    const staffJs = fs.readFileSync('staff.js', 'utf8');
    const staffHtml = fs.readFileSync('staff.html', 'utf8');

    // Test 1: HTML Markup for Master OTP Modal & Clear Buttons
    await test('1. staff.html contains Security Verification Master OTP Modal with input & error states', () => {
        assert(staffHtml.includes('id="staff-master-otp-modal"'), 'staff.html must include staff-master-otp-modal');
        assert(staffHtml.includes('id="staff-master-otp-input"'), 'staff.html must include staff-master-otp-input');
        assert(staffHtml.includes('id="staff-master-otp-error"'), 'staff.html must include staff-master-otp-error');
        assert(staffHtml.includes('id="staff-master-otp-confirm-btn"'), 'staff.html must include confirm button');
        assert(staffHtml.includes('id="staff-master-otp-cancel-btn"'), 'staff.html must include cancel button');
        assert(staffHtml.includes('Emergency Master Delivery OTP'), 'Modal must reference Emergency Master Delivery OTP');
        assert(staffHtml.includes('id="btn-delete-all-completed"'), 'staff.html must include btn-delete-all-completed');
    });

    // Test 2: Tab Decoupling in UI State Management
    await test('2. switchStaffTab & renderOrders enforce category label decoupling and pending tab isolation', () => {
        const switchSlice = staffJs.slice(staffJs.indexOf('function switchStaffTab('), staffJs.indexOf('window.switchStaffTab = switchStaffTab;'));
        assert(switchSlice.includes("tab === 'rejected' ? 'Clear All Rejected' : 'Clear All Completed'"), 'switchStaffTab must decouple Rejected vs Completed button labels');
        assert(switchSlice.includes("tab === 'pending' || !isAdmin"), 'switchStaffTab must hide and disable clear button on pending tab');

        const renderSlice = staffJs.slice(staffJs.indexOf('function renderOrders('), staffJs.indexOf('function renderOrders(') + 3500);
        assert(renderSlice.includes("currentStaffTab === 'rejected' ? 'Clear All Rejected' : 'Clear All Completed'"), 'renderOrders must dynamically set label per active tab');
        assert(renderSlice.includes("deleteCompletedBtn.style.display = 'none'") && renderSlice.includes("deleteCompletedBtn.disabled = true"), 'renderOrders must hide and disable button when on pending tab');
    });

    // Test 3: handleDeleteAllCompletedOrders strictly scopes by category and removes blanket midnight cleanup
    await test('3. handleDeleteAllCompletedOrders scopes statuses by active tab and eliminates indiscriminate midnight_cleanup', () => {
        const clearSlice = staffJs.slice(staffJs.indexOf('async function handleDeleteAllCompletedOrders('), staffJs.indexOf('window.handleDeleteAllCompletedOrders = handleDeleteAllCompletedOrders;'));
        
        // Pending protection
        assert(clearSlice.includes("currentStaffTab === 'pending'"), 'handleDeleteAllCompletedOrders must guard against pending tab execution');

        // Scoping
        assert(clearSlice.includes("['rejected', 'cancelled', 'canceled', 'declined']") && clearSlice.includes("['completed', 'delivered']"), 'Must scope targetStatuses to specific tab');
        
        // Master OTP Guard
        assert(clearSlice.includes('await requestStaffMasterOtpAuthorization('), 'handleDeleteAllCompletedOrders must require Master OTP authorization');

        // Scoped backend API call (must NOT call action=midnight_cleanup)
        assert(!clearSlice.includes("action=midnight_cleanup"), 'Must NOT invoke indiscriminate action=midnight_cleanup');
        assert(clearSlice.includes('completedIds: Array.from(ordersToDelete)'), 'Backend DELETE must strictly send scoped completedIds');
    });

    // Test 4: handleAdminDeleteOrder is guarded by Master OTP
    await test('4. handleAdminDeleteOrder requires Emergency Master Delivery OTP before single record purge', () => {
        const delSlice = staffJs.slice(staffJs.indexOf('async function handleAdminDeleteOrder('), staffJs.indexOf('window.handleAdminDeleteOrder = handleAdminDeleteOrder;'));
        assert(delSlice.includes('await requestStaffMasterOtpAuthorization('), 'handleAdminDeleteOrder must require Master OTP authorization');
    });

    // Test 5: VM Simulation of Master OTP Modal & Decoupled Execution
    await test('5. VM runtime verifies invalid Master OTP rejects deletion and valid Master OTP clears ONLY active tab orders', async () => {
        const storageMap = new Map();
        storageMap.set('emergencyMasterDeliveryOtp', '7492');

        const domElements = new Map();
        function getEl(id) {
            if (!domElements.has(id)) {
                domElements.set(id, {
                    id,
                    value: '',
                    textContent: '',
                    innerHTML: '',
                    style: {},
                    classList: {
                        add: () => {},
                        remove: () => {},
                        contains: () => false
                    },
                    focus: () => {},
                    select: () => {}
                });
            }
            return domElements.get(id);
        }

        let toastMsg = '';
        const context = {
            console,
            Date,
            Math,
            String,
            Array,
            Set,
            Map,
            Promise,
            setTimeout,
            clearTimeout,
            requestAnimationFrame: (cb) => { cb(); return 1; },
            localStorage: {
                getItem: (k) => storageMap.get(k) || null,
                setItem: (k, v) => storageMap.set(k, String(v)),
                removeItem: (k) => storageMap.delete(k)
            },
            document: {
                getElementById: (id) => getEl(id),
                addEventListener: () => {}
            },
            window: {},
            showStaffToast: (m) => { toastMsg = m; },
            getStaffFirestore: () => null,
            isStaffAdminUser: () => true,
            currentStaffUser: { role: 'Admin', phone: '9876543210' },
            MASTER_ADMIN_PHONE_NUM: '9414503886',
            STAFF_ORDERS_STORAGE_KEY: 'test_orders',
            apiCall: async () => {},
            recordStaffActivityLog: async () => {},
            renderOrders: () => {}
        };
        context.window = context;
        vm.createContext(context);

        // Run Master OTP controller code
        const otpControllerCode = staffJs.slice(
            staffJs.indexOf('function applyStaffStoreSettings('),
            staffJs.indexOf('let staffOrdersReconnectTimeout = null;')
        ) + '\n' + staffJs.slice(
            staffJs.indexOf('let staffMasterOtpResolver = null;'),
            staffJs.indexOf('async function handleStaffLogout()')
        );
        vm.runInContext(otpControllerCode, context);

        // Sub-test A: Invalid OTP verification fails
        let authPromise = context.requestStaffMasterOtpAuthorization('Delete testing');
        getEl('staff-master-otp-input').value = '1111'; // Wrong OTP
        await context.handleStaffMasterOtpSubmit();
        
        assert.strictEqual(getEl('staff-master-otp-error').style.display, 'block', 'Error message must display on invalid OTP');
        assert(toastMsg.includes('Invalid Master OTP'), 'Toast must notify unauthorized attempt');

        // Cancel modal
        context.handleStaffMasterOtpCancel();
        const authResultFail = await authPromise;
        assert.strictEqual(authResultFail, false, 'Invalid OTP / cancellation must resolve false');

        // Sub-test B: Valid OTP verification succeeds
        authPromise = context.requestStaffMasterOtpAuthorization('Delete testing');
        getEl('staff-master-otp-input').value = '7492'; // Correct OTP
        await context.handleStaffMasterOtpSubmit();
        const authResultSuccess = await authPromise;
        assert.strictEqual(authResultSuccess, true, 'Valid OTP must resolve true');

        // Sub-test C: Decoupled Deletion leaves opposite tab orders intact
        const clearOrdersCode = staffJs.slice(
            staffJs.indexOf('async function handleDeleteAllCompletedOrders('),
            staffJs.indexOf('window.handleDeleteAllCompletedOrders = handleDeleteAllCompletedOrders;')
        );
        vm.runInContext(clearOrdersCode, context);

        // Populate initial orders: 2 completed, 2 rejected, 1 pending
        context.staffOrders = [
            { id: '101', status: 'delivered' },
            { id: '102', status: 'completed' },
            { id: '201', status: 'rejected' },
            { id: '202', status: 'cancelled' },
            { id: '301', status: 'pending' }
        ];

        // 1. Clear Completed Tab
        context.currentStaffTab = 'completed';
        // Auto-fill valid OTP when modal prompts
        const origRequest = context.requestStaffMasterOtpAuthorization;
        context.requestStaffMasterOtpAuthorization = async () => true;

        await context.handleDeleteAllCompletedOrders();

        // Check that Completed orders (101, 102) are purged, but Rejected (201, 202) and Pending (301) REMAIN
        assert.strictEqual(context.staffOrders.length, 3, 'After clearing completed, exactly 3 orders must remain');
        assert(context.staffOrders.some(o => o.id === '201'), 'Order 201 (rejected) must NOT be deleted by Clear Completed');
        assert(context.staffOrders.some(o => o.id === '202'), 'Order 202 (cancelled) must NOT be deleted by Clear Completed');
        assert(context.staffOrders.some(o => o.id === '301'), 'Order 301 (pending) must NOT be deleted by Clear Completed');
        assert(!context.staffOrders.some(o => o.id === '101'), 'Order 101 (delivered) must be purged');
        assert(!context.staffOrders.some(o => o.id === '102'), 'Order 102 (completed) must be purged');

        // 2. Clear Rejected Tab
        context.currentStaffTab = 'rejected';
        await context.handleDeleteAllCompletedOrders();

        // Check that Rejected orders (201, 202) are purged, but Pending (301) STILL REMAINS
        assert.strictEqual(context.staffOrders.length, 1, 'After clearing rejected, exactly 1 order (pending) must remain');
        assert.strictEqual(context.staffOrders[0].id, '301', 'Order 301 (pending) must remain completely safe');

        // 3. Attempt Clear on Pending Tab -> Must be blocked
        context.currentStaffTab = 'pending';
        toastMsg = '';
        await context.handleDeleteAllCompletedOrders();
        assert(toastMsg.includes('Pending orders cannot be cleared'), 'Attempting to clear pending orders must be explicitly rejected');
        assert.strictEqual(context.staffOrders.length, 1, 'Pending order must remain untouched');
    });

    console.log(`\nALL ${passCount} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
}

runTests();
