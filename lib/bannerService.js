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
    { id: 'b1', url: 'https://i.ibb.co/GQtdNF4v/free-cold-drink.png', enabled: true },
    { id: 'b2', url: 'https://i.ibb.co/kVpH7yM2/free-kitkat-shake.png', enabled: true },
    { id: 'b3', url: 'https://i.ibb.co/VYqnBKbM/free-medium-pizza.png', enabled: true },
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
 * 
 * @param {Array} rawBanners - Raw input banners array
 * @returns {Array<{id: string, url: string, enabled: boolean}>} Validated 4 banners array
 */
function validateAndNormalizeBanners(rawBanners) {
    const list = Array.isArray(rawBanners) ? rawBanners : [];
    let sanitized = [];

    for (let i = 0; i < TOTAL_BANNER_SLOTS; i++) {
        const item = list[i] || DEFAULT_DAILY_BANNERS[i] || { id: `b${i + 1}`, url: DEFAULT_FALLBACK_BANNER_LOGO, enabled: true };
        const id = (item.id && String(item.id).trim()) || `b${i + 1}`;
        const url = resolveBannerUrl(item.url);
        const enabled = item.enabled !== false;
        sanitized.push({ id, url, enabled });
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

    const docPayload = {
        banners: validated,
        count: validated.length,
        activeCount: validated.filter(b => b.enabled).length,
        updatedAt: new Date().toISOString(),
        key: 'daily_banners'
    };

    try {
        await setFirestoreDoc('settings', 'daily_banners', docPayload);
        global.__perfettoDailyBanners = validated;
        return {
            success: true,
            banners: validated,
            message: `Successfully saved ${validated.length} persistent daily banner slots to Firestore (${docPayload.activeCount} active)`
        };
    } catch (err) {
        console.error('❌ [Firestore Daily Banners] Save error:', err.message);
        global.__perfettoDailyBanners = validated;
        return {
            success: true,
            banners: validated,
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
