/**
 * One-time Seeding Script: Update all Momos menu items, images & add-on rates in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const MOMOS_ITEMS = [
    {
        id: "mom-chilly-paneer",
        name: "Chilly Paneer Momos",
        category: "Momos",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/8npwRhND/Chilly-Paneer-Momos.jpg",
        desc: "Crispy paneer momos tossed in spicy chilli garlic sauce"
    },
    {
        id: "mom-chilly-veg",
        name: "Chilly Veg Momos",
        category: "Momos",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/C3fxBr0n/Chilly-Veg-Momos.jpg",
        desc: "Golden fried veg momos coated in tangy chilli sauce"
    },
    {
        id: "mom-crispy-paneer",
        name: "Crispy Paneer Momos",
        category: "Momos",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/7dCpxDhH/Crispy-Paneer-Momos.jpg",
        desc: "Crunchy crumb-coated momos loaded with seasoned paneer filling"
    },
    {
        id: "mom-crispy-veg",
        name: "Crispy Veg Momos",
        category: "Momos",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/20ZqGQqs/Crispy-Veg-Momos.jpg",
        desc: "Super crunchy fried momos stuffed with spiced minced veggies"
    },
    {
        id: "mom-pan-fried-paneer",
        name: "Pan Fried Paneer Momos",
        category: "Momos",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/rKg6g0zf/Pan-Fried-Paneer-Momos.jpg",
        desc: "Pan-seared juicy paneer momos with crispy bottoms and savory seasoning"
    },
    {
        id: "mom-pan-fried-veg",
        name: "Pan Fried Veg Momo",
        category: "Momos",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/BH0S6hGj/Pan-Fried-Veg-Momo.jpg",
        desc: "Crispy pan-fried vegetable momos glazed with mild aromatic spices"
    },
    {
        id: "mom-paneer",
        name: "Paneer Momos",
        category: "Momos",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/B786z53/Paneer-Momos.jpg",
        desc: "Steamed soft momos stuffed with rich seasoned cottage cheese"
    },
    {
        id: "mom-special-paneer",
        name: "Special Paneer Momos",
        category: "Momos",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/zVWhf66r/Special-Paneer-Momos.jpg",
        desc: "Chef special recipe paneer momos with gourmet herb filling"
    },
    {
        id: "mom-tandoori-paneer",
        name: "Tandoori Paneer Momos",
        category: "Momos",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/chtDHFmG/Tandoori-Paneer-Momos.jpg",
        desc: "Char-grilled paneer momos marinated in smoky tandoori spices"
    },
    {
        id: "mom-tandoori-veg",
        name: "Tandoori Veg Momos",
        category: "Momos",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/yFSGcBsD/Tandoori-Veg-Momos.jpg",
        desc: "Smoky tandoori marinated veg momos with oven-roasted aroma"
    },
    {
        id: "mom-veg",
        name: "Veg Momos",
        category: "Momos",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/0RTw1B4c/Veg-Momos.jpg",
        desc: "Classic steamed dumplings packed with fresh garden vegetables"
    }
];

const MOMOS_ADDONS = {
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

        // Remove any old placeholder momos items
        items = items.filter(i => {
            if (i.category === 'Momos') {
                return false;
            }
            if (i.id && i.id.startsWith('mom-')) {
                return false;
            }
            return true;
        });

        // Add 11 fresh momos items
        items.push(...MOMOS_ITEMS);

        // Update categoryAddons for Momos
        categoryAddons['Momos'] = MOMOS_ADDONS;

        await menuDocRef.set({
            items: items,
            categoryAddons: categoryAddons,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${MOMOS_ITEMS.length} momos & categoryAddons.Momos.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: MOMOS_ITEMS,
            categoryAddons: { Momos: MOMOS_ADDONS },
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy mom-1 .. mom-4 if they exist
    const legacyIds = ['mom-1', 'mom-2', 'mom-3', 'mom-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of MOMOS_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`Queued batch set for menu/${item.id}`);
    }

    await batch.commit();
    console.log('Batch commit for menu collection completed successfully.');
    console.log('ALL MOMOS ITEMS & IMAGES UPDATED IN FIRESTORE!');
}

main().catch(err => {
    console.error('Error updating momos images:', err);
    process.exit(1);
});
