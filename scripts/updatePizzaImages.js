/**
 * One-time Seeding Script: Update all Pizza menu images in Firestore
 * Updates both settings/menu document and individual menu collection documents
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const PIZZA_IMAGE_UPDATES = [
    {
        id: "green-veggie",
        matchNames: ["green veggie"],
        name: "Green Veggie",
        img: "https://i.ibb.co/FbZ23hF3/Green-Veggie.jpg",
        desc: "Onion, Capsicum, Tomato",
        prices: { S: 229, M: 329, L: 429 }
    },
    {
        id: "harissa-pizza",
        matchNames: ["harissa pizza", "harissa"],
        name: "Harissa Pizza",
        img: "https://i.ibb.co/fVq0W6hp/Harissa-Pizza.jpg",
        desc: "Paneer, Red Paprika, Black Olives, Onion, Harissa Sauce",
        prices: { S: 249, M: 349, L: 449 }
    },
    {
        id: "hot-country",
        matchNames: ["hot country"],
        name: "Hot Country",
        img: "https://i.ibb.co/C59X7CVY/Hot-Country.jpg",
        desc: "Onion, Red Corn, Jalapeno, Paneer, Black Olives & Red Paprika, Extra Cheese",
        prices: { S: 199, M: 299, L: 399 }
    },
    {
        id: "indian-veggie",
        matchNames: ["indian veggie"],
        name: "Indian Veggie",
        img: "https://i.ibb.co/fdKZMq2H/Indian-Veggie.jpg",
        desc: "Capsicum, Green Chilli, Onion, Mushroom, Black Olives, Extra Cheese",
        prices: { S: 219, M: 319, L: 419 }
    },
    {
        id: "lovers-pizza",
        matchNames: ["lover's pizza", "lover's", "lovers pizza", "lovers"],
        name: "Lover's Pizza",
        img: "https://i.ibb.co/xKgtXvQ3/Lover-s-Pizza.jpg",
        desc: "Red Paprika, Onion, Capsicum, Corn",
        prices: { S: 249, M: 349, L: 449 }
    },
    {
        id: "makhani-pizza",
        matchNames: ["makhani pizza", "makhani"],
        name: "Makhani Pizza",
        img: "https://i.ibb.co/5gkQ7SSv/Makhani-Pizza.jpg",
        desc: "Capsicum, Paneer, Makhani Sauce",
        prices: { S: 239, M: 339, L: 439 }
    },
    {
        id: "paradise-pizza",
        matchNames: ["paradize pizza", "parndize pizza", "paradise pizza"],
        name: "Paradize Pizza",
        img: "https://i.ibb.co/605cWN7n/Paradize-Pizza.jpg",
        desc: "Red Paprika, Onion, Mushroom, Tomato & Jalapeno",
        prices: { S: 229, M: 329, L: 429 }
    },
    {
        id: "perfetto-special",
        matchNames: ["perfetto special pizza", "perfetto special"],
        name: "Perfetto Special Pizza",
        img: "https://i.ibb.co/B5ZHyQ9q/Perfetto-Special-Pizza.jpg",
        desc: "Onion, Corn, Pineapple, Jalapeno, Capsicum, Mushroom, Black Olives, Red Paprika, Paneer, Tomato, Extra Cheese",
        prices: { S: 299, M: 399, L: 499 }
    },
    {
        id: "spicy-pizza",
        matchNames: ["spicy pizza", "spicy"],
        name: "Spicy Pizza",
        img: "https://i.ibb.co/Nd788pWq/Spicy-Pizza.jpg",
        desc: "Paneer Chilly, Capsicum, Red Paprika",
        prices: { S: 199, M: 299, L: 399 }
    },
    {
        id: "supreme-pizza",
        matchNames: ["supreme pizza", "supreme"],
        name: "Supreme Pizza",
        img: "https://i.ibb.co/Ng1kGnR6/Supreme-Pizza.jpg",
        desc: "Mushroom, Jalapeno, Paneer, Pineapple, Black Olives",
        prices: { S: 249, M: 349, L: 449 }
    },
    {
        id: "tandoori-pizza",
        matchNames: ["tandoori pizza", "tandoori"],
        name: "Tandoori Pizza",
        img: "https://i.ibb.co/jkpyY1b0/Tandoori-Pizza.jpg",
        desc: "Onion, Paneer, Bellpeper, Tandoori Sauce",
        prices: { S: 239, M: 339, L: 439 }
    },
    {
        id: "achari-pizza",
        matchNames: ["acharri pizza", "achari pizza"],
        name: "Acharri Pizza",
        img: "https://i.ibb.co/5XgKZM2Z/Acharri-Pizza.jpg",
        desc: "Capsicum, Corn, Paneer, Achari Sauce",
        prices: { S: 219, M: 319, L: 419 }
    },
    {
        id: "cheese-n-corn",
        matchNames: ["cheese 'n corn", "cheese-n-corn", "cheese n corn"],
        name: "Cheese 'n Corn",
        img: "https://i.ibb.co/FkgyjwHx/Cheese-n-Corn.jpg",
        desc: "Cheese, Corn",
        prices: { S: 179, M: 279, L: 379 }
    },
    {
        id: "cheese-n-mushroom",
        matchNames: ["cheese 'n mushroom", "cheese-n-mushroom", "cheese n mushroom"],
        name: "Cheese 'n Mushroom",
        img: "https://i.ibb.co/j96pyGyf/Cheese-n-Mushroom.jpg",
        desc: "Cheese, Mushroom",
        prices: { S: 219, M: 319, L: 419 }
    },
    {
        id: "chipotle-pizza",
        matchNames: ["chipotle pizza", "chipotle"],
        name: "Chipotle Pizza",
        img: "https://i.ibb.co/WvHtzxPQ/Chipotle-Pizza.jpg",
        desc: "Paneer, Capsicum, Corn, Onion, Chipotle Sauce",
        prices: { S: 229, M: 329, L: 429 }
    },
    {
        id: "double-cheese-margherita",
        matchNames: ["double cheese margherita", "dbl cheese margherita", "margherita"],
        name: "Double Cheese Margherita",
        img: "https://i.ibb.co/k6xGq83k/Dbl-Cheese-Margherita.jpg",
        desc: "Loaded with extra gooey mozzarella cheese & classic Italian herb tomato sauce",
        prices: { S: 199, M: 299, L: 399 }
    },
    {
        id: "delight-pizza",
        matchNames: ["delight pizza", "delight"],
        name: "Delight Pizza",
        img: "https://i.ibb.co/DDQ7zY7n/Delight-Pizza.jpg",
        desc: "Capsicum, Jalapeno, Mushroom",
        prices: { S: 219, M: 319, L: 419 }
    },
    {
        id: "deluxe-pizza",
        matchNames: ["deluxe pizza", "deluxe"],
        name: "Deluxe Pizza",
        img: "https://i.ibb.co/kgZXHP6J/Deluxe-Pizza.jpg",
        desc: "Onion, Paneer, Capsicum, Mushroom, Gold Corn",
        prices: { S: 199, M: 299, L: 399 }
    },
    {
        id: "farm-house",
        matchNames: ["farm house"],
        name: "Farm House",
        img: "https://i.ibb.co/nNsWCp9t/Farm-House.jpg",
        desc: "Corn, Pineapple, Mushroom, Black Olives, Red Paprika, Extra Cheese",
        prices: { S: 239, M: 339, L: 439 }
    }
];

async function updatePizzaImagesInFirestore() {
    console.log('🍕 Starting Pizza Image Updates in Firestore...');
    initFirebaseAdmin();
    const db = getFirestore();

    const menuDocRef = db.collection('settings').doc('menu');
    const docSnap = await menuDocRef.get();

    if (!docSnap.exists) {
        console.error('❌ settings/menu document does not exist in Firestore!');
        return;
    }

    const currentData = docSnap.data();
    let items = Array.isArray(currentData.items) ? [...currentData.items] : [];
    console.log(`📋 Found ${items.length} existing items in settings/menu.`);

    let updatedCount = 0;
    let addedCount = 0;

    for (const update of PIZZA_IMAGE_UPDATES) {
        let itemIndex = items.findIndex(i => {
            if (i.id === update.id) return true;
            const normName = (i.name || '').trim().toLowerCase();
            return update.matchNames.includes(normName);
        });

        if (itemIndex >= 0) {
            console.log(`🔄 Updating [${items[itemIndex].name}] -> new image: ${update.img}`);
            items[itemIndex] = {
                ...items[itemIndex],
                id: update.id,
                name: update.name,
                category: 'Pizza',
                isMultiSize: true,
                img: update.img,
                desc: items[itemIndex].desc || update.desc,
                prices: items[itemIndex].prices || update.prices,
                available: items[itemIndex].available !== undefined ? items[itemIndex].available : true
            };
            updatedCount++;
        } else {
            console.log(`➕ Adding new Pizza [${update.name}] with image: ${update.img}`);
            items.push({
                id: update.id,
                name: update.name,
                category: 'Pizza',
                isMultiSize: true,
                img: update.img,
                desc: update.desc,
                prices: update.prices,
                available: true
            });
            addedCount++;
        }

        // Also update / set in 'menu' collection
        try {
            await db.collection('menu').doc(update.id).set({
                id: update.id,
                name: update.name,
                category: 'Pizza',
                isMultiSize: true,
                img: update.img,
                desc: update.desc,
                prices: update.prices,
                available: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (colErr) {
            console.warn(`⚠️ Notice updating menu/${update.id}:`, colErr.message);
        }
    }

    // Write back to settings/menu
    await menuDocRef.set({
        ...currentData,
        items: items,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`✅ settings/menu successfully updated in Firestore! (${updatedCount} updated, ${addedCount} added).`);
    console.log(`🍕 Total items now: ${items.length}`);
}

updatePizzaImagesInFirestore()
    .then(() => {
        console.log('🎉 Pizza image update completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Error updating pizza images:', err);
        process.exit(1);
    });
