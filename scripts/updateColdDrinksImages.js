/**
 * One-time Seeding Script: Update all Cold Drinks category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const COLD_DRINKS_ITEMS = [
    {
        id: "drk-coke-300ml",
        name: "Coke (300ml)",
        category: "Colo Drinks",
        isMultiSize: false,
        price: 40,
        available: true,
        img: "https://i.ibb.co/r2JVJSMg/Coke-300ml.jpg",
        desc: "Chilled refreshing Coca-Cola bottle (300ml)"
    },
    {
        id: "drk-coke-ice-cream",
        name: "Coke With Ice Cream",
        category: "Colo Drinks",
        isMultiSize: false,
        price: 89,
        available: true,
        img: "https://i.ibb.co/jcQ2SVP/Coke-With-Ice-Cream.jpg",
        desc: "Classic chilled Coca-Cola served with a scoop of vanilla ice cream"
    },
    {
        id: "drk-milky-cola",
        name: "Milky Cola",
        category: "Colo Drinks",
        isMultiSize: false,
        price: 79,
        available: true,
        img: "https://i.ibb.co/Mk3VkTbK/Milky-Cola.jpg",
        desc: "Smooth and creamy cola blend with a velvety milky twist"
    },
    {
        id: "drk-milky-mango",
        name: "Milky Mango",
        category: "Colo Drinks",
        isMultiSize: false,
        price: 79,
        available: true,
        img: "https://i.ibb.co/35LxWDgq/Milky-Mango.jpg",
        desc: "Rich and refreshing creamy mango flavored chilled beverage"
    }
];

async function main() {
    const adminApp = initFirebaseAdmin();
    if (!adminApp) {
        console.error('Failed to initialize Firebase Admin SDK');
        process.exit(1);
    }

    const db = getFirestore(adminApp);
    console.log('Firebase Admin Firestore initialized successfully.');

    // 1. Update settings/menu document
    console.log('Fetching settings/menu doc...');
    const menuDocRef = db.collection('settings').doc('menu');
    const menuDocSnap = await menuDocRef.get();

    if (menuDocSnap.exists) {
        const data = menuDocSnap.data() || {};
        let items = Array.isArray(data.items) ? [...data.items] : [];

        // Remove old placeholder cold drinks items (drk-1, drk-2, drk-3, etc.)
        items = items.filter(i => {
            if (i.category === 'Colo Drinks' || i.category === 'Cold Drinks') {
                return false;
            }
            if (i.id && i.id.startsWith('drk-')) {
                return false;
            }
            return true;
        });

        // Add 4 fresh cold drinks items
        items.push(...COLD_DRINKS_ITEMS);

        await menuDocRef.set({
            items: items,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${COLD_DRINKS_ITEMS.length} Cold Drinks items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: COLD_DRINKS_ITEMS,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy drk-1 .. drk-4 if they exist
    const legacyIds = ['drk-1', 'drk-2', 'drk-3', 'drk-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of COLD_DRINKS_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully committed batch write for ${COLD_DRINKS_ITEMS.length} Cold Drinks items to 'menu' collection.`);

    console.log('\n--- VERIFICATION OF COLD DRINKS ITEMS ---');
    COLD_DRINKS_ITEMS.forEach(item => {
        console.log(`[OK] ${item.name} (${item.id}) => Price: Rs.${item.price}, isMultiSize: ${item.isMultiSize}, img: ${item.img}`);
    });
    console.log('\nAll Cold Drinks items and images seeded successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
