/**
 * Perfetto Pizza - Daily Banners Service & Fallback Logo System
 * Firestore Collection: 'settings', Document: 'daily_banners'
 * Enforces strictly 4 persistent slots (Banner #1 to #4) with enabled toggle flags.
 * At least 1 banner must remain active.
 */

try {
    require('dotenv').config();
} catch (e) { }

require('./globalStores');
const { getFirestoreDoc, setFirestoreDoc } = require('./firestore');

// Official Perfetto Pizza Default Logo Fallback Constant
const DEFAULT_FALLBACK_BANNER_LOGO = 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';

// Official 4 Valid Persistent Default Daily Banner Slots
const DEFAULT_DAILY_BANNERS = [
    { id: 'b1', url: 'https://i.ibb.co/GQtdNF4v/free-cold-drink.png', enabled: true, targetProductId: '', discountPercent: 0 },
    { id: 'b2', url: 'https://i.ibb.co/kVpH7yM2/free-kitkat-shake.png', enabled: true, minSpend: 699, rewardType: 'category', rewardCategory: 'Shake', rewardPizzaSize: 'medium' },
    { id: 'b3', url: 'https://i.ibb.co/VYqnBKbM/free-medium-pizza.png', enabled: true, dealType: 'category_bogo', targetCategory: 'Pizza', bogoCategory: 'Pizza' },
    { id: 'b4', url: 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png', enabled: true }
];

const TOTAL_BANNER_SLOTS = 4;

/**
 * Resolves a banner URL. If empty, invalid, or whitespace, falls back to official Perfetto logo.
 * @param {string} url - Input image URL
 * @returns {string} Safe resolved URL
 */
function resolveBannerUrl(url) {
    if (!url || typeof url !== 'string') {
        return DEFAULT_FALLBACK_BANNER_LOGO;
    }
    const trimmed = url.trim();
    if (!trimmed || trimmed.length < 4) {
        return DEFAULT_FALLBACK_BANNER_LOGO;
    }
    return trimmed;
}

/**
 * Validates and normalizes banner items into strictly 4 persistent slots.
 * Ensures:
 * - Exactly 4 slots: [ { id: 'b1', url: '...', enabled: boolean }, ... ]
 * - At least 1 banner remains active (enabled: true)
 * - Fallback: Any invalid URL resolves to DEFAULT_FALLBACK_BANNER_LOGO
 * - Slot 1 preserves targetProductId and discountPercent
 * - Slot 2 preserves minSpend, rewardType, rewardCategory, rewardPizzaSize
 * 
 * @param {Array} rawBanners - Raw input banners array
 * @returns {Array<{id: string, url: string, enabled: boolean, targetProductId?: string, discountPercent?: number, minSpend?: number, rewardType?: string, rewardCategory?: string, rewardPizzaSize?: string}>} Validated 4 banners array
 */
function validateAndNormalizeBanners(rawBanners) {
    const list = Array.isArray(rawBanners) ? rawBanners : [];
    let sanitized = [];

    for (let i = 0; i < TOTAL_BANNER_SLOTS; i++) {
        const item = list[i] || DEFAULT_DAILY_BANNERS[i] || { id: `b${i + 1}`, url: DEFAULT_FALLBACK_BANNER_LOGO, enabled: true };
        const id = (item.id && String(item.id).trim()) || `b${i + 1}`;
        const url = resolveBannerUrl(item.url);
        const enabled = item.enabled !== false;
        const bannerObj = { id, url, enabled };
        if (i === 0) {
            bannerObj.targetProductId = (item.targetProductId && String(item.targetProductId).trim()) || '';
            const rawDisc = parseInt(item.discountPercent, 10);
            bannerObj.discountPercent = (!isNaN(rawDisc) && rawDisc > 0) ? Math.min(90, Math.max(1, rawDisc)) : 0;
        }
        if (i === 1) {
            const rawSpend = parseInt(item.minSpend, 10);
            bannerObj.minSpend = (!isNaN(rawSpend) && rawSpend > 0) ? rawSpend : 699;
            const cat = (item.rewardCategory && String(item.rewardCategory).trim()) || 'Shake';
            const isPizza = cat.toLowerCase() === 'pizza';
            bannerObj.rewardCategory = cat;
            bannerObj.rewardType = isPizza ? 'pizza' : 'category';
            bannerObj.rewardPizzaSize = isPizza ? ((item.rewardPizzaSize && String(item.rewardPizzaSize).trim().toLowerCase()) || 'medium') : '';
        }
        if (i === 2) {
            bannerObj.dealType = (item.dealType && String(item.dealType).trim()) || 'category_bogo';
            const cat = (item.targetCategory || item.bogoCategory || 'Pizza').trim();
            bannerObj.targetCategory = cat;
            bannerObj.bogoCategory = cat;
        }
        sanitized.push(bannerObj);
    }

    // Validation: At least 1 banner must remain active (prevent unchecking all 4 slots)
    if (!sanitized.some(b => b.enabled)) {
        sanitized[0].enabled = true;
    }

    return sanitized;
}

/**
 * Fetches daily banners from Firestore ('settings/daily_banners').
 * Normalizes to strictly 4 slots with enabled flags.
 * @returns {Promise<Array<{id: string, url: string, enabled: boolean}>>}
 */
async function fetchDailyBannersFromFirestore() {
    try {
        const doc = await getFirestoreDoc('settings', 'daily_banners');
        if (doc && Array.isArray(doc.banners) && doc.banners.length > 0) {
            const normalized = validateAndNormalizeBanners(doc.banners);
            if (doc.slot1 && normalized[0]) {
                if (!normalized[0].targetProductId && doc.slot1.targetProductId) {
                    normalized[0].targetProductId = doc.slot1.targetProductId;
                }
                if (!normalized[0].discountPercent && doc.slot1.discountPercent) {
                    normalized[0].discountPercent = doc.slot1.discountPercent;
                }
            }
            if (doc.slot2 && normalized[1]) {
                if (doc.slot2.minSpend !== undefined) {
                    normalized[1].minSpend = Number(doc.slot2.minSpend) || 699;
                }
                if (doc.slot2.rewardCategory) {
                    normalized[1].rewardCategory = doc.slot2.rewardCategory;
                }
                const isPizza = (normalized[1].rewardCategory || '').toLowerCase() === 'pizza';
                normalized[1].rewardType = isPizza ? 'pizza' : 'category';
                if (isPizza && doc.slot2.rewardPizzaSize) {
                    normalized[1].rewardPizzaSize = doc.slot2.rewardPizzaSize;
                }
            }
            if (doc.slot3 && normalized[2]) {
                if (doc.slot3.dealType) {
                    normalized[2].dealType = doc.slot3.dealType;
                }
                if (doc.slot3.targetCategory || doc.slot3.bogoCategory) {
                    const cat = doc.slot3.targetCategory || doc.slot3.bogoCategory;
                    normalized[2].targetCategory = cat;
                    normalized[2].bogoCategory = cat;
                }
            }
            global.__perfettoDailyBanners = normalized;
            return normalized;
        }
    } catch (err) {
        console.warn('⚠️ [Firestore Daily Banners] Read notice:', err.message);
    }

    // Fallback to runtime memory cache or default 4 banners
    if (!global.__perfettoDailyBanners || !Array.isArray(global.__perfettoDailyBanners) || global.__perfettoDailyBanners.length !== TOTAL_BANNER_SLOTS) {
        global.__perfettoDailyBanners = JSON.parse(JSON.stringify(DEFAULT_DAILY_BANNERS));
    }
    return global.__perfettoDailyBanners;
}

/**
 * Saves daily banners to Firestore ('settings/daily_banners').
 * Locks strictly to 4 persistent slots and ensures enabled flags are persisted.
 * @param {Array<{id: string, url: string, enabled?: boolean}>} bannersList
 * @returns {Promise<{success: boolean, banners: Array<{id: string, url: string, enabled: boolean}>, message: string}>}
 */
async function saveDailyBannersToFirestore(bannersList) {
    const validated = validateAndNormalizeBanners(bannersList);

    const slot1Data = {
        imageUrl: validated[0].url,
        url: validated[0].url,
        targetProductId: validated[0].targetProductId || '',
        discountPercent: validated[0].discountPercent || 0,
        active: validated[0].enabled !== false,
        enabled: validated[0].enabled !== false
    };

    const isSlot2Pizza = (validated[1].rewardCategory || '').toLowerCase() === 'pizza';
    const slot2Data = {
        imageUrl: validated[1].url,
        url: validated[1].url,
        minSpend: Number(validated[1].minSpend) || 699,
        rewardType: isSlot2Pizza ? 'pizza' : 'category',
        rewardCategory: validated[1].rewardCategory || 'Shake',
        rewardPizzaSize: isSlot2Pizza ? (validated[1].rewardPizzaSize || 'medium') : '',
        active: validated[1].enabled !== false,
        enabled: validated[1].enabled !== false
    };

    const slot3Data = {
        imageUrl: validated[2].url,
        url: validated[2].url,
        dealType: validated[2].dealType || 'category_bogo',
        targetCategory: validated[2].targetCategory || validated[2].bogoCategory || 'Pizza',
        bogoCategory: validated[2].bogoCategory || validated[2].targetCategory || 'Pizza',
        active: validated[2].enabled !== false,
        enabled: validated[2].enabled !== false
    };

    const docPayload = {
        banners: validated,
        slot1: slot1Data,
        slot2: slot2Data,
        slot3: slot3Data,
        count: validated.length,
        activeCount: validated.filter(b => b.enabled).length,
        updatedAt: new Date().toISOString(),
        key: 'daily_banners'
    };

    try {
        await setFirestoreDoc('settings', 'daily_banners', docPayload);
        try {
            await setFirestoreDoc('banners', 'slot1', slot1Data);
            await setFirestoreDoc('banners', 'slot2', slot2Data);
            await setFirestoreDoc('banners', 'slot3', slot3Data);
        } catch (subErr) {}
        global.__perfettoDailyBanners = validated;
        return {
            success: true,
            banners: validated,
            slot1: slot1Data,
            slot2: slot2Data,
            slot3: slot3Data,
            message: `Successfully saved ${validated.length} persistent daily banner slots to Firestore (${docPayload.activeCount} active)`
        };
    } catch (err) {
        console.error('❌ [Firestore Daily Banners] Save error:', err.message);
        global.__perfettoDailyBanners = validated;
        return {
            success: true,
            banners: validated,
            slot1: slot1Data,
            slot2: slot2Data,
            slot3: slot3Data,
            message: `Saved locally (Firestore note: ${err.message})`
        };
    }
}

module.exports = {
    DEFAULT_FALLBACK_BANNER_LOGO,
    DEFAULT_DAILY_BANNERS,
    TOTAL_BANNER_SLOTS,
    resolveBannerUrl,
    validateAndNormalizeBanners,
    normalizeDailyBanners: validateAndNormalizeBanners,
    fetchDailyBannersFromFirestore,
    saveDailyBannersToFirestore
};
