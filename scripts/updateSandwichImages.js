/**
 * One-time Seeding Script: Update all Sandwich menu items & images in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const SANDWICH_ITEMS = [
    {
        id: "sdw-double-decker",
        name: "Double Decker Sandwich",
        category: "Sandwich",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/CsVRK0p0/Double-Decker-Sandwich.jpg",
        desc: "Layered grilled sandwich packed with fresh veggies, sauces & spices"
    },
    {
        id: "sdw-grilled",
        name: "Grilled Sandwich",
        category: "Sandwich",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/rGDgsJbM/Grilled-Sandwich.jpg",
        desc: "Crispy golden grilled sandwich with house seasoning & herb filling"
    },
    {
        id: "sdw-paneer",
        name: "Paneer Sandwich",
        category: "Sandwich",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/dsw5G4Kk/Paneer-Sandwich.jpg",
        desc: "Rich paneer chunks tossed with aromatic spices & fresh veggies"
    },
    {
        id: "sdw-spicy",
        name: "Spicy Sandwich",
        category: "Sandwich",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/YTb1G6fh/Spicy-Sandwich.jpg",
        desc: "Zesty spicy spread with crunchy vegetable filling & hot seasonings"
    },
    {
        id: "sdw-cheesy",
        name: "Cheesy Sandwich",
        category: "Sandwich",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/XZKVpGT8/Cheesy-Sandwich.jpg",
        desc: "Melted gooey cheese blend seasoned with Italian herbs"
    }
];

const SANDWICH_ADDONS = {
    extraCheese: 25,
    extraSpicy: 0,
    extraMayo: 20
};

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
        let categoryAddons = data.categoryAddons || {};

        // Remove any old placeholder sandwich items
        items = items.filter(i => {
            if (i.category === 'Sandwich') {
                return false;
            }
            if (i.id && i.id.startsWith('sdw-')) {
                return false;
            }
            return true;
        });

        // Add 5 fresh sandwich items
        items.push(...SANDWICH_ITEMS);

        // Update categoryAddons
        categoryAddons['Sandwich'] = SANDWICH_ADDONS;

        await menuDocRef.set({
            items: items,
            categoryAddons: categoryAddons,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${SANDWICH_ITEMS.length} sandwiches & categoryAddons.Sandwich.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: SANDWICH_ITEMS,
            categoryAddons: { Sandwich: SANDWICH_ADDONS },
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy sdw-1 .. sdw-4 if they exist
    const legacyIds = ['sdw-1', 'sdw-2', 'sdw-3', 'sdw-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of SANDWICH_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`Queued batch set for menu/${item.id}`);
    }

    await batch.commit();
    console.log('Batch commit for menu collection completed successfully.');
    console.log('ALL SANDWICH ITEMS & IMAGES UPDATED IN FIRESTORE!');
}

main().catch(err => {
    console.error('Error updating sandwich images:', err);
    process.exit(1);
});
