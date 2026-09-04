/**
 * One-time Seeding Script: Update all Hot & Cold Coffee category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const COFFEE_ITEMS = [
    {
        id: "cof-cold",
        name: "Cold Coffee",
        category: "Hot Cold Coffee",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/NdjHqdXP/Cold-Coffee.jpg",
        desc: "Creamy chilled coffee blended to rich perfection"
    },
    {
        id: "cof-hot",
        name: "Hot Coffee",
        category: "Hot Cold Coffee",
        isMultiSize: false,
        price: 79,
        available: true,
        img: "https://i.ibb.co/mVQ3X1wp/Hot-Coffee.jpg",
        desc: "Freshly brewed aromatic hot coffee"
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

        // Remove old placeholder coffee items (cof-1, cof-2, cof-3, cof-4)
        items = items.filter(i => {
            if (i.category === 'Hot Cold Coffee' || i.category === 'Coffee' || i.category === 'Hot & Cold Coffee') {
                return false;
            }
            if (i.id && (i.id.startsWith('cof-') || i.id === 'cof-1' || i.id === 'cof-2' || i.id === 'cof-3' || i.id === 'cof-4')) {
                return false;
            }
            return true;
        });

        // Add fresh coffee items
        items.push(...COFFEE_ITEMS);

        await menuDocRef.set({
            items: items,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${COFFEE_ITEMS.length} Coffee items.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: COFFEE_ITEMS,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const menuCollection = db.collection('menu');

    // Delete any old placeholder coffee items from menu collection
    const oldCoffeeDocs = await menuCollection.where('category', 'in', ['Hot Cold Coffee', 'Coffee', 'Hot & Cold Coffee']).get();
    const batch = db.batch();
    oldCoffeeDocs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Insert new coffee items
    for (const item of COFFEE_ITEMS) {
        await menuCollection.doc(item.id).set({
            ...item,
            updatedAt: new Date().toISOString()
        });
        console.log(`Saved menu item: ${item.id} - ${item.name}`);
    }

    console.log('Hot & Cold Coffee items updated successfully in Firestore!');
    process.exit(0);
}

main().catch(err => {
    console.error('Error updating Coffee items in Firestore:', err);
    process.exit(1);
});
