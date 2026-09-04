/**
 * One-time Seeding Script: Update all Mojito category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const MOJITO_ITEMS = [
    {
        id: "moj-fresh-lime-soda",
        name: "Fresh Lime Soda",
        category: "Mojito",
        isMultiSize: false,
        price: 59,
        available: true,
        img: "https://i.ibb.co/tMGr4c9y/Fresh-Lime-Soda.jpg",
        desc: "Crisp and sparkling fresh lemon lime soda with a touch of mint"
    },
    {
        id: "moj-green-apple",
        name: "Green Apple Mojito",
        category: "Mojito",
        isMultiSize: false,
        price: 89,
        available: true,
        img: "https://i.ibb.co/fGy3Rt0C/Green-Apple-Mojito.jpg",
        desc: "Crisp green apple flavored sparkling mojito with crushed mint and lime"
    },
    {
        id: "moj-mineral-water",
        name: "Mineral Water Soft Drink",
        category: "Mojito",
        isMultiSize: false,
        price: 20,
        available: true,
        img: "https://i.ibb.co/35d2ZxDD/Mineral-Water-Soft-Drink.jpg",
        desc: "Pure and refreshing chilled packaged drinking water"
    },
    {
        id: "moj-mint",
        name: "Mint Mojito",
        category: "Mojito",
        isMultiSize: false,
        price: 89,
        available: true,
        img: "https://i.ibb.co/Lzn2WZPk/Mint-Mojito.jpg",
        desc: "Classic cooling mint infused sparkling beverage with zesty lemon"
    },
    {
        id: "moj-strawberry",
        name: "Strawberry Mojito",
        category: "Mojito",
        isMultiSize: false,
        price: 89,
        available: true,
        img: "https://i.ibb.co/5XnrXt5d/Strawberry-Mojito.jpg",
        desc: "Sweet and tangy strawberry blended with fresh mint, lime and sparkling soda"
    },
    {
        id: "moj-virgin",
        name: "Virgin Mojito",
        category: "Mojito",
        isMultiSize: false,
        price: 79,
        available: true,
        img: "https://i.ibb.co/B24VCS65/Virgin-Mojito.jpg",
        desc: "Signature refreshing non-alcoholic mojito with lime wedges & crushed mint leaves"
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

        // Remove old placeholder mojito items (moj-1, moj-2, moj-3, moj-4, etc.)
        items = items.filter(i => {
            if (i.category === 'Mojito') {
                return false;
            }
            if (i.id && i.id.startsWith('moj-')) {
                return false;
            }
            return true;
        });

        // Add 6 fresh mojito items
        items.push(...MOJITO_ITEMS);

        await menuDocRef.set({
            items: items,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${MOJITO_ITEMS.length} Mojito items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: MOJITO_ITEMS,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy moj-1 .. moj-4 if they exist
    const legacyIds = ['moj-1', 'moj-2', 'moj-3', 'moj-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of MOJITO_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully committed batch write for ${MOJITO_ITEMS.length} Mojito items to 'menu' collection.`);

    console.log('\n--- VERIFICATION OF MOJITO ITEMS ---');
    MOJITO_ITEMS.forEach(item => {
        console.log(`[OK] ${item.name} (${item.id}) => Price: Rs.${item.price}, isMultiSize: ${item.isMultiSize}, img: ${item.img}`);
    });
    console.log('\nAll Mojito items and images seeded successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
