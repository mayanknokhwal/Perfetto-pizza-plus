/**
 * Perfetto Pizza - Admin Management Helpers & Wallet Configuration Controller
 * Provides modular helpers for Admin Wallet & Cashback Slabs management
 */

export const DEFAULT_WALLET_CONFIG = {
    key: 'wallet_config',
    enabled: true,
    expiryDays: 7,
    minRedemptionOrder: 0,
    minOrderToRedeem: 0,
    slabs: [
        { minOrder: 200, cashback: 20 },
        { minOrder: 500, cashback: 50 },
        { minOrder: 1000, cashback: 100 },
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
    const expiryDays = Math.min(30, Math.max(1, parseInt(raw.expiryDays, 10) || DEFAULT_WALLET_CONFIG.expiryDays));
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
        minOrder: Math.max(0, parseFloat(s.minOrder) || DEFAULT_WALLET_CONFIG.slabs[idx].minOrder),
        cashback: Math.max(0, parseFloat(s.cashback) || DEFAULT_WALLET_CONFIG.slabs[idx].cashback)
    }));

    return {
        key: 'wallet_config',
        enabled,
        expiryDays,
        minRedemptionOrder,
        minOrderToRedeem,
        slabs
    };
}

/**
 * Calculates eligible cashback amount for a given order total based on active slabs
 * @param {number} orderAmount 
 * @param {Object} walletConfig 
 * @returns {number}
 */
export function calculateEligibleCashback(orderAmount, walletConfig = DEFAULT_WALLET_CONFIG) {
    if (!walletConfig || walletConfig.enabled === false) return 0;
    const slabs = walletConfig.slabs || DEFAULT_WALLET_CONFIG.slabs;
    
    // Sort slabs descending by minOrder
    const sorted = [...slabs].sort((a, b) => b.minOrder - a.minOrder);
    for (const slab of sorted) {
        if (orderAmount >= slab.minOrder) {
            return slab.cashback;
        }
    }
    return 0;
}

// --------------------------------------------------------------------------
// STORE NOTICE CONFIGURATION & HELPERS
// --------------------------------------------------------------------------
export const DEFAULT_STORE_NOTICE = {
    key: 'store_notice',
    enabled: true,
    title: 'Store Notice',
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
 * Validates and normalizes store notice object
 * @param {Object} raw 
 * @returns {Object}
 */
export function normalizeStoreNotice(raw) {
    if (!raw || typeof raw !== 'object') {
        return JSON.parse(JSON.stringify(DEFAULT_STORE_NOTICE));
    }

    const enabled = raw.enabled !== false;
    const title = (raw.title && typeof raw.title === 'string' && raw.title.trim())
        ? raw.title.trim()
        : DEFAULT_STORE_NOTICE.title;
    const text = typeof raw.text === 'string' ? raw.text : (DEFAULT_STORE_NOTICE.text || '');

    return {
        key: 'store_notice',
        enabled,
        title,
        text,
        updatedAt: raw.updatedAt || null
    };
}
