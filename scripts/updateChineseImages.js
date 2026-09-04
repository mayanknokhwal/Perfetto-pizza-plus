/**
 * One-time Seeding Script: Update all Chinese Food menu items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const CHINESE_ITEMS = [
    {
        id: "chn-honey-chilly-cauliflower",
        name: "Honey Chilly Cauliflower",
        category: "Chinese Food",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/kgp9bjrS/Honey-Chilly-Cauliflower.jpg",
        desc: "Crispy florets tossed in sweet honey chilli glaze"
    },
    {
        id: "chn-honey-chilly-potato",
        name: "Honey Chilly Potato",
        category: "Chinese Food",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/GfY6XTJR/Honey-Chilly-Potato.jpg",
        desc: "Crispy potato fries glazed with honey, sesame and spicy chilli"
    },
    {
        id: "chn-veg-manchurian",
        name: "Veg Manchurian",
        category: "Chinese Food",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/NgMyx9My/Veg-Manchurian.jpg",
        desc: "Vegetable dumplings tossed in spicy garlic soy Manchurian sauce"
    },
    {
        id: "chn-chilly-cauliflower",
        name: "Chilly Cauliflower",
        category: "Chinese Food",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/pBPy144w/Chilly-Cauliflower.jpg",
        desc: "Crispy fried cauliflower tossed with bell peppers and chilli sauce"
    },
    {
        id: "chn-chilly-paneer",
        name: "Chilly Paneer",
        category: "Chinese Food",
        isMultiSize: false,
        price: 149,
        available: true,
        img: "https://i.ibb.co/HTm4J9Vh/Chilly-Paneer.jpg",
        desc: "Cubes of cottage cheese tossed with onion, capsicum & dark soy sauce"
    },
    {
        id: "chn-chilly-potato",
        name: "Chilly Potato",
        category: "Chinese Food",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/9k7pS8S3/Chilly-Potato.jpg",
        desc: "Spicy crisp potato fingers tossed in garlic chilli sauce"
    }
];

const CHINESE_ADDONS = {
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

        // Remove old placeholder chinese items (chn-1, chn-2, chn-3)
        items = items.filter(i => {
            if (i.category === 'Chinese Food' || i.category === 'Chinese') {
                return false;
            }
            if (i.id && i.id.startsWith('chn-')) {
                return false;
            }
            return true;
        });

        // Add 6 fresh chinese food items
        items.push(...CHINESE_ITEMS);

        // Update categoryAddons
        categoryAddons['Chinese Food'] = CHINESE_ADDONS;

        await menuDocRef.set({
            items: items,
            categoryAddons: categoryAddons,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${CHINESE_ITEMS.length} Chinese Food items & categoryAddons.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: CHINESE_ITEMS,
            categoryAddons: { 'Chinese Food': CHINESE_ADDONS },
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy chn-1 .. chn-3 if they exist
    const legacyIds = ['chn-1', 'chn-2', 'chn-3'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of CHINESE_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`Queued batch set for menu/${item.id}`);
    }

    await batch.commit();
    console.log('Batch commit for menu collection completed successfully.');
    console.log('ALL CHINESE FOOD ITEMS & IMAGES UPDATED IN FIRESTORE!');
}

main().catch(err => {
    console.error('Error updating Chinese Food images:', err);
    process.exit(1);
});
