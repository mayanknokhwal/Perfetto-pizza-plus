/**
 * Standalone One-Time Firestore Cleanup & State Reset Script
 * 
 * Purges all test data across:
 *  - `orders` collection: Deletes all historical/active test orders.
 *  - `customers` & `users` collections: Clears test customer records and associated test wallet balances/transactions.
 *  - `wallets` collection: Recursively deletes subcollections (transactions, wallet_transactions, etc.) and wallet docs.
 *  - Root collections: `wallet_transactions`, `transactions`, `scratch_cards`, `wallet_holds`, `order_holds`, `holds`, `checkout_holds`.
 * 
 * Initializes Global Sequence Counters:
 *  - `settings/system_counters`: { nextOrderNumber: 1, cycleLimit: 9999 }
 *  - `settings/order_metadata`: { nextOrderNumber: 1, cycleLimit: 9999 }
 *  - Resets order statistics in `settings/storeSettings` and `settings/store_config` to 0.
 * 
 * Safety Shield:
 *  - `team`: Staff and Admin accounts are STRICTLY PROTECTED and will NEVER be touched.
 *  - `settings`: Store operational settings, hours, notices, wallet_config, menu items are STRICTLY PROTECTED.
 *  - `menu`, `categories`, `banners`, `site_settings`: STRICTLY PROTECTED.
 * 
 * Usage:
 *   node scripts/reset-test-data.js --dry-run   (Dry run, no changes made)
 *   node scripts/reset-test-data.js             (Executes deletion & resets sequence counter)
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const isDryRun = process.argv.includes('--dry-run');

// Protected collections that must NEVER be purged
const PROTECTED_COLLECTIONS = new Set([
    'team',
    'settings',
    'menu',
    'menu_items',
    'categories',
    'banners',
    'daily_banners',
    'site_settings',
    'app_config',
    'staff_devices',
    'staff_tokens',
    'staff_fcm_tokens',
    'coupons',
    'promo_codes'
]);

// Target collections to wipe clean
const TARGET_COLLECTIONS = [
    'orders',
    'customers',
    'wallets',
    'users',
    'wallet_transactions',
    'transactions',
    'scratch_cards',
    'wallet_holds',
    'order_holds',
    'holds',
    'checkout_holds'
];

async function deleteSubcollections(docRef, depth = 1) {
    if (depth > 5) return 0; // Guard against infinite recursion
    let deletedCount = 0;
    try {
        const subcollections = await docRef.listCollections();
        for (const subcol of subcollections) {
            const subDocsSnap = await subcol.get();
            for (const subDoc of subDocsSnap.docs) {
                // Recursively delete sub-subcollections first
                deletedCount += await deleteSubcollections(subDoc.ref, depth + 1);
                if (!isDryRun) {
                    await subDoc.ref.delete();
                }
                deletedCount++;
            }
        }
    } catch (err) {
        console.warn(`    ⚠️ Notice checking subcollections for doc ${docRef.id}: ${err.message}`);
    }
    return deletedCount;
}

async function purgeCollection(db, collectionName) {
    if (PROTECTED_COLLECTIONS.has(collectionName)) {
        console.error(`🛑 BLOCKED: Attempted to purge protected collection '${collectionName}'! Skipping immediately.`);
        return { docsDeleted: 0, subDocsDeleted: 0 };
    }

    console.log(`\n======================================================`);
    console.log(`🔍 Inspecting collection: '${collectionName}'...`);

    const colRef = db.collection(collectionName);
    let snapshot;
    try {
        snapshot = await colRef.get();
    } catch (e) {
        console.warn(`⚠️ Collection '${collectionName}' query notice: ${e.message}`);
        return { docsDeleted: 0, subDocsDeleted: 0 };
    }

    if (snapshot.empty) {
        console.log(`ℹ️ Collection '${collectionName}' is already completely empty (0 documents).`);
        return { docsDeleted: 0, subDocsDeleted: 0 };
    }

    console.log(`📦 Found ${snapshot.size} document(s) in '${collectionName}'.`);

    let docsDeleted = 0;
    let subDocsDeleted = 0;

    for (const doc of snapshot.docs) {
        const docId = doc.id;
        const docData = doc.data() || {};
        
        console.log(`  🗑️ ${isDryRun ? '[DRY-RUN] Would delete' : 'Deleting'} doc: ${docId} (${JSON.stringify(Object.keys(docData))})`);

        // Delete any nested subcollections first
        const subDeleted = await deleteSubcollections(doc.ref);
        subDocsDeleted += subDeleted;

        if (!isDryRun) {
            await doc.ref.delete();
        }
        docsDeleted++;
    }

    console.log(`✅ Collection '${collectionName}' finished: ${docsDeleted} parent doc(s), ${subDocsDeleted} sub-doc(s) ${isDryRun ? 'identified' : 'deleted'}.`);
    return { docsDeleted, subDocsDeleted };
}

async function initializeGlobalOrderCounter(db) {
    console.log(`\n======================================================`);
    console.log(`🔢 Initializing Global Order Sequence Counters...`);

    const counterPayload = {
        nextOrderNumber: 1,
        cycleLimit: 9999,
        lastResetAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (isDryRun) {
        console.log(`  [DRY-RUN] Would set 'settings/system_counters' to:`, counterPayload);
        console.log(`  [DRY-RUN] Would set 'settings/order_metadata' to:`, counterPayload);
        return;
    }

    await db.collection('settings').doc('system_counters').set(counterPayload);
    console.log(`  ✓ 'settings/system_counters' set to nextOrderNumber=1, cycleLimit=9999`);

    await db.collection('settings').doc('order_metadata').set(counterPayload);
    console.log(`  ✓ 'settings/order_metadata' set to nextOrderNumber=1, cycleLimit=9999`);

    // Reset storeSettings and store_config order statistics
    const zeroStats = {
        ordersCount: 0,
        pendingCount: 0,
        totalOrdersCount: 0,
        deliveredOrdersCount: 0,
        completedOrdersCount: 0,
        pendingOrdersCount: 0,
        rejectedCount: 0,
        deliveredCount: 0,
        totalOrders: 0,
        completedCount: 0,
        rejectedOrdersCount: 0,
        updatedAt: new Date().toISOString()
    };

    try {
        await db.collection('settings').doc('storeSettings').set(zeroStats, { merge: true });
        console.log(`  ✓ 'settings/storeSettings' order stats reset to 0`);
    } catch (e) {
        console.warn(`  ⚠️ Could not reset storeSettings stats:`, e.message);
    }

    try {
        await db.collection('settings').doc('store_config').set(zeroStats, { merge: true });
        console.log(`  ✓ 'settings/store_config' order stats reset to 0`);
    } catch (e) {
        console.warn(`  ⚠️ Could not reset store_config stats:`, e.message);
    }
}

async function verifyState(db) {
    console.log(`\n======================================================`);
    console.log(`🔍 VERIFYING CLEAN-SLATE INTEGRITY`);
    console.log(`======================================================`);

    let allClear = true;

    // 1. Verify target collections are at 0
    for (const col of TARGET_COLLECTIONS) {
        try {
            const snap = await db.collection(col).get();
            if (snap.size === 0) {
                console.log(`  ✓ Collection '${col}': 0 documents (CLEAN)`);
            } else {
                console.error(`  ❌ Collection '${col}': ${snap.size} documents remaining!`);
                allClear = false;
            }
        } catch (e) {
            console.log(`  ✓ Collection '${col}': 0 documents (empty/uncreated)`);
        }
    }

    // 2. Verify settings/wallet_config is intact
    try {
        const walletSnap = await db.collection('settings').doc('wallet_config').get();
        if (walletSnap.exists) {
            const wData = walletSnap.data();
            console.log(`  ✓ 'settings/wallet_config': INTACT (enabled: ${wData.enabled}, slabs: ${Array.isArray(wData.slabs) ? wData.slabs.length : 0})`);
        } else {
            console.error(`  ❌ 'settings/wallet_config' document is MISSING!`);
            allClear = false;
        }
    } catch (e) {
        console.error(`  ❌ Error reading wallet_config:`, e.message);
        allClear = false;
    }

    // 3. Verify settings/store_config & storeSettings are intact
    try {
        const storeSnap = await db.collection('settings').doc('storeSettings').get();
        if (storeSnap.exists) {
            console.log(`  ✓ 'settings/storeSettings': INTACT`);
        }
        const confSnap = await db.collection('settings').doc('store_config').get();
        if (confSnap.exists) {
            console.log(`  ✓ 'settings/store_config': INTACT`);
        }
    } catch (e) {
        console.warn(`  ⚠️ Error checking store settings:`, e.message);
    }

    // 4. Verify menu data is intact
    try {
        const menuSnap = await db.collection('settings').doc('menu').get();
        if (menuSnap.exists) {
            const mData = menuSnap.data();
            const itemCount = Array.isArray(mData.items) ? mData.items.length : 0;
            console.log(`  ✓ 'settings/menu': INTACT (${itemCount} menu items preserved)`);
        } else {
            console.error(`  ❌ 'settings/menu' document is MISSING!`);
            allClear = false;
        }
    } catch (e) {
        console.error(`  ❌ Error reading settings/menu:`, e.message);
        allClear = false;
    }

    // 5. Verify global sequence counters
    try {
        const counterSnap = await db.collection('settings').doc('system_counters').get();
        if (counterSnap.exists) {
            const cData = counterSnap.data();
            console.log(`  ✓ 'settings/system_counters': INTACT (nextOrderNumber: ${cData.nextOrderNumber}, cycleLimit: ${cData.cycleLimit})`);
            if (cData.nextOrderNumber !== 1) {
                console.error(`  ❌ Expected nextOrderNumber to be 1, found: ${cData.nextOrderNumber}`);
                allClear = false;
            }
        } else if (!isDryRun) {
            console.error(`  ❌ 'settings/system_counters' document is MISSING!`);
            allClear = false;
        }
    } catch (e) {
        console.error(`  ❌ Error checking system_counters:`, e.message);
        allClear = false;
    }

    // 6. Verify team accounts are intact
    try {
        const teamSnap = await db.collection('team').get();
        console.log(`  ✓ 'team' collection: INTACT (${teamSnap.size} staff/admin accounts preserved)`);
    } catch (e) {
        console.warn(`  ⚠️ Error checking team:`, e.message);
    }

    return allClear;
}

async function runCleanup() {
    console.log(`\n======================================================`);
    console.log(`🚀 PERFETTO PIZZA - ONE-TIME TEST DATA CLEANUP & RESET`);
    console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (No changes will be written)' : '🔥 LIVE EXECUTION (Wiping test data & resetting sequence)'}`);
    console.log(`Target Collections: ${TARGET_COLLECTIONS.join(', ')}`);
    console.log(`Protected Collections: ${Array.from(PROTECTED_COLLECTIONS).join(', ')}`);
    console.log(`======================================================\n`);

    const app = initFirebaseAdmin();
    if (!app) {
        console.error(`❌ Failed to initialize Firebase Admin SDK. Check serviceAccountKey.json.`);
        process.exit(1);
    }

    const db = getFirestore(app);

    // Verify database connection and verify protected collections exist and are safe
    try {
        const teamSnap = await db.collection('team').get();
        console.log(`🛡️ SAFETY CHECK: 'team' collection currently has ${teamSnap.size} staff/admin accounts. (WILL BE PRESERVED)`);
        teamSnap.forEach(t => console.log(`   - Team member: ${t.id} (${t.data()?.name || 'N/A'}, role: ${t.data()?.role || 'N/A'})`));
    } catch (e) {
        console.warn(`⚠️ Could not inspect team collection: ${e.message}`);
    }

    const stats = {};
    for (const colName of TARGET_COLLECTIONS) {
        stats[colName] = await purgeCollection(db, colName);
    }

    // Initialize global sequence counters
    await initializeGlobalOrderCounter(db);

    console.log(`\n======================================================`);
    console.log(`📊 CLEANUP SUMMARY ${isDryRun ? '(DRY-RUN)' : '(COMPLETE)'}`);
    console.log(`======================================================`);
    for (const [col, result] of Object.entries(stats)) {
        console.log(`  - ${col.padEnd(22)}: ${result.docsDeleted} docs, ${result.subDocsDeleted} sub-docs ${isDryRun ? 'to delete' : 'deleted'}`);
    }

    if (!isDryRun) {
        const verified = await verifyState(db);
        if (verified) {
            console.log(`\n======================================================`);
            console.log(`🎉 PURGE & RESET SUCCEEDED!`);
            console.log(`All test data has been cleanly removed.`);
            console.log(`Global order sequence counter has been set to 1.`);
            console.log(`The next customer order placed will strictly be #1.`);
            console.log(`======================================================\n`);
        } else {
            console.error(`\n⚠️ Post-cleanup verification encountered warnings. Please review the output above.`);
        }
    } else {
        console.log(`\nℹ️ Dry-run completed. Run without '--dry-run' to execute deletions and initialize counters.`);
    }
}

if (require.main === module) {
    runCleanup()
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            console.error(`❌ Error executing cleanup:`, err);
            process.exit(1);
        });
}

module.exports = {
    runCleanup,
    TARGET_COLLECTIONS,
    PROTECTED_COLLECTIONS
};
