/**
 * Migration & Seed Script: Batch update 24 menu item images to optimized WebP format
 * across Sandwich (5), Bread (4), Wrap (6), and Burger (9) categories.
 * Updates both settings/menu document and individual menu collection documents in Firestore.
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const URL_REPLACEMENTS = [
  // 1. SANDWICH CATEGORY (5 items)
  {
    category: 'Sandwich',
    name: 'Spicy Sandwich',
    id: 'sdw-spicy',
    newUrl: 'https://i.ibb.co/VWVvjzQq/Spicy-Sandwich.webp'
  },
  {
    category: 'Sandwich',
    name: 'Cheesy Sandwich',
    id: 'sdw-cheesy',
    newUrl: 'https://i.ibb.co/7xqBz0CV/Cheesy-Sandwich.webp'
  },
  {
    category: 'Sandwich',
    name: 'Double Decker Sandwich',
    id: 'sdw-double-decker',
    newUrl: 'https://i.ibb.co/fYtFGP8P/Double-Decker-Sandwich.webp'
  },
  {
    category: 'Sandwich',
    name: 'Grilled Sandwich',
    id: 'sdw-grilled',
    newUrl: 'https://i.ibb.co/Z1pPfbXN/Grilled-Sandwich.webp'
  },
  {
    category: 'Sandwich',
    name: 'Paneer Sandwich',
    id: 'sdw-paneer',
    newUrl: 'https://i.ibb.co/Xfx80sdt/Paneer-Sandwich.webp'
  },

  // 2. BREAD / GARLIC BREAD CATEGORY (4 items)
  {
    category: 'Bread',
    name: 'Stuffed Bread',
    id: 'brd-stuffed',
    newUrl: 'https://i.ibb.co/jPcgttxg/Stuffed-Bread.webp'
  },
  {
    category: 'Bread',
    name: 'Cheese Corn Bread',
    id: 'brd-cheese-corn',
    newUrl: 'https://i.ibb.co/pBYrtH6T/Cheese-Corn-Bread.webp'
  },
  {
    category: 'Bread',
    name: 'Garlic Bread',
    id: 'brd-garlic',
    newUrl: 'https://i.ibb.co/ynzr3xD5/Garlic-Bread.webp'
  },
  {
    category: 'Bread',
    name: 'Perfetto Stuffed Bread',
    id: 'brd-perfetto-stuffed',
    newUrl: 'https://i.ibb.co/B5F66nQK/Perfetto-Stuffed-Bread.webp'
  },

  // 3. WRAP CATEGORY (6 items)
  {
    category: 'Wrap',
    name: 'Spicy Wrap',
    id: 'wrp-spicy',
    newUrl: 'https://i.ibb.co/gLrNz3f2/Spicy-Wrap.webp'
  },
  {
    category: 'Wrap',
    name: 'Tandoori Wrap',
    id: 'wrp-tandoori',
    newUrl: 'https://i.ibb.co/b5w7z0C8/Tandoori-Wrap.webp'
  },
  {
    category: 'Wrap',
    name: 'Aloo Patty Wrap',
    id: 'wrp-aloo-patty',
    newUrl: 'https://i.ibb.co/BHMF407g/Aloo-Patty-Wrap.webp'
  },
  {
    category: 'Wrap',
    name: 'Cheesy Saucy Wrap',
    id: 'wrp-cheesy-saucy',
    newUrl: 'https://i.ibb.co/9HS3bc0t/Cheesy-Saucy-Wrap.webp'
  },
  {
    category: 'Wrap',
    name: 'Cheesy Wrap',
    id: 'wrp-cheesy',
    newUrl: 'https://i.ibb.co/R4Bdy8V9/Cheesy-Wrap.webp'
  },
  {
    category: 'Wrap',
    name: 'Crispy Paneer Wrap',
    id: 'wrp-crispy-paneer',
    newUrl: 'https://i.ibb.co/7NdLCHF7/Crispy-Paneer-Wrap.webp'
  },

  // 4. BURGER CATEGORY (9 items)
  {
    category: 'Burger',
    name: 'Tandoori Burger',
    id: 'bgr-tandoori',
    newUrl: 'https://i.ibb.co/Z16PfSzj/Tandoori-Burger.webp'
  },
  {
    category: 'Burger',
    name: 'Veggie Burger',
    id: 'bgr-veggie',
    newUrl: 'https://i.ibb.co/Q3XGcwBN/Veggie-Burger.webp'
  },
  {
    category: 'Burger',
    name: 'Acharri Burger',
    id: 'bgr-acharri',
    newUrl: 'https://i.ibb.co/MDKQycZL/Acharri-Burger.webp'
  },
  {
    category: 'Burger',
    name: 'Aloo Patty Burger',
    id: 'bgr-aloo-patty',
    newUrl: 'https://i.ibb.co/4np6D7KW/Aloo-Patty-Burger.webp'
  },
  {
    category: 'Burger',
    name: 'Cheese Spicy',
    id: 'bgr-cheese-spicy',
    newUrl: 'https://i.ibb.co/6J4fSQ69/Cheese-Spicy.webp'
  },
  {
    category: 'Burger',
    name: 'Cheesy Burger',
    id: 'bgr-cheesy',
    newUrl: 'https://i.ibb.co/Df2FkPwj/Cheesy-Burger.webp'
  },
  {
    category: 'Burger',
    name: 'Crispy Paneer',
    id: 'bgr-crispy-paneer',
    newUrl: 'https://i.ibb.co/pYrWHYV/Crispy-Paneer.webp'
  },
  {
    category: 'Burger',
    name: 'Peri Peri Burger',
    id: 'bgr-peri-peri',
    newUrl: 'https://i.ibb.co/rfKv2m35/Peri-Peri-Burger.webp'
  },
  {
    category: 'Burger',
    name: 'Special Burger',
    id: 'bgr-special',
    newUrl: 'https://i.ibb.co/Kpqt4r2f/Special-Burger.webp'
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

  // Create lookup maps by id and by lowercase name
  const updateMapById = new Map();
  const updateMapByName = new Map();
  for (const item of URL_REPLACEMENTS) {
    updateMapById.set(item.id, item.newUrl);
    updateMapByName.set(item.name.toLowerCase().trim(), item.newUrl);
  }

  // 1. UPDATE settings/menu DOCUMENT
  console.log('\n--- STEP 1: Updating settings/menu document ---');
  const menuDocRef = db.collection('settings').doc('menu');
  const menuDocSnap = await menuDocRef.get();

  if (!menuDocSnap.exists) {
    console.warn('Document settings/menu does not exist!');
  } else {
    const data = menuDocSnap.data() || {};
    const items = Array.isArray(data.items) ? [...data.items] : [];
    let updatedCount = 0;

    const newItems = items.map(item => {
      let matchedUrl = null;
      if (item.id && updateMapById.has(item.id)) {
        matchedUrl = updateMapById.get(item.id);
      } else if (item.name && updateMapByName.has(item.name.toLowerCase().trim())) {
        matchedUrl = updateMapByName.get(item.name.toLowerCase().trim());
      }

      if (matchedUrl) {
        if (item.img !== matchedUrl) {
          console.log(`Updating [${item.category}] "${item.name}" (${item.id}) => ${matchedUrl}`);
          updatedCount++;
          return { ...item, img: matchedUrl };
        }
      }
      return item;
    });

    await menuDocRef.set({
      items: newItems,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Successfully updated settings/menu: ${updatedCount} items changed.`);
  }

  // 2. UPDATE INDIVIDUAL DOCUMENTS IN 'menu' COLLECTION
  console.log('\n--- STEP 2: Updating individual menu collection documents ---');
  const batch = db.batch();
  let collectionCount = 0;

  for (const item of URL_REPLACEMENTS) {
    const docRef = db.collection('menu').doc(item.id);
    batch.set(docRef, {
      id: item.id,
      name: item.name,
      category: item.category,
      img: item.newUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    collectionCount++;
  }

  await batch.commit();
  console.log(`Successfully committed batch write for ${collectionCount} documents in 'menu' collection.`);

  console.log('\n--- VERIFICATION COMPLETE: ALL 24 WEBP IMAGES UPDATED ---');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
