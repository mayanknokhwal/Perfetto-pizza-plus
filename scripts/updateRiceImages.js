/**
 * One-time Seeding Script: Update all Rice category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const RICE_ITEMS = [
    {
        id: "ric-veg-fried",
        name: "Veg Fried Rice",
        category: "Rice",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/0j2C4vR2/Veg-Fried-Rice.jpg",
        desc: "Classic stir-fried rice tossed with fresh garden vegetables & aromatic seasonings"
    },
    {
        id: "ric-singapuri",
        name: "Singapuri Rice",
        category: "Rice",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/q3wnW2kC/Singapuri-Rice.jpg",
        desc: "Spicy & exotic Singapore style fried rice infused with mild curry spices"
    },
    {
        id: "ric-chilly-garlic",
        name: "Chilly Garlic Rice",
        category: "Rice",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/wFBqyMBD/Chilly-Garlic-Rice.jpg",
        desc: "Zesty fried rice wok-tossed with pungent chili garlic sauce"
    },
    {
        id: "ric-haka",
        name: "Haka Rice",
        category: "Rice",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/4g1rfZ9V/Haka-Rice.jpg",
        desc: "Authentic Hakka style wok-tossed rice with crisp vegetables"
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

        // Remove old placeholder rice items (ric-1, ric-2, ric-3, ric-4)
        items = items.filter(i => {
            if (i.category === 'Rice') {
                return false;
            }
            if (i.id && i.id.startsWith('ric-')) {
                return false;
            }
            return true;
        });

        // Add 4 fresh rice items
        items.push(...RICE_ITEMS);

        await menuDocRef.set({
            items: items,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${RICE_ITEMS.length} Rice items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: RICE_ITEMS,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy ric-1 .. ric-4 if they exist
    const legacyIds = ['ric-1', 'ric-2', 'ric-3', 'ric-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of RICE_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`Queued batch set for menu/${item.id}`);
    }

    await batch.commit();
    console.log('Batch commit for menu collection completed successfully.');
    console.log('ALL RICE ITEMS & IMAGES UPDATED IN FIRESTORE!');
}

main().catch(err => {
    console.error('Error updating Rice images:', err);
    process.exit(1);
});
