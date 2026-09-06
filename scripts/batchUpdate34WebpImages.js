/**
 * Migration & Seed Script: Batch update 34 menu item images to optimized WebP format
 * across Noodles, Pasta, Salad, Shakes, Coffee, and Rice.
 * Updates both settings/menu document and individual menu collection documents in Firestore.
 */

const fs = require('fs');
const path = require('path');
const { initFirebaseAdmin } = require('../lib/firebaseAdmin');
const { getFirestore } = require('firebase-admin/firestore');

const URL_REPLACEMENTS = [
  // NOODLES
  {
    category: 'Noodles',
    name: 'Veg Noodles',
    oldUrl: 'https://i.ibb.co/21JBqyRP/Veg-Noodles.jpg',
    newUrl: 'https://i.ibb.co/Fbp92V4J/Veg-Noodles.webp'
  },
  {
    category: 'Noodles',
    name: 'Haka Noodles',
    oldUrl: 'https://i.ibb.co/WvG995DF/Haka-Noodles.jpg',
    newUrl: 'https://i.ibb.co/TqgkbcCt/Haka-Noodles.webp'
  },
  {
    category: 'Noodles',
    name: 'Singapuri Noodles',
    oldUrl: 'https://i.ibb.co/M0KJsvz/Singapuri-Noodles.jpg',
    newUrl: 'https://i.ibb.co/LD7Sbm4Z/Singapuri-Noodles.webp'
  },
  {
    category: 'Noodles',
    name: 'Paneer Noodles',
    oldUrl: 'https://i.ibb.co/Cpwx1BY5/Paneer-Noodles.jpg',
    newUrl: 'https://i.ibb.co/C5tQN9PX/Paneer-Noodles.webp'
  },
  {
    category: 'Noodles',
    name: 'Butter Paneer Noodles',
    oldUrl: 'https://i.ibb.co/Qv9TGVwy/Butter-Paneer-Noodles.jpg',
    newUrl: 'https://i.ibb.co/Z1bnHNPr/Butter-Paneer-Noodles.webp'
  },
  {
    category: 'Noodles',
    name: 'Chilly Garlic Noodles',
    oldUrl: 'https://i.ibb.co/ycQT35rB/Chilly-Garlic-Noodles.jpg',
    newUrl: 'https://i.ibb.co/chQ8Y0zc/Chilly-Garlic-Noodles.webp'
  },

  // PASTA
  {
    category: 'Pasta',
    name: 'Red Pasta',
    oldUrl: 'https://i.ibb.co/mCHkdqkg/Red-Pasta.jpg',
    newUrl: 'https://i.ibb.co/gMX9t7Cx/Red-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Creamy Pasta',
    oldUrl: 'https://i.ibb.co/Q3yyX7ss/Creamy-Pasta.jpg',
    newUrl: 'https://i.ibb.co/Ld0XT4V6/Creamy-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Supreme Pasta',
    oldUrl: 'https://i.ibb.co/NDByPtY/Supreme-Pasta.jpg',
    newUrl: 'https://i.ibb.co/GQCnC6HF/Supreme-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Tandoori Pasta',
    oldUrl: 'https://i.ibb.co/hRg5D667/Tandoori-Pasta.jpg',
    newUrl: 'https://i.ibb.co/bRPS4b74/Tandoori-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Baked Makhani Pasta',
    oldUrl: 'https://i.ibb.co/v4KDB6tm/Baked-Makhani-Pasta.jpg',
    newUrl: 'https://i.ibb.co/1f41Gz6R/Baked-Makhani-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Baked Mix Pasta',
    oldUrl: 'https://i.ibb.co/Z1k7wYcZ/Baked-Mix-Pasta.jpg',
    newUrl: 'https://i.ibb.co/DPg7DTSN/Baked-Mix-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Baked Red Pasta',
    oldUrl: 'https://i.ibb.co/0pLfYKfN/Baked-Red-Pasta.jpg',
    newUrl: 'https://i.ibb.co/CKzJwGB0/Baked-Red-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Baked Sweet Spicy Pasta',
    oldUrl: 'https://i.ibb.co/PzgbnkXp/Baked-Sweet-Spicy-Pasta.jpg',
    newUrl: 'https://i.ibb.co/wNyqgDjC/Baked-Sweet-Spicy-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Baked Tandoori Pasta',
    oldUrl: 'https://i.ibb.co/mFhbQZsN/Baked-Tandoori-Pasta.jpg',
    newUrl: 'https://i.ibb.co/cXgL2JkW/Baked-Tandoori-Pasta.webp'
  },
  {
    category: 'Pasta',
    name: 'Baked White Pasta',
    oldUrl: 'https://i.ibb.co/0jQLrKgh/Baked-White-Pasta.jpg',
    newUrl: 'https://i.ibb.co/s9ZmT25L/Baked-White-Pasta.webp'
  },

  // SALAD
  {
    category: 'Salad',
    name: 'Green Salad',
    oldUrl: 'https://i.ibb.co/dwWmX7HX/Green-Salad.jpg',
    newUrl: 'https://i.ibb.co/fYxbGzMk/Green-Salad.webp'
  },
  {
    category: 'Salad',
    name: 'Russian Salad',
    oldUrl: 'https://i.ibb.co/ds4XYn5d/Russian-Salad.jpg',
    newUrl: 'https://i.ibb.co/qL3gX0sH/Russian-Salad.webp'
  },
  {
    category: 'Salad',
    name: 'Perfetto Special Salad',
    oldUrl: 'https://i.ibb.co/2YS2PS1s/Perfetto-Special-Salad.jpg',
    newUrl: 'https://i.ibb.co/M5MPrMq8/Perfetto-Special-Salad.webp'
  },

  // SHAKES
  {
    category: 'Shake',
    name: 'Vanilla Shake',
    oldUrl: 'https://i.ibb.co/nqzRxxjB/Vanilla-Shake.jpg',
    newUrl: 'https://i.ibb.co/0pTTNPjC/Vanilla-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Strawberry Shake',
    oldUrl: 'https://i.ibb.co/jvcrqP0Z/Strawberry-Shake.jpg',
    newUrl: 'https://i.ibb.co/B26T8mwM/Strawberry-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Chocolate Shake',
    oldUrl: 'https://i.ibb.co/dsmztpV7/Chocolate-Shake.jpg',
    newUrl: 'https://i.ibb.co/pv9qz679/Chocolate-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Butter Scotch Shake',
    oldUrl: 'https://i.ibb.co/Wvy1Zfbj/Butter-Scotch-Shake.jpg',
    newUrl: 'https://i.ibb.co/LXVV1r0X/Butter-Scotch-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Pineapple Shake',
    oldUrl: 'https://i.ibb.co/pc2FGBh/Pineapple-Shake.jpg',
    newUrl: 'https://i.ibb.co/SDXSHgJ2/Pineapple-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Rasmalai Shake',
    oldUrl: 'https://i.ibb.co/vCtBxC5V/Rasmalai-Shake.jpg',
    newUrl: 'https://i.ibb.co/N2CH8MTf/Rasmalai-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Black Currant Shake',
    oldUrl: 'https://i.ibb.co/nN8ZnFYV/Black-Currant-Shake.jpg',
    newUrl: 'https://i.ibb.co/fdWVLBkM/Black-Currant-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Kit Kat Crunchy Shake',
    oldUrl: 'https://i.ibb.co/wZZf2jWy/Kit-Kat-Crunchy-Shake.jpg',
    newUrl: 'https://i.ibb.co/CK1gCdRp/Kit-Kat-Crunchy-Shake.webp'
  },
  {
    category: 'Shake',
    name: 'Oreo Feast Shake',
    oldUrl: 'https://i.ibb.co/YqNxTL3/Oreo-Feast-Shake.jpg',
    newUrl: 'https://i.ibb.co/HD4H8Hy3/Oreo-Feast-Shake.webp'
  },

  // COFFEE
  {
    category: 'Hot Cold Coffee',
    name: 'Hot Coffee',
    oldUrl: 'https://i.ibb.co/mVQ3X1wp/Hot-Coffee.jpg',
    newUrl: 'https://i.ibb.co/nsfGGq4c/Hot-Coffee.webp'
  },
  {
    category: 'Hot Cold Coffee',
    name: 'Cold Coffee',
    oldUrl: 'https://i.ibb.co/NdjHqdXP/Cold-Coffee.jpg',
    newUrl: 'https://i.ibb.co/nMmjCLrF/Cold-Coffee.webp'
  },

  // RICE
  {
    category: 'Rice',
    name: 'Veg Fried Rice',
    oldUrl: 'https://i.ibb.co/0j2C4vR2/Veg-Fried-Rice.jpg',
    newUrl: 'https://i.ibb.co/2YP9KpNt/Veg-Fried-Rice.webp'
  },
  {
    category: 'Rice',
    name: 'Haka Rice',
    oldUrl: 'https://i.ibb.co/4g1rfZ9V/Haka-Rice.jpg',
    newUrl: 'https://i.ibb.co/TBQfzv2D/Haka-Rice.webp'
  },
  {
    category: 'Rice',
    name: 'Singapuri Rice',
    oldUrl: 'https://i.ibb.co/q3wnW2kC/Singapuri-Rice.jpg',
    newUrl: 'https://i.ibb.co/PGSJYhMp/Singapuri-Rice.webp'
  },
  {
    category: 'Rice',
    name: 'Chilly Garlic Rice',
    oldUrl: 'https://i.ibb.co/wFBqyMBD/Chilly-Garlic-Rice.jpg',
    newUrl: 'https://i.ibb.co/v4JZ0GGk/Chilly-Garlic-Rice.webp'
  }
];

async function updateFirestore() {
  console.log('--- Updating Live Firestore Database ---');
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
      const match = URL_REPLACEMENTS.find(r => 
        (r.name.toLowerCase() === (item.name || '').toLowerCase() && 
         (item.category === r.category || (r.category === 'Hot Cold Coffee' && (item.category === 'Coffee' || item.category === 'Hot & Cold Coffee')))) ||
        item.img === r.oldUrl
      );
      if (match) {
        if (item.img !== match.newUrl) {
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
      const match = URL_REPLACEMENTS.find(r => 
        (r.name.toLowerCase() === (item.name || '').toLowerCase()) ||
        item.img === r.oldUrl ||
        docSnap.id === r.oldUrl
      );
      if (match && item.img !== match.newUrl) {
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
  console.log('All updates complete.');
  process.exit(0);
}).catch(err => {
  console.error('Error during Firestore update:', err);
  process.exit(1);
});
