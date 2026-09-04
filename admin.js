/**
 * Perfetto Pizza - Admin Management Helpers & Wallet Configuration Controller
 * Provides modular helpers for Admin Wallet & Cashback Slabs management
 */

export const DEFAULT_WALLET_CONFIG = {
    key: 'wallet_config',
    enabled: true,
    expiryDays: 7,
    minRedemptionOrder: 200,
    slabs: [
        { minOrder: 200, cashback: 20 },
        { minOrder: 500, cashback: 50 },
        { minOrder: 1000, cashback: 100 },
        { minOrder: 2000, cashback: 200 }
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
    const expiryDays = Math.max(1, parseInt(raw.expiryDays, 10) || DEFAULT_WALLET_CONFIG.expiryDays);
    const minRedemptionOrder = Math.max(0, parseFloat(raw.minRedemptionOrder) || DEFAULT_WALLET_CONFIG.minRedemptionOrder);

    const slabs = Array.isArray(raw.slabs) && raw.slabs.length >= 4
        ? raw.slabs.map((s, idx) => ({
            minOrder: Math.max(0, parseFloat(s.minOrder) || DEFAULT_WALLET_CONFIG.slabs[idx].minOrder),
            cashback: Math.max(0, parseFloat(s.cashback) || DEFAULT_WALLET_CONFIG.slabs[idx].cashback)
        }))
        : DEFAULT_WALLET_CONFIG.slabs;

    return {
        key: 'wallet_config',
        enabled,
        expiryDays,
        minRedemptionOrder,
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
