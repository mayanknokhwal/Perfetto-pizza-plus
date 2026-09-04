/**
 * Perfetto Pizza - Store Settings Controller
 * Powered by Firebase Firestore ('settings/storeSettings')
 * Handles GET, PUT, PATCH for shop status, delivery radius, min order, free delivery, zone charges, customer care
 */

const { DEFAULT_SETTINGS, DEFAULT_DAILY_BANNERS, DEFAULT_FALLBACK_BANNER_LOGO, DEFAULT_WALLET_CONFIG } = require('../lib/globalStores');
const { FIREBASE_CONFIG, getFirestoreDoc, setFirestoreDoc } = require('../lib/firestore');
const {
    fetchDailyBannersFromFirestore,
    saveDailyBannersToFirestore,
    validateAndNormalizeBanners
} = require('../lib/bannerService');

async function fetchLiveSettingsFromFirestore() {
    try {
        const doc = await getFirestoreDoc('settings', 'storeSettings');
        if (doc) {
            global.__perfettoStoreSettings = { ...global.__perfettoStoreSettings, ...doc };
        }
    } catch (e) {
        console.warn('Firestore settings read note:', e.message);
    }
    return global.__perfettoStoreSettings;
}

async function handleSettingsRequest(req, res) {
    try {
        // 1. GET: Retrieve Store Settings from Firestore
        if (req.method === 'GET') {
            const currentSettings = await fetchLiveSettingsFromFirestore();
            return res.status(200).json({
                success: true,
                settings: currentSettings,
                firebaseConfig: FIREBASE_CONFIG,
            });
        }

        // 2. PUT / PATCH: Update Store Settings in Firestore
        if (req.method === 'PUT' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            const updateFields = {};
            if (body.minOrderValue !== undefined) updateFields.minOrderValue = Number(body.minOrderValue);
            if (body.freeDeliveryLimit !== undefined) updateFields.freeDeliveryLimit = Number(body.freeDeliveryLimit);
            if (body.customerCarePhone !== undefined) updateFields.customerCarePhone = String(body.customerCarePhone).replace(/[^0-9]/g, '').trim();
            if (body.customerCareEnabled !== undefined) updateFields.customerCareEnabled = Boolean(body.customerCareEnabled);
            if (body.restaurantLat !== undefined) updateFields.restaurantLat = Number(body.restaurantLat);
            if (body.restaurantLng !== undefined) updateFields.restaurantLng = Number(body.restaurantLng);
            if (body.deliveryRadius !== undefined) updateFields.deliveryRadius = Number(body.deliveryRadius);
            if (body.zoneCharges !== undefined) updateFields.zoneCharges = body.zoneCharges;
            if (body.shopStatus !== undefined) updateFields.shopStatus = body.shopStatus === 'closed' ? 'closed' : 'open';
            if (body.openingTime !== undefined) updateFields.openingTime = String(body.openingTime).trim();
            if (body.closingTime !== undefined) updateFields.closingTime = String(body.closingTime).trim();
            if (body.autoScheduleEnabled !== undefined) updateFields.autoScheduleEnabled = Boolean(body.autoScheduleEnabled);
            if (body.manualOverride !== undefined) updateFields.manualOverride = String(body.manualOverride).trim();
            if (body.manualCloseDate !== undefined) updateFields.manualCloseDate = body.manualCloseDate ? String(body.manualCloseDate).trim() : null;
            if (body.hideStaffPaymentDetails !== undefined) updateFields.hideStaffPaymentDetails = Boolean(body.hideStaffPaymentDetails);
            if (body.masterDeliveryOtp !== undefined) updateFields.masterDeliveryOtp = String(body.masterDeliveryOtp).replace(/[^0-9]/g, '').slice(0, 4);

            Object.assign(global.__perfettoStoreSettings, updateFields);
            global.__perfettoStoreSettings.updatedAt = new Date().toISOString();

            // Persist to Firestore
            await setFirestoreDoc('settings', 'storeSettings', global.__perfettoStoreSettings);

            return res.status(200).json({
                success: true,
                message: 'Store settings saved successfully to Firebase Firestore',
                settings: global.__perfettoStoreSettings,
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleSettingsRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
}

/**
 * Handles /api/banners requests (GET, PUT, POST)
 * Document: settings/daily_banners
 */
async function handleBannersRequest(req, res) {
    try {
        if (req.method === 'GET') {
            const banners = await fetchDailyBannersFromFirestore();
            return res.status(200).json({
                success: true,
                banners: banners,
                count: banners.length,
                fallbackLogo: DEFAULT_FALLBACK_BANNER_LOGO
            });
        }

        if (req.method === 'PUT' || req.method === 'POST' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            const rawBanners = Array.isArray(body) ? body : (body.banners || []);
            const result = await saveDailyBannersToFirestore(rawBanners);

            return res.status(200).json({
                success: true,
                message: result.message,
                banners: result.banners,
                count: result.banners.length
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleBannersRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
}

/**
 * Handles /api/wallet/config or /api/wallet requests (GET, PUT, POST)
 * Document: settings/wallet_config
 */
async function handleWalletConfigRequest(req, res) {
    try {
        if (req.method === 'GET') {
            let config = global.__perfettoWalletConfig;
            try {
                const doc = await getFirestoreDoc('settings', 'wallet_config');
                if (doc) {
                    config = { ...global.__perfettoWalletConfig, ...doc };
                    global.__perfettoWalletConfig = config;
                }
            } catch (e) {
                console.warn('Firestore wallet_config fetch notice:', e.message);
            }

            return res.status(200).json({
                success: true,
                config: config || DEFAULT_WALLET_CONFIG
            });
        }

        if (req.method === 'PUT' || req.method === 'POST' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            const isEnabled = body.enabled !== undefined ? Boolean(body.enabled) : true;
            const expiryDays = body.expiryDays !== undefined ? Math.max(1, parseInt(body.expiryDays, 10) || 7) : 7;
            const minRedemptionOrder = body.minRedemptionOrder !== undefined ? Math.max(0, parseFloat(body.minRedemptionOrder) || 200) : 200;

            const slabs = Array.isArray(body.slabs) && body.slabs.length >= 4
                ? body.slabs.map((s, i) => ({
                    minOrder: Math.max(0, parseFloat(s.minOrder) || DEFAULT_WALLET_CONFIG.slabs[i].minOrder),
                    cashback: Math.max(0, parseFloat(s.cashback) || DEFAULT_WALLET_CONFIG.slabs[i].cashback)
                }))
                : DEFAULT_WALLET_CONFIG.slabs;

            const updatedConfig = {
                key: 'wallet_config',
                enabled: isEnabled,
                expiryDays,
                minRedemptionOrder,
                slabs,
                updatedAt: new Date().toISOString()
            };

            global.__perfettoWalletConfig = updatedConfig;
            await setFirestoreDoc('settings', 'wallet_config', updatedConfig);

            return res.status(200).json({
                success: true,
                message: 'Wallet & Cashback settings saved successfully to Firebase Firestore',
                config: updatedConfig
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleWalletConfigRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error'
        });
    }
}

module.exports = {
    handleSettingsRequest,
    handleBannersRequest,
    handleWalletConfigRequest,
    DEFAULT_SETTINGS,
    DEFAULT_DAILY_BANNERS,
    DEFAULT_FALLBACK_BANNER_LOGO,
    DEFAULT_WALLET_CONFIG
};

