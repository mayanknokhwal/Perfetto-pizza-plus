/**
 * Perfetto Pizza - Daily Banners Service & Fallback Logo System
 * Firestore Collection: 'settings', Document: 'daily_banners'
 * Enforces Min 2, Max 7 banner bounds with automatic fallback to official Perfetto Pizza logo.
 */

try {
    require('dotenv').config();
} catch (e) { }

require('./globalStores');
const { getFirestoreDoc, setFirestoreDoc } = require('./firestore');

// Official Perfetto Pizza Default Logo Fallback Constant
const DEFAULT_FALLBACK_BANNER_LOGO = 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';

// Official 3 Valid Default Daily Banner URLs
const DEFAULT_DAILY_BANNERS = [
    { id: 'b1', url: 'https://i.ibb.co/GQtdNF4v/free-cold-drink.png' },
    { id: 'b2', url: 'https://i.ibb.co/kVpH7yM2/free-kitkat-shake.png' },
    { id: 'b3', url: 'https://i.ibb.co/VYqnBKbM/free-medium-pizza.png' }
];

const MIN_BANNERS_COUNT = 2;
const MAX_BANNERS_COUNT = 7;

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
 * Validates and normalizes a list of banner items.
 * Ensures:
 * - Structure: [ { id: '...', url: '...' }, ... ]
 * - Bounds: Min 2, Max 7 items
 * - Fallback: Any invalid URL resolves to DEFAULT_FALLBACK_BANNER_LOGO
 * 
 * @param {Array} rawBanners - Raw input banners array
 * @returns {Array<{id: string, url: string}>} Validated banners array
 */
function validateAndNormalizeBanners(rawBanners) {
    if (!Array.isArray(rawBanners) || rawBanners.length === 0) {
        return JSON.parse(JSON.stringify(DEFAULT_DAILY_BANNERS));
    }

    let sanitized = rawBanners
        .filter(item => item && typeof item === 'object')
        .map((item, index) => {
            const id = (item.id && String(item.id).trim()) || `b${index + 1}`;
            const url = resolveBannerUrl(item.url);
            return { id, url };
        });

    // Enforce Minimum (2 items): Pad with default banners if fewer than 2
    if (sanitized.length < MIN_BANNERS_COUNT) {
        DEFAULT_DAILY_BANNERS.forEach(defBanner => {
            if (sanitized.length < MIN_BANNERS_COUNT && !sanitized.some(s => s.id === defBanner.id || s.url === defBanner.url)) {
                sanitized.push({ ...defBanner });
            }
        });
    }

    // If still less than 2, fallback completely to default 3
    if (sanitized.length < MIN_BANNERS_COUNT) {
        sanitized = JSON.parse(JSON.stringify(DEFAULT_DAILY_BANNERS));
    }

    // Enforce Maximum (7 items)
    if (sanitized.length > MAX_BANNERS_COUNT) {
        sanitized = sanitized.slice(0, MAX_BANNERS_COUNT);
    }

    return sanitized;
}

/**
 * Fetches daily banners from Firestore ('settings/daily_banners').
 * Falls back seamlessly to the 3 valid default banners if document is not found or empty.
 * @returns {Promise<Array<{id: string, url: string}>>}
 */
async function fetchDailyBannersFromFirestore() {
    try {
        const doc = await getFirestoreDoc('settings', 'daily_banners');
        if (doc && Array.isArray(doc.banners) && doc.banners.length >= MIN_BANNERS_COUNT) {
            const normalized = validateAndNormalizeBanners(doc.banners);
            global.__perfettoDailyBanners = normalized;
            return normalized;
        }
    } catch (err) {
        console.warn('⚠️ [Firestore Daily Banners] Read notice:', err.message);
    }

    // Fallback to runtime memory cache or default 3 banners
    if (!global.__perfettoDailyBanners || !Array.isArray(global.__perfettoDailyBanners) || global.__perfettoDailyBanners.length < MIN_BANNERS_COUNT) {
        global.__perfettoDailyBanners = JSON.parse(JSON.stringify(DEFAULT_DAILY_BANNERS));
    }
    return global.__perfettoDailyBanners;
}

/**
 * Saves daily banners to Firestore ('settings/daily_banners').
 * Validates array structure (Min 2, Max 7).
 * @param {Array<{id: string, url: string}>} bannersList
 * @returns {Promise<{success: boolean, banners: Array<{id: string, url: string}>, message: string}>}
 */
async function saveDailyBannersToFirestore(bannersList) {
    const validated = validateAndNormalizeBanners(bannersList);

    const docPayload = {
        banners: validated,
        count: validated.length,
        updatedAt: new Date().toISOString(),
        key: 'daily_banners'
    };

    try {
        await setFirestoreDoc('settings', 'daily_banners', docPayload);
        global.__perfettoDailyBanners = validated;
        return {
            success: true,
            banners: validated,
            message: `Successfully saved ${validated.length} daily banners to Firestore`
        };
    } catch (err) {
        console.error('❌ [Firestore Daily Banners] Save error:', err.message);
        global.__perfettoDailyBanners = validated; // Keep updated in memory fallback
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
    MIN_BANNERS_COUNT,
    MAX_BANNERS_COUNT,
    resolveBannerUrl,
    validateAndNormalizeBanners,
    fetchDailyBannersFromFirestore,
    saveDailyBannersToFirestore
};
