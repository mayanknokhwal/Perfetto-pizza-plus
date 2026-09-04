/**
 * One-time Seeding Script: Update all Shake menu items, images & add-on rates in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const SHAKE_ITEMS = [
    {
        id: "shk-black-currant",
        name: "Black Currant Shake",
        category: "Shake",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/nN8ZnFYV/Black-Currant-Shake.jpg",
        desc: "Rich creamy shake blended with luscious black currant flavor"
    },
    {
        id: "shk-butter-scotch",
        name: "Butter Scotch Shake",
        category: "Shake",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/Wvy1Zfbj/Butter-Scotch-Shake.jpg",
        desc: "Smooth butterscotch milkshake topped with crunchy caramel nuggets"
    },
    {
        id: "shk-chocolate",
        name: "Chocolate Shake",
        category: "Shake",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/dsmztpV7/Chocolate-Shake.jpg",
        desc: "Classic rich cocoa chocolate shake blended to perfection"
    },
    {
        id: "shk-kitkat-crunchy",
        name: "Kit Kat Crunchy Shake",
        category: "Shake",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/wZZf2jWy/Kit-Kat-Crunchy-Shake.jpg",
        desc: "Delicious chocolate shake blended with real crispy KitKat wafers"
    },
    {
        id: "shk-oreo-feast",
        name: "Oreo Feast Shake",
        category: "Shake",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/YqNxTL3/Oreo-Feast-Shake.jpg",
        desc: "Thick creamy shake loaded with crushed Oreo cookies"
    },
    {
        id: "shk-pineapple",
        name: "Pineapple Shake",
        category: "Shake",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/pc2FGBh/Pineapple-Shake.jpg",
        desc: "Refreshing tropical pineapple milkshake"
    },
    {
        id: "shk-rasmalai",
        name: "Rasmalai Shake",
        category: "Shake",
        isMultiSize: false,
        price: 149,
        available: true,
        img: "https://i.ibb.co/vCtBxC5V/Rasmalai-Shake.jpg",
        desc: "Royal Indian fusion shake with authentic rasmalai flavor & dry fruits"
    },
    {
        id: "shk-strawberry",
        name: "Strawberry Shake",
        category: "Shake",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/jvcrqP0Z/Strawberry-Shake.jpg",
        desc: "Sweet and tangy fresh strawberry milkshake"
    },
    {
        id: "shk-vanilla",
        name: "Vanilla Shake",
        category: "Shake",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/nqzRxxjB/Vanilla-Shake.jpg",
        desc: "Smooth classic Madagascar vanilla milkshake"
    }
];

const SHAKE_ADDONS = {
    withIceCream: 30
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

        // Remove old placeholder shake items (shk-1, shk-2, etc.)
        items = items.filter(i => {
            if (i.category === 'Shake') {
                return false;
            }
            if (i.id && i.id.startsWith('shk-')) {
                return false;
            }
            return true;
        });

        // Add 9 fresh shake items
        items.push(...SHAKE_ITEMS);

        // Update categoryAddons
        categoryAddons['Shake'] = SHAKE_ADDONS;

        await menuDocRef.set({
            items: items,
            categoryAddons: categoryAddons,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${SHAKE_ITEMS.length} shake items & categoryAddons.Shake.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: SHAKE_ITEMS,
            categoryAddons: { Shake: SHAKE_ADDONS },
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy shk-1 .. shk-4 if they exist
    const legacyIds = ['shk-1', 'shk-2', 'shk-3', 'shk-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of SHAKE_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`Queued batch set for menu/${item.id}`);
    }

    await batch.commit();
    console.log('Batch commit for menu collection completed successfully.');
    console.log('ALL SHAKE ITEMS & IMAGES UPDATED IN FIRESTORE!');
}

main().catch(err => {
    console.error('Error updating shake images:', err);
    process.exit(1);
});
