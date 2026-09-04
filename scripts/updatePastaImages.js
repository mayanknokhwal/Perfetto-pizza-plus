/**
 * One-time Seeding Script: Update all Pasta menu items, images & add-on rates in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const PASTA_ITEMS = [
    {
        id: "pst-baked-mix",
        name: "Baked Mix Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 149,
        available: true,
        img: "https://i.ibb.co/Z1k7wYcZ/Baked-Mix-Pasta.jpg",
        desc: "Oven baked pasta with rich combination of red and white sauces topped with melted cheese"
    },
    {
        id: "pst-baked-red",
        name: "Baked Red Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/0pLfYKfN/Baked-Red-Pasta.jpg",
        desc: "Tangy tomato arrabbiata pasta baked with extra mozzarella"
    },
    {
        id: "pst-baked-sweet-spicy",
        name: "Baked Sweet & Spicy Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 149,
        available: true,
        img: "https://i.ibb.co/PzgbnkXp/Baked-Sweet-Spicy-Pasta.jpg",
        desc: "Sweet chilli and herb infused pasta baked to cheesy perfection"
    },
    {
        id: "pst-baked-tandoori",
        name: "Baked Tandoori Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 149,
        available: true,
        img: "https://i.ibb.co/mFhbQZsN/Baked-Tandoori-Pasta.jpg",
        desc: "Smoky tandoori sauce pasta baked with golden cheese layer"
    },
    {
        id: "pst-baked-white",
        name: "Baked White Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/0jQLrKgh/Baked-White-Pasta.jpg",
        desc: "Creamy alfredo sauce pasta baked with Italian herbs and cheese"
    },
    {
        id: "pst-creamy",
        name: "Creamy Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/Q3yyX7ss/Creamy-Pasta.jpg",
        desc: "Rich smooth parmesan cream sauce tossed with penne"
    },
    {
        id: "pst-red",
        name: "Red Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/mCHkdqkg/Red-Pasta.jpg",
        desc: "Classic spicy tomato sauce pasta with Italian basil"
    },
    {
        id: "pst-supreme",
        name: "Supreme Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 159,
        available: true,
        img: "https://i.ibb.co/NDByPtY/Supreme-Pasta.jpg",
        desc: "Chef special pasta with fresh veggies, olives, jalapenos and secret herbs"
    },
    {
        id: "pst-tandoori",
        name: "Tandoori Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/hRg5D667/Tandoori-Pasta.jpg",
        desc: "Indian fusion pasta tossed in spicy tandoori mayo sauce"
    },
    {
        id: "pst-baked-makhani",
        name: "Baked Makhani Pasta",
        category: "Pasta",
        isMultiSize: false,
        price: 149,
        available: true,
        img: "https://i.ibb.co/v4KDB6tm/Baked-Makhani-Pasta.jpg",
        desc: "Rich butter makhani gravy pasta baked with melted mozzarella"
    }
];

const PASTA_ADDONS = {
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

        // Remove old placeholder pasta items (pst-1, pst-2, etc.)
        items = items.filter(i => {
            if (i.category === 'Pasta') {
                return false;
            }
            if (i.id && i.id.startsWith('pst-')) {
                return false;
            }
            return true;
        });

        // Add 10 fresh pasta items
        items.push(...PASTA_ITEMS);

        // Update categoryAddons
        categoryAddons['Pasta'] = PASTA_ADDONS;

        await menuDocRef.set({
            items: items,
            categoryAddons: categoryAddons,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${PASTA_ITEMS.length} pasta items & categoryAddons.Pasta.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: PASTA_ITEMS,
            categoryAddons: { Pasta: PASTA_ADDONS },
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy pst-1 .. pst-3 if they exist
    const legacyIds = ['pst-1', 'pst-2', 'pst-3'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of PASTA_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`Queued batch set for menu/${item.id}`);
    }

    await batch.commit();
    console.log('Batch commit for menu collection completed successfully.');
    console.log('ALL PASTA ITEMS & IMAGES UPDATED IN FIRESTORE!');
}

main().catch(err => {
    console.error('Error updating pasta images:', err);
    process.exit(1);
});
