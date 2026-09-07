/**
 * Perfetto Pizza - Admin Management Helpers & Wallet Configuration Controller
 * Provides modular helpers for Admin Wallet & Cashback Slabs management
 */

export const DEFAULT_WALLET_CONFIG = {
    key: 'wallet_config',
    enabled: true,
    expiryDays: 15,
    cashbackExpiryDays: 15,
    minRedemptionOrder: 0,
    minOrderToRedeem: 0,
    slabs: [
        { minOrder: 350, cashback: 10 },
        { minOrder: 450, cashback: 40 },
        { minOrder: 700, cashback: 80 },
        { minOrder: 2000, cashback: 200 },
        { minOrder: 3000, cashback: 300 }
    ]
};

/**
 * Validates and normalizes wallet configuration
 * @param {Object} raw 
 * @returns {Object}
 */
export function normalizeWalletConfig(raw) {
    if (!raw || typeof raw !== 'object') {
        return JSON.parse(JSON.stringify(DEFAULT_WALLET_CONFIG));
    }

    const enabled = raw.enabled !== false;
    const rawExpiry = raw.cashbackExpiryDays !== undefined ? raw.cashbackExpiryDays : raw.expiryDays;
    const expiryDays = Math.min(30, Math.max(1, parseInt(rawExpiry, 10) || DEFAULT_WALLET_CONFIG.expiryDays));
    const minRedemptionOrder = 0;
    const minOrderToRedeem = 0;

    let slabs = Array.isArray(raw.slabs) ? [...raw.slabs] : [];
    if (slabs.length < 5) {
        for (let i = slabs.length; i < 5; i++) {
            const prevMin = i > 0 ? (slabs[i - 1].minOrder || 0) : 0;
            const prevCb = i > 0 ? (slabs[i - 1].cashback || 0) : 0;
            const def = DEFAULT_WALLET_CONFIG.slabs[i];
            slabs.push({
                minOrder: Math.max(def.minOrder, prevMin + 1000),
                cashback: Math.max(def.cashback, prevCb + 100)
            });
        }
    }

    slabs = slabs.slice(0, 5).map((s, idx) => ({
        minOrder: (s.minOrder !== undefined && !isNaN(parseFloat(s.minOrder)))
            ? Math.max(0, parseFloat(s.minOrder))
            : (DEFAULT_WALLET_CONFIG.slabs[idx] ? DEFAULT_WALLET_CONFIG.slabs[idx].minOrder : 0),
        cashback: (s.cashback !== undefined && !isNaN(parseFloat(s.cashback)))
            ? Math.max(0, parseFloat(s.cashback))
            : (DEFAULT_WALLET_CONFIG.slabs[idx] ? DEFAULT_WALLET_CONFIG.slabs[idx].cashback : 0)
    }));

    return {
        key: 'wallet_config',
        enabled,
        expiryDays,
        cashbackExpiryDays: expiryDays,
        minRedemptionOrder,
        minOrderToRedeem,
        slabs
    };
}

/**
 * Calculates exact eligible cashback reward for a given order total based on active slabs.
 * If generateRandom is true, generates a fair uniformly distributed random integer:
 * - Slab 1: between ₹1 and Slab 1 max inclusive.
 * - Slabs 2-5: between previous slab max and current slab max inclusive.
 * @param {number} orderAmount 
 * @param {Object} walletConfig 
 * @param {boolean} [generateRandom=false] 
 * @returns {number}
 */
export function calculateEligibleCashback(orderAmount, walletConfig = DEFAULT_WALLET_CONFIG, generateRandom = false) {
    if (!walletConfig || walletConfig.enabled === false || orderAmount <= 0) return 0;
    const rawSlabs = walletConfig.slabs || walletConfig.rewardTiers || walletConfig.cashbackTiers || walletConfig.rewards || DEFAULT_WALLET_CONFIG.slabs;
    
    // Sort slabs ascending by minOrder
    const sorted = [...rawSlabs].map(s => ({
        minOrder: Number(s.minOrder !== undefined ? s.minOrder : (s.min !== undefined ? s.min : (s.minAmount !== undefined ? s.minAmount : s.threshold))) || 0,
        cashback: Number(s.cashback !== undefined ? s.cashback : (s.reward !== undefined ? s.reward : (s.amount !== undefined ? s.amount : s.wonAmount))) || 0
    })).sort((a, b) => a.minOrder - b.minOrder);

    let qualifiedIndex = -1;
    for (let i = 0; i < sorted.length; i++) {
        if (orderAmount >= sorted[i].minOrder) {
            qualifiedIndex = i;
        }
    }
    if (qualifiedIndex === -1) return 0;

    const currentMax = Number(sorted[qualifiedIndex].cashback) || 0;
    if (!generateRandom) {
        return currentMax;
    }

    if (qualifiedIndex === 0) {
        const min = 1;
        const max = Math.max(1, currentMax);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
        const prevMax = Number(sorted[qualifiedIndex - 1].cashback) || 1;
        const min = Math.min(prevMax, currentMax);
        const max = Math.max(prevMax, currentMax);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

/**
 * Returns boundaries [min, max] for a given order total
 * - Slab 1: [1, Slab 1 max]
 * - Slabs 2-5: [Slab(i-1) max, Slab(i) max]
 * @param {number} orderAmount 
 * @param {Object} walletConfig 
 * @returns {{ qualified: boolean, min: number, max: number, tierIndex: number }}
 */
export function getCashbackTierBoundaries(orderAmount, walletConfig = DEFAULT_WALLET_CONFIG) {
    if (!walletConfig || walletConfig.enabled === false || orderAmount <= 0) {
        return { qualified: false, min: 0, max: 0, tierIndex: -1 };
    }
    const rawSlabs = walletConfig.slabs || DEFAULT_WALLET_CONFIG.slabs;
    const sorted = [...rawSlabs].sort((a, b) => (Number(a.minOrder) || 0) - (Number(b.minOrder) || 0));
    let qualifiedIndex = -1;
    for (let i = 0; i < sorted.length; i++) {
        if (orderAmount >= (Number(sorted[i].minOrder) || 0)) {
            qualifiedIndex = i;
        }
    }
    if (qualifiedIndex === -1) return { qualified: false, min: 0, max: 0, tierIndex: -1 };

    const max = Number(sorted[qualifiedIndex].cashback) || 0;
    let min = 1;
    if (qualifiedIndex > 0) {
        min = Number(sorted[qualifiedIndex - 1].cashback) || 1;
    }
    if (max < min) min = Math.max(1, Math.min(min, max));

    return { qualified: true, min, max, tierIndex: qualifiedIndex };
}

// --------------------------------------------------------------------------
// STORE NOTICE CONFIGURATION & HELPERS
// --------------------------------------------------------------------------
export const DEFAULT_STORE_NOTICE = {
    key: 'store_notice',
    active: true,
    enabled: true,
    title: 'Store Notice',
    content: 'Welcome to Perfetto Pizza Plus! We take pride in serving freshly baked pizzas, delicious burgers, wraps, and fast food delights. For any special catering or bulk party orders, contact customer support.',
    text: 'Welcome to Perfetto Pizza Plus! We take pride in serving freshly baked pizzas, delicious burgers, wraps, and fast food delights. For any special catering or bulk party orders, contact customer support.',
    updatedAt: null
};

/**
 * Counts words in a string
 * @param {string} text 
 * @returns {number}
 */
export function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Counts characters in a string
 * @param {string} text 
 * @returns {number}
 */
export function countCharacters(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.length;
}

/**
 * Validates and normalizes store notice object (enforces 500 characters and 12 lines maximum)
 * @param {Object} raw 
 * @returns {Object}
 */
export function normalizeStoreNotice(raw) {
    if (!raw || typeof raw !== 'object') {
        return JSON.parse(JSON.stringify(DEFAULT_STORE_NOTICE));
    }

    const active = raw.active !== undefined ? Boolean(raw.active) : (raw.enabled !== false);
    const title = (raw.title && typeof raw.title === 'string' && raw.title.trim())
        ? raw.title.trim().slice(0, 100)
        : DEFAULT_STORE_NOTICE.title;
    const rawContent = typeof raw.content === 'string'
        ? raw.content
        : (typeof raw.text === 'string' ? raw.text : (DEFAULT_STORE_NOTICE.content || ''));

    // Clamp to 12 lines and 500 characters
    const lines = rawContent.split('\n').slice(0, 12);
    const content = lines.join('\n').slice(0, 500);

    return {
        key: 'store_notice',
        active,
        enabled: active,
        title,
        content,
        text: content,
        characterCount: content.length,
        lineCount: content.split('\n').length,
        updatedAt: raw.updatedAt || null
    };
}

// --------------------------------------------------------------------------
// 4-SLOT PERSISTENT DAILY BANNERS CONFIGURATION & HELPERS
// --------------------------------------------------------------------------
export const DEFAULT_FALLBACK_BANNER_LOGO = 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';

export const DEFAULT_DAILY_BANNERS = [
    { id: 'b1', url: 'https://i.ibb.co/GQtdNF4v/free-cold-drink.png', enabled: true },
    { id: 'b2', url: 'https://i.ibb.co/kVpH7yM2/free-kitkat-shake.png', enabled: true },
    { id: 'b3', url: 'https://i.ibb.co/VYqnBKbM/free-medium-pizza.png', enabled: true },
    { id: 'b4', url: 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png', enabled: true }
];

/**
 * Validates and normalizes banner slots into strictly 4 persistent slots.
 * Ensures at least 1 banner remains active.
 * @param {Array} raw 
 * @returns {Array<{id: string, url: string, enabled: boolean}>}
 */
export function normalizeDailyBanners(raw) {
    const list = Array.isArray(raw) ? raw : [];
    let normalized = [];
    for (let i = 0; i < 4; i++) {
        const item = list[i] || DEFAULT_DAILY_BANNERS[i] || { id: `b${i + 1}`, url: DEFAULT_FALLBACK_BANNER_LOGO, enabled: true };
        const url = (item.url && typeof item.url === 'string' && item.url.trim().length >= 4)
            ? item.url.trim()
            : DEFAULT_FALLBACK_BANNER_LOGO;
        normalized.push({
            id: (item.id && String(item.id).trim()) || `b${i + 1}`,
            url,
            enabled: item.enabled !== false
        });
    }

    if (!normalized.some(b => b.enabled)) {
        normalized[0].enabled = true;
    }
    return normalized;
}

