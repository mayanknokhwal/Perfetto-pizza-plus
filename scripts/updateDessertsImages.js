/**
 * One-time Seeding Script: Update all Desserts category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const DESSERTS_ITEMS = [
    {
        id: "des-ice-cream-vanilla",
        name: "Ice Cream Vanilla",
        category: "Desserts",
        isMultiSize: false,
        price: 79,
        available: true,
        img: "https://i.ibb.co/t5SyXgM/Ice-Cream-Vanilla.jpg",
        desc: "Creamy classic vanilla ice cream scoop"
    },
    {
        id: "des-lava-cake-ice-cream",
        name: "Lava Cake With Ice Cream",
        category: "Desserts",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/7tVhrnxQ/Lava-Cake-With-Ice-Cream.jpg",
        desc: "Warm molten chocolate lava cake served with rich vanilla ice cream"
    },
    {
        id: "des-lava-cake",
        name: "Lava Cake",
        category: "Desserts",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/wZQSKRvS/Lava-Cake.jpg",
        desc: "Decadent chocolate cake with a warm molten chocolate center"
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

        // Remove old placeholder desserts items (des-1, des-2, des-3, des-4)
        items = items.filter(i => {
            if (i.category === 'Desserts') {
                return false;
            }
            if (i.id && i.id.startsWith('des-')) {
                return false;
            }
            return true;
        });

        // Add 3 fresh desserts items
        items.push(...DESSERTS_ITEMS);

        await menuDocRef.set({
            items: items,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${DESSERTS_ITEMS.length} Desserts items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: DESSERTS_ITEMS,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy des-1 .. des-4 if they exist
    const legacyIds = ['des-1', 'des-2', 'des-3', 'des-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of DESSERTS_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully committed batch write for ${DESSERTS_ITEMS.length} Desserts items to 'menu' collection.`);

    console.log('\n--- VERIFICATION OF DESSERTS ITEMS ---');
    DESSERTS_ITEMS.forEach(item => {
        console.log(`[OK] ${item.name} (${item.id}) => Price: Rs.${item.price}, isMultiSize: ${item.isMultiSize}, img: ${item.img}`);
    });
    console.log('\nAll Desserts items and images seeded successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
