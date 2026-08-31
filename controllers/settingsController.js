/**
 * Perfetto Pizza - Store Settings Controller
 * Powered by Firebase Firestore ('settings/storeSettings')
 * Handles GET, PUT, PATCH for shop status, delivery radius, min order, free delivery, zone charges, customer care
 */

const { DEFAULT_SETTINGS } = require('../lib/globalStores');
const { FIREBASE_CONFIG, getFirestoreDoc, setFirestoreDoc } = require('../lib/firestore');

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

module.exports = {
    handleSettingsRequest,
    DEFAULT_SETTINGS,
};
