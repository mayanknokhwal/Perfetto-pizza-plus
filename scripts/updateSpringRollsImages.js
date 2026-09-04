/**
 * One-time Seeding Script: Update all Spring Rolls category items & image URLs in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const SPRING_ROLLS_ITEMS = [
    {
        id: "spr-chilly-paneer-kathi-roll",
        name: "Chilly Paneer Kathi Roll",
        category: "Spring Rolls",
        isMultiSize: false,
        price: 129,
        available: true,
        img: "https://i.ibb.co/vxh5Htcf/Chilly-Paneer-Kathi-Roll.jpg",
        desc: "Spicy tossed paneer cubes with crunchy bell peppers wrapped in a soft kathi roll"
    },
    {
        id: "spr-crispy-spring-roll",
        name: "Crispy Spring Roll",
        category: "Spring Rolls",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/Ngzq7HDS/Crispy-Spring-Roll.jpg",
        desc: "Golden fried crispy rolls stuffed with seasoned shredded vegetables and herbs"
    },
    {
        id: "spr-paneer-kathi-roll",
        name: "Paneer Kathi Roll",
        category: "Spring Rolls",
        isMultiSize: false,
        price: 119,
        available: true,
        img: "https://i.ibb.co/4wRYJtFg/Paneer-Kathi-Roll.jpg",
        desc: "Marinated tender paneer pieces layered with sliced onions and rich sauces in a kathi wrap"
    },
    {
        id: "spr-spring-roll",
        name: "Spring Roll",
        category: "Spring Rolls",
        isMultiSize: false,
        price: 89,
        available: true,
        img: "https://i.ibb.co/ZzYLkLfn/Spring-Roll.jpg",
        desc: "Classic golden fried rolls packed with savory spiced vegetables and dipping sauce"
    },
    {
        id: "spr-veg-kathi-roll",
        name: "Veg Kathi Roll",
        category: "Spring Rolls",
        isMultiSize: false,
        price: 99,
        available: true,
        img: "https://i.ibb.co/YKVjDfb/Veg-Kathi-Roll.jpg",
        desc: "A hearty medley of spiced garden vegetables rolled into a fresh kathi paratha"
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

        // Remove old placeholder spring rolls items (spr-1, spr-2, spr-3, etc.)
        items = items.filter(i => {
            if (i.category === 'Spring Rolls') {
                return false;
            }
            if (i.id && i.id.startsWith('spr-')) {
                return false;
            }
            return true;
        });

        // Add 5 fresh spring rolls items
        items.push(...SPRING_ROLLS_ITEMS);

        const categoryAddons = data.categoryAddons || {};
        categoryAddons['Spring Rolls'] = {
            extraCheese: 25,
            extraSpicy: 0,
            extraMayo: 20
        };

        await menuDocRef.set({
            items: items,
            categoryAddons: categoryAddons,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`Updated settings/menu document with ${SPRING_ROLLS_ITEMS.length} Spring Rolls items and category add-ons.`);
    } else {
        console.warn('settings/menu document does not exist, creating new one...');
        await menuDocRef.set({
            items: SPRING_ROLLS_ITEMS,
            categoryAddons: {
                'Spring Rolls': { extraCheese: 25, extraSpicy: 0, extraMayo: 20 }
            },
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Update individual menu collection items
    console.log('Updating individual menu collection documents...');
    const batch = db.batch();

    // Remove legacy spr-1 .. spr-4 if they exist
    const legacyIds = ['spr-1', 'spr-2', 'spr-3', 'spr-4'];
    for (const legId of legacyIds) {
        const legRef = db.collection('menu').doc(legId);
        batch.delete(legRef);
    }

    for (const item of SPRING_ROLLS_ITEMS) {
        const docRef = db.collection('menu').doc(item.id);
        batch.set(docRef, {
            ...item,
            updatedAt: new Date().toISOString()
        }, { merge: true });
    }

    await batch.commit();
    console.log(`Successfully committed batch write for ${SPRING_ROLLS_ITEMS.length} Spring Rolls items to 'menu' collection.`);

    console.log('\n--- VERIFICATION OF SPRING ROLLS ITEMS ---');
    SPRING_ROLLS_ITEMS.forEach(item => {
        console.log(`[OK] ${item.name} (${item.id}) => Price: Rs.${item.price}, isMultiSize: ${item.isMultiSize}, img: ${item.img}`);
    });
    console.log('\nAll Spring Rolls items and images seeded successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
