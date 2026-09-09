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
    { id: 'b1', url: DEFAULT_FALLBACK_BANNER_LOGO, enabled: true, targetProductId: '', discountPercent: 0 },
    { id: 'b2', url: DEFAULT_FALLBACK_BANNER_LOGO, enabled: true, minSpend: 699, rewardType: 'category', rewardCategory: 'Shake', rewardPizzaSize: 'medium' },
    { id: 'b3', url: DEFAULT_FALLBACK_BANNER_LOGO, enabled: true },
    { id: 'b4', url: DEFAULT_FALLBACK_BANNER_LOGO, enabled: true }
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
        if (i === 0 || item.targetProductId !== undefined || item.discountPercent !== undefined) {
            bannerObj.targetProductId = (item.targetProductId && String(item.targetProductId).trim()) || '';
            const rawDisc = parseInt(item.discountPercent, 10);
            bannerObj.discountPercent = (!isNaN(rawDisc) && rawDisc > 0) ? Math.min(90, Math.max(1, rawDisc)) : 0;
        }
        if (i === 1 || item.minSpend !== undefined || item.rewardType !== undefined) {
            const rawSpend = parseInt(item.minSpend, 10);
            bannerObj.minSpend = (!isNaN(rawSpend) && rawSpend > 0) ? rawSpend : 699;
            bannerObj.rewardType = (item.rewardType === 'pizza') ? 'pizza' : 'category';
            const catVal = (item.rewardCategory && String(item.rewardCategory).trim()) || 'Shake';
            bannerObj.rewardCategory = (catVal.toLowerCase() === 'pizza') ? 'Shake' : catVal;
            bannerObj.rewardPizzaSize = (item.rewardPizzaSize && String(item.rewardPizzaSize).trim().toLowerCase()) || 'medium';
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
                if (doc.slot2.rewardType) {
                    normalized[1].rewardType = doc.slot2.rewardType;
                }
                if (doc.slot2.rewardCategory) {
                    normalized[1].rewardCategory = doc.slot2.rewardCategory;
                }
                if (doc.slot2.rewardPizzaSize) {
                    normalized[1].rewardPizzaSize = doc.slot2.rewardPizzaSize;
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

    const catVal = validated[1].rewardCategory || 'Shake';
    const safeRewardCategory = (String(catVal).toLowerCase() === 'pizza') ? 'Shake' : catVal;
    const slot2Data = {
        imageUrl: validated[1].url,
        url: validated[1].url,
        minSpend: validated[1].minSpend || 699,
        rewardType: validated[1].rewardType || 'category',
        rewardCategory: safeRewardCategory,
        rewardPizzaSize: validated[1].rewardPizzaSize || 'medium',
        active: validated[1].enabled,
        enabled: validated[1].enabled
    };

    const docPayload = {
        banners: validated,
        slot1: slot1Data,
        slot2: slot2Data,
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
        } catch (subErr) {}
        global.__perfettoDailyBanners = validated;
        return {
            success: true,
            banners: validated,
            slot1: slot1Data,
            slot2: slot2Data,
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
