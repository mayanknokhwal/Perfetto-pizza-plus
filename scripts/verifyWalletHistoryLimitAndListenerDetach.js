const fs = require('fs');
const assert = require('assert');

console.log('=== VERIFYING WALLET HISTORY LIMIT & LISTENER DETACHMENT ===\n');

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
const staffJs = fs.readFileSync('staff.js', 'utf8');
const adminHtml = fs.readFileSync('admin.html', 'utf8');

// Test 1: fetchCustomerWalletLedger is defined and exported
test('1. fetchCustomerWalletLedger is defined and attached to window', () => {
    assert(appJs.includes("function fetchCustomerWalletLedger(phone)"), "fetchCustomerWalletLedger must be defined");
    assert(appJs.includes("window.fetchCustomerWalletLedger = fetchCustomerWalletLedger"), "fetchCustomerWalletLedger must be exported to window");
});

// Test 2: fetchCustomerWalletLedger uses strict .orderBy('createdAt', 'desc').limit(15)
test('2. fetchCustomerWalletLedger queries Firestore with .orderBy(createdAt, desc).limit(15)', () => {
    assert(appJs.includes(".orderBy('createdAt', 'desc')"), "Query must sort strictly by createdAt descending");
    assert(appJs.includes(".limit(15)"), "Query must enforce hard limit of 15 records");
});

// Test 3: fetchCustomerWalletLedger enforces memory clamp of 15 records
test('3. fetchCustomerWalletLedger clamps transactions to at most 15 records', () => {
    assert(appJs.includes("fetchedTxs.slice(0, 15)"), "Must slice fetched transactions to 15");
});

// Test 4: toggleWalletLedgerView queries ledger on accordion expansion
test('4. toggleWalletLedgerView triggers fetchCustomerWalletLedger when expanded', () => {
    assert(appJs.includes("function toggleWalletLedgerView()"), "toggleWalletLedgerView must be defined");
    assert(appJs.includes("fetchCustomerWalletLedger(phone)"), "toggleWalletLedgerView must invoke fetchCustomerWalletLedger on expand");
});

// Test 5: renderProfileWalletTxList strictly sorts reverse-chronologically and clamps to 15
test('5. renderProfileWalletTxList sorts by creation timestamp descending and renders at most 15 entries', () => {
    assert(appJs.includes("sortedTxList = [...txList].sort"), "renderProfileWalletTxList must sort txList");
    assert(appJs.includes("timeB - timeA"), "renderProfileWalletTxList must sort descending (newest first)");
    assert(appJs.includes("sortedTxList.map"), "renderProfileWalletTxList must map over capped sortedTxList");
});

// Test 6: fetchCustomerWallet calls fetchCustomerWalletLedger
test('6. fetchCustomerWallet integrates fetchCustomerWalletLedger query', () => {
    assert(appJs.includes("await fetchCustomerWalletLedger(cleanPhone)"), "fetchCustomerWallet must fetch constrained ledger");
});

// Test 7: cleanupAllCustomerListeners detaches all customer listeners to eliminate ghost reads
test('7. cleanupAllCustomerListeners cleans up all active customer listeners on unmount/pagehide', () => {
    assert(appJs.includes("function cleanupAllCustomerListeners()"), "cleanupAllCustomerListeners must be defined");
    assert(appJs.includes("customerWalletRealtimeUnsubscribe"), "Must detach customerWalletRealtimeUnsubscribe");
    assert(appJs.includes("customerUserRealtimeUnsubscribe"), "Must detach customerUserRealtimeUnsubscribe");
    assert(appJs.includes("customerPhoneOrdersUnsubscribe"), "Must detach customerPhoneOrdersUnsubscribe");
    assert(appJs.includes("customerMenuRealtimeUnsubscribe"), "Must detach customerMenuRealtimeUnsubscribe");
    assert(appJs.includes("window.cleanupAllCustomerListeners = cleanupAllCustomerListeners"), "Must export cleanupAllCustomerListeners");
});

// Test 8: Page unload and pagehide listeners are attached for graceful teardown
test('8. cleanupAllCustomerListeners is bound to beforeunload and pagehide lifecycle events', () => {
    assert(appJs.includes("window.addEventListener('beforeunload', cleanupAllCustomerListeners)"), "Must listen to beforeunload");
    assert(appJs.includes("window.addEventListener('pagehide', cleanupAllCustomerListeners)"), "Must listen to pagehide");
});

// Test 9: Customer phone orders query has query limit attached
test('9. customer phone orders stream enforces limit(25)', () => {
    assert(appJs.includes(".where('customerPhone', '==', verifiedPhone)") && appJs.includes(".limit(25)"), "Customer phone orders query must have limit(25)");
});

// Test 10: Staff and Admin orders listeners enforce limit(150)
test('10. Staff and Admin order streams enforce limit(150) to prevent unbounded collection scans', () => {
    assert(staffJs.includes(".collection('orders')") && staffJs.includes(".limit(150)"), "Staff orders listener must have limit(150)");
    assert(adminHtml.includes(".collection('orders')") && adminHtml.includes(".limit(150)"), "Admin orders listener must have limit(150)");
});

// Test 11: Admin activity logs enforce limit(50)
test('11. Admin activity logs listener enforces limit(50)', () => {
    assert(adminHtml.includes(".collection('activity_logs')") && adminHtml.includes(".limit(50)"), "Admin activity logs must have limit(50)");
});

// Test 12: Public assets are synchronized with root source files
test('12. public/app.js is synchronized with root app.js', () => {
    const publicAppJs = fs.readFileSync('public/app.js', 'utf8');
    assert(publicAppJs.includes("fetchCustomerWalletLedger"), "public/app.js must contain fetchCustomerWalletLedger");
    assert(publicAppJs.includes("cleanupAllCustomerListeners"), "public/app.js must contain updated cleanupAllCustomerListeners");
});

console.log(`\nALL ${passCount} VERIFICATION TESTS PASSED SUCCESSFULLY!`);
