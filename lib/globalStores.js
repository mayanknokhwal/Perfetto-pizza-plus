/**
 * Perfetto Pizza - Centralized Global Runtime State Store
 * Initializes all in-memory cache stores once at application boot
 */

try {
    require('dotenv').config();
} catch (e) { }

const DEFAULT_SETTINGS = {
    key: 'default',
    minOrderValue: 80,
    freeDeliveryLimit: 500,
    customerCarePhone: '9414503886',
    customerCareEnabled: true,
    restaurantLat: 29.533736,
    restaurantLng: 73.447895,
    deliveryRadius: 10,
    zoneCharges: {
        zone1: 0,
        zone2: 0,
        zone3: 0,
        zone4: 0,
        zone5: 0,
        zone6: 0,
    },
    shopStatus: 'open',
    openingTime: '11:00',
    closingTime: '23:00',
    autoScheduleEnabled: false,
    manualOverride: 'none', // 'none' | 'force_open' | 'force_closed'
    manualCloseDate: null, // 'YYYY-MM-DD' if manually emergency closed for the day
    hideStaffPaymentDetails: false,
    masterDeliveryOtp: '9999',
};

// 1. Firestore In-Memory Document Cache
if (!global.__firestoreMemoryCache) {
    global.__firestoreMemoryCache = new Map();
}

// 2. Orders Runtime List
if (!global.__perfettoOrdersList) {
    global.__perfettoOrdersList = [];
}

// 3. Customer Users Runtime List
if (!global.__perfettoUsersList) {
    global.__perfettoUsersList = [];
}

// 4. Store Settings Runtime Object
if (!global.__perfettoStoreSettings) {
    global.__perfettoStoreSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

// 5. Admin & Staff Team Runtime Map
if (!global.__adminTeamStore) {
    global.__adminTeamStore = new Map();

    const MASTER_ADMIN_PHONE = (process.env.MASTER_ADMIN_PHONE || '9414503886').replace(/[^0-9]/g, '').slice(-10);

    if (MASTER_ADMIN_PHONE) {
        global.__adminTeamStore.set(MASTER_ADMIN_PHONE, {
            id: 'master_admin_' + MASTER_ADMIN_PHONE,
            phone: MASTER_ADMIN_PHONE,
            fullName: 'Master Admin',
            role: 'Master Admin',
            status: 'active',
            photoURL: `https://ui-avatars.com/api/?name=Master+Admin&background=ff6b00&color=fff`,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
        });
    }
}

module.exports = {
    DEFAULT_SETTINGS
};
