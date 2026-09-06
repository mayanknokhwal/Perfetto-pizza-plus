/**
 * Migration & Seed Script: Batch update 26 menu item images to optimized WebP format
 * across Chinese Food, Cold Drinks, Side Orders, Mojitos, and Desserts.
 * Updates both settings/menu document and individual menu collection documents in Firestore.
 */

const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const URL_REPLACEMENTS = [
  // CHINESE FOOD
  {
    category: 'Chinese Food',
    name: 'Honey Chilly Cauliflower',
    id: 'chn-honey-chilly-cauliflower',
    oldUrl: 'https://i.ibb.co/kgp9bjrS/Honey-Chilly-Cauliflower.jpg',
    newUrl: 'https://i.ibb.co/NdwbQrrR/Honey-Chilly-Cauliflower-food.webp'
  },
  {
    category: 'Chinese Food',
    name: 'Honey Chilly Potato',
    id: 'chn-honey-chilly-potato',
    oldUrl: 'https://i.ibb.co/GfY6XTJR/Honey-Chilly-Potato.jpg',
    newUrl: 'https://i.ibb.co/B2V7N0GC/Honey-Chilly-Potato-food.webp'
  },
  {
    category: 'Chinese Food',
    name: 'Veg Manchurian',
    id: 'chn-veg-manchurian',
    oldUrl: 'https://i.ibb.co/NgMyx9My/Veg-Manchurian.jpg',
    newUrl: 'https://i.ibb.co/Fq43P9w1/Veg-Manchurian-food.webp'
  },
  {
    category: 'Chinese Food',
    name: 'Chilly Cauliflower',
    id: 'chn-chilly-cauliflower',
    oldUrl: 'https://i.ibb.co/pBPy144w/Chilly-Cauliflower.jpg',
    newUrl: 'https://i.ibb.co/jP6QCgvJ/Chilly-Cauliflower-food.webp'
  },
  {
    category: 'Chinese Food',
    name: 'Chilly Paneer',
    id: 'chn-chilly-paneer',
    oldUrl: 'https://i.ibb.co/HTm4J9Vh/Chilly-Paneer.jpg',
    newUrl: 'https://i.ibb.co/VWh8Hm56/Chilly-Paneer-food.webp'
  },
  {
    category: 'Chinese Food',
    name: 'Chilly Potato',
    id: 'chn-chilly-potato',
    oldUrl: 'https://i.ibb.co/9k7pS8S3/Chilly-Potato.jpg',
    newUrl: 'https://i.ibb.co/Xx539H2T/Chilly-Potato-food.webp'
  },

  // COLD DRINKS
  {
    category: 'Colo Drinks',
    name: 'Milky Cola',
    id: 'drk-milky-cola',
    oldUrl: 'https://i.ibb.co/Mk3VkTbK/Milky-Cola.jpg',
    newUrl: 'https://i.ibb.co/NgsyRT7m/Milky-Cola-cold.webp'
  },
  {
    category: 'Colo Drinks',
    name: 'Milky Mango',
    id: 'drk-milky-mango',
    oldUrl: 'https://i.ibb.co/35LxWDgq/Milky-Mango.jpg',
    newUrl: 'https://i.ibb.co/7xsP7BYY/Milky-Mango-cold.webp'
  },
  {
    category: 'Colo Drinks',
    name: 'Coke (300ml)',
    aliases: ['Coke 300ml', 'Coke (300ml)'],
    id: 'drk-coke-300ml',
    oldUrl: 'https://i.ibb.co/r2JVJSMg/Coke-300ml.jpg',
    newUrl: 'https://i.ibb.co/hFFB26fM/Coke-300ml-cold.webp'
  },
  {
    category: 'Colo Drinks',
    name: 'Coke With Ice Cream',
    id: 'drk-coke-ice-cream',
    oldUrl: 'https://i.ibb.co/jcQ2SVP/Coke-With-Ice-Cream.jpg',
    newUrl: 'https://i.ibb.co/tTHLCFJk/Coke-With-Ice-Cream-cold.webp'
  },

  // SIDE ORDERS
  {
    category: 'Side Orders',
    name: 'Masala Fries',
    id: 'sde-masala-fries',
    oldUrl: 'https://i.ibb.co/KxGpWPHz/Masala-Fries.jpg',
    newUrl: 'https://i.ibb.co/v4QRWT0b/Masala-Fries-side.webp'
  },
  {
    category: 'Side Orders',
    name: 'Paneer Parcel',
    id: 'sde-paneer-parcel',
    oldUrl: 'https://i.ibb.co/dwSwJ6zK/Paneer-Parcel.jpg',
    newUrl: 'https://i.ibb.co/7NWFL9rr/Paneer-Parcel-side.webp'
  },
  {
    category: 'Side Orders',
    name: 'Peri Peri Fries',
    id: 'sde-peri-peri-fries',
    oldUrl: 'https://i.ibb.co/PGK7N3mJ/Peri-Peri-Fries.jpg',
    newUrl: 'https://i.ibb.co/rfXHnkyR/Peri-Peri-Fries-side.webp'
  },
  {
    category: 'Side Orders',
    name: 'Saucy Fries',
    id: 'sde-saucy-fries',
    oldUrl: 'https://i.ibb.co/gZ0RCYrS/Saucy-Fries.jpg',
    newUrl: 'https://i.ibb.co/tPLTnMnt/Saucy-Fries-side.webp'
  },
  {
    category: 'Side Orders',
    name: 'Taco',
    id: 'sde-taco',
    oldUrl: 'https://i.ibb.co/ZzKMq3h7/Taco.jpg',
    newUrl: 'https://i.ibb.co/zVdy8L5t/Taco-side.webp'
  },
  {
    category: 'Side Orders',
    name: 'Zingy Parcel',
    id: 'sde-zingy-parcel',
    oldUrl: 'https://i.ibb.co/WNfHNVBk/Zingy-Parcel.jpg',
    newUrl: 'https://i.ibb.co/jkKQt3hC/Zingy-Parcel-side.webp'
  },
  {
    category: 'Side Orders',
    name: 'French Fries',
    id: 'sde-french-fries',
    oldUrl: 'https://i.ibb.co/3y4xtxj7/French-Fries.jpg',
    newUrl: 'https://i.ibb.co/nNtdVDJj/French-Fries-side.webp'
  },

  // MOJITOS
  {
    category: 'Mojito',
    name: 'Mineral Water Soft Drink',
    id: 'moj-mineral-water',
    oldUrl: 'https://i.ibb.co/35d2ZxDD/Mineral-Water-Soft-Drink.jpg',
    newUrl: 'https://i.ibb.co/wZznTVZ1/Mineral-Water-Soft-Drink-Mojito.webp'
  },
  {
    category: 'Mojito',
    name: 'Mint Mojito',
    id: 'moj-mint',
    oldUrl: 'https://i.ibb.co/Lzn2WZPk/Mint-Mojito.jpg',
    newUrl: 'https://i.ibb.co/WpycLrbs/Mint-Mojito.webp'
  },
  {
    category: 'Mojito',
    name: 'Strawberry Mojito',
    id: 'moj-strawberry',
    oldUrl: 'https://i.ibb.co/5XnrXt5d/Strawberry-Mojito.jpg',
    newUrl: 'https://i.ibb.co/CsPH2c2J/Strawberry-Mojito.webp'
  },
  {
    category: 'Mojito',
    name: 'Virgin Mojito',
    id: 'moj-virgin',
    oldUrl: 'https://i.ibb.co/B24VCS65/Virgin-Mojito.jpg',
    newUrl: 'https://i.ibb.co/VWg3nBjn/Virgin-Mojito.webp'
  },
  {
    category: 'Mojito',
    name: 'Fresh Lime Soda',
    id: 'moj-fresh-lime-soda',
    oldUrl: 'https://i.ibb.co/tMGr4c9y/Fresh-Lime-Soda.jpg',
    newUrl: 'https://i.ibb.co/nqXkpPGX/Fresh-Lime-Soda-Mojito.webp'
  },
  {
    category: 'Mojito',
    name: 'Green Apple Mojito',
    id: 'moj-green-apple',
    oldUrl: 'https://i.ibb.co/fGy3Rt0C/Green-Apple-Mojito.jpg',
    newUrl: 'https://i.ibb.co/DfxvzYvY/Green-Apple-Mojito.webp'
  },

  // DESSERTS
  {
    category: 'Desserts',
    name: 'Ice Cream Vanilla',
    id: 'des-ice-cream-vanilla',
    oldUrl: 'https://i.ibb.co/t5SyXgM/Ice-Cream-Vanilla.jpg',
    newUrl: 'https://i.ibb.co/0Rj6DQVp/Ice-Cream-Vanilla-desserts.webp'
  },
  {
    category: 'Desserts',
    name: 'Lava Cake With Ice Cream',
    aliases: ['Lava Cake Cream', 'Lava Cake With Ice Cream'],
    id: 'des-lava-cake-ice-cream',
    oldUrl: 'https://i.ibb.co/7tVhrnxQ/Lava-Cake-With-Ice-Cream.jpg',
    newUrl: 'https://i.ibb.co/NgZNCJbR/Lava-Cake-Cream-desserts.webp'
  },
  {
    category: 'Desserts',
    name: 'Lava Cake',
    id: 'des-lava-cake',
    oldUrl: 'https://i.ibb.co/wZQSKRvS/Lava-Cake.jpg',
    newUrl: 'https://i.ibb.co/PZVP1y3B/Lava-Cake-desserts.webp'
  }
];

function isMatch(item, r) {
  if (item.id && r.id && item.id === r.id) return true;
  if (item.img === r.oldUrl) return true;
  const itemName = (item.name || '').toLowerCase().trim();
  const rName = (r.name || '').toLowerCase().trim();
  if (itemName === rName) return true;
  if (r.aliases && r.aliases.some(a => a.toLowerCase().trim() === itemName)) return true;
  return false;
}

async function updateFirestore() {
  console.log('--- Batch Updating 26 WebP Menu Images in Live Firestore ---');
  const app = initFirebaseAdmin();
  if (!app) {
    console.error('Firebase Admin could not be initialized.');
    return;
  }
  const db = getFirestore(app);

  // 1. Update settings/menu document
  console.log('Reading settings/menu document...');
  const menuDocRef = db.collection('settings').doc('menu');
  const menuDocSnap = await menuDocRef.get();
  if (menuDocSnap.exists) {
    const data = menuDocSnap.data() || {};
    let items = Array.isArray(data.items) ? [...data.items] : [];
    let updatedCount = 0;

    items = items.map(item => {
      const match = URL_REPLACEMENTS.find(r => isMatch(item, r));
      if (match) {
        if (item.img !== match.newUrl) {
          console.log(`[settings/menu] Updating: "${item.name}" -> ${match.newUrl}`);
          item.img = match.newUrl;
          updatedCount++;
        }
      }
      return item;
    });

    console.log(`Updating settings/menu with ${updatedCount} modified items...`);
    await menuDocRef.set({
      items: items,
      lastUpdated: Date.now()
    }, { merge: true });
    console.log('✅ settings/menu document updated successfully.');
  } else {
    console.log('settings/menu document not found.');
  }

  // 2. Update individual menu collection documents if present
  console.log('Checking menu collection documents...');
  const menuColSnap = await db.collection('menu').get();
  if (!menuColSnap.empty) {
    let colUpdated = 0;
    const batch = db.batch();
    menuColSnap.forEach(docSnap => {
      const item = docSnap.data();
      const match = URL_REPLACEMENTS.find(r => isMatch({ ...item, id: docSnap.id }, r));
      if (match && item.img !== match.newUrl) {
        console.log(`[menu/${docSnap.id}] Updating: "${item.name || docSnap.id}" -> ${match.newUrl}`);
        batch.update(docSnap.ref, { img: match.newUrl });
        colUpdated++;
      }
    });
    if (colUpdated > 0) {
      await batch.commit();
      console.log(`✅ menu collection updated: ${colUpdated} documents.`);
    } else {
      console.log('menu collection documents are already up to date.');
    }
  } else {
    console.log('menu collection is empty or not used.');
  }
}

updateFirestore().then(() => {
  console.log('All 26 image updates complete.');
  process.exit(0);
}).catch(err => {
  console.error('Error during Firestore update:', err);
  process.exit(1);
});
