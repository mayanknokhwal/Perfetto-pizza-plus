/**
 * One-time Seeding Script: Update all Salad category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const SALAD_ITEMS = [
    {
        id: "sld-green",
        name: "Green Salad",
        category: "Salad",
        isMultiSize: false,
        price: 69,
        available: true,
        img: "https://i.ibb.co/dwWmX7HX/Green-Salad.jpg",
        desc: "Fresh assortment of sliced cucumbers, tomatoes, carrots, onions & lemon wedges"
    },
    {
        id: "sld-perfetto-special",
        name: "Perfetto Special Salad",
        category: "Salad",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/2YS2PS1s/Perfetto-Special-Salad.jpg",
        desc: "Chef special fresh garden salad tossed with paneer cubes, olives and house dressing"
    },
    {
        id: "sld-russian",
        name: "Russian Salad",
        category: "Salad",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/ds4XYn5d/Russian-Salad.jpg",
        desc: "Classic diced vegetables, boiled potatoes and sweet corn folded in creamy mayo dressing"
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

        // Remove old placeholder salad items (sld-1, sld-2, sld-3, sld-4)
        items = items.filter(i => {
            if (i.category === 'Salad') {
                return false;
            }
            if (i.id && i.id.startsWith('sld-')) {
                return false;
            }
            return true;
        });

        // Add 3 fresh salad items
        items.push(...SALAD_ITEMS);

        await menuDocRef.set({
            items: items,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${SALAD_ITEMS.length} Salad items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: SALAD_ITEMS,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy sld-1 .. sld-4 if they exist
    const legacyIds = ['sld-1', 'sld-2', 'sld-3', 'sld-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of SALAD_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully committed batch write for ${SALAD_ITEMS.length} Salad items to 'menu' collection.`);

    console.log('\n--- VERIFICATION OF SALAD ITEMS ---');
    SALAD_ITEMS.forEach(item => {
        console.log(`[OK] ${item.name} (${item.id}) => Price: Rs.${item.price}, isMultiSize: ${item.isMultiSize}, img: ${item.img}`);
    });
    console.log('\nAll Salad items and images seeded successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
