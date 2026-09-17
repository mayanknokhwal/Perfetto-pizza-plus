/**
 * Standalone One-Time Firestore Cleanup Script
 * 
 * Purges all test data across:
 *  - `orders` collection: Deletes all historical/active test orders.
 *  - `wallets` collection: Recursively deletes subcollections (transactions, wallet_transactions, etc.) and wallet docs.
 *  - `users` collection: Recursively deletes subcollections (addresses, transactions, wallet_transactions, etc.) and user docs.
 *  - Root collections: `wallet_transactions`, `transactions`, `scratch_cards`, `wallet_holds` if any exist.
 * 
 * Safety Shield:
 *  - `team`: Staff and Admin accounts are STRICTLY PROTECTED and will NEVER be touched.
 *  - `settings`: Store operational settings, hours, notices, etc. are STRICTLY PROTECTED.
 *  - `menu`, `categories`, `banners`, `site_settings`: STRICTLY PROTECTED.
 * 
 * Usage:
 *   node scripts/reset-test-data.js --dry-run   (Dry run, no changes made)
 *   node scripts/reset-test-data.js             (Executes deletion)
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const isDryRun = process.argv.includes('--dry-run');

// Protected collections that must NEVER be touched under any circumstances
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
    'wallets',
    'users',
    'wallet_transactions',
    'transactions',
    'scratch_cards',
    'wallet_holds'
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
    const snapshot = await colRef.get();

    if (snapshot.empty) {
        console.log(`ℹ️ Collection '${collectionName}' is already completely empty (0 documents).`);
        return { docsDeleted: 0, subDocsDeleted: 0 };
    }

    console.log(`📦 Found ${snapshot.size} document(s) in '${collectionName}'.`);

    let docsDeleted = 0;
    let subDocsDeleted = 0;

    // Process documents in batches
    for (const doc of snapshot.docs) {
        const docId = doc.id;
        const docData = doc.data() || {};
        
        console.log(`  🗑️ ${isDryRun ? '[DRY-RUN] Would delete' : 'Deleting'} doc: ${docId} (${JSON.stringify(Object.keys(docData))})`);

        // Check and delete any nested subcollections (e.g. transactions, wallet_transactions)
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

async function runCleanup() {
    console.log(`\n======================================================`);
    console.log(`🚀 PERFETTO PIZZA - ONE-TIME TEST DATA CLEANUP`);
    console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (No changes will be written)' : '🔥 LIVE EXECUTION (Wiping test data)'}`);
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

    console.log(`\n======================================================`);
    console.log(`📊 CLEANUP SUMMARY ${isDryRun ? '(DRY-RUN)' : '(COMPLETE)'}`);
    console.log(`======================================================`);
    for (const [col, result] of Object.entries(stats)) {
        console.log(`  - ${col.padEnd(22)}: ${result.docsDeleted} docs, ${result.subDocsDeleted} sub-docs ${isDryRun ? 'to delete' : 'deleted'}`);
    }

    if (!isDryRun) {
        console.log(`\n✅ Database sweep finished successfully. Target collections are now clean.`);
    } else {
        console.log(`\nℹ️ Dry-run completed. Run without '--dry-run' to execute deletions.`);
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
