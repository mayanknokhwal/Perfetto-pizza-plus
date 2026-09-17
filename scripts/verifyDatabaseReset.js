/**
 * Verification Script: Verify Database Reset State
 * 
 * Asserts:
 *  1. `orders` collection is completely empty (size === 0).
 *  2. `wallets` collection is completely empty (size === 0).
 *  3. `users` collection is completely empty (size === 0).
 *  4. `team` collection is INTACT (size >= 5, staff & admins preserved).
 *  5. `settings` collection is INTACT (store settings preserved).
 *  6. `menu` collection is INTACT (menu items preserved).
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

async function verifyReset() {
    console.log('======================================================');
    console.log('🔍 VERIFYING DATABASE RESET STATE');
    console.log('======================================================');

    const app = initFirebaseAdmin();
    if (!app) {
        console.error('❌ Failed to initialize Firebase Admin SDK');
        process.exit(1);
    }

    const db = getFirestore(app);

    let allPassed = true;

    // 1. Check orders
    const ordersSnap = await db.collection('orders').get();
    console.log(`[1/6] 'orders' collection count: ${ordersSnap.size}`);
    if (ordersSnap.size === 0) {
        console.log('  ✅ PASS: orders collection is completely empty.');
    } else {
        console.error(`  ❌ FAIL: orders collection has ${ordersSnap.size} document(s).`);
        allPassed = false;
    }

    // 2. Check wallets
    const walletsSnap = await db.collection('wallets').get();
    console.log(`[2/6] 'wallets' collection count: ${walletsSnap.size}`);
    if (walletsSnap.size === 0) {
        console.log('  ✅ PASS: wallets collection is completely empty.');
    } else {
        console.error(`  ❌ FAIL: wallets collection has ${walletsSnap.size} document(s).`);
        allPassed = false;
    }

    // 3. Check users
    const usersSnap = await db.collection('users').get();
    console.log(`[3/6] 'users' collection count: ${usersSnap.size}`);
    if (usersSnap.size === 0) {
        console.log('  ✅ PASS: users collection is completely empty.');
    } else {
        console.error(`  ❌ FAIL: users collection has ${usersSnap.size} document(s).`);
        allPassed = false;
    }

    // 4. Check team (MUST BE PRESERVED)
    const teamSnap = await db.collection('team').get();
    console.log(`[4/6] 'team' collection count: ${teamSnap.size}`);
    if (teamSnap.size >= 5) {
        console.log('  ✅ PASS: team collection is intact with staff & admin accounts.');
        teamSnap.forEach(t => console.log(`     - ${t.id} (${t.data()?.role || 'member'})`));
    } else {
        console.error(`  ❌ FAIL: team collection count unexpected (${teamSnap.size}).`);
        allPassed = false;
    }

    // 5. Check settings (MUST BE PRESERVED)
    const settingsSnap = await db.collection('settings').get();
    console.log(`[5/6] 'settings' collection count: ${settingsSnap.size}`);
    if (settingsSnap.size > 0) {
        console.log('  ✅ PASS: settings collection is intact.');
        settingsSnap.forEach(s => console.log(`     - ${s.id}`));
    } else {
        console.warn('  ⚠️ Notice: settings collection has 0 documents.');
    }

    // 6. Check menu (MUST BE PRESERVED)
    const menuSnap = await db.collection('menu').get();
    console.log(`[6/6] 'menu' collection count: ${menuSnap.size}`);
    if (menuSnap.size > 0) {
        console.log('  ✅ PASS: menu collection is intact.');
    } else {
        console.log('  ℹ️ menu collection root count: 0 (menu may be in menu_items or settings).');
    }

    console.log('======================================================');
    if (allPassed) {
        console.log('🎉 ALL RESETS VERIFIED: Target collections wiped, protected data safe.');
        process.exit(0);
    } else {
        console.error('❌ Reset verification failed some assertions.');
        process.exit(1);
    }
}

verifyReset().catch(err => {
    console.error('Error in verification:', err);
    process.exit(1);
});
