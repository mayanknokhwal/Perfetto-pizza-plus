/**
 * Script: Update Firestore settings/menu categoryAddons with Extra Mayo for Burger, Wrap, Bread, and Sandwich
 */
const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

async function main() {
    console.log('Initializing Firebase Admin...');
    initFirebaseAdmin();
    const db = getFirestore();

    const menuDocRef = db.collection('settings').doc('menu');
    const menuDocSnap = await menuDocRef.get();

    if (!menuDocSnap.exists) {
        console.error('settings/menu document does not exist!');
        process.exit(1);
    }

    const data = menuDocSnap.data() || {};
    const categoryAddons = data.categoryAddons || {};

    // Update Burger, Wrap, Bread, Sandwich with extraMayo
    categoryAddons['Burger'] = {
        extraCheese: categoryAddons['Burger']?.extraCheese ?? 25,
        extraSpicy: categoryAddons['Burger']?.extraSpicy ?? 0,
        extraMayo: categoryAddons['Burger']?.extraMayo ?? 20
    };

    categoryAddons['Wrap'] = {
        extraCheese: categoryAddons['Wrap']?.extraCheese ?? 30,
        extraSpicy: categoryAddons['Wrap']?.extraSpicy ?? 0,
        extraMayo: categoryAddons['Wrap']?.extraMayo ?? 20
    };

    categoryAddons['Bread'] = {
        extraCheese: categoryAddons['Bread']?.extraCheese ?? 25,
        extraSpicy: categoryAddons['Bread']?.extraSpicy ?? 0,
        extraMayo: categoryAddons['Bread']?.extraMayo ?? 20
    };

    categoryAddons['Sandwich'] = {
        extraCheese: categoryAddons['Sandwich']?.extraCheese ?? 25,
        extraSpicy: categoryAddons['Sandwich']?.extraSpicy ?? 0,
        extraMayo: categoryAddons['Sandwich']?.extraMayo ?? 20
    };

    if (!categoryAddons['Pizza']) {
        categoryAddons['Pizza'] = { sizes: {} };
    }
    if (!categoryAddons['Pizza'].sizes) {
        categoryAddons['Pizza'].sizes = {};
    }
    categoryAddons['Pizza'].sizes.S = {
        extraCheese: categoryAddons['Pizza'].sizes.S?.extraCheese ?? 30,
        extraSpicy: categoryAddons['Pizza'].sizes.S?.extraSpicy ?? 0,
        extraMayo: categoryAddons['Pizza'].sizes.S?.extraMayo ?? 20
    };
    categoryAddons['Pizza'].sizes.M = {
        extraCheese: categoryAddons['Pizza'].sizes.M?.extraCheese ?? 50,
        extraSpicy: categoryAddons['Pizza'].sizes.M?.extraSpicy ?? 0,
        extraMayo: categoryAddons['Pizza'].sizes.M?.extraMayo ?? 30
    };
    categoryAddons['Pizza'].sizes.L = {
        extraCheese: categoryAddons['Pizza'].sizes.L?.extraCheese ?? 70,
        extraSpicy: categoryAddons['Pizza'].sizes.L?.extraSpicy ?? 0,
        extraMayo: categoryAddons['Pizza'].sizes.L?.extraMayo ?? 40
    };

    await menuDocRef.set({
        categoryAddons: categoryAddons,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log('Successfully updated settings/menu categoryAddons in Firestore:');
    console.log(JSON.stringify(categoryAddons, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error('Error updating categoryAddons in Firestore:', err);
    process.exit(1);
});
