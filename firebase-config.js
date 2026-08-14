// --------------------------------------------------------------------------
// PERFETTO PIZZA - FIREBASE BACKEND CONFIGURATION & CLOUD SYNC BRIDGE
// --------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
  authDomain: "website-fa79c.firebaseapp.com",
  projectId: "website-fa79c",
  storageBucket: "website-fa79c.firebasestorage.app",
  messagingSenderId: "1070276115284",
  appId: "1:1070276115284:web:ebcb37d56f3af2a2d326c1",
  measurementId: "G-DT7MRXDMZ0"
};

// Initialize Firebase if not already initialized
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log("🔥 Firebase initialized successfully for project:", firebaseConfig.projectId);
    } catch (e) {
        console.error("🔥 Error initializing Firebase:", e);
    }
}

// Firestore Database Instance
let db = null;
if (typeof firebase !== 'undefined' && firebase.firestore) {
    try {
        db = firebase.firestore();
    } catch (e) {
        console.error("🔥 Error accessing Firestore:", e);
    }
}

// --------------------------------------------------------------------------
// CLOUD HELPER FUNCTIONS
// --------------------------------------------------------------------------

const PerfettoFirebase = {
    db: db,
    config: firebaseConfig,

    // 1. ORDERS: Place/Create Order in Firestore
    async placeOrder(orderData) {
        if (!db) {
            console.warn("Firestore unavailable, falling back to local only.");
            return false;
        }
        try {
            const orderRef = db.collection('orders').doc(orderData.id.toString());
            await orderRef.set({
                ...orderData,
                serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("🔥 Order saved to Firestore:", orderData.id);
            return true;
        } catch (e) {
            console.error("🔥 Failed to save order to Firestore:", e);
            return false;
        }
    },

    // 2. ORDERS: Update Order Status in Firestore
    async updateOrderStatus(orderId, newStatus) {
        if (!db) return false;
        try {
            const orderRef = db.collection('orders').doc(orderId.toString());
            await orderRef.update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`🔥 Order #${orderId} status updated to ${newStatus} in Firestore`);
            return true;
        } catch (e) {
            console.error(`🔥 Failed to update order status in Firestore:`, e);
            return false;
        }
    },

    // 3. ORDERS: Realtime Listener for Live Orders
    subscribeOrders(onUpdateCallback) {
        if (!db) return null;
        try {
            return db.collection('orders').onSnapshot(snapshot => {
                const orders = [];
                snapshot.forEach(doc => {
                    orders.push({ id: doc.id, ...doc.data() });
                });
                // Sort by createdAt descending
                orders.sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                });
                onUpdateCallback(orders);
            }, error => {
                console.error("🔥 Error listening to orders in Firestore:", error);
            });
        } catch (e) {
            console.error("🔥 Failed to set up orders subscription:", e);
            return null;
        }
    },

    // 4. SETTINGS: Save Global Store Settings (Shop Open/Closed, Min Order, Free Delivery)
    async saveSettings(settings) {
        if (!db) return false;
        try {
            const docRef = db.collection('settings').doc('global');
            await docRef.set({
                ...settings,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log("🔥 Store settings saved to Firestore:", settings);
            return true;
        } catch (e) {
            console.error("🔥 Failed to save settings to Firestore:", e);
            return false;
        }
    },

    // 5. SETTINGS: Realtime Listener for Global Settings
    subscribeSettings(onUpdateCallback) {
        if (!db) return null;
        try {
            return db.collection('settings').doc('global').onSnapshot(doc => {
                if (doc.exists) {
                    onUpdateCallback(doc.data());
                }
            }, error => {
                console.error("🔥 Error listening to settings in Firestore:", error);
            });
        } catch (e) {
            console.error("🔥 Failed to set up settings subscription:", e);
            return null;
        }
    },

    // 6. MENU: Save Menu Catalog to Firestore
    async saveMenu(menuItems) {
        if (!db) return false;
        try {
            const docRef = db.collection('menu').doc('menuData');
            await docRef.set({
                items: menuItems,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("🔥 Menu catalog saved to Firestore (items count:", menuItems.length, ")");
            return true;
        } catch (e) {
            console.error("🔥 Failed to save menu to Firestore:", e);
            return false;
        }
    },

    // 7. MENU: Realtime Listener for Menu Catalog
    subscribeMenu(onUpdateCallback) {
        if (!db) return null;
        try {
            return db.collection('menu').doc('menuData').onSnapshot(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data && Array.isArray(data.items)) {
                        onUpdateCallback(data.items);
                    }
                }
            }, error => {
                console.error("🔥 Error listening to menu in Firestore:", error);
            });
        } catch (e) {
            console.error("🔥 Failed to set up menu subscription:", e);
            return null;
        }
    }
};

window.PerfettoFirebase = PerfettoFirebase;
