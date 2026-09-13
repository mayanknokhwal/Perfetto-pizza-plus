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
        const doc = await getFirestoreDoc('settings', 'storeSettings') || await getFirestoreDoc('settings', 'store_config');
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
            if (body.masterDeliveryOtp !== undefined || body.emergency_master_otp !== undefined) {
                const cleanOtp = String(body.masterDeliveryOtp !== undefined ? body.masterDeliveryOtp : body.emergency_master_otp).replace(/[^0-9]/g, '').slice(0, 4);
                updateFields.masterDeliveryOtp = cleanOtp;
                updateFields.emergency_master_otp = cleanOtp;
            }

            Object.assign(global.__perfettoStoreSettings, updateFields);
            global.__perfettoStoreSettings.updatedAt = new Date().toISOString();

            // Persist to Firestore under both storeSettings and store_config
            await setFirestoreDoc('settings', 'storeSettings', global.__perfettoStoreSettings);
            await setFirestoreDoc('settings', 'store_config', global.__perfettoStoreSettings);
            await bumpSettingsVersion();

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
            const slot1 = (banners && banners[0]) ? {
                imageUrl: banners[0].url,
                url: banners[0].url,
                targetProductId: banners[0].targetProductId || '',
                discountPercent: banners[0].discountPercent || 0,
                active: banners[0].enabled !== false,
                enabled: banners[0].enabled !== false
            } : null;
            const slot2 = (banners && banners[1]) ? {
                imageUrl: banners[1].url,
                url: banners[1].url,
                minSpend: Number(banners[1].minSpend) || 699,
                rewardType: banners[1].rewardType || 'category',
                rewardCategory: banners[1].rewardCategory || 'Shake',
                rewardPizzaSize: banners[1].rewardPizzaSize || 'medium',
                active: banners[1].enabled !== false,
                enabled: banners[1].enabled !== false
            } : null;
            const slot3 = (banners && banners[2]) ? {
                imageUrl: banners[2].url,
                url: banners[2].url,
                buyCategory: banners[2].buyCategory || 'Momos',
                buyQty: Number(banners[2].buyQty) || 2,
                rewardCategory: banners[2].rewardCategory || 'Shake',
                freeQty: Number(banners[2].freeQty) || 1,
                active: banners[2].enabled !== false,
                enabled: banners[2].enabled !== false
            } : null;
            return res.status(200).json({
                success: true,
                banners: banners,
                slot1: slot1,
                slot2: slot2,
                slot3: slot3,
                max_offers_per_order: global.__perfettoMaxOffersPerOrder || 1,
                maxOffersPerOrder: global.__perfettoMaxOffersPerOrder || 1,
                max_qty_per_offer: global.__perfettoMaxQtyPerOffer || 1,
                maxQtyPerOffer: global.__perfettoMaxQtyPerOffer || 1,
                count: banners.length,
                activeCount: banners.filter(b => b.enabled).length,
                fallbackLogo: DEFAULT_FALLBACK_BANNER_LOGO
            });
        }

        if (req.method === 'PUT' || req.method === 'POST' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            const rawBanners = Array.isArray(body) ? body : (body.banners || []);
            const extra = (typeof body === 'object' && !Array.isArray(body)) ? body : {};
            const result = await saveDailyBannersToFirestore(rawBanners, extra);
            await bumpSettingsVersion();

            return res.status(200).json({
                success: true,
                message: result.message,
                banners: result.banners,
                slot1: result.slot1 || null,
                slot2: result.slot2 || null,
                slot3: result.slot3 || null,
                max_offers_per_order: result.max_offers_per_order || 1,
                maxOffersPerOrder: result.maxOffersPerOrder || 1,
                max_qty_per_offer: result.max_qty_per_offer || 1,
                maxQtyPerOffer: result.maxQtyPerOffer || 1,
                count: result.banners.length,
                activeCount: result.banners.filter(b => b.enabled).length
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
                let doc = await getFirestoreDoc('settings', 'wallet_config');
                if (!doc) {
                    doc = await getFirestoreDoc('settings', 'rewards');
                }
                if (!doc) {
                    doc = await getFirestoreDoc('settings', 'store_config');
                }
                if (doc) {
                    config = { ...global.__perfettoWalletConfig, ...(doc.wallet_config || doc) };
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
            const expiryDays = body.expiryDays !== undefined ? Math.min(30, Math.max(1, parseInt(body.expiryDays, 10) || 7)) : 7;
            const minRedemptionOrder = body.minRedemptionOrder !== undefined ? Math.max(0, parseFloat(body.minRedemptionOrder) || 0) : 0;

            let rawSlabs = Array.isArray(body.slabs) ? [...body.slabs] : [];
            if (rawSlabs.length !== 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed: Exactly 5 slabs (Slabs 1 to 5) are required.'
                });
            }

            const MIN_ORDER_GAP = 100;
            const CASHBACK_GAP = 5;
            const slabs = [];

            for (let i = 0; i < 5; i++) {
                const s = rawSlabs[i] || {};
                const minOrder = parseFloat(s.minOrder);
                const cashback = parseFloat(s.cashback);

                if (isNaN(minOrder) || minOrder < 1) {
                    return res.status(400).json({
                        success: false,
                        message: `Validation failed: Slab ${i + 1} Minimum Order Amount must be at least ₹1.`
                    });
                }
                if (isNaN(cashback) || cashback < 1) {
                    return res.status(400).json({
                        success: false,
                        message: `Validation failed: Slab ${i + 1} Cashback Amount must be at least ₹1.`
                    });
                }
                if (cashback > minOrder) {
                    return res.status(400).json({
                        success: false,
                        message: `Validation failed: Slab ${i + 1} Cashback (₹${cashback}) cannot exceed Min Order (₹${minOrder}).`
                    });
                }

                if (i > 0) {
                    const prevSlab = slabs[i - 1];
                    if (minOrder < prevSlab.minOrder + MIN_ORDER_GAP) {
                        return res.status(400).json({
                            success: false,
                            message: `Validation failed: Slab ${i + 1} Min Order (₹${minOrder}) must be at least ₹${prevSlab.minOrder + MIN_ORDER_GAP} (minimum ₹100 gap above Slab ${i}).`
                        });
                    }
                    if (cashback < prevSlab.cashback + CASHBACK_GAP) {
                        return res.status(400).json({
                            success: false,
                            message: `Validation failed: Slab ${i + 1} Cashback (₹${cashback}) must be at least ₹${prevSlab.cashback + CASHBACK_GAP} (minimum ₹5 gap above Slab ${i}).`
                        });
                    }
                }

                slabs.push({ minOrder, cashback });
            }

            const updatedConfig = {
                key: 'wallet_config',
                enabled: isEnabled,
                expiryDays,
                minRedemptionOrder,
                minOrderToRedeem: 0,
                slabs,
                updatedAt: new Date().toISOString()
            };

            global.__perfettoWalletConfig = updatedConfig;
            await setFirestoreDoc('settings', 'wallet_config', updatedConfig);
            try {
                await setFirestoreDoc('settings', 'rewards', {
                    key: 'rewards',
                    slabs,
                    rewardTiers: slabs,
                    cashbackTiers: slabs,
                    enabled: isEnabled,
                    expiryDays,
                    updatedAt: updatedConfig.updatedAt
                });
            } catch (e) {}
            await bumpSettingsVersion();

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

/**
 * Default Store Notice Configuration
 */
const DEFAULT_STORE_NOTICE = {
    key: 'store_notice',
    active: true,
    enabled: true,
    title: 'Store Notice',
    content: 'Welcome to Perfetto Pizza Plus! We take pride in serving freshly baked pizzas, delicious burgers, wraps, and fast food delights. For any special catering or bulk party orders, contact customer support.',
    text: 'Welcome to Perfetto Pizza Plus! We take pride in serving freshly baked pizzas, delicious burgers, wraps, and fast food delights. For any special catering or bulk party orders, contact customer support.',
    characterCount: 202,
    lineCount: 1,
    updatedAt: null
};

if (!global.__perfettoStoreNotice) {
    global.__perfettoStoreNotice = JSON.parse(JSON.stringify(DEFAULT_STORE_NOTICE));
}

/**
 * Handles /api/notice, /api/settings/notice, /api/store-notice (GET, POST, PUT, PATCH)
 * Document: settings/store_notice
 */
async function handleStoreNoticeRequest(req, res) {
    try {
        if (req.method === 'GET') {
            let notice = global.__perfettoStoreNotice;
            try {
                const doc = await getFirestoreDoc('settings', 'store_notice');
                if (doc) {
                    notice = { ...global.__perfettoStoreNotice, ...doc };
                    global.__perfettoStoreNotice = notice;
                }
            } catch (e) {
                console.warn('Firestore store_notice fetch notice:', e.message);
            }

            return res.status(200).json({
                success: true,
                notice: notice || DEFAULT_STORE_NOTICE
            });
        }

        if (req.method === 'PUT' || req.method === 'POST' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            const isActive = body.active !== undefined
                ? Boolean(body.active)
                : (body.enabled !== undefined ? Boolean(body.enabled) : true);
            const title = (body.title && typeof body.title === 'string' && body.title.trim())
                ? body.title.trim().slice(0, 100)
                : 'Store Notice';
            const rawContent = typeof body.content === 'string'
                ? body.content
                : (typeof body.text === 'string' ? body.text : '');

            // Strict 500 characters and 12 lines constraints
            if (rawContent.length > 500) {
                return res.status(400).json({
                    success: false,
                    message: 'Notice content exceeds maximum 500 characters limit'
                });
            }

            const lines = rawContent.split('\n');
            if (lines.length > 12) {
                return res.status(400).json({
                    success: false,
                    message: 'Notice content exceeds maximum 12 lines limit'
                });
            }

            const content = rawContent.slice(0, 500);
            const characterCount = content.length;
            const lineCount = lines.length;

            const updatedNotice = {
                key: 'store_notice',
                active: isActive,
                enabled: isActive,
                title,
                content,
                text: content,
                characterCount,
                lineCount,
                updatedAt: new Date().toISOString()
            };

            global.__perfettoStoreNotice = updatedNotice;
            await setFirestoreDoc('settings', 'store_notice', updatedNotice);
            await bumpSettingsVersion();

            return res.status(200).json({
                success: true,
                message: 'Store notice saved successfully to Firebase Firestore',
                notice: updatedNotice
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleStoreNoticeRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error'
        });
    }
}

/**
 * Bumps central settings_version timestamp in Firestore (app_config/metadata)
 * and in-memory runtime cache.
 */
async function bumpSettingsVersion(customVer) {
    const version = Number(customVer) || Date.now();
    global.__perfettoSettingsVersion = version;
    const payload = {
        settings_version: version,
        settingsVersion: version,
        updatedAt: new Date().toISOString()
    };
    try {
        await setFirestoreDoc('app_config', 'metadata', payload);
    } catch (e) {
        console.warn('Failed to write settings_version to app_config/metadata:', e.message);
    }
    try {
        await setFirestoreDoc('settings', 'metadata', payload);
    } catch (e) { }
    return version;
}

async function getSettingsVersion(options = {}) {
    const now = Date.now();
    if (!options.force && global.__perfettoSettingsVersion && (now - (global.__perfettoSettingsVersionTimestamp || 0) < 3000)) {
        return global.__perfettoSettingsVersion;
    }
    try {
        const doc = await getFirestoreDoc('app_config', 'metadata') || await getFirestoreDoc('settings', 'metadata');
        if (doc && (doc.settings_version || doc.settingsVersion)) {
            global.__perfettoSettingsVersion = Number(doc.settings_version || doc.settingsVersion);
            global.__perfettoSettingsVersionTimestamp = now;
            return global.__perfettoSettingsVersion;
        }
    } catch (e) { }
    if (!global.__perfettoSettingsVersion) {
        global.__perfettoSettingsVersion = Date.now();
        global.__perfettoSettingsVersionTimestamp = now;
    }
    return global.__perfettoSettingsVersion;
}

async function handleSettingsVersionRequest(req, res) {
    try {
        if (req.method === 'GET') {
            const version = await getSettingsVersion();
            return res.status(200).json({ success: true, settings_version: version });
        }
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const incomingVer = Number(body?.settings_version || body?.settingsVersion || body?.version) || Date.now();
            const version = await bumpSettingsVersion(incomingVer);
            return res.status(200).json({ success: true, settings_version: version });
        }
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (err) {
        console.error('Error in handleSettingsVersionRequest:', err);
        return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
    }
}

const DEFAULT_COMBO_CONFIG = {
    allow_combo_with_daily_offer: false,
    combos: {
        solo: [
            {
                id: "solo_deal_1",
                name: "Solo Meal 1",
                combo_price: 149,
                original_price: 219,
                is_active: true,
                items: [
                    { category_id: "Burger", item_id: "bgr-veggie", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Bread", item_id: "brd-garlic", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 1 }
                ]
            },
            {
                id: "solo_deal_2",
                name: "Solo Meal 2",
                combo_price: 169,
                original_price: 247,
                is_active: true,
                items: [
                    { category_id: "Burger", item_id: "bgr-cheesy", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Bread", item_id: "brd-cheese-corn", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 1 }
                ]
            },
            {
                id: "solo_deal_3",
                name: "Solo Meal 3",
                combo_price: 199,
                original_price: 318,
                is_active: true,
                items: [
                    { category_id: "Pizza", item_id: "cheese-n-corn", size: "S", variant_id: "S", quantity: 1 },
                    { category_id: "Bread", item_id: "brd-garlic", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 1 }
                ]
            }
        ],
        duo: [
            {
                id: "duo_deal_1",
                name: "Duo Meal 1",
                combo_price: 299,
                original_price: 437,
                is_active: true,
                items: [
                    { category_id: "Pizza", item_id: "cheese-n-corn", size: "M", variant_id: "M", quantity: 1 },
                    { category_id: "Bread", item_id: "brd-stuffed", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 2 }
                ]
            },
            {
                id: "duo_deal_2",
                name: "Duo Meal 2",
                combo_price: 329,
                original_price: 467,
                is_active: true,
                items: [
                    { category_id: "Burger", item_id: "bgr-crispy-paneer", size: "", variant_id: "", quantity: 2 },
                    { category_id: "Pasta", item_id: "pst-creamy", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 2 }
                ]
            },
            {
                id: "duo_deal_3",
                name: "Duo Meal 3",
                combo_price: 359,
                original_price: 527,
                is_active: true,
                items: [
                    { category_id: "Pizza", item_id: "farm-house", size: "M", variant_id: "M", quantity: 1 },
                    { category_id: "Bread", item_id: "brd-perfetto-stuffed", size: "", variant_id: "", quantity: 1 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 2 }
                ]
            }
        ],
        squad: [
            {
                id: "squad_deal_1",
                name: "Squad Meal 1",
                combo_price: 499,
                original_price: 737,
                is_active: true,
                items: [
                    { category_id: "Pizza", item_id: "farm-house", size: "L", variant_id: "L", quantity: 1 },
                    { category_id: "Burger", item_id: "bgr-veggie", size: "", variant_id: "", quantity: 2 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 3 }
                ]
            },
            {
                id: "squad_deal_2",
                name: "Squad Meal 2",
                combo_price: 549,
                original_price: 846,
                is_active: true,
                items: [
                    { category_id: "Pizza", item_id: "deluxe-pizza", size: "L", variant_id: "L", quantity: 1 },
                    { category_id: "Pasta", item_id: "pst-baked-mix", size: "", variant_id: "", quantity: 2 },
                    { category_id: "Bread", item_id: "brd-perfetto-stuffed", size: "", variant_id: "", quantity: 1 }
                ]
            },
            {
                id: "squad_deal_3",
                name: "Squad Meal 3",
                combo_price: 599,
                original_price: 907,
                is_active: true,
                items: [
                    { category_id: "Pizza", item_id: "tandoori-pizza", size: "L", variant_id: "L", quantity: 1 },
                    { category_id: "Momos", item_id: "mmo-paneer-steam", size: "", variant_id: "", quantity: 2 },
                    { category_id: "Colo Drinks", item_id: "drk-coke-300ml", size: "", variant_id: "", quantity: 4 }
                ]
            }
        ]
    }
};

async function handleCombosRequest(req, res) {
    try {
        if (req.method === 'GET') {
            let doc = await getFirestoreDoc('site_settings', 'combo_config') || await getFirestoreDoc('settings', 'combo_config');
            if (!doc) doc = DEFAULT_COMBO_CONFIG;
            return res.status(200).json({ success: true, config: doc });
        }
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const payload = {
                allow_combo_with_daily_offer: Boolean(body.allow_combo_with_daily_offer),
                combos: body.combos || DEFAULT_COMBO_CONFIG.combos,
                key: 'combo_config',
                updatedAt: new Date().toISOString()
            };
            await setFirestoreDoc('site_settings', 'combo_config', payload);
            try { await setFirestoreDoc('settings', 'combo_config', payload); } catch (e) {}
            await bumpSettingsVersion();
            return res.status(200).json({ success: true, config: payload });
        }
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (err) {
        console.error('Error in handleCombosRequest:', err);
        return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
    }
}

module.exports = {
    handleSettingsRequest,
    handleBannersRequest,
    handleWalletConfigRequest,
    handleStoreNoticeRequest,
    handleSettingsVersionRequest,
    handleCombosRequest,
    bumpSettingsVersion,
    getSettingsVersion,
    DEFAULT_SETTINGS,
    DEFAULT_DAILY_BANNERS,
    DEFAULT_FALLBACK_BANNER_LOGO,
    DEFAULT_WALLET_CONFIG,
    DEFAULT_STORE_NOTICE,
    DEFAULT_COMBO_CONFIG
};


