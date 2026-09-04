/**
 * One-time Seeding Script: Update all Noodles category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const NOODLES_ITEMS = [
    {
        id: "ndl-butter-paneer",
        name: "Butter Paneer Noodles",
        category: "Noodles",
        isMultiSize: false,
        price: 149,
        available: true,
        img: "https://i.ibb.co/Qv9TGVwy/Butter-Paneer-Noodles.jpg",
        desc: "Wok-tossed noodles with soft paneer cubes in rich butter masala sauce"
    },
    {
        id: "ndl-chilly-garlic",
        name: "Chilly Garlic Noodles",
        category: "Noodles",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/ycQT35rB/Chilly-Garlic-Noodles.jpg",
        desc: "Spicy wok-tossed noodles flavored with pungent garlic and red chillies"
    },
    {
        id: "ndl-haka",
        name: "Haka Noodles",
        category: "Noodles",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/WvG995DF/Haka-Noodles.jpg",
        desc: "Classic Hakka style noodles stir-fried with crisp garden vegetables"
    },
    {
        id: "ndl-paneer",
        name: "Paneer Noodles",
        category: "Noodles",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/Cpwx1BY5/Paneer-Noodles.jpg",
        desc: "Delicious stir-fried noodles tossed with spiced paneer cubes and crunchy veggies"
    },
    {
        id: "ndl-singapuri",
        name: "Singapuri Noodles",
        category: "Noodles",
        isMultiSize: false,
        price: 139,
        available: true,
        img: "https://i.ibb.co/M0KJsvz/Singapuri-Noodles.jpg",
        desc: "Zesty Singapore style noodles with exotic spices and fresh bell peppers"
    },
    {
        id: "ndl-veg",
        name: "Veg Noodles",
        category: "Noodles",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/21JBqyRP/Veg-Noodles.jpg",
        desc: "Classic stir-fried noodles loaded with fresh seasoned vegetables"
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

        // Remove old placeholder noodles items (ndl-1, ndl-2, ndl-3, ndl-4)
        items = items.filter(i => {
            if (i.category === 'Noodles') {
                return false;
            }
            if (i.id && i.id.startsWith('ndl-')) {
                return false;
            }
            return true;
        });

        // Add 6 fresh noodles items
        items.push(...NOODLES_ITEMS);

        // Also update categoryAddons
        const categoryAddons = {
            ...(data.categoryAddons || {}),
            "Noodles": {
                extraCheese: 25,
                extraSpicy: 0,
                extraMayo: 20
            }
        };

        await menuDocRef.set({
            items: items,
            categoryAddons: categoryAddons,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${NOODLES_ITEMS.length} Noodles items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: NOODLES_ITEMS,
            categoryAddons: {
                "Noodles": {
                    extraCheese: 25,
                    extraSpicy: 0,
                    extraMayo: 20
                }
            },
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy ndl-1 .. ndl-4 if they exist
    const legacyIds = ['ndl-1', 'ndl-2', 'ndl-3', 'ndl-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of NOODLES_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully committed batch write for ${NOODLES_ITEMS.length} Noodles items to 'menu' collection.`);

    console.log('\n--- VERIFICATION OF NOODLES ITEMS ---');
    NOODLES_ITEMS.forEach(item => {
        console.log(`[OK] ${item.name} (${item.id}) => Price: Rs.${item.price}, isMultiSize: ${item.isMultiSize}, img: ${item.img}`);
    });
    console.log('\nAll Noodles items and images seeded successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
