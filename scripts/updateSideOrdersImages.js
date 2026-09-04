/**
 * One-time Seeding Script: Update all Side Orders category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const SIDE_ORDERS_ITEMS = [
    {
        id: "sde-french-fries",
        name: "French Fries",
        category: "Side Orders",
        isMultiSize: false,
        price: 89,
        available: true,
        img: "https://i.ibb.co/3y4xtxj7/French-Fries.jpg",
        desc: "Crispy golden fried potato fries lightly salted to perfection"
    },
    {
        id: "sde-masala-fries",
        name: "Masala Fries",
        category: "Side Orders",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/KxGpWPHz/Masala-Fries.jpg",
        desc: "Crispy french fries tossed with tangy chaat masala and spicy seasonings"
    },
    {
        id: "sde-paneer-parcel",
        name: "Paneer Parcel",
        category: "Side Orders",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/dwSwJ6zK/Paneer-Parcel.jpg",
        desc: "Flaky baked golden pastry filled with seasoned paneer & herbs"
    },
    {
        id: "sde-peri-peri-fries",
        name: "Peri Peri Fries",
        category: "Side Orders",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/PGK7N3mJ/Peri-Peri-Fries.jpg",
        desc: "Crisp potato fries dusted with hot and zesty peri peri spice mix"
    },
    {
        id: "sde-saucy-fries",
        name: "Saucy Fries",
        category: "Side Orders",
        isMultiSize: false,
        price: 109,
        available: true,
        img: "https://i.ibb.co/gZ0RCYrS/Saucy-Fries.jpg",
        desc: "Crispy fries drizzled generously with signature savory and cheesy sauces"
    },
    {
        id: "sde-taco",
        name: "Taco",
        category: "Side Orders",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/ZzKMq3h7/Taco.jpg",
        desc: "Crispy folded taco shell stuffed with spiced fillings, crunchy veggies & creamy sauce"
    },
    {
        id: "sde-zingy-parcel",
        name: "Zingy Parcel",
        category: "Side Orders",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/WNfHNVBk/Zingy-Parcel.jpg",
        desc: "Warm oven-baked parcel stuffed with zingy spiced filling and melted cheese"
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

        // Remove old placeholder side orders items (sde-1, sde-2, sde-3, sde-4)
        items = items.filter(i => {
            if (i.category === 'Side Orders') {
                return false;
            }
            if (i.id && i.id.startsWith('sde-')) {
                return false;
            }
            return true;
        });

        // Add 7 fresh side orders items
        items.push(...SIDE_ORDERS_ITEMS);

        await menuDocRef.set({
            items: items,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${SIDE_ORDERS_ITEMS.length} Side Orders items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: SIDE_ORDERS_ITEMS,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy sde-1 .. sde-4 if they exist
    const legacyIds = ['sde-1', 'sde-2', 'sde-3', 'sde-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of SIDE_ORDERS_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully committed batch write for ${SIDE_ORDERS_ITEMS.length} Side Orders items to 'menu' collection.`);

    console.log('\n--- VERIFICATION OF SIDE ORDERS ITEMS ---');
    SIDE_ORDERS_ITEMS.forEach(item => {
        console.log(`[OK] ${item.name} (${item.id}) => Price: Rs.${item.price}, isMultiSize: ${item.isMultiSize}, img: ${item.img}`);
    });
    console.log('\nAll Side Orders items and images seeded successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
