/**
 * PERFETTO PIZZA - WEB APPLICATION LOGIC
 * Dynamic Theme Switcher, Sticky Header Logo Switcher,
 * Fixed Bottom Navigation Controller & Fast Food Interaction
 */

// --------------------------------------------------------------------------
// 1. CONSTANTS & DOM ELEMENTS
// --------------------------------------------------------------------------
const LOGO_LIGHT = 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';
const LOGO_DARK = 'https://i.ibb.co/BH6TR6dh/perfetto-White.png';

const htmlElement = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');
const appLogo = document.getElementById('app-logo');
const navItems = document.querySelectorAll('.nav-item');
const tabViews = document.querySelectorAll('.tab-view');
const cartBadge = document.getElementById('cart-badge-count');
const cartContainer = document.getElementById('cart-items-container');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// Price Formatter Helper: Whole numbers only (e.g. ₹299), with strict zero-NaN & non-negative guards
function formatPrice(amount) {
    const num = Number(amount);
    if (isNaN(num) || !isFinite(num)) {
        return '₹0';
    }
    return `₹${Math.max(0, Math.round(num))}`;
}
window.formatPrice = formatPrice;

// Global HTML / Attribute Sanitizer Helper
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

// Robust In-Memory Backed Storage Helpers (Private Browsing & Storage Quota Resilience)
const memoryStorageFallback = {};
const memorySessionFallback = {};

const safeStorage = {
    getItem: (key) => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const val = window.localStorage.getItem(key);
                if (val !== null && val !== undefined) return val;
            }
        } catch (e) { }
        return memoryStorageFallback[key] !== undefined ? memoryStorageFallback[key] : null;
    },
    setItem: (key, val) => {
        const strVal = String(val);
        memoryStorageFallback[key] = strVal;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, strVal);
            }
        } catch (e) { }
    },
    removeItem: (key) => {
        delete memoryStorageFallback[key];
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } catch (e) { }
    },
    getJSON: (key, fallback = null) => {
        try {
            const raw = safeStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return (parsed !== null && parsed !== undefined) ? parsed : fallback;
        } catch (e) {
            return fallback;
        }
    },
    setJSON: (key, val) => {
        try {
            const str = JSON.stringify(val);
            safeStorage.setItem(key, str);
        } catch (e) { }
    }
};
window.safeStorage = safeStorage;

const safeSessionStorage = {
    getItem: (key) => {
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                const val = window.sessionStorage.getItem(key);
                if (val !== null && val !== undefined) return val;
            }
        } catch (e) { }
        return memorySessionFallback[key] !== undefined ? memorySessionFallback[key] : null;
    },
    setItem: (key, val) => {
        const strVal = String(val);
        memorySessionFallback[key] = strVal;
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.setItem(key, strVal);
            }
        } catch (e) { }
    },
    removeItem: (key) => {
        delete memorySessionFallback[key];
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                window.sessionStorage.removeItem(key);
            }
        } catch (e) { }
    }
};
window.safeSessionStorage = safeSessionStorage;

// Storage Prototype Hardening for Private Browsing & QuotaExceeded Protection
(function hardenStoragePrototypes() {
    try {
        if (typeof window === 'undefined' || typeof window.Storage === 'undefined' || !window.Storage.prototype) return;
        const origSetItem = window.Storage.prototype.setItem;
        const origGetItem = window.Storage.prototype.getItem;
        const origRemoveItem = window.Storage.prototype.removeItem;

        window.Storage.prototype.setItem = function (key, value) {
            const isSession = (typeof window.sessionStorage !== 'undefined' && this === window.sessionStorage);
            const str = String(value);
            try {
                origSetItem.call(this, key, str);
            } catch (err) {
                if (isSession) memorySessionFallback[key] = str;
                else memoryStorageFallback[key] = str;
            }
        };

        window.Storage.prototype.getItem = function (key) {
            const isSession = (typeof window.sessionStorage !== 'undefined' && this === window.sessionStorage);
            try {
                const val = origGetItem.call(this, key);
                if (val !== null && val !== undefined) return val;
            } catch (err) { }
            return isSession
                ? (memorySessionFallback[key] !== undefined ? memorySessionFallback[key] : null)
                : (memoryStorageFallback[key] !== undefined ? memoryStorageFallback[key] : null);
        };

        window.Storage.prototype.removeItem = function (key) {
            const isSession = (typeof window.sessionStorage !== 'undefined' && this === window.sessionStorage);
            if (isSession) delete memorySessionFallback[key];
            else delete memoryStorageFallback[key];
            try {
                origRemoveItem.call(this, key);
            } catch (err) { }
        };
    } catch (e) {
        // Storage prototype modifications restricted by host environment; safeStorage remains active
    }
})();

// Centralized Localization Helper Bridge
function t(key, params) {
    if (typeof window !== 'undefined' && typeof window.perfettoTranslate === 'function') {
        return window.perfettoTranslate(key, params);
    }
    return key;
}
function tItem(name) {
    if (typeof window !== 'undefined' && typeof window.perfettoTranslateItem === 'function') {
        return window.perfettoTranslateItem(name);
    }
    return name;
}
function tCategory(cat) {
    if (typeof window !== 'undefined' && typeof window.perfettoTranslateCategory === 'function') {
        return window.perfettoTranslateCategory(cat);
    }
    return cat;
}
function tAddon(addon) {
    if (typeof window !== 'undefined' && typeof window.perfettoTranslateAddon === 'function') {
        return window.perfettoTranslateAddon(addon);
    }
    return addon;
}

// Global hook for instant reactive re-rendering across the app when language changes
window.onAppLanguageChanged = function (newLang) {
    // 1. Re-render Category Detail if open
    if (activeTabName === 'category-detail' && lastCategoryState.categoryName) {
        openCategoryDetail(lastCategoryState.categoryName, lastCategoryState.categoryImg, true, true);
    }
    // 2. Refresh Cart UI
    if (typeof updateCartUI === 'function') {
        updateCartUI();
    }
    // 3. Refresh Profile UI & Wallet
    if (typeof updateProfileWalletUI === 'function') {
        updateProfileWalletUI();
    }
    if (typeof updateProfileTotalsUI === 'function') {
        updateProfileTotalsUI();
    }
    // 4. Refresh Checkout Wallet UI if modal is open
    const checkoutModal = document.getElementById('checkout-modal');
    if (checkoutModal && checkoutModal.style.display !== 'none' && typeof updateCheckoutWalletUI === 'function') {
        updateCheckoutWalletUI();
    }
    // 5. Update header search input placeholder
    const searchInput = document.getElementById('customer-search-input');
    if (searchInput && typeof t === 'function') {
        searchInput.placeholder = t('search_placeholder');
    }
    // 6. Update Sticky Floating Cart Bar
    if (typeof updateFloatingCartBar === 'function') {
        updateFloatingCartBar();
    }
    // 7. Update Profile Language Pills & Subtitle
    const pillEn = document.getElementById('profile-pill-en');
    if (pillEn) pillEn.classList.toggle('active', newLang === 'en');
    const pillHi = document.getElementById('profile-pill-hi');
    if (pillHi) pillHi.classList.toggle('active', newLang === 'hi');
    const profSub = document.getElementById('profile-lang-subtitle');
    if (profSub) {
        profSub.textContent = newLang === 'hi' ? 'हिंदी (सक्रिय)' : 'English (Active)';
    }
    // 8. Update Notice preview chip if using default
    const noticePreview = document.getElementById('home-notice-chip-preview');
    if (noticePreview) {
        const rawSaved = localStorage.getItem('perfetto_store_notice');
        if (!rawSaved || !rawSaved.trim()) {
            noticePreview.textContent = newLang === 'hi'
                ? 'स्टोर घोषणाएं और जानकारी देखने के लिए क्लिक करें'
                : 'Click to view store announcements & info';
        }
    }
};

// Cart State & Persistence
const CART_STORAGE_KEY = 'perfetto_pizza_cart';
const DELIVERY_PROFILE_KEY = 'customerDeliveryProfile';
const VERIFIED_PHONE_STORAGE_KEY = 'perfetto_verified_phone';
const VERIFIED_PHONE_STATE_KEY = 'perfetto_phone_verification_state';
const CUSTOMER_CARE_PHONE_KEY = 'customerCarePhone';
const CUSTOMER_CARE_ENABLED_KEY = 'customerCareEnabled';
const DEFAULT_CUSTOMER_CARE_PHONE = '9876543210';

// CATEGORY ADD-ONS CONFIGURATION & REAL-TIME STATE
const DEFAULT_CATEGORY_ADDONS = {
    "Burger": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Wrap": {
        extraCheese: 30,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Bread": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Pizza": {
        sizes: {
            S: { extraCheese: 30, extraSpicy: 0, extraMayo: 20 },
            M: { extraCheese: 50, extraSpicy: 0, extraMayo: 30 },
            L: { extraCheese: 70, extraSpicy: 0, extraMayo: 40 }
        }
    },
    "Sandwich": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Momos": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Pasta": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Shake": {
        withIceCream: 30
    },
    "Chinese Food": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Noodles": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    },
    "Spring Rolls": {
        extraCheese: 25,
        extraSpicy: 0,
        extraMayo: 20
    }
};

let customerCategoryAddons = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ADDONS));

function getCustomerCategoryAddons(categoryName) {
    try {
        const saved = localStorage.getItem('perfetto_category_addons');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                customerCategoryAddons = { ...DEFAULT_CATEGORY_ADDONS, ...parsed };
            }
        }
    } catch (e) { }

    return customerCategoryAddons[categoryName] || DEFAULT_CATEGORY_ADDONS[categoryName] || { extraCheese: 25, extraSpicy: 0, extraMayo: 20 };
}

function getPizzaSizeAddonRates(size = 'M') {
    const pAddons = getCustomerCategoryAddons('Pizza');
    if (pAddons && pAddons.sizes && pAddons.sizes[size]) {
        return {
            extraCheese: pAddons.sizes[size].extraCheese !== undefined ? pAddons.sizes[size].extraCheese : (size === 'S' ? 30 : (size === 'M' ? 50 : 70)),
            extraSpicy: pAddons.sizes[size].extraSpicy !== undefined ? pAddons.sizes[size].extraSpicy : 0,
            extraMayo: pAddons.sizes[size].extraMayo !== undefined ? pAddons.sizes[size].extraMayo : (size === 'S' ? 20 : (size === 'M' ? 30 : 40))
        };
    }
    const defaults = {
        S: { extraCheese: 30, extraSpicy: 0, extraMayo: 20 },
        M: { extraCheese: 50, extraSpicy: 0, extraMayo: 30 },
        L: { extraCheese: 70, extraSpicy: 0, extraMayo: 40 }
    };
    return defaults[size] || { extraCheese: 50, extraSpicy: 0, extraMayo: 30 };
}

// --------------------------------------------------------------------------
// INLINE CARD ADD-ON EMOJI SELECTORS (S/M/L BADGE STYLE) & DYNAMIC PRICING
// --------------------------------------------------------------------------
const cardSelectedAddons = {}; // itemId -> { cheese: boolean, spicy: boolean, mayo: boolean }

function toggleCardAddon(categoryName, itemId, addonType, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!cardSelectedAddons[itemId]) {
        cardSelectedAddons[itemId] = { cheese: false, spicy: false, mayo: false };
    }

    cardSelectedAddons[itemId][addonType] = !cardSelectedAddons[itemId][addonType];
    const isSelected = cardSelectedAddons[itemId][addonType];

    // Update box / chip element active state
    const boxEl = document.getElementById(`box-${addonType}-${itemId}`) || document.getElementById(`chip-${addonType}-${itemId}`);
    if (boxEl) {
        if (isSelected) {
            boxEl.classList.add('active', 'selected', `active-${addonType}`);
        } else {
            boxEl.classList.remove('active', 'selected', `active-${addonType}`);
        }
    }

    // Recalculate card total price
    const catAddons = getCustomerCategoryAddons(categoryName);
    const cheeseRate = catAddons.extraCheese !== undefined ? catAddons.extraCheese : (categoryName === 'Wrap' ? 30 : 25);
    const spicyRate = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
    const mayoRate = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

    const allItems = getAllCustomerMenuItems();
    const itemObj = allItems.find(i => i.id === itemId);
    const basePrice = (itemObj && itemObj.price) ? itemObj.price : 99;

    let total = basePrice;
    if (cardSelectedAddons[itemId].cheese) total += cheeseRate;
    if (cardSelectedAddons[itemId].spicy) total += spicyRate;
    if (cardSelectedAddons[itemId].mayo) total += mayoRate;

    const priceEl = document.getElementById(`card-price-${itemId}`) || document.getElementById(`price-${itemId}`);
    if (priceEl) {
        priceEl.textContent = formatPrice(total);
        priceEl.classList.add('price-pop-active');
        clearTimeout(priceEl._popTimer);
        priceEl._popTimer = setTimeout(() => {
            priceEl.classList.remove('price-pop-active');
        }, 150);
    }

    // Top Drop-Down Toast Notification with smooth 1.8s auto-dismiss
    if (addonType === 'cheese') {
        showToast(isSelected ? 'Added extra cheese' : 'Removed extra cheese', 1800);
    } else if (addonType === 'spicy') {
        showToast(isSelected ? 'Added extra spicy' : 'Removed extra spicy', 1800);
    } else if (addonType === 'mayo') {
        showToast(isSelected ? 'Added extra mayo' : 'Removed extra mayo', 1800);
    }
}
window.toggleCardAddon = toggleCardAddon;
window.toggleBurgerCardAddon = function(itemId, addonType, addonPrice, event) {
    toggleCardAddon('Burger', itemId, addonType, event);
};

function togglePizzaAddon(pizzaId, addonType, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!cardSelectedAddons[pizzaId]) {
        cardSelectedAddons[pizzaId] = { cheese: false, spicy: false, mayo: false };
    }

    cardSelectedAddons[pizzaId][addonType] = !cardSelectedAddons[pizzaId][addonType];
    const isSelected = cardSelectedAddons[pizzaId][addonType];

    const boxEl = document.getElementById(`box-${addonType}-${pizzaId}`);
    if (boxEl) {
        if (isSelected) {
            boxEl.classList.add('active', 'selected', `active-${addonType}`);
        } else {
            boxEl.classList.remove('active', 'selected', `active-${addonType}`);
        }
    }

    recalculatePizzaCardPrice(pizzaId);

    // Top Drop-Down Toast Notification with smooth 1.8s auto-dismiss
    if (addonType === 'cheese') {
        showToast(isSelected ? 'Added extra cheese' : 'Removed extra cheese', 1800);
    } else if (addonType === 'spicy') {
        showToast(isSelected ? 'Added extra spicy' : 'Removed extra spicy', 1800);
    } else if (addonType === 'mayo') {
        showToast(isSelected ? 'Added extra mayo' : 'Removed extra mayo', 1800);
    }
}
window.togglePizzaAddon = togglePizzaAddon;

function recalculatePizzaCardPrice(pizzaId) {
    const card = document.querySelector(`.pizza-card[data-pizza-id="${pizzaId}"]`);
    if (!card) return;

    const selectedSize = card.getAttribute('data-selected-size') || 'M';
    const pizzaList = getSubItems("Pizza");
    const item = pizzaList.find(p => p.id === pizzaId);
    const basePrice = (item && item.prices && item.prices[selectedSize]) || 299;

    const rates = getPizzaSizeAddonRates(selectedSize);
    const sel = cardSelectedAddons[pizzaId] || { cheese: false, spicy: false, mayo: false };

    let total = basePrice;
    if (sel.cheese) total += rates.extraCheese;
    if (sel.spicy) total += rates.extraSpicy;
    if (sel.mayo) total += rates.extraMayo;

    card.setAttribute('data-current-price', total);

    const priceEl = card.querySelector('.pizza-card-price') || document.getElementById(`price-${pizzaId}`);
    if (priceEl) {
        priceEl.textContent = formatPrice(total);
        priceEl.classList.add('price-pop-active');
        clearTimeout(priceEl._popTimer);
        priceEl._popTimer = setTimeout(() => {
            priceEl.classList.remove('price-pop-active');
        }, 150);
    }
}
window.recalculatePizzaCardPrice = recalculatePizzaCardPrice;

function toggleShakeIceCreamAddon(itemId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    if (!cardSelectedAddons[itemId]) {
        cardSelectedAddons[itemId] = { cheese: false, spicy: false, mayo: false, iceCream: false };
    }

    cardSelectedAddons[itemId].iceCream = !cardSelectedAddons[itemId].iceCream;
    const isSelected = cardSelectedAddons[itemId].iceCream;

    const btnEl = document.getElementById(`box-icecream-${itemId}`);
    if (btnEl) {
        if (isSelected) {
            btnEl.classList.add('active', 'selected');
        } else {
            btnEl.classList.remove('active', 'selected');
        }
    }

    const catAddons = getCustomerCategoryAddons('Shake');
    const iceCreamRate = catAddons.withIceCream !== undefined ? catAddons.withIceCream : 30;

    const allItems = getAllCustomerMenuItems();
    const itemObj = allItems.find(i => i.id === itemId);
    const basePrice = (itemObj && itemObj.price) ? itemObj.price : 119;

    let total = basePrice;
    if (cardSelectedAddons[itemId].iceCream) total += iceCreamRate;

    const priceEl = document.getElementById(`card-price-${itemId}`) || document.getElementById(`price-${itemId}`);
    if (priceEl) {
        priceEl.textContent = formatPrice(total);
        priceEl.classList.add('price-pop-active');
        clearTimeout(priceEl._popTimer);
        priceEl._popTimer = setTimeout(() => {
            priceEl.classList.remove('price-pop-active');
        }, 150);
    }

    showToast(isSelected ? 'Added Ice Cream' : 'Removed Ice Cream', 1800);
}
window.toggleShakeIceCreamAddon = toggleShakeIceCreamAddon;

function addCardWithAddonsToCart(categoryName, itemId, itemName, basePrice, itemImg) {
    const sel = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false, iceCream: false };
    const catAddons = getCustomerCategoryAddons(categoryName);
    
    const addons = [];
    let calculatedPrice = basePrice;

    if (categoryName === 'Shake') {
        const iceCreamRate = catAddons.withIceCream !== undefined ? catAddons.withIceCream : 30;
        if (sel.iceCream) {
            addons.push({ name: '🍨 With Ice Cream', price: iceCreamRate });
            calculatedPrice += iceCreamRate;
        }
    } else {
        const cheeseRate = catAddons.extraCheese !== undefined ? catAddons.extraCheese : (categoryName === 'Wrap' ? 30 : 25);
        const spicyRate = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
        const mayoRate = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

        if (sel.cheese) {
            addons.push({ name: 'Extra Cheese', price: cheeseRate });
            calculatedPrice += cheeseRate;
        }
        if (sel.spicy) {
            addons.push({ name: 'Extra Spicy', price: spicyRate });
            calculatedPrice += spicyRate;
        }
        if (sel.mayo) {
            addons.push({ name: '🍥 Extra Mayo', price: mayoRate });
            calculatedPrice += mayoRate;
        }
    }

    addToCart(itemName, calculatedPrice, itemImg, addons);
}
window.addCardWithAddonsToCart = addCardWithAddonsToCart;
window.addBurgerCardToCart = function(itemId, itemName, basePrice, itemImg) {
    addCardWithAddonsToCart('Burger', itemId, itemName, basePrice, itemImg);
};

function getStoredVerifiedPhone() {
    try {
        // 1. Check direct verified phone key
        const direct = safeStorage.getItem(VERIFIED_PHONE_STORAGE_KEY) || safeSessionStorage.getItem(VERIFIED_PHONE_STORAGE_KEY);
        if (direct && typeof direct === 'string') {
            const clean = direct.replace(/[^0-9]/g, '').slice(-10);
            if (clean.length === 10) return clean;
        }

        // 2. Check structured verified phone state object
        const parsedState = safeStorage.getJSON(VERIFIED_PHONE_STATE_KEY, null);
        if (parsedState && parsedState.isVerified && parsedState.phone) {
            const clean = String(parsedState.phone).replace(/[^0-9]/g, '').slice(-10);
            if (clean.length === 10) return clean;
        }

        // 3. Check delivery profile if marked isVerified
        const parsedProfile = safeStorage.getJSON(DELIVERY_PROFILE_KEY, null);
        if (parsedProfile && parsedProfile.isVerified && parsedProfile.phone) {
            const clean = String(parsedProfile.phone).replace(/[^0-9]/g, '').slice(-10);
            if (clean.length === 10) return clean;
        }
    } catch (e) {
        console.warn('Error reading stored verified phone:', e);
    }
    return null;
}

function setStoredPhoneVerified(phone, isVerified = true) {
    if (!phone) return;
    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) return;

    try {
        if (isVerified) {
            safeStorage.setItem(VERIFIED_PHONE_STORAGE_KEY, cleanPhone);
            safeSessionStorage.setItem(VERIFIED_PHONE_STORAGE_KEY, cleanPhone);
            safeStorage.setJSON(VERIFIED_PHONE_STATE_KEY, {
                phone: cleanPhone,
                isVerified: true,
                verifiedAt: new Date().toISOString()
            });

            // Sync with existing delivery profile if present
            const profile = safeStorage.getJSON(DELIVERY_PROFILE_KEY, null);
            if (profile && typeof profile === 'object') {
                profile.phone = cleanPhone;
                profile.isVerified = true;
                safeStorage.setJSON(DELIVERY_PROFILE_KEY, profile);
            }

            // Immediately restore permanent wallet balance & order history for verified phone
            setTimeout(() => {
                if (typeof restoreUserProfileFromFirestore === 'function') {
                    restoreUserProfileFromFirestore(cleanPhone, { silent: true });
                }
            }, 50);
        } else {
            safeStorage.removeItem(VERIFIED_PHONE_STORAGE_KEY);
            safeSessionStorage.removeItem(VERIFIED_PHONE_STORAGE_KEY);
            safeStorage.removeItem(VERIFIED_PHONE_STATE_KEY);

            const profile = safeStorage.getJSON(DELIVERY_PROFILE_KEY, null);
            if (profile && typeof profile === 'object') {
                profile.isVerified = false;
                safeStorage.setJSON(DELIVERY_PROFILE_KEY, profile);
            }
        }
    } catch (e) {
        console.warn('Error writing stored verified phone:', e);
    }
}

function applyPhoneVerifiedUI(verified, phoneNumber = '') {
    const badge = document.getElementById('phone-verified-badge');
    const changeBtn = document.getElementById('btn-change-phone');
    const verifyBtn = document.getElementById('btn-request-otp');
    const otpBox = document.getElementById('otp-verification-box');
    const phoneInput = document.getElementById('customer-phone');

    if (verified) {
        isPhoneVerified = true;
        if (badge) {
            badge.style.display = 'inline-flex';
            badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verified';
        }
        if (changeBtn) changeBtn.style.display = 'inline-flex';
        if (verifyBtn) verifyBtn.style.display = 'none';
        if (otpBox) otpBox.style.display = 'none';

        if (phoneInput) {
            if (phoneNumber) {
                phoneInput.value = String(phoneNumber).replace(/[^0-9]/g, '').slice(-10);
            }
            phoneInput.readOnly = true;
            phoneInput.classList.remove('invalid-field');
            phoneInput.style.backgroundColor = 'var(--bg-surface-elevated)';
            phoneInput.style.cursor = 'not-allowed';
        }
    } else {
        isPhoneVerified = false;
        if (badge) badge.style.display = 'none';
        if (changeBtn) changeBtn.style.display = 'none';
        if (verifyBtn) {
            verifyBtn.style.display = 'inline-flex';
            const currentLen = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').length : 0;
            verifyBtn.disabled = currentLen !== 10;
            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
        }
        if (otpBox) otpBox.style.display = 'none';

        if (phoneInput) {
            phoneInput.readOnly = false;
            phoneInput.style.backgroundColor = 'var(--bg-input)';
            phoneInput.style.cursor = 'text';
        }
    }
}

function initPhoneVerificationState() {
    const phoneInput = document.getElementById('customer-phone');
    const storedVerifiedPhone = getStoredVerifiedPhone();

    if (storedVerifiedPhone) {
        isPhoneVerified = true;
        currentTargetPhone = '91' + storedVerifiedPhone;
        if (phoneInput && (!phoneInput.value || phoneInput.value.trim() === '')) {
            phoneInput.value = storedVerifiedPhone;
        }
        applyPhoneVerifiedUI(true, storedVerifiedPhone);
    } else {
        const currentVal = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').slice(-10) : '';
        applyPhoneVerifiedUI(false, currentVal);
    }
}

function getCustomerCarePhone() {
    try {
        const stored = localStorage.getItem(CUSTOMER_CARE_PHONE_KEY);
        if (stored && stored.trim() !== '') {
            const digits = stored.replace(/[^0-9]/g, '').slice(-10);
            return digits || DEFAULT_CUSTOMER_CARE_PHONE;
        }
    } catch (e) {
        console.warn('Failed to read customerCarePhone from localStorage:', e);
    }
    return DEFAULT_CUSTOMER_CARE_PHONE;
}

function getCustomerCareEnabled() {
    try {
        const stored = localStorage.getItem(CUSTOMER_CARE_ENABLED_KEY);
        return stored === null ? true : stored === 'true';
    } catch (e) {
        console.warn('Failed to read customerCareEnabled from localStorage:', e);
        return true;
    }
}

// --------------------------------------------------------------------------
// API BASE URL & ENVIRONMENT RESOLVER
// --------------------------------------------------------------------------
const API_BASE_URL = (typeof window !== 'undefined' && (window.PERFETTO_API_BASE_URL || window.API_BASE_URL)) || '/api';

function resolveApiUrl(path) {
    if (!path) return API_BASE_URL;
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    if (cleanPath.startsWith('/api')) {
        if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && window.location.protocol !== 'file:') {
            return `${window.location.origin}${cleanPath}`;
        }
        return cleanPath;
    }
    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    if (typeof window !== 'undefined' && window.location && window.location.origin && base.startsWith('/')) {
        return `${window.location.origin}${base}${cleanPath}`;
    }
    return `${base}${cleanPath}`;
}

async function apiCall(endpoint, options = {}) {
    const url = resolveApiUrl(endpoint);
    const headers = {
        'Accept': 'application/json',
        ...(options.headers || {})
    };
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(url, { ...options, headers });
}

function getAppOrigin() {
    if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && window.location.protocol !== 'file:') {
        return window.location.origin;
    }
    return '';
}

function loadCartFromStorage() {
    const parsed = safeStorage.getJSON(CART_STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
}

function saveCartToStorage() {
    safeStorage.setJSON(CART_STORAGE_KEY, Array.isArray(cart) ? cart : []);
}

let cart = loadCartFromStorage();

// Navigation Retention State
let activeTabName = 'home';
let lastHomeScrollY = 0;
let lastCategoryState = {
    categoryName: null,
    categoryImg: null,
    scrollY: 0
};

// Scroll offset helper functions for seamless Home/Category navigation
function getHomeScrollPosition() {
    const mainContainer = document.getElementById('main-container');
    const homeView = document.getElementById('view-home');
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || (mainContainer ? mainContainer.scrollTop : 0) || (homeView ? homeView.scrollTop : 0) || 0;
}

function restoreHomeScrollPosition() {
    const targetY = lastHomeScrollY || 0;
    const applyScroll = () => {
        window.scrollTo({ top: targetY, behavior: 'instant' });
        const mainContainer = document.getElementById('main-container');
        if (mainContainer && mainContainer.scrollTop !== undefined && mainContainer.scrollTop !== targetY) {
            mainContainer.scrollTop = targetY;
        }
        const homeView = document.getElementById('view-home');
        if (homeView && homeView.scrollTop !== undefined && homeView.scrollTop !== targetY) {
            homeView.scrollTop = targetY;
        }
    };

    // Immediate attempt
    applyScroll();

    // Ensure scroll is reapplied on subsequent render frames and timeouts
    requestAnimationFrame(() => {
        applyScroll();
        setTimeout(applyScroll, 0);
        setTimeout(applyScroll, 50);
    });
}

function closeCategoryDetail() {
    // Explicit category back button resets memory to root home dashboard and restores Home scroll position
    lastCategoryState.categoryName = null;
    lastCategoryState.categoryImg = null;
    lastCategoryState.scrollY = 0;
    switchTab('home', true, false, true);
    restoreHomeScrollPosition();
}
window.closeCategoryDetail = closeCategoryDetail;

// --------------------------------------------------------------------------
// 2. THEME CONTROLLER & DYNAMIC LOGO SWITCHER
// --------------------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem('perfetto_theme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        htmlElement.setAttribute('data-theme', 'dark');
        if (appLogo) appLogo.src = LOGO_DARK;
    } else {
        htmlElement.setAttribute('data-theme', 'light');
        if (appLogo) appLogo.src = LOGO_LIGHT;
    }
    localStorage.setItem('perfetto_theme', theme);
}

function toggleTheme() {
    const currentTheme = htmlElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
}

if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
const categoryThemeToggleBtn = document.getElementById('category-theme-toggle');
if (categoryThemeToggleBtn) categoryThemeToggleBtn.addEventListener('click', toggleTheme);

// --------------------------------------------------------------------------
// PROFILE REDIRECTION NOTICE BANNER CONTROLLER
// --------------------------------------------------------------------------
function showProfileRedirectNotice(show) {
    const banner = document.getElementById('profile-redirect-notice');
    if (banner) {
        banner.style.display = show ? 'block' : 'none';
    }
}

// --------------------------------------------------------------------------
// 3. FIXED BOTTOM NAVIGATION TAB CONTROLLER
// --------------------------------------------------------------------------
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            if (targetTab === 'profile') {
                // When manually navigating to Profile tab, do not show the cart redirection banner
                showProfileRedirectNotice(false);
            }
            switchTab(targetTab);
        });
    });

    const backBtn = document.getElementById('category-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            closeCategoryDetail();
        });
    }
}

function switchTab(tabName, forceRootHome = false, isPopState = false, restoreHomeScroll = false) {
    // If accessing Cart, check if profile is complete. If new/incomplete, redirect to Profile completion
    if (tabName === 'cart') {
        const savedProfile = getSavedDeliveryProfile();
        if (!savedProfile) {
            tabName = 'profile';
            showProfileRedirectNotice(true);
            openEditProfileModal();
        }
    }

    // Save scroll position before leaving category-detail
    if (activeTabName === 'category-detail') {
        lastCategoryState.scrollY = window.scrollY || window.pageYOffset || 0;
    }

    // Smart retention: return to last category when navigating to home from another tab
    if (tabName === 'home' && !forceRootHome) {
        if (lastCategoryState.categoryName && activeTabName !== 'category-detail') {
            openCategoryDetail(lastCategoryState.categoryName, lastCategoryState.categoryImg, true, isPopState);
            return;
        } else if (activeTabName === 'category-detail') {
            // Clicking Home icon while already on category-detail resets to main home dashboard
            lastCategoryState.categoryName = null;
            lastCategoryState.categoryImg = null;
            lastCategoryState.scrollY = 0;
        }
    }

    // Push History State if not triggered by browser popstate
    if (!isPopState) {
        let hash = '#' + tabName;
        if (tabName === 'home' && !lastCategoryState.categoryName) hash = '#home';
        history.pushState({ page: tabName }, '', hash);
    }

    // 0. Toggle main header vs category hero bar visibility
    const mainHeader = document.getElementById('header');
    const categoryHeroBar = document.getElementById('category-hero-bar');
    if (mainHeader && categoryHeroBar) {
        if (tabName === 'category-detail') {
            mainHeader.style.display = 'none';
            categoryHeroBar.style.display = 'flex';
        } else {
            mainHeader.style.display = 'block';
            categoryHeroBar.style.display = 'none';
        }
    }

    // 1. Update Bottom Nav Active States
    navItems.forEach(item => {
        const itemTab = item.getAttribute('data-tab');
        if (itemTab === tabName || (tabName === 'category-detail' && itemTab === 'home')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 2. Update Active Tab View
    tabViews.forEach(view => {
        if (view.id === `view-${tabName}`) {
            view.classList.add('active-tab');
        } else {
            view.classList.remove('active-tab');
        }
    });

    activeTabName = tabName;

    if (tabName === 'profile') {
        updateProfileTotalsUI();
    }

    // Update Floating Cart Pill Bar visibility on tab switch
    updateFloatingCartBar();

    // Scroll handling: if returning to home with restoreHomeScroll, restore position; otherwise scroll to top
    if (tabName === 'home' && restoreHomeScroll) {
        restoreHomeScrollPosition();
    } else {
        // Scroll to top of view
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// --------------------------------------------------------------------------
// 4. CATEGORY DETAIL VIEW & SUB-ITEM DATA
// --------------------------------------------------------------------------
const categorySubItems = {
    "Burger": [
        { id: "bgr-acharri", name: "Acharri Burger", price: 99.00, img: "https://i.ibb.co/W44mjwxN/Acharri-Burger.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-aloo-patty", name: "Aloo Patty Burger", price: 99.00, img: "https://i.ibb.co/Df2JH9fb/Aloo-Patty-Burger.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-cheese-spicy", name: "Cheese Spicy", price: 99.00, img: "https://i.ibb.co/WvX6jhYM/Cheese-Spicy.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-cheesy", name: "Cheesy Burger", price: 99.00, img: "https://i.ibb.co/v6vK86T1/Cheesy-Burger.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-crispy-paneer", name: "Crispy Paneer", price: 99.00, img: "https://i.ibb.co/DD26cbg3/Crispy-Paneer.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-peri-peri", name: "Peri Peri Burger", price: 99.00, img: "https://i.ibb.co/xqST9xJT/Peri-Peri-Burger.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-special", name: "Special Burger", price: 99.00, img: "https://i.ibb.co/CKF4Vqw0/Special-Burger.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-tandoori", name: "Tandoori Burger", price: 99.00, img: "https://i.ibb.co/kVsYKYhJ/Tandoori-Burger.jpg", category: "Burger", available: true, isMultiSize: false },
        { id: "bgr-veggie", name: "Veggie Burger", price: 99.00, img: "https://i.ibb.co/840Qp6qQ/Veggie-Burger.jpg", category: "Burger", available: true, isMultiSize: false }
    ],
    "Pizza": [
        {
            id: "hot-country",
            name: "Hot Country",
            desc: "Onion, Red Corn, Jalapeno, Paneer, Black Olives & Red Paprika, Extra Cheese",
            prices: { S: 199.00, M: 299.00, L: 399.00 },
            img: "https://i.ibb.co/C59X7CVY/Hot-Country.jpg"
        },
        {
            id: "indian-veggie",
            name: "Indian Veggie",
            desc: "Capsicum, Green Chilli, Onion, Capsicum, Mushroom, Black Olives, Extra Cheese",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/fdKZMq2H/Indian-Veggie.jpg"
        },
        {
            id: "lovers-pizza",
            name: "Lover's Pizza",
            desc: "Red Paprika, Onion, Capsicum, Corn",
            prices: { S: 249.00, M: 349.00, L: 449.00 },
            img: "https://i.ibb.co/xKgtXvQ3/Lover-s-Pizza.jpg"
        },
        {
            id: "makhani-pizza",
            name: "Makhani Pizza",
            desc: "Capsicum, Paneer, Makhani Sauce",
            prices: { S: 239.00, M: 339.00, L: 439.00 },
            img: "https://i.ibb.co/5gkQ7SSv/Makhani-Pizza.jpg"
        },
        {
            id: "paradise-pizza",
            name: "Paradize Pizza",
            desc: "Red Paprika, Onion, Mushroom, Tomato & Jalapeno",
            prices: { S: 229.00, M: 329.00, L: 429.00 },
            img: "https://i.ibb.co/605cWN7n/Paradize-Pizza.jpg"
        },
        {
            id: "perfetto-special",
            name: "Perfetto Special Pizza",
            desc: "Onion, Corn, Pineapple, Jalapeno, Capsicum, Mushroom, Black Olives, Red Paprika, Paneer, Tomato, Extra Cheese",
            prices: { S: 299.00, M: 399.00, L: 499.00 },
            img: "https://i.ibb.co/B5ZHyQ9q/Perfetto-Special-Pizza.jpg"
        },
        {
            id: "spicy-pizza",
            name: "Spicy Pizza",
            desc: "Paneer Chilly, Capsicum, Red Paprika",
            prices: { S: 199.00, M: 299.00, L: 399.00 },
            img: "https://i.ibb.co/Nd788pWq/Spicy-Pizza.jpg"
        },
        {
            id: "supreme-pizza",
            name: "Supreme Pizza",
            desc: "Mushroom, Jalapeno, Paneer, Pineapple, Black Olives",
            prices: { S: 249.00, M: 349.00, L: 449.00 },
            img: "https://i.ibb.co/Ng1kGnR6/Supreme-Pizza.jpg"
        },
        {
            id: "tandoori-pizza",
            name: "Tandoori Pizza",
            desc: "Onion, Paneer, Bellpeper, Tandoori Sauce",
            prices: { S: 239.00, M: 339.00, L: 439.00 },
            img: "https://i.ibb.co/jkpyY1b0/Tandoori-Pizza.jpg"
        },
        {
            id: "achari-pizza",
            name: "Acharri Pizza",
            desc: "Capsicum, Corn, Paneer, Achari Sauce",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/5XgKZM2Z/Acharri-Pizza.jpg"
        },
        {
            id: "cheese-n-corn",
            name: "Cheese 'n Corn",
            desc: "Cheese, Corn",
            prices: { S: 179.00, M: 279.00, L: 379.00 },
            img: "https://i.ibb.co/FkgyjwHx/Cheese-n-Corn.jpg"
        },
        {
            id: "cheese-n-mushroom",
            name: "Cheese 'n Mushroom",
            desc: "Cheese, Mushroom",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/j96pyGyf/Cheese-n-Mushroom.jpg"
        },
        {
            id: "chipotle-pizza",
            name: "Chipotle Pizza",
            desc: "Paneer, Capsicum, Corn, Onion, Chipotle Sauce",
            prices: { S: 229.00, M: 329.00, L: 429.00 },
            img: "https://i.ibb.co/WvHtzxPQ/Chipotle-Pizza.jpg"
        },
        {
            id: "double-cheese-margherita",
            name: "Double Cheese Margherita",
            desc: "Loaded with extra gooey mozzarella cheese & classic Italian herb tomato sauce",
            prices: { S: 199.00, M: 299.00, L: 399.00 },
            img: "https://i.ibb.co/k6xGq83k/Dbl-Cheese-Margherita.jpg"
        },
        {
            id: "deluxe-pizza",
            name: "Deluxe Pizza",
            desc: "Onion, Paneer, Capsicum, Mushroom, Gold Corn",
            prices: { S: 199.00, M: 299.00, L: 399.00 },
            img: "https://i.ibb.co/kgZXHP6J/Deluxe-Pizza.jpg"
        },
        {
            id: "delight-pizza",
            name: "Delight Pizza",
            desc: "Capsicum, Jalapeno, Mushroom",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/DDQ7zY7n/Delight-Pizza.jpg"
        },
        {
            id: "farm-house",
            name: "Farm House",
            desc: "Corn, Pineapple, Mushroom, Black Olives, Red Paprika, Extra Cheese",
            prices: { S: 239.00, M: 339.00, L: 439.00 },
            img: "https://i.ibb.co/nNsWCp9t/Farm-House.jpg"
        },
        {
            id: "green-veggie",
            name: "Green Veggie",
            desc: "Onion, Capsicum, Tomato",
            prices: { S: 229.00, M: 329.00, L: 429.00 },
            img: "https://i.ibb.co/FbZ23hF3/Green-Veggie.jpg"
        },
        {
            id: "harissa-pizza",
            name: "Harissa Pizza",
            desc: "Paneer, Red Paprika, Black Olives, Onion, Harissa Sauce",
            prices: { S: 249.00, M: 349.00, L: 449.00 },
            img: "https://i.ibb.co/fVq0W6hp/Harissa-Pizza.jpg"
        }
    ],
    "Bread": [
        { name: "Garlic Butter Breadsticks", desc: "Warm oven-baked breadsticks with garlic butter", price: 119.00, tag: "Fresh" },
        { name: "Cheesy Garlic Bread", desc: "Melted mozzarella over seasoned garlic toast", price: 149.00, tag: "Bestseller" },
        { name: "Stuffed Cheese Pocket", desc: "Crispy crust filled with herbs & cheese", price: 159.00, tag: "Hot" }
    ],
    "Chinese Food": [
        { id: "chn-honey-chilly-cauliflower", name: "Honey Chilly Cauliflower", category: "Chinese Food", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/kgp9bjrS/Honey-Chilly-Cauliflower.jpg", desc: "Crispy florets tossed in sweet honey chilli glaze" },
        { id: "chn-honey-chilly-potato", name: "Honey Chilly Potato", category: "Chinese Food", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/GfY6XTJR/Honey-Chilly-Potato.jpg", desc: "Crispy potato fries glazed with honey, sesame and spicy chilli" },
        { id: "chn-veg-manchurian", name: "Veg Manchurian", category: "Chinese Food", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/NgMyx9My/Veg-Manchurian.jpg", desc: "Vegetable dumplings tossed in spicy garlic soy Manchurian sauce" },
        { id: "chn-chilly-cauliflower", name: "Chilly Cauliflower", category: "Chinese Food", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/pBPy144w/Chilly-Cauliflower.jpg", desc: "Crispy fried cauliflower tossed with bell peppers and chilli sauce" },
        { id: "chn-chilly-paneer", name: "Chilly Paneer", category: "Chinese Food", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/HTm4J9Vh/Chilly-Paneer.jpg", desc: "Cubes of cottage cheese tossed with onion, capsicum & dark soy sauce" },
        { id: "chn-chilly-potato", name: "Chilly Potato", category: "Chinese Food", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/9k7pS8S3/Chilly-Potato.jpg", desc: "Spicy crisp potato fingers tossed in garlic chilli sauce" }
    ],
    "Colo Drinks": [
        { id: "drk-coke-300ml", name: "Coke (300ml)", category: "Colo Drinks", isMultiSize: false, price: 40, available: true, img: "https://i.ibb.co/r2JVJSMg/Coke-300ml.jpg", desc: "Chilled refreshing Coca-Cola bottle (300ml)" },
        { id: "drk-coke-ice-cream", name: "Coke With Ice Cream", category: "Colo Drinks", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/jcQ2SVP/Coke-With-Ice-Cream.jpg", desc: "Classic chilled Coca-Cola served with a scoop of vanilla ice cream" },
        { id: "drk-milky-cola", name: "Milky Cola", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/Mk3VkTbK/Milky-Cola.jpg", desc: "Smooth and creamy cola blend with a velvety milky twist" },
        { id: "drk-milky-mango", name: "Milky Mango", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/35LxWDgq/Milky-Mango.jpg", desc: "Rich and refreshing creamy mango flavored chilled beverage" }
    ],
    "Cold Drinks": [
        { id: "drk-coke-300ml", name: "Coke (300ml)", category: "Colo Drinks", isMultiSize: false, price: 40, available: true, img: "https://i.ibb.co/r2JVJSMg/Coke-300ml.jpg", desc: "Chilled refreshing Coca-Cola bottle (300ml)" },
        { id: "drk-coke-ice-cream", name: "Coke With Ice Cream", category: "Colo Drinks", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/jcQ2SVP/Coke-With-Ice-Cream.jpg", desc: "Classic chilled Coca-Cola served with a scoop of vanilla ice cream" },
        { id: "drk-milky-cola", name: "Milky Cola", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/Mk3VkTbK/Milky-Cola.jpg", desc: "Smooth and creamy cola blend with a velvety milky twist" },
        { id: "drk-milky-mango", name: "Milky Mango", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/35LxWDgq/Milky-Mango.jpg", desc: "Rich and refreshing creamy mango flavored chilled beverage" }
    ],
    "Mojito": [
        { id: "moj-fresh-lime-soda", name: "Fresh Lime Soda", category: "Mojito", isMultiSize: false, price: 59, available: true, img: "https://i.ibb.co/tMGr4c9y/Fresh-Lime-Soda.jpg", desc: "Crisp and sparkling fresh lemon lime soda with a touch of mint" },
        { id: "moj-green-apple", name: "Green Apple Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/fGy3Rt0C/Green-Apple-Mojito.jpg", desc: "Crisp green apple flavored sparkling mojito with crushed mint and lime" },
        { id: "moj-mineral-water", name: "Mineral Water Soft Drink", category: "Mojito", isMultiSize: false, price: 20, available: true, img: "https://i.ibb.co/35d2ZxDD/Mineral-Water-Soft-Drink.jpg", desc: "Pure and refreshing chilled packaged drinking water" },
        { id: "moj-mint", name: "Mint Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/Lzn2WZPk/Mint-Mojito.jpg", desc: "Classic cooling mint infused sparkling beverage with zesty lemon" },
        { id: "moj-strawberry", name: "Strawberry Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/5XnrXt5d/Strawberry-Mojito.jpg", desc: "Sweet and tangy strawberry blended with fresh mint, lime and sparkling soda" },
        { id: "moj-virgin", name: "Virgin Mojito", category: "Mojito", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/B24VCS65/Virgin-Mojito.jpg", desc: "Signature refreshing non-alcoholic mojito with lime wedges & crushed mint leaves" }
    ],
    "Pasta": [
        { id: "pst-baked-mix", name: "Baked Mix Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/Z1k7wYcZ/Baked-Mix-Pasta.jpg", desc: "Oven baked pasta with rich combination of red and white sauces topped with melted cheese" },
        { id: "pst-baked-red", name: "Baked Red Pasta", category: "Pasta", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/0pLfYKfN/Baked-Red-Pasta.jpg", desc: "Tangy tomato arrabbiata pasta baked with extra mozzarella" },
        { id: "pst-baked-sweet-spicy", name: "Baked Sweet & Spicy Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/PzgbnkXp/Baked-Sweet-Spicy-Pasta.jpg", desc: "Sweet chilli and herb infused pasta baked to cheesy perfection" },
        { id: "pst-baked-tandoori", name: "Baked Tandoori Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/mFhbQZsN/Baked-Tandoori-Pasta.jpg", desc: "Smoky tandoori sauce pasta baked with golden cheese layer" },
        { id: "pst-baked-white", name: "Baked White Pasta", category: "Pasta", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/0jQLrKgh/Baked-White-Pasta.jpg", desc: "Creamy alfredo sauce pasta baked with Italian herbs and cheese" },
        { id: "pst-creamy", name: "Creamy Pasta", category: "Pasta", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/Q3yyX7ss/Creamy-Pasta.jpg", desc: "Rich smooth parmesan cream sauce tossed with penne" },
        { id: "pst-red", name: "Red Pasta", category: "Pasta", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/mCHkdqkg/Red-Pasta.jpg", desc: "Classic spicy tomato sauce pasta with Italian basil" },
        { id: "pst-supreme", name: "Supreme Pasta", category: "Pasta", isMultiSize: false, price: 159, available: true, img: "https://i.ibb.co/NDByPtY/Supreme-Pasta.jpg", desc: "Chef special pasta with fresh veggies, olives, jalapenos and secret herbs" },
        { id: "pst-tandoori", name: "Tandoori Pasta", category: "Pasta", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/hRg5D667/Tandoori-Pasta.jpg", desc: "Indian fusion pasta tossed in spicy tandoori mayo sauce" },
        { id: "pst-baked-makhani", name: "Baked Makhani Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/v4KDB6tm/Baked-Makhani-Pasta.jpg", desc: "Rich butter makhani gravy pasta baked with melted mozzarella" }
    ],
    "Wrap": [
        { id: "wrp-tandoori", name: "Tandoori Wrap", price: 99.00, img: "https://i.ibb.co/vx34djt8/Tandoori-Wrap.jpg", category: "Wrap", available: true, isMultiSize: false },
        { id: "wrp-aloo-patty", name: "Aloo Patty Wrap", price: 99.00, img: "https://i.ibb.co/MDpP2m0Q/Aloo-Patty-Wrap.jpg", category: "Wrap", available: true, isMultiSize: false },
        { id: "wrp-cheesy-saucy", name: "Cheesy Saucy Wrap", price: 99.00, img: "https://i.ibb.co/NkgGphz/Cheesy-Saucy-Wrap.jpg", category: "Wrap", available: true, isMultiSize: false },
        { id: "wrp-cheesy", name: "Cheesy Wrap", price: 99.00, img: "https://i.ibb.co/JRZWfVvX/Cheesy-Wrap.jpg", category: "Wrap", available: true, isMultiSize: false },
        { id: "wrp-crispy-paneer", name: "Crispy Paneer Wrap", price: 99.00, img: "https://i.ibb.co/Tx8G92GX/Crispy-Paneer-Wrap.jpg", category: "Wrap", available: true, isMultiSize: false },
        { id: "wrp-spicy", name: "Spicy Wrap", price: 99.00, img: "https://i.ibb.co/0jx7P4sj/Spicy-Wrap.png", category: "Wrap", available: true, isMultiSize: false }
    ],
    "Bread": [
        { id: "brd-cheese-corn", name: "Cheese Corn Bread", price: 99.00, img: "https://i.ibb.co/d4sByypr/Cheese-Corn-Bread.jpg", category: "Bread", available: true, isMultiSize: false },
        { id: "brd-garlic", name: "Garlic Bread", price: 99.00, img: "https://i.ibb.co/JFRG0cD0/Garlic-Bread.jpg", category: "Bread", available: true, isMultiSize: false },
        { id: "brd-perfetto-stuffed", name: "Perfetto Stuffed Bread", price: 99.00, img: "https://i.ibb.co/j2ZXJWh/Perfetto-Stuffed-Bread.jpg", category: "Bread", available: true, isMultiSize: false },
        { id: "brd-stuffed", name: "Stuffed Bread", price: 99.00, img: "https://i.ibb.co/6c66XWJn/Stuffed-Bread.jpg", category: "Bread", available: true, isMultiSize: false }
    ],
    "Sandwich": [
        { id: "sdw-double-decker", name: "Double Decker Sandwich", category: "Sandwich", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/CsVRK0p0/Double-Decker-Sandwich.jpg", desc: "" },
        { id: "sdw-grilled", name: "Grilled Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/rGDgsJbM/Grilled-Sandwich.jpg", desc: "" },
        { id: "sdw-paneer", name: "Paneer Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/dsw5G4Kk/Paneer-Sandwich.jpg", desc: "" },
        { id: "sdw-spicy", name: "Spicy Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/YTb1G6fh/Spicy-Sandwich.jpg", desc: "" },
        { id: "sdw-cheesy", name: "Cheesy Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/XZKVpGT8/Cheesy-Sandwich.jpg", desc: "" }
    ],
    "Momos": [
        { id: "mom-chilly-paneer", name: "Chilly Paneer Momos", category: "Momos", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/8npwRhND/Chilly-Paneer-Momos.jpg", desc: "Crispy paneer momos tossed in spicy chilli garlic sauce" },
        { id: "mom-chilly-veg", name: "Chilly Veg Momos", category: "Momos", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/C3fxBr0n/Chilly-Veg-Momos.jpg", desc: "Golden fried veg momos coated in tangy chilli sauce" },
        { id: "mom-crispy-paneer", name: "Crispy Paneer Momos", category: "Momos", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/7dCpxDhH/Crispy-Paneer-Momos.jpg", desc: "Crunchy crumb-coated momos loaded with seasoned paneer filling" },
        { id: "mom-crispy-veg", name: "Crispy Veg Momos", category: "Momos", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/20ZqGQqs/Crispy-Veg-Momos.jpg", desc: "Super crunchy fried momos stuffed with spiced minced veggies" },
        { id: "mom-pan-fried-paneer", name: "Pan Fried Paneer Momos", category: "Momos", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/rKg6g0zf/Pan-Fried-Paneer-Momos.jpg", desc: "Pan-seared juicy paneer momos with crispy bottoms and savory seasoning" },
        { id: "mom-pan-fried-veg", name: "Pan Fried Veg Momo", category: "Momos", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/BH0S6hGj/Pan-Fried-Veg-Momo.jpg", desc: "Crispy pan-fried vegetable momos glazed with mild aromatic spices" },
        { id: "mom-paneer", name: "Paneer Momos", category: "Momos", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/B786z53/Paneer-Momos.jpg", desc: "Steamed soft momos stuffed with rich seasoned cottage cheese" },
        { id: "mom-special-paneer", name: "Special Paneer Momos", category: "Momos", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/zVWhf66r/Special-Paneer-Momos.jpg", desc: "Chef special recipe paneer momos with gourmet herb filling" },
        { id: "mom-tandoori-paneer", name: "Tandoori Paneer Momos", category: "Momos", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/chtDHFmG/Tandoori-Paneer-Momos.jpg", desc: "Char-grilled paneer momos marinated in smoky tandoori spices" },
        { id: "mom-tandoori-veg", name: "Tandoori Veg Momos", category: "Momos", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/yFSGcBsD/Tandoori-Veg-Momos.jpg", desc: "Smoky tandoori marinated veg momos with oven-roasted aroma" },
        { id: "mom-veg", name: "Veg Momos", category: "Momos", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/0RTw1B4c/Veg-Momos.jpg", desc: "Classic steamed dumplings packed with fresh garden vegetables" }
    ],
    "Shake": [
        { id: "shk-black-currant", name: "Black Currant Shake", category: "Shake", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/nN8ZnFYV/Black-Currant-Shake.jpg", desc: "Rich creamy shake blended with luscious black currant flavor" },
        { id: "shk-butter-scotch", name: "Butter Scotch Shake", category: "Shake", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/Wvy1Zfbj/Butter-Scotch-Shake.jpg", desc: "Smooth butterscotch milkshake topped with crunchy caramel nuggets" },
        { id: "shk-chocolate", name: "Chocolate Shake", category: "Shake", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/dsmztpV7/Chocolate-Shake.jpg", desc: "Classic rich cocoa chocolate shake blended to perfection" },
        { id: "shk-kitkat-crunchy", name: "Kit Kat Crunchy Shake", category: "Shake", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/wZZf2jWy/Kit-Kat-Crunchy-Shake.jpg", desc: "Delicious chocolate shake blended with real crispy KitKat wafers" },
        { id: "shk-oreo-feast", name: "Oreo Feast Shake", category: "Shake", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/YqNxTL3/Oreo-Feast-Shake.jpg", desc: "Thick creamy shake loaded with crushed Oreo cookies" },
        { id: "shk-pineapple", name: "Pineapple Shake", category: "Shake", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/pc2FGBh/Pineapple-Shake.jpg", desc: "Refreshing tropical pineapple milkshake" },
        { id: "shk-rasmalai", name: "Rasmalai Shake", category: "Shake", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/vCtBxC5V/Rasmalai-Shake.jpg", desc: "Royal Indian fusion shake with authentic rasmalai flavor & dry fruits" },
        { id: "shk-strawberry", name: "Strawberry Shake", category: "Shake", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/jvcrqP0Z/Strawberry-Shake.jpg", desc: "Sweet and tangy fresh strawberry milkshake" },
        { id: "shk-vanilla", name: "Vanilla Shake", category: "Shake", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/nqzRxxjB/Vanilla-Shake.jpg", desc: "Smooth classic Madagascar vanilla milkshake" }
    ],
    "Rice": [
        { id: "ric-veg-fried", name: "Veg Fried Rice", category: "Rice", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/0j2C4vR2/Veg-Fried-Rice.jpg", desc: "Classic stir-fried rice tossed with fresh garden vegetables & aromatic seasonings" },
        { id: "ric-singapuri", name: "Singapuri Rice", category: "Rice", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/q3wnW2kC/Singapuri-Rice.jpg", desc: "Spicy & exotic Singapore style fried rice infused with mild curry spices" },
        { id: "ric-chilly-garlic", name: "Chilly Garlic Rice", category: "Rice", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/wFBqyMBD/Chilly-Garlic-Rice.jpg", desc: "Zesty fried rice wok-tossed with pungent chili garlic sauce" },
        { id: "ric-haka", name: "Haka Rice", category: "Rice", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/4g1rfZ9V/Haka-Rice.jpg", desc: "Authentic Hakka style wok-tossed rice with crisp vegetables" }
    ],
    "Hot Cold Coffee": [
        { id: "cof-cold", name: "Cold Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/NdjHqdXP/Cold-Coffee.jpg", desc: "Creamy chilled coffee blended to rich perfection" },
        { id: "cof-hot", name: "Hot Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/mVQ3X1wp/Hot-Coffee.jpg", desc: "Freshly brewed aromatic hot coffee" }
    ],
    "Coffee": [
        { id: "cof-cold", name: "Cold Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/NdjHqdXP/Cold-Coffee.jpg", desc: "Creamy chilled coffee blended to rich perfection" },
        { id: "cof-hot", name: "Hot Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/mVQ3X1wp/Hot-Coffee.jpg", desc: "Freshly brewed aromatic hot coffee" }
    ],
    "Noodles": [
        { id: "ndl-butter-paneer", name: "Butter Paneer Noodles", category: "Noodles", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/Qv9TGVwy/Butter-Paneer-Noodles.jpg", desc: "Wok-tossed noodles with soft paneer cubes in rich butter masala sauce" },
        { id: "ndl-chilly-garlic", name: "Chilly Garlic Noodles", category: "Noodles", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/ycQT35rB/Chilly-Garlic-Noodles.jpg", desc: "Spicy wok-tossed noodles flavored with pungent garlic and red chillies" },
        { id: "ndl-haka", name: "Haka Noodles", category: "Noodles", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/WvG995DF/Haka-Noodles.jpg", desc: "Classic Hakka style noodles stir-fried with crisp garden vegetables" },
        { id: "ndl-paneer", name: "Paneer Noodles", category: "Noodles", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/Cpwx1BY5/Paneer-Noodles.jpg", desc: "Delicious stir-fried noodles tossed with spiced paneer cubes and crunchy veggies" },
        { id: "ndl-singapuri", name: "Singapuri Noodles", category: "Noodles", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/M0KJsvz/Singapuri-Noodles.jpg", desc: "Zesty Singapore style noodles with exotic spices and fresh bell peppers" },
        { id: "ndl-veg", name: "Veg Noodles", category: "Noodles", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/21JBqyRP/Veg-Noodles.jpg", desc: "Classic stir-fried noodles loaded with fresh seasoned vegetables" }
    ],
    "Desserts": [
        { id: "des-ice-cream-vanilla", name: "Ice Cream Vanilla", category: "Desserts", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/t5SyXgM/Ice-Cream-Vanilla.jpg", desc: "Creamy classic vanilla ice cream scoop" },
        { id: "des-lava-cake-ice-cream", name: "Lava Cake With Ice Cream", category: "Desserts", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/7tVhrnxQ/Lava-Cake-With-Ice-Cream.jpg", desc: "Warm molten chocolate lava cake served with rich vanilla ice cream" },
        { id: "des-lava-cake", name: "Lava Cake", category: "Desserts", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/wZQSKRvS/Lava-Cake.jpg", desc: "Decadent chocolate cake with a warm molten chocolate center" }
    ],
    "Salad": [
        { id: "sld-green", name: "Green Salad", category: "Salad", isMultiSize: false, price: 69, available: true, img: "https://i.ibb.co/dwWmX7HX/Green-Salad.jpg", desc: "Fresh assortment of sliced cucumbers, tomatoes, carrots, onions & lemon wedges" },
        { id: "sld-perfetto-special", name: "Perfetto Special Salad", category: "Salad", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/2YS2PS1s/Perfetto-Special-Salad.jpg", desc: "Chef special fresh garden salad tossed with paneer cubes, olives and house dressing" },
        { id: "sld-russian", name: "Russian Salad", category: "Salad", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/ds4XYn5d/Russian-Salad.jpg", desc: "Classic diced vegetables, boiled potatoes and sweet corn folded in creamy mayo dressing" }
    ],
    "Side Orders": [
        { id: "sde-french-fries", name: "French Fries", category: "Side Orders", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/3y4xtxj7/French-Fries.jpg", desc: "Crispy golden fried potato fries lightly salted to perfection" },
        { id: "sde-masala-fries", name: "Masala Fries", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/KxGpWPHz/Masala-Fries.jpg", desc: "Crispy french fries tossed with tangy chaat masala and spicy seasonings" },
        { id: "sde-paneer-parcel", name: "Paneer Parcel", category: "Side Orders", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/dwSwJ6zK/Paneer-Parcel.jpg", desc: "Flaky baked golden pastry filled with seasoned paneer & herbs" },
        { id: "sde-peri-peri-fries", name: "Peri Peri Fries", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/PGK7N3mJ/Peri-Peri-Fries.jpg", desc: "Crisp potato fries dusted with hot and zesty peri peri spice mix" },
        { id: "sde-saucy-fries", name: "Saucy Fries", category: "Side Orders", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/gZ0RCYrS/Saucy-Fries.jpg", desc: "Crispy fries drizzled generously with signature savory and cheesy sauces" },
        { id: "sde-taco", name: "Taco", category: "Side Orders", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/ZzKMq3h7/Taco.jpg", desc: "Crispy folded taco shell stuffed with spiced fillings, crunchy veggies & creamy sauce" },
        { id: "sde-zingy-parcel", name: "Zingy Parcel", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/WNfHNVBk/Zingy-Parcel.jpg", desc: "Warm oven-baked parcel stuffed with zingy spiced filling and melted cheese" }
    ],
    "Spring Rolls": [
        { id: "spr-chilly-paneer-kathi-roll", name: "Chilly Paneer Kathi Roll", category: "Spring Rolls", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/vxh5Htcf/Chilly-Paneer-Kathi-Roll.jpg", desc: "Spicy tossed paneer cubes with crunchy bell peppers wrapped in a soft kathi roll" },
        { id: "spr-crispy-spring-roll", name: "Crispy Spring Roll", category: "Spring Rolls", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/Ngzq7HDS/Crispy-Spring-Roll.jpg", desc: "Golden fried crispy rolls stuffed with seasoned shredded vegetables and herbs" },
        { id: "spr-paneer-kathi-roll", name: "Paneer Kathi Roll", category: "Spring Rolls", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/4wRYJtFg/Paneer-Kathi-Roll.jpg", desc: "Marinated tender paneer pieces layered with sliced onions and rich sauces in a kathi wrap" },
        { id: "spr-spring-roll", name: "Spring Roll", category: "Spring Rolls", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/ZzYLkLfn/Spring-Roll.jpg", desc: "Classic golden fried rolls packed with savory spiced vegetables and dipping sauce" },
        { id: "spr-veg-kathi-roll", name: "Veg Kathi Roll", category: "Spring Rolls", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/YKVjDfb/Veg-Kathi-Roll.jpg", desc: "A hearty medley of spiced garden vegetables rolled into a fresh kathi paratha" }
    ]
};

const MENU_STORAGE_KEY = 'menuData';

const NEW_SPRING_ROLLS_MENU_ITEMS = [
    { id: "spr-chilly-paneer-kathi-roll", name: "Chilly Paneer Kathi Roll", category: "Spring Rolls", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/vxh5Htcf/Chilly-Paneer-Kathi-Roll.jpg", desc: "Spicy tossed paneer cubes with crunchy bell peppers wrapped in a soft kathi roll" },
    { id: "spr-crispy-spring-roll", name: "Crispy Spring Roll", category: "Spring Rolls", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/Ngzq7HDS/Crispy-Spring-Roll.jpg", desc: "Golden fried crispy rolls stuffed with seasoned shredded vegetables and herbs" },
    { id: "spr-paneer-kathi-roll", name: "Paneer Kathi Roll", category: "Spring Rolls", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/4wRYJtFg/Paneer-Kathi-Roll.jpg", desc: "Marinated tender paneer pieces layered with sliced onions and rich sauces in a kathi wrap" },
    { id: "spr-spring-roll", name: "Spring Roll", category: "Spring Rolls", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/ZzYLkLfn/Spring-Roll.jpg", desc: "Classic golden fried rolls packed with savory spiced vegetables and dipping sauce" },
    { id: "spr-veg-kathi-roll", name: "Veg Kathi Roll", category: "Spring Rolls", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/YKVjDfb/Veg-Kathi-Roll.jpg", desc: "A hearty medley of spiced garden vegetables rolled into a fresh kathi paratha" }
];

const NEW_MOJITO_MENU_ITEMS = [
    { id: "moj-fresh-lime-soda", name: "Fresh Lime Soda", category: "Mojito", isMultiSize: false, price: 59, available: true, img: "https://i.ibb.co/tMGr4c9y/Fresh-Lime-Soda.jpg", desc: "Crisp and sparkling fresh lemon lime soda with a touch of mint" },
    { id: "moj-green-apple", name: "Green Apple Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/fGy3Rt0C/Green-Apple-Mojito.jpg", desc: "Crisp green apple flavored sparkling mojito with crushed mint and lime" },
    { id: "moj-mineral-water", name: "Mineral Water Soft Drink", category: "Mojito", isMultiSize: false, price: 20, available: true, img: "https://i.ibb.co/35d2ZxDD/Mineral-Water-Soft-Drink.jpg", desc: "Pure and refreshing chilled packaged drinking water" },
    { id: "moj-mint", name: "Mint Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/Lzn2WZPk/Mint-Mojito.jpg", desc: "Classic cooling mint infused sparkling beverage with zesty lemon" },
    { id: "moj-strawberry", name: "Strawberry Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/5XnrXt5d/Strawberry-Mojito.jpg", desc: "Sweet and tangy strawberry blended with fresh mint, lime and sparkling soda" },
    { id: "moj-virgin", name: "Virgin Mojito", category: "Mojito", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/B24VCS65/Virgin-Mojito.jpg", desc: "Signature refreshing non-alcoholic mojito with lime wedges & crushed mint leaves" }
];

const NEW_COLD_DRINKS_MENU_ITEMS = [
    { id: "drk-coke-300ml", name: "Coke (300ml)", category: "Colo Drinks", isMultiSize: false, price: 40, available: true, img: "https://i.ibb.co/r2JVJSMg/Coke-300ml.jpg", desc: "Chilled refreshing Coca-Cola bottle (300ml)" },
    { id: "drk-coke-ice-cream", name: "Coke With Ice Cream", category: "Colo Drinks", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/jcQ2SVP/Coke-With-Ice-Cream.jpg", desc: "Classic chilled Coca-Cola served with a scoop of vanilla ice cream" },
    { id: "drk-milky-cola", name: "Milky Cola", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/Mk3VkTbK/Milky-Cola.jpg", desc: "Smooth and creamy cola blend with a velvety milky twist" },
    { id: "drk-milky-mango", name: "Milky Mango", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/35LxWDgq/Milky-Mango.jpg", desc: "Rich and refreshing creamy mango flavored chilled beverage" }
];

const NEW_SIDE_ORDERS_MENU_ITEMS = [
    { id: "sde-french-fries", name: "French Fries", category: "Side Orders", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/3y4xtxj7/French-Fries.jpg", desc: "Crispy golden fried potato fries lightly salted to perfection" },
    { id: "sde-masala-fries", name: "Masala Fries", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/KxGpWPHz/Masala-Fries.jpg", desc: "Crispy french fries tossed with tangy chaat masala and spicy seasonings" },
    { id: "sde-paneer-parcel", name: "Paneer Parcel", category: "Side Orders", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/dwSwJ6zK/Paneer-Parcel.jpg", desc: "Flaky baked golden pastry filled with seasoned paneer & herbs" },
    { id: "sde-peri-peri-fries", name: "Peri Peri Fries", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/PGK7N3mJ/Peri-Peri-Fries.jpg", desc: "Crisp potato fries dusted with hot and zesty peri peri spice mix" },
    { id: "sde-saucy-fries", name: "Saucy Fries", category: "Side Orders", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/gZ0RCYrS/Saucy-Fries.jpg", desc: "Crispy fries drizzled generously with signature savory and cheesy sauces" },
    { id: "sde-taco", name: "Taco", category: "Side Orders", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/ZzKMq3h7/Taco.jpg", desc: "Crispy folded taco shell stuffed with spiced fillings, crunchy veggies & creamy sauce" },
    { id: "sde-zingy-parcel", name: "Zingy Parcel", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/WNfHNVBk/Zingy-Parcel.jpg", desc: "Warm oven-baked parcel stuffed with zingy spiced filling and melted cheese" }
];

const NEW_SALAD_MENU_ITEMS = [
    { id: "sld-green", name: "Green Salad", category: "Salad", isMultiSize: false, price: 69, available: true, img: "https://i.ibb.co/dwWmX7HX/Green-Salad.jpg", desc: "Fresh assortment of sliced cucumbers, tomatoes, carrots, onions & lemon wedges" },
    { id: "sld-perfetto-special", name: "Perfetto Special Salad", category: "Salad", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/2YS2PS1s/Perfetto-Special-Salad.jpg", desc: "Chef special fresh garden salad tossed with paneer cubes, olives and house dressing" },
    { id: "sld-russian", name: "Russian Salad", category: "Salad", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/ds4XYn5d/Russian-Salad.jpg", desc: "Classic diced vegetables, boiled potatoes and sweet corn folded in creamy mayo dressing" }
];

const NEW_DESSERTS_MENU_ITEMS = [
    { id: "des-ice-cream-vanilla", name: "Ice Cream Vanilla", category: "Desserts", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/t5SyXgM/Ice-Cream-Vanilla.jpg", desc: "Creamy classic vanilla ice cream scoop" },
    { id: "des-lava-cake-ice-cream", name: "Lava Cake With Ice Cream", category: "Desserts", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/7tVhrnxQ/Lava-Cake-With-Ice-Cream.jpg", desc: "Warm molten chocolate lava cake served with rich vanilla ice cream" },
    { id: "des-lava-cake", name: "Lava Cake", category: "Desserts", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/wZQSKRvS/Lava-Cake.jpg", desc: "Decadent chocolate cake with a warm molten chocolate center" }
];

const NEW_NOODLES_MENU_ITEMS = [
    { id: "ndl-butter-paneer", name: "Butter Paneer Noodles", category: "Noodles", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/Qv9TGVwy/Butter-Paneer-Noodles.jpg", desc: "Wok-tossed noodles with soft paneer cubes in rich butter masala sauce" },
    { id: "ndl-chilly-garlic", name: "Chilly Garlic Noodles", category: "Noodles", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/ycQT35rB/Chilly-Garlic-Noodles.jpg", desc: "Spicy wok-tossed noodles flavored with pungent garlic and red chillies" },
    { id: "ndl-haka", name: "Haka Noodles", category: "Noodles", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/WvG995DF/Haka-Noodles.jpg", desc: "Classic Hakka style noodles stir-fried with crisp garden vegetables" },
    { id: "ndl-paneer", name: "Paneer Noodles", category: "Noodles", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/Cpwx1BY5/Paneer-Noodles.jpg", desc: "Delicious stir-fried noodles tossed with spiced paneer cubes and crunchy veggies" },
    { id: "ndl-singapuri", name: "Singapuri Noodles", category: "Noodles", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/M0KJsvz/Singapuri-Noodles.jpg", desc: "Zesty Singapore style noodles with exotic spices and fresh bell peppers" },
    { id: "ndl-veg", name: "Veg Noodles", category: "Noodles", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/21JBqyRP/Veg-Noodles.jpg", desc: "Classic stir-fried noodles loaded with fresh seasoned vegetables" }
];

const NEW_COFFEE_MENU_ITEMS = [
    { id: "cof-cold", name: "Cold Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/NdjHqdXP/Cold-Coffee.jpg", desc: "Creamy chilled coffee blended to rich perfection" },
    { id: "cof-hot", name: "Hot Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/mVQ3X1wp/Hot-Coffee.jpg", desc: "Freshly brewed aromatic hot coffee" }
];

const NEW_MOMOS_MENU_ITEMS = [
    { id: "mom-chilly-paneer", name: "Chilly Paneer Momos", category: "Momos", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/8npwRhND/Chilly-Paneer-Momos.jpg", desc: "Crispy paneer momos tossed in spicy chilli garlic sauce" },
    { id: "mom-chilly-veg", name: "Chilly Veg Momos", category: "Momos", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/C3fxBr0n/Chilly-Veg-Momos.jpg", desc: "Golden fried veg momos coated in tangy chilli sauce" },
    { id: "mom-crispy-paneer", name: "Crispy Paneer Momos", category: "Momos", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/7dCpxDhH/Crispy-Paneer-Momos.jpg", desc: "Crunchy crumb-coated momos loaded with seasoned paneer filling" },
    { id: "mom-crispy-veg", name: "Crispy Veg Momos", category: "Momos", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/20ZqGQqs/Crispy-Veg-Momos.jpg", desc: "Super crunchy fried momos stuffed with spiced minced veggies" },
    { id: "mom-pan-fried-paneer", name: "Pan Fried Paneer Momos", category: "Momos", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/rKg6g0zf/Pan-Fried-Paneer-Momos.jpg", desc: "Pan-seared juicy paneer momos with crispy bottoms and savory seasoning" },
    { id: "mom-pan-fried-veg", name: "Pan Fried Veg Momo", category: "Momos", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/BH0S6hGj/Pan-Fried-Veg-Momo.jpg", desc: "Crispy pan-fried vegetable momos glazed with mild aromatic spices" },
    { id: "mom-paneer", name: "Paneer Momos", category: "Momos", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/B786z53/Paneer-Momos.jpg", desc: "Steamed soft momos stuffed with rich seasoned cottage cheese" },
    { id: "mom-special-paneer", name: "Special Paneer Momos", category: "Momos", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/zVWhf66r/Special-Paneer-Momos.jpg", desc: "Chef special recipe paneer momos with gourmet herb filling" },
    { id: "mom-tandoori-paneer", name: "Tandoori Paneer Momos", category: "Momos", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/chtDHFmG/Tandoori-Paneer-Momos.jpg", desc: "Char-grilled paneer momos marinated in smoky tandoori spices" },
    { id: "mom-tandoori-veg", name: "Tandoori Veg Momos", category: "Momos", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/yFSGcBsD/Tandoori-Veg-Momos.jpg", desc: "Smoky tandoori marinated veg momos with oven-roasted aroma" },
    { id: "mom-veg", name: "Veg Momos", category: "Momos", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/0RTw1B4c/Veg-Momos.jpg", desc: "Classic steamed dumplings packed with fresh garden vegetables" }
];

const NEW_SANDWICH_MENU_ITEMS = [
    { id: "sdw-double-decker", name: "Double Decker Sandwich", category: "Sandwich", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/CsVRK0p0/Double-Decker-Sandwich.jpg", desc: "" },
    { id: "sdw-grilled", name: "Grilled Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/rGDgsJbM/Grilled-Sandwich.jpg", desc: "" },
    { id: "sdw-paneer", name: "Paneer Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/dsw5G4Kk/Paneer-Sandwich.jpg", desc: "" },
    { id: "sdw-spicy", name: "Spicy Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/YTb1G6fh/Spicy-Sandwich.jpg", desc: "" },
    { id: "sdw-cheesy", name: "Cheesy Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/XZKVpGT8/Cheesy-Sandwich.jpg", desc: "" }
];

const NEW_BURGER_MENU_ITEMS = [
    { id: "bgr-acharri", name: "Acharri Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/W44mjwxN/Acharri-Burger.jpg", desc: "" },
    { id: "bgr-aloo-patty", name: "Aloo Patty Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/Df2JH9fb/Aloo-Patty-Burger.jpg", desc: "" },
    { id: "bgr-cheese-spicy", name: "Cheese Spicy", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/WvX6jhYM/Cheese-Spicy.jpg", desc: "" },
    { id: "bgr-cheesy", name: "Cheesy Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/v6vK86T1/Cheesy-Burger.jpg", desc: "" },
    { id: "bgr-crispy-paneer", name: "Crispy Paneer", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/DD26cbg3/Crispy-Paneer.jpg", desc: "" },
    { id: "bgr-peri-peri", name: "Peri Peri Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/xqST9xJT/Peri-Peri-Burger.jpg", desc: "" },
    { id: "bgr-special", name: "Special Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/CKF4Vqw0/Special-Burger.jpg", desc: "" },
    { id: "bgr-tandoori", name: "Tandoori Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/kVsYKYhJ/Tandoori-Burger.jpg", desc: "" },
    { id: "bgr-veggie", name: "Veggie Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/840Qp6qQ/Veggie-Burger.jpg", desc: "" }
];

const NEW_WRAP_MENU_ITEMS = [
    { id: "wrp-tandoori", name: "Tandoori Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/vx34djt8/Tandoori-Wrap.jpg", desc: "" },
    { id: "wrp-aloo-patty", name: "Aloo Patty Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/MDpP2m0Q/Aloo-Patty-Wrap.jpg", desc: "" },
    { id: "wrp-cheesy-saucy", name: "Cheesy Saucy Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/NkgGphz/Cheesy-Saucy-Wrap.jpg", desc: "" },
    { id: "wrp-cheesy", name: "Cheesy Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/JRZWfVvX/Cheesy-Wrap.jpg", desc: "" },
    { id: "wrp-crispy-paneer", name: "Crispy Paneer Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/Tx8G92GX/Crispy-Paneer-Wrap.jpg", desc: "" },
    { id: "wrp-spicy", name: "Spicy Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/0jx7P4sj/Spicy-Wrap.png", desc: "" }
];

const NEW_BREAD_MENU_ITEMS = [
    { id: "brd-cheese-corn", name: "Cheese Corn Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/d4sByypr/Cheese-Corn-Bread.jpg", desc: "" },
    { id: "brd-garlic", name: "Garlic Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/JFRG0cD0/Garlic-Bread.jpg", desc: "" },
    { id: "brd-perfetto-stuffed", name: "Perfetto Stuffed Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/j2ZXJWh/Perfetto-Stuffed-Bread.jpg", desc: "" },
    { id: "brd-stuffed", name: "Stuffed Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/6c66XWJn/Stuffed-Bread.jpg", desc: "" }
];

const NEW_PIZZA_MENU_IMAGES = {
    "green-veggie": "https://i.ibb.co/FbZ23hF3/Green-Veggie.jpg",
    "harissa-pizza": "https://i.ibb.co/fVq0W6hp/Harissa-Pizza.jpg",
    "hot-country": "https://i.ibb.co/C59X7CVY/Hot-Country.jpg",
    "indian-veggie": "https://i.ibb.co/fdKZMq2H/Indian-Veggie.jpg",
    "lovers-pizza": "https://i.ibb.co/xKgtXvQ3/Lover-s-Pizza.jpg",
    "makhani-pizza": "https://i.ibb.co/5gkQ7SSv/Makhani-Pizza.jpg",
    "paradise-pizza": "https://i.ibb.co/605cWN7n/Paradize-Pizza.jpg",
    "perfetto-special": "https://i.ibb.co/B5ZHyQ9q/Perfetto-Special-Pizza.jpg",
    "spicy-pizza": "https://i.ibb.co/Nd788pWq/Spicy-Pizza.jpg",
    "supreme-pizza": "https://i.ibb.co/Ng1kGnR6/Supreme-Pizza.jpg",
    "tandoori-pizza": "https://i.ibb.co/jkpyY1b0/Tandoori-Pizza.jpg",
    "achari-pizza": "https://i.ibb.co/5XgKZM2Z/Acharri-Pizza.jpg",
    "cheese-n-corn": "https://i.ibb.co/FkgyjwHx/Cheese-n-Corn.jpg",
    "cheese-n-mushroom": "https://i.ibb.co/j96pyGyf/Cheese-n-Mushroom.jpg",
    "chipotle-pizza": "https://i.ibb.co/WvHtzxPQ/Chipotle-Pizza.jpg",
    "double-cheese-margherita": "https://i.ibb.co/k6xGq83k/Dbl-Cheese-Margherita.jpg",
    "delight-pizza": "https://i.ibb.co/DDQ7zY7n/Delight-Pizza.jpg",
    "deluxe-pizza": "https://i.ibb.co/kgZXHP6J/Deluxe-Pizza.jpg",
    "farm-house": "https://i.ibb.co/nNsWCp9t/Farm-House.jpg"
};

function sanitizeStoredMenuItems(items) {
    if (!Array.isArray(items)) return null;
    let updated = [...items];
    let modified = false;

    // 1. Sanitize Burger items
    const hasOldBurgers = updated.some(i => i.category === 'Burger' && (i.name === 'Classic Crispy Burger' || i.name === 'Double Cheese Delite' || i.id === 'bgr-1' || i.id === 'bgr-2' || i.id === 'bgr-3' || i.id === 'bgr-4' || i.id === 'bgr-5' || i.id === 'bgr-6' || !NEW_BURGER_MENU_ITEMS.some(nb => nb.id === i.id || nb.name === i.name)));
    if (hasOldBurgers) {
        const nonBurgers = updated.filter(i => i.category !== 'Burger');
        updated = [...nonBurgers, ...NEW_BURGER_MENU_ITEMS];
        modified = true;
    }

    // 2. Sanitize Wrap items
    const hasOldWraps = updated.some(i => i.category === 'Wrap' && (i.id === 'wrp-1' || i.id === 'wrp-2' || i.id === 'wrp-3' || i.id === 'wrp-4' || (i.name && i.name.startsWith('Wrap Option')) || !NEW_WRAP_MENU_ITEMS.some(nw => nw.id === i.id || nw.name === i.name)));
    if (hasOldWraps) {
        const nonWraps = updated.filter(i => i.category !== 'Wrap');
        updated = [...nonWraps, ...NEW_WRAP_MENU_ITEMS];
        modified = true;
    }

    // 3. Sanitize Bread items
    const hasOldBreads = updated.some(i => i.category === 'Bread' && (i.id === 'brd-1' || i.id === 'brd-2' || i.id === 'brd-3' || i.name === 'Garlic Butter Breadsticks' || i.name === 'Cheesy Garlic Bread' || i.name === 'Stuffed Cheese Pocket' || !NEW_BREAD_MENU_ITEMS.some(nb => nb.id === i.id || nb.name === i.name)));
    if (hasOldBreads) {
        const nonBreads = updated.filter(i => i.category !== 'Bread');
        updated = [...nonBreads, ...NEW_BREAD_MENU_ITEMS];
        modified = true;
    }

    // 4. Sanitize and Upgrade Pizza images to latest high-res URLs
    updated.forEach(item => {
        if (item.category === 'Pizza' && item.id && NEW_PIZZA_MENU_IMAGES[item.id]) {
            if (item.img !== NEW_PIZZA_MENU_IMAGES[item.id]) {
                item.img = NEW_PIZZA_MENU_IMAGES[item.id];
                modified = true;
            }
        }
    });

    // Ensure Double Cheese Margherita is present
    if (!updated.some(i => i.id === 'double-cheese-margherita' || (i.name && i.name.toLowerCase().includes('margherita')))) {
        updated.push({
            id: "double-cheese-margherita",
            name: "Double Cheese Margherita",
            category: "Pizza",
            isMultiSize: true,
            prices: { S: 199, M: 299, L: 399 },
            available: true,
            img: "https://i.ibb.co/k6xGq83k/Dbl-Cheese-Margherita.jpg",
            desc: "Loaded with extra gooey mozzarella cheese & classic Italian herb tomato sauce"
        });
        modified = true;
    }

    // 5. Sanitize Sandwich items
    const hasOldSandwiches = updated.some(i => i.category === 'Sandwich' && (i.id === 'sdw-1' || i.id === 'sdw-2' || i.id === 'sdw-3' || i.id === 'sdw-4' || (i.name && i.name.startsWith('Sandwich Option')) || !NEW_SANDWICH_MENU_ITEMS.some(ns => ns.id === i.id || ns.name === i.name)));
    if (hasOldSandwiches) {
        const nonSandwiches = updated.filter(i => i.category !== 'Sandwich');
        updated = [...nonSandwiches, ...NEW_SANDWICH_MENU_ITEMS];
        modified = true;
    }

    const SANDWICH_IMAGE_MAP = {
        "sdw-double-decker": "https://i.ibb.co/CsVRK0p0/Double-Decker-Sandwich.jpg",
        "sdw-grilled": "https://i.ibb.co/rGDgsJbM/Grilled-Sandwich.jpg",
        "sdw-paneer": "https://i.ibb.co/dsw5G4Kk/Paneer-Sandwich.jpg",
        "sdw-spicy": "https://i.ibb.co/YTb1G6fh/Spicy-Sandwich.jpg",
        "sdw-cheesy": "https://i.ibb.co/XZKVpGT8/Cheesy-Sandwich.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Sandwich' && item.id && SANDWICH_IMAGE_MAP[item.id]) {
            if (item.img !== SANDWICH_IMAGE_MAP[item.id]) {
                item.img = SANDWICH_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 6. Sanitize Momos items
    const hasOldMomos = updated.some(i => i.category === 'Momos' && (i.id === 'mom-1' || i.id === 'mom-2' || i.id === 'mom-3' || i.id === 'mom-4' || (i.name && i.name.startsWith('Momos Option')) || !NEW_MOMOS_MENU_ITEMS.some(nm => nm.id === i.id || nm.name === i.name)));
    if (hasOldMomos) {
        const nonMomos = updated.filter(i => i.category !== 'Momos');
        updated = [...nonMomos, ...NEW_MOMOS_MENU_ITEMS];
        modified = true;
    }

    const MOMOS_IMAGE_MAP = {
        "mom-chilly-paneer": "https://i.ibb.co/8npwRhND/Chilly-Paneer-Momos.jpg",
        "mom-chilly-veg": "https://i.ibb.co/C3fxBr0n/Chilly-Veg-Momos.jpg",
        "mom-crispy-paneer": "https://i.ibb.co/7dCpxDhH/Crispy-Paneer-Momos.jpg",
        "mom-crispy-veg": "https://i.ibb.co/20ZqGQqs/Crispy-Veg-Momos.jpg",
        "mom-pan-fried-paneer": "https://i.ibb.co/rKg6g0zf/Pan-Fried-Paneer-Momos.jpg",
        "mom-pan-fried-veg": "https://i.ibb.co/BH0S6hGj/Pan-Fried-Veg-Momo.jpg",
        "mom-paneer": "https://i.ibb.co/B786z53/Paneer-Momos.jpg",
        "mom-special-paneer": "https://i.ibb.co/zVWhf66r/Special-Paneer-Momos.jpg",
        "mom-tandoori-paneer": "https://i.ibb.co/chtDHFmG/Tandoori-Paneer-Momos.jpg",
        "mom-tandoori-veg": "https://i.ibb.co/yFSGcBsD/Tandoori-Veg-Momos.jpg",
        "mom-veg": "https://i.ibb.co/0RTw1B4c/Veg-Momos.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Momos' && item.id && MOMOS_IMAGE_MAP[item.id]) {
            if (item.img !== MOMOS_IMAGE_MAP[item.id]) {
                item.img = MOMOS_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 7. Sanitize Hot & Cold Coffee items
    const hasOldCoffee = updated.some(i => (i.category === 'Hot Cold Coffee' || i.category === 'Coffee' || i.category === 'Hot & Cold Coffee') && (i.id === 'cof-1' || i.id === 'cof-2' || i.id === 'cof-3' || i.id === 'cof-4' || (i.name && i.name.startsWith('Hot Cold Coffee Option')) || !NEW_COFFEE_MENU_ITEMS.some(nc => nc.id === i.id || nc.name === i.name)));
    if (hasOldCoffee) {
        const nonCoffee = updated.filter(i => i.category !== 'Hot Cold Coffee' && i.category !== 'Coffee' && i.category !== 'Hot & Cold Coffee');
        updated = [...nonCoffee, ...NEW_COFFEE_MENU_ITEMS];
        modified = true;
    }

    const COFFEE_IMAGE_MAP = {
        "cof-cold": "https://i.ibb.co/NdjHqdXP/Cold-Coffee.jpg",
        "cof-hot": "https://i.ibb.co/mVQ3X1wp/Hot-Coffee.jpg"
    };
    updated.forEach(item => {
        if ((item.category === 'Hot Cold Coffee' || item.category === 'Coffee' || item.category === 'Hot & Cold Coffee') && item.id && COFFEE_IMAGE_MAP[item.id]) {
            if (item.img !== COFFEE_IMAGE_MAP[item.id]) {
                item.img = COFFEE_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 8. Sanitize Noodles items
    const hasOldNoodles = updated.some(i => i.category === 'Noodles' && (i.id === 'ndl-1' || i.id === 'ndl-2' || i.id === 'ndl-3' || i.id === 'ndl-4' || (i.name && i.name.startsWith('Noodles Option')) || !NEW_NOODLES_MENU_ITEMS.some(nn => nn.id === i.id || nn.name === i.name)));
    if (hasOldNoodles) {
        const nonNoodles = updated.filter(i => i.category !== 'Noodles');
        updated = [...nonNoodles, ...NEW_NOODLES_MENU_ITEMS];
        modified = true;
    }

    const NOODLES_IMAGE_MAP = {
        "ndl-butter-paneer": "https://i.ibb.co/Qv9TGVwy/Butter-Paneer-Noodles.jpg",
        "ndl-chilly-garlic": "https://i.ibb.co/ycQT35rB/Chilly-Garlic-Noodles.jpg",
        "ndl-haka": "https://i.ibb.co/WvG995DF/Haka-Noodles.jpg",
        "ndl-paneer": "https://i.ibb.co/Cpwx1BY5/Paneer-Noodles.jpg",
        "ndl-singapuri": "https://i.ibb.co/M0KJsvz/Singapuri-Noodles.jpg",
        "ndl-veg": "https://i.ibb.co/21JBqyRP/Veg-Noodles.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Noodles' && item.id && NOODLES_IMAGE_MAP[item.id]) {
            if (item.img !== NOODLES_IMAGE_MAP[item.id]) {
                item.img = NOODLES_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 9. Sanitize Desserts items
    const hasOldDesserts = updated.some(i => i.category === 'Desserts' && (i.id === 'des-1' || i.id === 'des-2' || i.id === 'des-3' || i.id === 'des-4' || (i.name && i.name.startsWith('Desserts Option')) || !NEW_DESSERTS_MENU_ITEMS.some(nd => nd.id === i.id || nd.name === i.name)));
    if (hasOldDesserts) {
        const nonDesserts = updated.filter(i => i.category !== 'Desserts');
        updated = [...nonDesserts, ...NEW_DESSERTS_MENU_ITEMS];
        modified = true;
    }

    const DESSERTS_IMAGE_MAP = {
        "des-ice-cream-vanilla": "https://i.ibb.co/t5SyXgM/Ice-Cream-Vanilla.jpg",
        "des-lava-cake-ice-cream": "https://i.ibb.co/7tVhrnxQ/Lava-Cake-With-Ice-Cream.jpg",
        "des-lava-cake": "https://i.ibb.co/wZQSKRvS/Lava-Cake.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Desserts' && item.id && DESSERTS_IMAGE_MAP[item.id]) {
            if (item.img !== DESSERTS_IMAGE_MAP[item.id]) {
                item.img = DESSERTS_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 10. Sanitize Salad items
    const hasOldSalad = updated.some(i => i.category === 'Salad' && (i.id === 'sld-1' || i.id === 'sld-2' || i.id === 'sld-3' || i.id === 'sld-4' || (i.name && i.name.startsWith('Salad Option')) || !NEW_SALAD_MENU_ITEMS.some(ns => ns.id === i.id || ns.name === i.name)));
    if (hasOldSalad) {
        const nonSalad = updated.filter(i => i.category !== 'Salad');
        updated = [...nonSalad, ...NEW_SALAD_MENU_ITEMS];
        modified = true;
    }

    const SALAD_IMAGE_MAP = {
        "sld-green": "https://i.ibb.co/dwWmX7HX/Green-Salad.jpg",
        "sld-perfetto-special": "https://i.ibb.co/2YS2PS1s/Perfetto-Special-Salad.jpg",
        "sld-russian": "https://i.ibb.co/ds4XYn5d/Russian-Salad.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Salad' && item.id && SALAD_IMAGE_MAP[item.id]) {
            if (item.img !== SALAD_IMAGE_MAP[item.id]) {
                item.img = SALAD_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 11. Sanitize Side Orders items
    const hasOldSideOrders = updated.some(i => i.category === 'Side Orders' && (i.id === 'sde-1' || i.id === 'sde-2' || i.id === 'sde-3' || i.id === 'sde-4' || (i.name && i.name.startsWith('Side Orders Option')) || !NEW_SIDE_ORDERS_MENU_ITEMS.some(nso => nso.id === i.id || nso.name === i.name)));
    if (hasOldSideOrders) {
        const nonSideOrders = updated.filter(i => i.category !== 'Side Orders');
        updated = [...nonSideOrders, ...NEW_SIDE_ORDERS_MENU_ITEMS];
        modified = true;
    }

    const SIDE_ORDERS_IMAGE_MAP = {
        "sde-french-fries": "https://i.ibb.co/3y4xtxj7/French-Fries.jpg",
        "sde-masala-fries": "https://i.ibb.co/KxGpWPHz/Masala-Fries.jpg",
        "sde-paneer-parcel": "https://i.ibb.co/dwSwJ6zK/Paneer-Parcel.jpg",
        "sde-peri-peri-fries": "https://i.ibb.co/PGK7N3mJ/Peri-Peri-Fries.jpg",
        "sde-saucy-fries": "https://i.ibb.co/gZ0RCYrS/Saucy-Fries.jpg",
        "sde-taco": "https://i.ibb.co/ZzKMq3h7/Taco.jpg",
        "sde-zingy-parcel": "https://i.ibb.co/WNfHNVBk/Zingy-Parcel.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Side Orders' && item.id && SIDE_ORDERS_IMAGE_MAP[item.id]) {
            if (item.img !== SIDE_ORDERS_IMAGE_MAP[item.id]) {
                item.img = SIDE_ORDERS_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 12. Sanitize Cold Drinks items
    const hasOldColdDrinks = updated.some(i => (i.category === 'Colo Drinks' || i.category === 'Cold Drinks') && (i.id === 'drk-1' || i.id === 'drk-2' || i.id === 'drk-3' || (i.name && i.name.startsWith('Colo Drinks Option')) || !NEW_COLD_DRINKS_MENU_ITEMS.some(ncd => ncd.id === i.id || ncd.name === i.name)));
    if (hasOldColdDrinks) {
        const nonColdDrinks = updated.filter(i => i.category !== 'Colo Drinks' && i.category !== 'Cold Drinks');
        updated = [...nonColdDrinks, ...NEW_COLD_DRINKS_MENU_ITEMS];
        modified = true;
    }

    const COLD_DRINKS_IMAGE_MAP = {
        "drk-coke-300ml": "https://i.ibb.co/r2JVJSMg/Coke-300ml.jpg",
        "drk-coke-ice-cream": "https://i.ibb.co/jcQ2SVP/Coke-With-Ice-Cream.jpg",
        "drk-milky-cola": "https://i.ibb.co/Mk3VkTbK/Milky-Cola.jpg",
        "drk-milky-mango": "https://i.ibb.co/35LxWDgq/Milky-Mango.jpg"
    };
    updated.forEach(item => {
        if ((item.category === 'Colo Drinks' || item.category === 'Cold Drinks') && item.id && COLD_DRINKS_IMAGE_MAP[item.id]) {
            if (item.img !== COLD_DRINKS_IMAGE_MAP[item.id]) {
                item.img = COLD_DRINKS_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 13. Sanitize Mojito items
    const hasOldMojito = updated.some(i => i.category === 'Mojito' && (i.id === 'moj-1' || i.id === 'moj-2' || i.id === 'moj-3' || i.id === 'moj-4' || (i.name && i.name.startsWith('Mojito Option')) || !NEW_MOJITO_MENU_ITEMS.some(nm => nm.id === i.id || nm.name === i.name)));
    if (hasOldMojito) {
        const nonMojito = updated.filter(i => i.category !== 'Mojito');
        updated = [...nonMojito, ...NEW_MOJITO_MENU_ITEMS];
        modified = true;
    }

    const MOJITO_IMAGE_MAP = {
        "moj-fresh-lime-soda": "https://i.ibb.co/tMGr4c9y/Fresh-Lime-Soda.jpg",
        "moj-green-apple": "https://i.ibb.co/fGy3Rt0C/Green-Apple-Mojito.jpg",
        "moj-mineral-water": "https://i.ibb.co/35d2ZxDD/Mineral-Water-Soft-Drink.jpg",
        "moj-mint": "https://i.ibb.co/Lzn2WZPk/Mint-Mojito.jpg",
        "moj-strawberry": "https://i.ibb.co/5XnrXt5d/Strawberry-Mojito.jpg",
        "moj-virgin": "https://i.ibb.co/B24VCS65/Virgin-Mojito.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Mojito' && item.id && MOJITO_IMAGE_MAP[item.id]) {
            if (item.img !== MOJITO_IMAGE_MAP[item.id]) {
                item.img = MOJITO_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    // 14. Sanitize Spring Rolls items
    const hasOldSpringRolls = updated.some(i => i.category === 'Spring Rolls' && (i.id === 'spr-1' || i.id === 'spr-2' || i.id === 'spr-3' || i.id === 'spr-4' || (i.name && i.name.startsWith('Spring Rolls Option')) || !NEW_SPRING_ROLLS_MENU_ITEMS.some(ns => ns.id === i.id || ns.name === i.name)));
    if (hasOldSpringRolls) {
        const nonSpringRolls = updated.filter(i => i.category !== 'Spring Rolls');
        updated = [...nonSpringRolls, ...NEW_SPRING_ROLLS_MENU_ITEMS];
        modified = true;
    }

    const SPRING_ROLLS_IMAGE_MAP = {
        "spr-chilly-paneer-kathi-roll": "https://i.ibb.co/vxh5Htcf/Chilly-Paneer-Kathi-Roll.jpg",
        "spr-crispy-spring-roll": "https://i.ibb.co/Ngzq7HDS/Crispy-Spring-Roll.jpg",
        "spr-paneer-kathi-roll": "https://i.ibb.co/4wRYJtFg/Paneer-Kathi-Roll.jpg",
        "spr-spring-roll": "https://i.ibb.co/ZzYLkLfn/Spring-Roll.jpg",
        "spr-veg-kathi-roll": "https://i.ibb.co/YKVjDfb/Veg-Kathi-Roll.jpg"
    };
    updated.forEach(item => {
        if (item.category === 'Spring Rolls' && item.id && SPRING_ROLLS_IMAGE_MAP[item.id]) {
            if (item.img !== SPRING_ROLLS_IMAGE_MAP[item.id]) {
                item.img = SPRING_ROLLS_IMAGE_MAP[item.id];
                modified = true;
            }
        }
    });

    if (modified) {
        try {
            localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
    }
    return items;
}

function getStoredMenuItems() {
    try {
        const stored = localStorage.getItem(MENU_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return sanitizeStoredMenuItems(parsed);
            }
        }
    } catch (e) {
        console.warn('Error reading menuData from localStorage:', e);
    }
    return null;
}

function computeMenuHash(items) {
    if (!Array.isArray(items)) return '';
    return items.map(i => `${i.id}:${i.available !== false}:${i.price || 0}:${JSON.stringify(i.prices || {})}`).join('|');
}

// Synchronize in-cart items with live price and availability changes from Admin
function syncCartWithLatestMenu(freshItems) {
    if (!Array.isArray(cart) || cart.length === 0 || !Array.isArray(freshItems)) return;
    let changed = false;

    cart.forEach(cartItem => {
        // 1. Check if it's a Pizza with size e.g. "Hot Country (M)"
        const sizeMatch = cartItem.name.match(/^(.+?)\s*\((S|M|L)\)$/i);
        if (sizeMatch) {
            const pizzaName = sizeMatch[1].trim().toLowerCase();
            const size = sizeMatch[2].toUpperCase();
            const menuItem = freshItems.find(m => (m.name && m.name.toLowerCase() === pizzaName) || (m.id && m.id.toLowerCase() === pizzaName));
            if (menuItem) {
                const freshPrice = (menuItem.prices && menuItem.prices[size]) || cartItem.price;
                if (cartItem.price !== freshPrice) {
                    cartItem.price = freshPrice;
                    changed = true;
                }
                if (menuItem.available === false && cartItem.available !== false) {
                    cartItem.available = false;
                    changed = true;
                } else if (menuItem.available !== false && cartItem.available === false) {
                    cartItem.available = true;
                    changed = true;
                }
            }
        } else {
            // 2. Regular item (Burger, Shake, etc.)
            const menuItem = freshItems.find(m => (m.name && m.name.toLowerCase() === cartItem.name.toLowerCase()) || (m.id && m.id === cartItem.id));
            if (menuItem) {
                const freshPrice = menuItem.price !== undefined ? menuItem.price : cartItem.price;
                if (cartItem.price !== freshPrice) {
                    cartItem.price = freshPrice;
                    changed = true;
                }
                if (menuItem.available === false && cartItem.available !== false) {
                    cartItem.available = false;
                    changed = true;
                } else if (menuItem.available !== false && cartItem.available === false) {
                    cartItem.available = true;
                    changed = true;
                }
            }
        }
    });

    if (changed) {
        saveCartToStorage();
    }
}

// Seamlessly refresh active customer view in-place without page jump or loss of scroll position
function refreshActiveCustomerView(freshItems) {
    if (!Array.isArray(freshItems)) return;

    if (activeTabName === 'category-detail' && lastCategoryState.categoryName) {
        const subItemsGrid = document.getElementById('sub-items-grid');
        const heroCountEl = document.getElementById('category-hero-count');
        const categoryName = lastCategoryState.categoryName;
        const categoryImg = lastCategoryState.categoryImg;

        const items = getSubItems(categoryName, categoryImg);
        if (heroCountEl) heroCountEl.textContent = `${items.length} options available`;

        if (subItemsGrid) {
            if (categoryName === "Pizza") {
                subItemsGrid.classList.add('pizza-grid-container');
                subItemsGrid.innerHTML = items.map(item => {
                    const ingredients = item.desc ? item.desc.split(/[,&]/).map(s => s.trim()).filter(Boolean) : [];
                    const hasMoreThanFive = ingredients.length > 5;

                    let descMarkup = '';
                    if (hasMoreThanFive) {
                        const shortText = ingredients.slice(0, 5).join(', ') + '...';
                        const escFull = item.desc.replace(/"/g, '&quot;');
                        const escShort = shortText.replace(/"/g, '&quot;');
                        descMarkup = `<p class="pizza-card-desc" id="desc-${item.id}">
                            <span class="desc-text truncated" data-full="${escFull}" data-short="${escShort}">${shortText}</span>
                            <button class="more-btn" onclick="toggleIngredients('${item.id}', event)">More</button>
                           </p>`;
                    } else {
                        descMarkup = `<p class="pizza-card-desc" id="desc-${item.id}">
                            <span class="desc-text">${item.desc}</span>
                           </p>`;
                    }

                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const addBtnMarkup = isAvailable
                        ? `<button class="pizza-add-cart-btn" onclick="addPizzaToCart('${item.id}', event)"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="pizza-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    const prices = item.prices || { S: 199, M: 299, L: 399 };
                    
                    // Check if card currently has a selected size (e.g. S or L) to preserve user selection
                    const existingCard = document.querySelector(`.pizza-card[data-pizza-id="${item.id}"]`);
                    const selectedSize = (existingCard && existingCard.getAttribute('data-selected-size')) || 'M';
                    const basePrice = (prices && prices[selectedSize]) || (prices && prices.M) || 299;

                    const rates = getPizzaSizeAddonRates(selectedSize);
                    const selectedAddons = cardSelectedAddons[item.id] || { cheese: false, spicy: false, mayo: false };
                    const currentTotal = basePrice + (selectedAddons.cheese ? rates.extraCheese : 0) + (selectedAddons.spicy ? rates.extraSpicy : 0) + (selectedAddons.mayo ? rates.extraMayo : 0);

                    const addonsMarkup = isAvailable ? `
                        <div class="burger-addon-selector pizza-addon-selector">
                            <div class="addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="burger-addon-options">
                                <button type="button" class="burger-addon-box ${selectedAddons.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${item.id}" data-addon="cheese" title="Extra Cheese (+₹${rates.extraCheese})" onclick="togglePizzaAddon('${item.id}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="burger-addon-box ${selectedAddons.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${item.id}" data-addon="spicy" title="Extra Spicy (${rates.extraSpicy > 0 ? `+₹${rates.extraSpicy}` : 'Free'})" onclick="togglePizzaAddon('${item.id}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="burger-addon-box ${selectedAddons.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${item.id}" data-addon="mayo" title="Extra Mayo (+₹${rates.extraMayo})" onclick="togglePizzaAddon('${item.id}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    return `
                    <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="${selectedSize}" data-current-price="${currentTotal}">
                        ${outOfStockBadge}
                        <div class="pizza-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="pizza-card-img" loading="lazy">
                        </div>
                        <div class="pizza-card-body">
                            <h4 class="pizza-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${descMarkup}
                            
                            <div class="pizza-size-selector">
                                <span class="size-label">Size:</span>
                                <div class="size-options">
                                    <button class="size-btn ${selectedSize === 'S' ? 'selected' : ''}" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                                    <button class="size-btn ${selectedSize === 'M' ? 'selected' : ''}" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                                    <button class="size-btn ${selectedSize === 'L' ? 'selected' : ''}" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
                                </div>
                            </div>

                            ${addonsMarkup}
                            
                            <div class="pizza-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="pizza-card-price" id="price-${item.id}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Burger" || categoryName === "Wrap") {
                const isWrap = categoryName === "Wrap";
                const prefix = isWrap ? 'wrap' : 'burger';
                const catAddons = getCustomerCategoryAddons(categoryName);
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : (isWrap ? 30 : 25);
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = `sub-items-grid ${prefix}-grid-container grid grid-cols-2 gap-3`;
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 99) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="burger-addon-selector">
                            <div class="addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="burger-addon-options">
                                <button type="button" class="burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('${categoryName}', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('${categoryName}', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('${categoryName}', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="${prefix}-add-cart-btn" onclick="addCardWithAddonsToCart('${categoryName}', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="${prefix}-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="${prefix}-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="${prefix}-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="${prefix}-card-img" loading="lazy">
                        </div>
                        <div class="${prefix}-card-body">
                            <h4 class="${prefix}-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="${prefix}-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="${prefix}-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Bread") {
                const catAddons = getCustomerCategoryAddons('Bread');
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = 'sub-items-grid bread-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 99) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="bread-addon-selector burger-addon-selector">
                            <div class="addon-label bread-addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="bread-addon-options burger-addon-options">
                                <button type="button" class="bread-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('Bread', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="bread-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Bread', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="bread-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('Bread', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="bread-add-cart-btn" onclick="addCardWithAddonsToCart('Bread', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="bread-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="bread-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="bread-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="bread-card-img" loading="lazy">
                        </div>
                        <div class="bread-card-body">
                            <h4 class="bread-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="bread-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="bread-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Sandwich") {
                const catAddons = getCustomerCategoryAddons('Sandwich');
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = 'sub-items-grid sandwich-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 99) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="sandwich-addon-selector burger-addon-selector">
                            <div class="addon-label sandwich-addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="sandwich-addon-options burger-addon-options">
                                <button type="button" class="sandwich-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('Sandwich', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="sandwich-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Sandwich', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="sandwich-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('Sandwich', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="sandwich-add-cart-btn" onclick="addCardWithAddonsToCart('Sandwich', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="sandwich-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="sandwich-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="sandwich-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="sandwich-card-img" loading="lazy">
                        </div>
                        <div class="sandwich-card-body">
                            <h4 class="sandwich-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="sandwich-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="sandwich-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Momos") {
                const catAddons = getCustomerCategoryAddons('Momos');
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = 'sub-items-grid momos-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 99) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="momos-addon-selector burger-addon-selector">
                            <div class="addon-label momos-addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="momos-addon-options burger-addon-options">
                                <button type="button" class="momos-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('Momos', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="momos-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Momos', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="momos-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('Momos', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="momos-add-cart-btn" onclick="addCardWithAddonsToCart('Momos', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="momos-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="momos-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="momos-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="momos-card-img" loading="lazy">
                        </div>
                        <div class="momos-card-body">
                            <h4 class="momos-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="momos-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="momos-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Pasta") {
                const catAddons = getCustomerCategoryAddons('Pasta');
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = 'sub-items-grid pasta-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 129) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="pasta-addon-selector burger-addon-selector">
                            <div class="addon-label pasta-addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="pasta-addon-options burger-addon-options">
                                <button type="button" class="pasta-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('Pasta', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="pasta-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Pasta', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="pasta-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('Pasta', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="pasta-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Pasta', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 129}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="pasta-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="pasta-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="pasta-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="pasta-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="pasta-card-body burger-card-body">
                            <h4 class="pasta-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="pasta-price-row burger-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="pasta-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Chinese Food" || categoryName === "Chinese") {
                const catAddons = getCustomerCategoryAddons('Chinese Food');
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = 'sub-items-grid chinese-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 129) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="chinese-addon-selector burger-addon-selector">
                            <div class="addon-label chinese-addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="chinese-addon-options burger-addon-options">
                                <button type="button" class="chinese-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('Chinese Food', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="chinese-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Chinese Food', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="chinese-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('Chinese Food', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="chinese-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Chinese Food', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 129}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="chinese-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="chinese-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="chinese-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="chinese-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="chinese-card-body burger-card-body">
                            <h4 class="chinese-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="chinese-price-row burger-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="chinese-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Shake") {
                const catAddons = getCustomerCategoryAddons('Shake');
                const iceCreamPrice = catAddons.withIceCream !== undefined ? catAddons.withIceCream : 30;

                subItemsGrid.className = 'sub-items-grid shake-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { iceCream: false };

                    const currentTotal = (item.price || 119) + (selected.iceCream ? iceCreamPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="shake-addon-selector burger-addon-selector">
                            <div class="addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="shake-addon-options">
                                <button type="button" class="shake-icecream-chip ${selected.iceCream ? 'selected active' : ''}" id="box-icecream-${itemId}" onclick="toggleShakeIceCreamAddon('${itemId}', event)" title="With Ice Cream (+₹${iceCreamPrice})">
                                    🍨 With Ice Cream
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="shake-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Shake', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 119}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="shake-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="shake-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="shake-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="shake-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="shake-card-body burger-card-body">
                            <h4 class="shake-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="shake-price-row burger-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="shake-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Rice") {
                subItemsGrid.className = 'sub-items-grid rice-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                    const addBtnMarkup = isAvailable
                        ? `<button class="rice-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 119}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="rice-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="rice-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="rice-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="rice-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="rice-card-body burger-card-body">
                            <h4 class="rice-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="rice-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                                <span class="price-prefix">Price:</span>
                                <span class="rice-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 119)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Hot Cold Coffee" || categoryName === "Hot & Cold Coffee" || categoryName === "Coffee") {
                subItemsGrid.className = 'sub-items-grid coffee-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                    const addBtnMarkup = isAvailable
                        ? `<button class="coffee-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="coffee-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="coffee-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="coffee-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="coffee-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="coffee-card-body burger-card-body">
                            <h4 class="coffee-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="coffee-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                                <span class="price-prefix">Price:</span>
                                <span class="coffee-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 99)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Noodles") {
                const catAddons = getCustomerCategoryAddons('Noodles');
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = 'sub-items-grid noodles-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 119) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="noodles-addon-selector burger-addon-selector">
                            <div class="addon-label noodles-addon-label burger-addon-label">ADD-<br>ONS:</div>
                            <div class="noodles-addon-options burger-addon-options">
                                <button type="button" class="noodles-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('Noodles', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="noodles-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Noodles', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="noodles-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('Noodles', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="noodles-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Noodles', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 119}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="noodles-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="noodles-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="noodles-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="noodles-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="noodles-card-body burger-card-body">
                            <h4 class="noodles-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            ${boxesMarkup}
                            <div class="noodles-price-row burger-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="noodles-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Desserts") {
                subItemsGrid.className = 'sub-items-grid desserts-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                    const addBtnMarkup = isAvailable
                        ? `<button class="desserts-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="desserts-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="desserts-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="desserts-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="desserts-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="desserts-card-body burger-card-body">
                            <h4 class="desserts-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="desserts-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                                <span class="price-prefix">Price:</span>
                                <span class="desserts-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 99)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Salad") {
                subItemsGrid.className = 'sub-items-grid salad-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                    const addBtnMarkup = isAvailable
                        ? `<button class="salad-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 69}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="salad-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="salad-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="salad-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="salad-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="salad-card-body burger-card-body">
                            <h4 class="salad-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="salad-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                                <span class="price-prefix">Price:</span>
                                <span class="salad-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 69)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Side Orders") {
                subItemsGrid.className = 'sub-items-grid side-orders-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                    const addBtnMarkup = isAvailable
                        ? `<button class="side-orders-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 89}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="side-orders-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="side-orders-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="side-orders-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="side-orders-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="side-orders-card-body burger-card-body">
                            <h4 class="side-orders-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="side-orders-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                                <span class="price-prefix">Price:</span>
                                <span class="side-orders-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 89)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Colo Drinks" || categoryName === "Cold Drinks") {
                subItemsGrid.className = 'sub-items-grid cold-drinks-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                    const addBtnMarkup = isAvailable
                        ? `<button class="cold-drinks-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 40}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="cold-drinks-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="cold-drinks-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="cold-drinks-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="cold-drinks-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="cold-drinks-card-body burger-card-body">
                            <h4 class="cold-drinks-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="cold-drinks-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                                <span class="price-prefix">Price:</span>
                                <span class="cold-drinks-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 40)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Mojito") {
                subItemsGrid.className = 'sub-items-grid mojito-grid-container grid grid-cols-2 gap-3';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                    const addBtnMarkup = isAvailable
                        ? `<button class="mojito-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 79}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="mojito-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="mojito-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                        ${outOfStockBadge}
                        <div class="mojito-card-image-wrapper burger-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="mojito-card-img burger-card-img" loading="lazy">
                        </div>
                        <div class="mojito-card-body burger-card-body">
                            <h4 class="mojito-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="mojito-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                                <span class="price-prefix">Price:</span>
                                <span class="mojito-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 79)}</span>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else if (categoryName === "Spring Rolls") {
                const catAddons = getCustomerCategoryAddons('Spring Rolls');
                const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
                const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
                const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

                subItemsGrid.className = 'sub-items-grid spring-rolls-grid-container';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                    const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                    const currentTotal = (item.price || 99) +
                        (selected.cheese ? cheesePrice : 0) +
                        (selected.spicy ? spicyPrice : 0) +
                        (selected.mayo ? mayoPrice : 0);

                    const boxesMarkup = isAvailable ? `
                        <div class="spring-rolls-addon-selector">
                            <span class="spring-rolls-addon-label">ADD-ONS:</span>
                            <div class="spring-rolls-addon-options">
                                <button type="button" class="spring-rolls-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="Extra Cheese (+₹${cheesePrice})" onclick="toggleCardAddon('Spring Rolls', '${itemId}', 'cheese', event)">
                                    🧀
                                </button>
                                <button type="button" class="spring-rolls-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="Extra Spicy (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Spring Rolls', '${itemId}', 'spicy', event)">
                                    🌶️
                                </button>
                                <button type="button" class="spring-rolls-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="Extra Mayo (+₹${mayoPrice})" onclick="toggleCardAddon('Spring Rolls', '${itemId}', 'mayo', event)">
                                    🍥
                                </button>
                            </div>
                        </div>
                    ` : '';

                    const addBtnMarkup = isAvailable
                        ? `<button class="spring-rolls-add-cart-btn" onclick="addCardWithAddonsToCart('Spring Rolls', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                        : `<button class="spring-rolls-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

                    return `
                    <div class="spring-rolls-card ${outOfStockClass}" data-item-id="${itemId}" data-category="Spring Rolls">
                        ${outOfStockBadge}
                        <div class="spring-rolls-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="spring-rolls-card-img" loading="lazy">
                        </div>
                        <div class="spring-rolls-card-body">
                            <h4 class="spring-rolls-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${item.name}</span></h4>
                            <div class="spring-rolls-action-row">
                                ${boxesMarkup}
                                <div class="spring-rolls-price-row">
                                    <span class="price-prefix">Price:</span>
                                    <span class="spring-rolls-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                                </div>
                            </div>
                        </div>
                        ${addBtnMarkup}
                    </div>
                    `;
                }).join('');
            } else {
                subItemsGrid.className = 'sub-items-grid';
                subItemsGrid.innerHTML = items.map(item => {
                    const isAvailable = item.available !== false;
                    const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                    const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';
                    const addBtnMarkup = isAvailable
                        ? `<button class="add-subitem-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.img}')"><i class="fa-solid fa-plus"></i> Add</button>`
                        : `<button class="add-subitem-btn disabled" disabled><i class="fa-solid fa-ban"></i> Out of Stock</button>`;

                    return `
                    <div class="sub-item-card ${outOfStockClass}">
                        ${outOfStockBadge}
                        <div class="sub-item-img-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="sub-item-img" loading="lazy">
                        </div>
                        <div class="sub-item-details">
                            <div class="sub-item-top-row">
                                <span class="sub-item-name">${item.name}</span>
                                ${item.tag ? `<span class="sub-item-tag">${item.tag}</span>` : ''}
                            </div>
                            <p class="sub-item-desc">${item.desc}</p>
                            <div class="sub-item-bottom-row">
                                <span class="sub-item-price">${formatPrice(item.price)}</span>
                                ${addBtnMarkup}
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');
            }
        }
    } else if (activeTabName === 'search-results') {
        const searchInput = document.getElementById('customer-search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            renderCustomerSearchResults(searchInput.value.toLowerCase().trim(), searchInput.value);
        }
    }

    // Refresh cart in case prices or availability of in-cart items changed
    updateCartUI();

    // Check and apply smooth marquee scrolling for overflowing card titles
    applyMarqueeToOverflowTitles();
}

// Background Live Menu Poller & Server Synchronization
async function fetchLiveMenuFromBackend() {
    try {
        const res = await fetch(resolveApiUrl('/api/menu'));
        const data = await res.json();
        if (data && data.success && Array.isArray(data.items) && data.items.length > 0) {
            if (data.categoryAddons) {
                try {
                    customerCategoryAddons = { ...DEFAULT_CATEGORY_ADDONS, ...data.categoryAddons };
                    localStorage.setItem('perfetto_category_addons', JSON.stringify(customerCategoryAddons));
                } catch (e) { }
            }
            const freshItems = sanitizeStoredMenuItems(data.items) || data.items;
            const newHash = computeMenuHash(freshItems);
            const stored = getStoredMenuItems();
            const oldHash = computeMenuHash(stored || []);

            if (newHash !== oldHash || !stored || stored.length === 0) {
                try {
                    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(freshItems));
                } catch (e) { }
                refreshActiveCustomerView(freshItems);
            }
        }
    } catch (err) {
        // Graceful offline fallback - continue using local cached menu
    }
}

// Background Live Store Settings Fetch & Server Synchronization
async function fetchLiveSettingsFromBackend() {
    try {
        const res = await fetch(resolveApiUrl('/api/settings'));
        const data = await res.json();
        if (data && data.success && data.settings) {
            const s = data.settings;
            if (s.minOrderValue !== undefined) localStorage.setItem(MIN_ORDER_KEY, String(s.minOrderValue));
            if (s.freeDeliveryLimit !== undefined) localStorage.setItem(FREE_DELIVERY_KEY, String(s.freeDeliveryLimit));
            if (s.customerCarePhone !== undefined) localStorage.setItem(CUSTOMER_CARE_PHONE_KEY, String(s.customerCarePhone));
            if (s.customerCareEnabled !== undefined) localStorage.setItem(CUSTOMER_CARE_ENABLED_KEY, String(data.customerCareEnabled));
            if (s.restaurantLat !== undefined) localStorage.setItem(RESTAURANT_LAT_KEY, String(s.restaurantLat));
            if (s.restaurantLng !== undefined) localStorage.setItem(RESTAURANT_LNG_KEY, String(s.restaurantLng));
            if (s.deliveryRadius !== undefined) localStorage.setItem(DELIVERY_RADIUS_KEY, String(s.deliveryRadius));
            if (s.zoneCharges !== undefined) localStorage.setItem(ZONE_CHARGES_KEY, JSON.stringify(s.zoneCharges));
            if (s.shopStatus !== undefined) localStorage.setItem(SHOP_STATUS_KEY, String(s.shopStatus));
            if (s.openingTime !== undefined) localStorage.setItem(OPENING_TIME_KEY, String(s.openingTime));
            if (s.closingTime !== undefined) localStorage.setItem(CLOSING_TIME_KEY, String(s.closingTime));
            if (s.autoScheduleEnabled !== undefined) localStorage.setItem(AUTO_SCHEDULE_KEY, String(s.autoScheduleEnabled));
            if (s.manualOverride !== undefined) localStorage.setItem(MANUAL_OVERRIDE_KEY, String(s.manualOverride));
            if (s.manualCloseDate !== undefined) {
                if (s.manualCloseDate) localStorage.setItem(MANUAL_CLOSE_DATE_KEY, String(s.manualCloseDate));
                else localStorage.removeItem(MANUAL_CLOSE_DATE_KEY);
            }

            applyRealtimeStoreSettings();
            checkAndUpdateShopStatusUI();
        }
    } catch (err) {
        // Graceful offline fallback
    }

    // Also fetch dynamic daily banners
    fetchLiveBannersFromBackend();
}

async function fetchLiveBannersFromBackend() {
    if (typeof customerFirestore !== 'undefined' && customerFirestore) {
        try {
            const doc = await customerFirestore.collection('settings').doc('daily_banners').get();
            if (doc.exists && doc.data() && Array.isArray(doc.data().banners) && doc.data().banners.length > 0) {
                const normalized = doc.data().banners.slice(0, 4).map((b, i) => ({
                    id: b.id || `b${i + 1}`,
                    url: resolveBannerUrl(b.url),
                    enabled: b.enabled !== false
                }));
                localStorage.setItem('perfetto_daily_banners', JSON.stringify(normalized));
                renderDynamicOfferSlider(normalized);
                return;
            }
        } catch (e) {
            console.warn('Direct Firestore daily banners fetch notice:', e.message);
        }
    }

    try {
        const res = await fetch(resolveApiUrl('/api/banners'));
        if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.banners) && data.banners.length > 0) {
                const normalized = data.banners.slice(0, 4).map((b, i) => ({
                    id: b.id || `b${i + 1}`,
                    url: resolveBannerUrl(b.url),
                    enabled: b.enabled !== false
                }));
                localStorage.setItem('perfetto_daily_banners', JSON.stringify(normalized));
                renderDynamicOfferSlider(normalized);
                return;
            }
        }
    } catch (e) { }

    const local = localStorage.getItem('perfetto_daily_banners');
    if (local) {
        try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
                renderDynamicOfferSlider(parsed);
                return;
            }
        } catch (e) { }
    }
    renderDynamicOfferSlider(DEFAULT_DAILY_BANNERS);
}

// Check if any items currently in customer's cart are marked unavailable in the latest menu
function validateCartAvailability() {
    const allItems = getAllCustomerMenuItems();
    const unavailableInCart = [];

    cart.forEach(cartItem => {
        const cleanName = (cartItem.name || '').replace(/\s*\([SML]\)$/i, '').trim();
        const found = allItems.find(i =>
            (i.name && i.name.toLowerCase() === cleanName.toLowerCase()) ||
            (i.id && cartItem.id && i.id === cartItem.id)
        );
        if (found && found.available === false) {
            unavailableInCart.push(cartItem.name);
        }
    });

    return unavailableInCart;
}

function getSubItems(categoryName, categoryImg) {
    const storedItems = getStoredMenuItems();
    if (storedItems) {
        const catItems = storedItems.filter(i => i.category === categoryName);
        if (catItems.length > 0) {
            return catItems.map(item => ({
                ...item,
                img: item.img || categoryImg,
                available: item.available !== false
            }));
        }
    }

    if (categorySubItems[categoryName]) {
        return categorySubItems[categoryName].map(item => ({
            ...item,
            img: item.img || categoryImg,
            available: true
        }));
    }

    return [
        { id: `${categoryName}-1`, name: `${categoryName} Option 1`, desc: `Freshly prepared item variation for ${categoryName}`, price: 179.00, tag: "Variety 1", img: categoryImg, available: true },
        { id: `${categoryName}-2`, name: `${categoryName} Option 2`, desc: `Special chef recipe variation for ${categoryName}`, price: 199.00, tag: "Variety 2", img: categoryImg, available: true },
        { id: `${categoryName}-3`, name: `${categoryName} Option 3`, desc: `Deluxe portion variation for ${categoryName}`, price: 219.00, tag: "Variety 3", img: categoryImg, available: true },
        { id: `${categoryName}-4`, name: `${categoryName} Option 4`, desc: `Combo style variation for ${categoryName}`, price: 259.00, tag: "Variety 4", img: categoryImg, available: true }
    ];
}

function changePizzaSize(pizzaId, size, basePrice, event) {
    if (event) event.stopPropagation();

    const card = document.querySelector(`.pizza-card[data-pizza-id="${pizzaId}"]`);
    if (!card) return;

    card.setAttribute('data-selected-size', size);

    const sizeBtns = card.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
        if (btn.getAttribute('data-size') === size) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
        btn.classList.remove('active');
    });

    // Update tooltips on add-on buttons for current size rates
    const rates = getPizzaSizeAddonRates(size);
    const cheeseBox = document.getElementById(`box-cheese-${pizzaId}`);
    const spicyBox = document.getElementById(`box-spicy-${pizzaId}`);
    const mayoBox = document.getElementById(`box-mayo-${pizzaId}`);
    if (cheeseBox) cheeseBox.setAttribute('title', `Extra Cheese (+₹${rates.extraCheese})`);
    if (spicyBox) spicyBox.setAttribute('title', `Extra Spicy (${rates.extraSpicy > 0 ? `+₹${rates.extraSpicy}` : 'Free'})`);
    if (mayoBox) mayoBox.setAttribute('title', `Extra Mayo (+₹${rates.extraMayo})`);

    recalculatePizzaCardPrice(pizzaId);
}

function toggleIngredients(pizzaId, event) {
    if (event) event.stopPropagation();
    const descEl = document.getElementById(`desc-${pizzaId}`);
    if (!descEl) return;

    const textSpan = descEl.querySelector('.desc-text');
    const btn = descEl.querySelector('.more-btn');
    if (!textSpan || !btn) return;

    const fullText = textSpan.getAttribute('data-full') || textSpan.textContent;
    const shortText = textSpan.getAttribute('data-short') || fullText;

    if (textSpan.classList.contains('truncated')) {
        textSpan.classList.remove('truncated');
        textSpan.classList.add('expanded');
        textSpan.textContent = fullText;
        btn.textContent = 'Less';
    } else {
        textSpan.classList.remove('expanded');
        textSpan.classList.add('truncated');
        textSpan.textContent = shortText;
        btn.textContent = 'More';
    }
}

function addPizzaToCart(pizzaId, event) {
    if (event) event.stopPropagation();

    const card = document.querySelector(`.pizza-card[data-pizza-id="${pizzaId}"]`);
    if (card && card.classList.contains('out-of-stock')) {
        showToast('⚠️ This pizza is currently out of stock.');
        return;
    }

    const pizzaList = getSubItems("Pizza");
    const item = pizzaList.find(p => p.id === pizzaId);
    if (!item || item.available === false) {
        showToast('⚠️ This pizza is currently out of stock.');
        return;
    }

    const selectedSize = (card && card.getAttribute('data-selected-size')) || 'M';
    const basePrice = (item.prices && item.prices[selectedSize]) || 299;
    const rates = getPizzaSizeAddonRates(selectedSize);
    const sel = cardSelectedAddons[pizzaId] || { cheese: false, spicy: false, mayo: false };

    const addons = [];
    let calculatedPrice = basePrice;

    if (sel.cheese) {
        addons.push({ name: 'Extra Cheese', price: rates.extraCheese });
        calculatedPrice += rates.extraCheese;
    }
    if (sel.spicy) {
        addons.push({ name: 'Extra Spicy', price: rates.extraSpicy });
        calculatedPrice += rates.extraSpicy;
    }
    if (sel.mayo) {
        addons.push({ name: '🍥 Extra Mayo', price: rates.extraMayo });
        calculatedPrice += rates.extraMayo;
    }

    const cartItemTitle = `${item.name} (${selectedSize})`;
    addToCart(cartItemTitle, calculatedPrice, item.img, addons);
}

function openCategoryDetail(categoryName, categoryImg, isRestoringState = false, isPopState = false) {
    // Record home scroll position before switching away if user is currently on the home screen
    if (activeTabName === 'home' && !isRestoringState) {
        lastHomeScrollY = getHomeScrollPosition();
    }

    const heroTitleEl = document.getElementById('category-hero-title');
    const heroImgEl = document.getElementById('category-hero-img');
    const heroCountEl = document.getElementById('category-hero-count');
    const subItemsGrid = document.getElementById('sub-items-grid');

    if (!isRestoringState) {
        lastCategoryState.categoryName = categoryName;
        lastCategoryState.categoryImg = categoryImg;
        lastCategoryState.scrollY = 0;
    }

    if (!isPopState) {
        history.pushState(
            { page: 'category-detail', categoryName, categoryImg },
            '',
            '#category-' + encodeURIComponent(categoryName)
        );
    }

    const items = getSubItems(categoryName, categoryImg);

    const translatedCat = typeof tCategory === 'function' ? tCategory(categoryName) : categoryName;
    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
    const titleText = isHindi
        ? (categoryName.toLowerCase().includes('menu') ? translatedCat : `${translatedCat} मेन्यू`)
        : (categoryName.toLowerCase().includes('menu') ? categoryName : `${categoryName} Menu`);
    if (heroTitleEl) heroTitleEl.textContent = titleText;
    if (heroImgEl) heroImgEl.src = categoryImg;
    if (heroCountEl) heroCountEl.textContent = `${items.length} ${typeof t === 'function' ? t('options_available') : 'options available'}`;

    if (subItemsGrid) {
        if (categoryName === "Pizza") {
            subItemsGrid.classList.add('pizza-grid-container');
            subItemsGrid.innerHTML = items.map(item => {
                const ingredients = item.desc ? item.desc.split(/[,&]/).map(s => s.trim()).filter(Boolean) : [];
                const hasMoreThanFive = ingredients.length > 5;

                let descMarkup = '';
                if (hasMoreThanFive) {
                    const shortText = ingredients.slice(0, 5).join(', ') + '...';
                    const escFull = item.desc.replace(/"/g, '&quot;');
                    const escShort = shortText.replace(/"/g, '&quot;');
                    descMarkup = `<p class="pizza-card-desc" id="desc-${item.id}">
                        <span class="desc-text truncated" data-full="${escFull}" data-short="${escShort}">${shortText}</span>
                        <button class="more-btn" onclick="toggleIngredients('${item.id}', event)">More</button>
                       </p>`;
                } else {
                    descMarkup = `<p class="pizza-card-desc" id="desc-${item.id}">
                        <span class="desc-text">${item.desc}</span>
                       </p>`;
                }

                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const addBtnMarkup = isAvailable
                    ? `<button class="pizza-add-cart-btn" onclick="addPizzaToCart('${item.id}', event)"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="pizza-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                const prices = item.prices || { S: 199, M: 299, L: 399 };
                const selectedSize = 'M';
                const basePrice = (prices && prices.M) || 299;
                const rates = getPizzaSizeAddonRates(selectedSize);
                const selectedAddons = cardSelectedAddons[item.id] || { cheese: false, spicy: false, mayo: false };
                const currentTotal = basePrice + (selectedAddons.cheese ? rates.extraCheese : 0) + (selectedAddons.spicy ? rates.extraSpicy : 0) + (selectedAddons.mayo ? rates.extraMayo : 0);

                const addonsMarkup = isAvailable ? `
                    <div class="burger-addon-selector pizza-addon-selector">
                        <div class="addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="burger-addon-options">
                            <button type="button" class="burger-addon-box ${selectedAddons.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${item.id}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${rates.extraCheese})" onclick="togglePizzaAddon('${item.id}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="burger-addon-box ${selectedAddons.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${item.id}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${rates.extraSpicy > 0 ? `+₹${rates.extraSpicy}` : 'Free'})" onclick="togglePizzaAddon('${item.id}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="burger-addon-box ${selectedAddons.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${item.id}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${rates.extraMayo})" onclick="togglePizzaAddon('${item.id}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                return `
                <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${currentTotal}">
                    ${outOfStockBadge}
                    <div class="pizza-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="pizza-card-img" loading="lazy">
                    </div>
                    <div class="pizza-card-body">
                        <h4 class="pizza-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${descMarkup}
                        
                        <div class="pizza-size-selector">
                            <span class="size-label">${typeof t === 'function' ? t('size_label') : 'Size:'}</span>
                            <div class="size-options">
                                <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                                <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                                <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
                            </div>
                        </div>

                        ${addonsMarkup}
                        
                        <div class="pizza-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="pizza-card-price" id="price-${item.id}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Burger" || categoryName === "Wrap") {
            const isWrap = categoryName === "Wrap";
            const prefix = isWrap ? 'wrap' : 'burger';
            const catAddons = getCustomerCategoryAddons(categoryName);
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : (isWrap ? 30 : 25);
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = `sub-items-grid ${prefix}-grid-container grid grid-cols-2 gap-3`;
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 99) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="burger-addon-selector">
                        <div class="addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="burger-addon-options">
                            <button type="button" class="burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('${categoryName}', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('${categoryName}', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('${categoryName}', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="${prefix}-add-cart-btn" onclick="addCardWithAddonsToCart('${categoryName}', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="${prefix}-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="${prefix}-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="${prefix}-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="${prefix}-card-img" loading="lazy">
                    </div>
                    <div class="${prefix}-card-body">
                        <h4 class="${prefix}-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="${prefix}-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="${prefix}-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Bread") {
            const catAddons = getCustomerCategoryAddons('Bread');
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = 'sub-items-grid bread-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 99) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="bread-addon-selector burger-addon-selector">
                        <div class="addon-label bread-addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="bread-addon-options burger-addon-options">
                            <button type="button" class="bread-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('Bread', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="bread-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Bread', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="bread-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('Bread', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="bread-add-cart-btn" onclick="addCardWithAddonsToCart('Bread', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="bread-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="bread-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="bread-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="bread-card-img" loading="lazy">
                    </div>
                    <div class="bread-card-body">
                        <h4 class="bread-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="bread-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="bread-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Sandwich") {
            const catAddons = getCustomerCategoryAddons('Sandwich');
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = 'sub-items-grid sandwich-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 99) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="sandwich-addon-selector burger-addon-selector">
                        <div class="addon-label sandwich-addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="sandwich-addon-options burger-addon-options">
                            <button type="button" class="sandwich-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('Sandwich', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="sandwich-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Sandwich', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="sandwich-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('Sandwich', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="sandwich-add-cart-btn" onclick="addCardWithAddonsToCart('Sandwich', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="sandwich-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="sandwich-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="sandwich-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="sandwich-card-img" loading="lazy">
                    </div>
                    <div class="sandwich-card-body">
                        <h4 class="sandwich-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="sandwich-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="sandwich-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Momos") {
            const catAddons = getCustomerCategoryAddons('Momos');
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = 'sub-items-grid momos-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 99) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="momos-addon-selector burger-addon-selector">
                        <div class="addon-label momos-addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="momos-addon-options burger-addon-options">
                            <button type="button" class="momos-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('Momos', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="momos-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Momos', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="momos-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('Momos', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="momos-add-cart-btn" onclick="addCardWithAddonsToCart('Momos', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="momos-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="momos-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="momos-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="momos-card-img" loading="lazy">
                    </div>
                    <div class="momos-card-body">
                        <h4 class="momos-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="momos-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="momos-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Pasta") {
            const catAddons = getCustomerCategoryAddons('Pasta');
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = 'sub-items-grid pasta-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 129) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="pasta-addon-selector burger-addon-selector">
                        <div class="addon-label pasta-addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="pasta-addon-options burger-addon-options">
                            <button type="button" class="pasta-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('Pasta', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="pasta-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Pasta', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="pasta-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('Pasta', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="pasta-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Pasta', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 129}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="pasta-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="pasta-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="pasta-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="pasta-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="pasta-card-body burger-card-body">
                        <h4 class="pasta-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="pasta-price-row burger-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="pasta-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Chinese Food" || categoryName === "Chinese") {
            const catAddons = getCustomerCategoryAddons('Chinese Food');
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = 'sub-items-grid chinese-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 129) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="chinese-addon-selector burger-addon-selector">
                        <div class="addon-label chinese-addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="chinese-addon-options burger-addon-options">
                            <button type="button" class="chinese-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('Chinese Food', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="chinese-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Chinese Food', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="chinese-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('Chinese Food', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="chinese-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Chinese Food', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 129}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="chinese-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="chinese-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="chinese-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="chinese-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="chinese-card-body burger-card-body">
                        <h4 class="chinese-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="chinese-price-row burger-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="chinese-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Shake") {
            const catAddons = getCustomerCategoryAddons('Shake');
            const iceCreamPrice = catAddons.withIceCream !== undefined ? catAddons.withIceCream : 30;

            subItemsGrid.className = 'sub-items-grid shake-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { iceCream: false };

                const currentTotal = (item.price || 119) + (selected.iceCream ? iceCreamPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="shake-addon-selector burger-addon-selector">
                        <div class="addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="shake-addon-options">
                            <button type="button" class="shake-icecream-chip ${selected.iceCream ? 'selected active' : ''}" id="box-icecream-${itemId}" onclick="toggleShakeIceCreamAddon('${itemId}', event)" title="${typeof tAddon === 'function' ? tAddon('With Ice Cream') : 'With Ice Cream'} (+₹${iceCreamPrice})">
                                🍨 ${typeof tAddon === 'function' ? tAddon('With Ice Cream') : 'With Ice Cream'}
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="shake-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Shake', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 119}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="shake-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="shake-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="shake-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="shake-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="shake-card-body burger-card-body">
                        <h4 class="shake-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="shake-price-row burger-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="shake-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Rice") {
            subItemsGrid.className = 'sub-items-grid rice-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                const addBtnMarkup = isAvailable
                    ? `<button class="rice-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 119}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="rice-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="rice-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="rice-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="rice-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="rice-card-body burger-card-body">
                        <h4 class="rice-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="rice-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="rice-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 119)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Hot Cold Coffee" || categoryName === "Hot & Cold Coffee" || categoryName === "Coffee") {
            subItemsGrid.className = 'sub-items-grid coffee-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                const addBtnMarkup = isAvailable
                    ? `<button class="coffee-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="coffee-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="coffee-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="coffee-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="coffee-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="coffee-card-body burger-card-body">
                        <h4 class="coffee-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="coffee-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="coffee-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 99)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Noodles") {
            const catAddons = getCustomerCategoryAddons('Noodles');
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = 'sub-items-grid noodles-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 119) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="noodles-addon-selector burger-addon-selector">
                        <div class="addon-label noodles-addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                        <div class="noodles-addon-options burger-addon-options">
                            <button type="button" class="noodles-addon-box burger-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('Noodles', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="noodles-addon-box burger-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Noodles', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="noodles-addon-box burger-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('Noodles', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="noodles-add-cart-btn burger-add-cart-btn" onclick="addCardWithAddonsToCart('Noodles', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 119}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="noodles-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="noodles-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="noodles-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="noodles-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="noodles-card-body burger-card-body">
                        <h4 class="noodles-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        ${boxesMarkup}
                        <div class="noodles-price-row burger-price-row">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="noodles-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Desserts") {
            subItemsGrid.className = 'sub-items-grid desserts-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                const addBtnMarkup = isAvailable
                    ? `<button class="desserts-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="desserts-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="desserts-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="desserts-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="desserts-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="desserts-card-body burger-card-body">
                        <h4 class="desserts-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="desserts-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="desserts-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 99)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Salad") {
            subItemsGrid.className = 'sub-items-grid salad-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                const addBtnMarkup = isAvailable
                    ? `<button class="salad-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 69}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="salad-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="salad-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="salad-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="salad-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="salad-card-body burger-card-body">
                        <h4 class="salad-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="salad-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="salad-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 69)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Side Orders") {
            subItemsGrid.className = 'sub-items-grid side-orders-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                const addBtnMarkup = isAvailable
                    ? `<button class="side-orders-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 89}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="side-orders-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="side-orders-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="side-orders-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="side-orders-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="side-orders-card-body burger-card-body">
                        <h4 class="side-orders-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="side-orders-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="side-orders-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 89)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Colo Drinks" || categoryName === "Cold Drinks") {
            subItemsGrid.className = 'sub-items-grid cold-drinks-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                const addBtnMarkup = isAvailable
                    ? `<button class="cold-drinks-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 40}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="cold-drinks-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="cold-drinks-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="cold-drinks-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="cold-drinks-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="cold-drinks-card-body burger-card-body">
                        <h4 class="cold-drinks-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="cold-drinks-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="cold-drinks-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 40)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Mojito") {
            subItemsGrid.className = 'sub-items-grid mojito-grid-container grid grid-cols-2 gap-3';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');

                const addBtnMarkup = isAvailable
                    ? `<button class="mojito-add-cart-btn burger-add-cart-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 79}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="mojito-add-cart-btn burger-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="mojito-card burger-card ${outOfStockClass}" data-item-id="${itemId}">
                    ${outOfStockBadge}
                    <div class="mojito-card-image-wrapper burger-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="mojito-card-img burger-card-img" loading="lazy">
                    </div>
                    <div class="mojito-card-body burger-card-body">
                        <h4 class="mojito-card-title burger-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="mojito-price-row burger-price-row" style="margin-top: auto; padding-top: 6px;">
                            <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                            <span class="mojito-card-price burger-card-price" id="card-price-${itemId}">${formatPrice(item.price || 79)}</span>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else if (categoryName === "Spring Rolls") {
            const catAddons = getCustomerCategoryAddons('Spring Rolls');
            const cheesePrice = catAddons.extraCheese !== undefined ? catAddons.extraCheese : 25;
            const spicyPrice = catAddons.extraSpicy !== undefined ? catAddons.extraSpicy : 0;
            const mayoPrice = catAddons.extraMayo !== undefined ? catAddons.extraMayo : 20;

            subItemsGrid.className = 'sub-items-grid spring-rolls-grid-container';
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const itemId = item.id || item.name.toLowerCase().replace(/\s+/g, '-');
                const selected = cardSelectedAddons[itemId] || { cheese: false, spicy: false, mayo: false };

                const currentTotal = (item.price || 99) +
                    (selected.cheese ? cheesePrice : 0) +
                    (selected.spicy ? spicyPrice : 0) +
                    (selected.mayo ? mayoPrice : 0);

                const boxesMarkup = isAvailable ? `
                    <div class="spring-rolls-addon-selector">
                        <span class="spring-rolls-addon-label">${typeof t === 'function' ? t('addons_label') : 'ADD-ONS:'}</span>
                        <div class="spring-rolls-addon-options">
                            <button type="button" class="spring-rolls-addon-box ${selected.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${itemId}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${cheesePrice})" onclick="toggleCardAddon('Spring Rolls', '${itemId}', 'cheese', event)">
                                🧀
                            </button>
                            <button type="button" class="spring-rolls-addon-box ${selected.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${itemId}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${spicyPrice > 0 ? `+₹${spicyPrice}` : 'Free'})" onclick="toggleCardAddon('Spring Rolls', '${itemId}', 'spicy', event)">
                                🌶️
                            </button>
                            <button type="button" class="spring-rolls-addon-box ${selected.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${itemId}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${mayoPrice})" onclick="toggleCardAddon('Spring Rolls', '${itemId}', 'mayo', event)">
                                🍥
                            </button>
                        </div>
                    </div>
                ` : '';

                const addBtnMarkup = isAvailable
                    ? `<button class="spring-rolls-add-cart-btn" onclick="addCardWithAddonsToCart('Spring Rolls', '${itemId}', '${item.name.replace(/'/g, "\\'")}', ${item.price || 99}, '${item.img}')"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                    : `<button class="spring-rolls-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

                return `
                <div class="spring-rolls-card ${outOfStockClass}" data-item-id="${itemId}" data-category="Spring Rolls">
                    ${outOfStockBadge}
                    <div class="spring-rolls-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="spring-rolls-card-img" loading="lazy">
                    </div>
                    <div class="spring-rolls-card-body">
                        <h4 class="spring-rolls-card-title" title="${item.name.replace(/"/g, '&quot;')}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                        <div class="spring-rolls-action-row">
                            ${boxesMarkup}
                            <div class="spring-rolls-price-row">
                                <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                                <span class="spring-rolls-card-price" id="card-price-${itemId}">${formatPrice(currentTotal)}</span>
                            </div>
                        </div>
                    </div>
                    ${addBtnMarkup}
                </div>
                `;
            }).join('');
        } else {
            subItemsGrid.classList.remove('pizza-grid-container');
            subItemsGrid.innerHTML = items.map(item => {
                const isAvailable = item.available !== false;
                const outOfStockClass = isAvailable ? '' : 'out-of-stock';
                const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${t('product_not_available')}</div>`;
                const addBtnMarkup = isAvailable
                    ? `<button class="add-subitem-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.img}')"><i class="fa-solid fa-plus"></i> ${typeof t === 'function' ? t('add_to_cart') : 'Add'}</button>`
                    : `<button class="add-subitem-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'Out of Stock'}</button>`;

                return `
                <div class="sub-item-card ${outOfStockClass}">
                    ${outOfStockBadge}
                    <div class="sub-item-img-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="sub-item-img" loading="lazy">
                    </div>
                    <div class="sub-item-details">
                        <div class="sub-item-top-row">
                            <span class="sub-item-name">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span>
                            ${item.tag ? `<span class="sub-item-tag">${item.tag}</span>` : ''}
                        </div>
                        <p class="sub-item-desc">${item.desc}</p>
                        <div class="sub-item-bottom-row">
                            <span class="sub-item-price">${formatPrice(item.price)}</span>
                            ${addBtnMarkup}
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }
    }

    switchTab('category-detail', false, true);

    // Trigger smooth marquee auto-scroll evaluation for overflowing titles
    applyMarqueeToOverflowTitles();

    if (isRestoringState && lastCategoryState.scrollY > 0) {
        setTimeout(() => {
            window.scrollTo({ top: lastCategoryState.scrollY, behavior: 'instant' });
        }, 10);
    }
}

// --------------------------------------------------------------------------
// AUTOMATIC SINGLE-LINE OVERFLOW MARQUEE AUTO-SCROLL SYSTEM
// --------------------------------------------------------------------------
function applyMarqueeToOverflowTitles() {
    requestAnimationFrame(() => {
        const titleContainers = document.querySelectorAll(
            '.pizza-card-title, .burger-card-title, .wrap-card-title, .bread-card-title, .sandwich-card-title, .momos-card-title, .pasta-card-title, .chinese-card-title, .shake-card-title, .rice-card-title, .coffee-card-title, .noodles-card-title, .desserts-card-title, .salad-card-title, .side-orders-card-title, .cold-drinks-card-title, .mojito-card-title, .spring-rolls-card-title'
        );
        if (!titleContainers.length) return;

        titleContainers.forEach(container => {
            const span = container.querySelector('.card-title-text');
            if (!span) return;

            // Reset marquee class first for pure unconstrained measurement
            container.classList.remove('has-marquee');

            const containerWidth = container.clientWidth;
            const textWidth = span.scrollWidth;

            if (containerWidth > 0 && textWidth > containerWidth + 2) {
                const overflowPx = Math.ceil(textWidth - containerWidth);
                container.style.setProperty('--marquee-overflow', `-${overflowPx + 6}px`);
                const duration = Math.max(3.5, Math.min(8, (overflowPx / 18) + 2.5));
                container.style.setProperty('--marquee-duration', `${duration.toFixed(1)}s`);
                container.classList.add('has-marquee');
            } else {
                container.classList.remove('has-marquee');
                container.style.removeProperty('--marquee-overflow');
                container.style.removeProperty('--marquee-duration');
            }
        });
    });
}

// Window resize handler for dynamic title marquee recalculation
window.addEventListener('resize', () => {
    if (window._marqueeResizeTimeout) clearTimeout(window._marqueeResizeTimeout);
    window._marqueeResizeTimeout = setTimeout(applyMarqueeToOverflowTitles, 150);
});

// --------------------------------------------------------------------------
// SHOP OPEN / CLOSED STATUS SYSTEM
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// SHOP OPEN / CLOSED STATUS SYSTEM & AUTOMATIC SCHEDULE EVALUATION
// --------------------------------------------------------------------------
const SHOP_STATUS_KEY = 'shopStatus';
const OPENING_TIME_KEY = 'storeOpeningTime';
const CLOSING_TIME_KEY = 'storeClosingTime';
const AUTO_SCHEDULE_KEY = 'storeAutoScheduleEnabled';
const MANUAL_OVERRIDE_KEY = 'storeManualOverride';
const MANUAL_CLOSE_DATE_KEY = 'storeManualCloseDate';

function getCustomerShopStatus() {
    return localStorage.getItem(SHOP_STATUS_KEY) || 'open';
}

function getCustomerOpeningTime() {
    return localStorage.getItem(OPENING_TIME_KEY) || '11:00';
}

function getCustomerClosingTime() {
    return localStorage.getItem(CLOSING_TIME_KEY) || '23:00';
}

function getCustomerAutoScheduleEnabled() {
    return localStorage.getItem(AUTO_SCHEDULE_KEY) === 'true';
}

function getCustomerManualOverride() {
    return localStorage.getItem(MANUAL_OVERRIDE_KEY) || 'none';
}

function getCustomerManualCloseDate() {
    return localStorage.getItem(MANUAL_CLOSE_DATE_KEY) || null;
}

function getCustomerTodayDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatCustomerTime12Hour(time24) {
    if (!time24) return '11:00 AM';
    const parts = time24.split(':');
    let h = parseInt(parts[0], 10) || 0;
    const m = parts[1] ? parts[1].padStart(2, '0') : '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${m} ${ampm}`;
}

function isCustomerCurrentTimeWithinHours(openTimeStr, closeTimeStr) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = (openTimeStr || '11:00').split(':').map(Number);
    const [closeH, closeM] = (closeTimeStr || '23:00').split(':').map(Number);

    const openMinutes = (openH || 0) * 60 + (openM || 0);
    const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

    if (openMinutes === closeMinutes) {
        return true; // 24 hours open
    }

    if (openMinutes < closeMinutes) {
        return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    } else {
        return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }
}

function evaluateCustomerStoreStatus() {
    const openTime = getCustomerOpeningTime();
    const closeTime = getCustomerClosingTime();
    const isAutoOn = getCustomerAutoScheduleEnabled();
    const manualShopStatus = getCustomerShopStatus(); // 'open' | 'closed'
    const manualCloseDate = getCustomerManualCloseDate();
    const todayStr = getCustomerTodayDateString();

    const formattedOpen = formatCustomerTime12Hour(openTime);

    // 1. Automatic Schedule Evaluation
    if (isAutoOn) {
        const withinHours = isCustomerCurrentTimeWithinHours(openTime, closeTime);
        if (!withinHours) {
            return {
                isOpen: false,
                message: `We are currently closed. We open at ${formattedOpen}.`
            };
        }

        // Inside hours: check if an emergency manual close occurred TODAY
        if (manualCloseDate && manualCloseDate === todayStr && manualShopStatus === 'closed') {
            return {
                isOpen: false,
                message: `We are temporarily closed for today. We will resume normal operations at ${formattedOpen}.`
            };
        }

        // Within hours and no active emergency close for today: Open
        return { isOpen: true, message: '' };
    }

    // 2. Normal Manual Shop Status (When Auto-Schedule is Disabled)
    if (manualShopStatus === 'closed') {
        return {
            isOpen: false,
            message: `We are currently closed. We open at ${formattedOpen}.`
        };
    }

    return { isOpen: true, message: '' };
}

function checkAndUpdateShopStatusUI() {
    const statusInfo = evaluateCustomerStoreStatus();
    const banner = document.getElementById('shop-closed-banner');
    const isClosed = !statusInfo.isOpen;

    if (banner) {
        banner.style.display = isClosed ? 'block' : 'none';
        const bannerSpan = banner.querySelector('span');
        if (bannerSpan && statusInfo.message) {
            bannerSpan.textContent = statusInfo.message;
        }
    }

    if (isClosed) {
        document.body.classList.add('shop-closed');
    } else {
        document.body.classList.remove('shop-closed');
    }

    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        if (isClosed || (typeof cart !== 'undefined' && cart.length === 0)) {
            checkoutBtn.setAttribute('disabled', 'true');
        } else {
            checkoutBtn.removeAttribute('disabled');
        }
    }

    const modalPlaceOrderBtn = document.getElementById('btn-place-order');
    if (modalPlaceOrderBtn && isClosed) {
        modalPlaceOrderBtn.setAttribute('disabled', 'true');
    }
}

// Automatically re-evaluate store schedule every 30 seconds
setInterval(() => {
    checkAndUpdateShopStatusUI();
}, 30000);

// --------------------------------------------------------------------------
// ORDER & DELIVERY THRESHOLDS AND LOCATION BOUNDARY SYSTEM
// --------------------------------------------------------------------------
const MIN_ORDER_KEY = 'minOrderValue';
const FREE_DELIVERY_KEY = 'freeDeliveryLimit';
const RESTAURANT_LAT_KEY = 'restaurantLatitude';
const RESTAURANT_LNG_KEY = 'restaurantLongitude';
const DELIVERY_RADIUS_KEY = 'deliveryRadiusKm';

// 6 Flexible Zone Delivery Charges Keys & Defaults
const ZONE_CHARGES_KEY = 'perfettoDeliveryZones';
const DEFAULT_ZONE_CHARGES = {
    zone1: 0,
    zone2: 0,
    zone3: 0,
    zone4: 0,
    zone5: 0,
    zone6: 0
};

const DEFAULT_RESTAURANT_LAT = 29.533736;
const DEFAULT_RESTAURANT_LNG = 73.447895;
const DEFAULT_DELIVERY_RADIUS_KM = 10;

function getDeliveryZoneCharges() {
    try {
        const stored = localStorage.getItem(ZONE_CHARGES_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const result = {};
            for (let i = 1; i <= 6; i++) {
                const key = `zone${i}`;
                const raw = parsed[key];
                if (raw !== undefined && raw !== null && raw !== '') {
                    const parsedNum = parseFloat(raw);
                    result[key] = !isNaN(parsedNum) && parsedNum >= 0 ? parsedNum : 0;
                } else {
                    result[key] = DEFAULT_ZONE_CHARGES[key] || 0;
                }
            }
            return result;
        }
    } catch (e) {
        console.error('Error reading delivery zone charges:', e);
    }
    return { ...DEFAULT_ZONE_CHARGES };
}

function getMinOrderValue() {
    const val = localStorage.getItem(MIN_ORDER_KEY);
    return val !== null ? parseFloat(val) : 80;
}

function getFreeDeliveryLimit() {
    const val = localStorage.getItem(FREE_DELIVERY_KEY);
    return val !== null ? parseFloat(val) : 500;
}

function getRestaurantLat() {
    const val = localStorage.getItem(RESTAURANT_LAT_KEY);
    return val !== null ? parseFloat(val) : DEFAULT_RESTAURANT_LAT;
}

function getRestaurantLng() {
    const val = localStorage.getItem(RESTAURANT_LNG_KEY);
    return val !== null ? parseFloat(val) : DEFAULT_RESTAURANT_LNG;
}

function getDeliveryRadiusKm() {
    const val = localStorage.getItem(DELIVERY_RADIUS_KEY);
    return val !== null ? parseFloat(val) : DEFAULT_DELIVERY_RADIUS_KM;
}

// Calculate distance in kilometers between two coordinates using Haversine formula
function calculateDistanceHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in KM
}

// Map calculated distance (KM) to one of the 6 admin-configured distance zones
function getDeliveryZoneForDistance(distKm) {
    if (distKm <= 0.5) {
        return { zoneNum: 1, zoneKey: 'zone1', zoneLabel: 'Zone 1 (0 - 0.5 KM)', range: '0 - 0.5 KM' };
    } else if (distKm <= 2.0) {
        return { zoneNum: 2, zoneKey: 'zone2', zoneLabel: 'Zone 2 (0.5 - 2 KM)', range: '0.5 - 2 KM' };
    } else if (distKm <= 4.0) {
        return { zoneNum: 3, zoneKey: 'zone3', zoneLabel: 'Zone 3 (2 - 4 KM)', range: '2 - 4 KM' };
    } else if (distKm <= 6.0) {
        return { zoneNum: 4, zoneKey: 'zone4', zoneLabel: 'Zone 4 (4 - 6 KM)', range: '4 - 6 KM' };
    } else if (distKm <= 8.0) {
        return { zoneNum: 5, zoneKey: 'zone5', zoneLabel: 'Zone 5 (6 - 8 KM)', range: '6 - 8 KM' };
    } else {
        return { zoneNum: 6, zoneKey: 'zone6', zoneLabel: 'Zone 6 (8 - 10 KM)', range: '8 - 10 KM' };
    }
}

// Retrieve verified customer GPS coordinates from active state, form hidden fields, or saved profile
function getCustomerVerifiedCoordinates() {
    // 1. In-memory confirmed GPS coordinates
    if (currentCustomerGps && typeof currentCustomerGps.lat === 'number' && typeof currentCustomerGps.lng === 'number' && !isNaN(currentCustomerGps.lat) && !isNaN(currentCustomerGps.lng)) {
        return { lat: currentCustomerGps.lat, lng: currentCustomerGps.lng };
    }

    // 2. Hidden inputs in profile form
    const latHidden = document.getElementById('customer-gps-lat');
    const lngHidden = document.getElementById('customer-gps-lng');
    if (latHidden && lngHidden && latHidden.value && lngHidden.value) {
        const lat = parseFloat(latHidden.value);
        const lng = parseFloat(lngHidden.value);
        if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
        }
    }

    // 3. Saved profile in localStorage
    try {
        const stored = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (stored) {
            const p = JSON.parse(stored);
            if (p && p.gpsLat !== undefined && p.gpsLng !== undefined && p.gpsLat !== null && p.gpsLng !== null) {
                const lat = parseFloat(p.gpsLat);
                const lng = parseFloat(p.gpsLng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    return { lat, lng };
                }
            }
        }
    } catch (e) { }

    return null;
}

// Calculate dynamic delivery fee and zone information based on distance and order subtotal
function calculateDynamicDeliveryInfo(subtotal, customCoords = null) {
    const freeDeliveryLim = getFreeDeliveryLimit();
    const coords = customCoords || getCustomerVerifiedCoordinates();
    const restLat = getRestaurantLat();
    const restLng = getRestaurantLng();
    const zoneCharges = getDeliveryZoneCharges();

    let distanceKm = null;
    let zoneInfo = null;
    let baseDeliveryFee = 0;
    let hasVerifiedGps = false;

    if (coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && !isNaN(coords.lat) && !isNaN(coords.lng)) {
        hasVerifiedGps = true;
        const rawDist = calculateDistanceHaversine(restLat, restLng, coords.lat, coords.lng);
        distanceKm = parseFloat(rawDist.toFixed(2));
        zoneInfo = getDeliveryZoneForDistance(distanceKm);
        const configuredCharge = zoneCharges[zoneInfo.zoneKey];
        baseDeliveryFee = (configuredCharge !== undefined && configuredCharge !== null && !isNaN(configuredCharge))
            ? parseFloat(configuredCharge)
            : 0;
    } else {
        // Default to Zone 1 base charge when coordinates are not yet set
        zoneInfo = getDeliveryZoneForDistance(0);
        const configuredCharge = zoneCharges[zoneInfo.zoneKey];
        baseDeliveryFee = (configuredCharge !== undefined && configuredCharge !== null && !isNaN(configuredCharge))
            ? parseFloat(configuredCharge)
            : 0;
    }

    const isFreeDelivery = (subtotal >= freeDeliveryLim && subtotal > 0);
    const finalDeliveryFee = isFreeDelivery ? 0 : baseDeliveryFee;

    return {
        hasVerifiedGps,
        coords,
        distanceKm,
        zoneInfo,
        baseDeliveryFee,
        isFreeDelivery,
        finalDeliveryFee,
        freeDeliveryLimit: freeDeliveryLim
    };
}

function isWithinDeliveryRadius(userLat, userLng) {
    const restLat = getRestaurantLat();
    const restLng = getRestaurantLng();
    const maxRadius = getDeliveryRadiusKm();
    const dist = calculateDistanceHaversine(restLat, restLng, userLat, userLng);
    return {
        isAllowed: dist <= maxRadius,
        distanceKm: parseFloat(dist.toFixed(2)),
        maxRadiusKm: maxRadius
    };
}

function updateCartThresholdBanner(subtotal, minOrderVal, freeDeliveryLim) {
    const banner = document.getElementById('cart-threshold-banner');
    const content = document.getElementById('threshold-banner-content');
    const checkoutBtn = document.querySelector('.checkout-btn');

    if (!banner || !content) return;

    if (cart.length === 0) {
        banner.style.display = 'none';
        if (checkoutBtn) {
            checkoutBtn.setAttribute('disabled', 'true');
        }
        return;
    }

    banner.style.display = 'block';

    const isShopClosed = getCustomerShopStatus() === 'closed';

    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';

    if (subtotal < minOrderVal) {
        // CONDITION A: Below Minimum Order Value
        const diff = (minOrderVal - subtotal).toFixed(2);
        banner.className = 'cart-threshold-banner status-below-min';
        content.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${isHindi ? `न्यूनतम ऑर्डर ${formatPrice(minOrderVal)} है। ऑर्डर पूरा करने के लिए ${formatPrice(diff)} का सामान और जोड़ें।` : `Minimum order is ${formatPrice(minOrderVal)}. Add ${formatPrice(diff)} more to place your order.`}</span>
        `;
        if (checkoutBtn) {
            checkoutBtn.setAttribute('disabled', 'true');
        }
    } else if (subtotal < freeDeliveryLim) {
        // CONDITION B: Above Minimum, Below Free Delivery Limit
        const diff = (freeDeliveryLim - subtotal).toFixed(2);
        banner.className = 'cart-threshold-banner status-upsell-free';
        content.innerHTML = `
            <i class="fa-solid fa-truck-arrow-right"></i>
            <span>${isHindi ? `मुफ्त होम डिलीवरी के लिए ${formatPrice(diff)} और जोड़ें!` : `Add ${formatPrice(diff)} more to get FREE Home Delivery!`}</span>
        `;
        if (checkoutBtn && !isShopClosed) {
            checkoutBtn.removeAttribute('disabled');
        }
    } else {
        // CONDITION C: Free Delivery Unlocked!
        banner.className = 'cart-threshold-banner status-unlocked-free';
        content.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>${isHindi ? `बधाई हो! आपको मुफ़्त डिलीवरी मिल गई है।` : `Congratulations! You have unlocked FREE Delivery.`}</span>
        `;
        if (checkoutBtn && !isShopClosed) {
            checkoutBtn.removeAttribute('disabled');
        }
    }
}

// --------------------------------------------------------------------------
// 4B. WALLET & CASHBACK CLIENT CONTROLLER (STEP 2)
// Dynamic Incentive Bar in Cart & Wallet Redemption at Checkout
// --------------------------------------------------------------------------
const DEFAULT_WALLET_CONFIG = {
    enabled: true,
    expiryDays: 7,
    cashbackExpiryDays: 7,
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

function getClampedCashbackExpiryDays(config) {
    const raw = config ? (config.cashbackExpiryDays !== undefined ? config.cashbackExpiryDays : config.expiryDays) : undefined;
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 1) return DEFAULT_WALLET_CONFIG.expiryDays || 7;
    return Math.min(30, Math.max(1, parsed));
}
window.getClampedCashbackExpiryDays = getClampedCashbackExpiryDays;

function formatExpiryDaysLabel(days, isHindi) {
    const d = Math.max(1, parseInt(days, 10) || 1);
    if (isHindi) {
        return `${d} दिनों में समाप्त`;
    }
    return d === 1 ? 'Expires in 1 day' : `Expires in ${d} days`;
}
window.formatExpiryDaysLabel = formatExpiryDaysLabel;

let customerWalletConfig = (function() {
    try {
        const stored = localStorage.getItem('perfetto_wallet_config');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed === 'object') {
                const days = getClampedCashbackExpiryDays(parsed);
                parsed.expiryDays = days;
                parsed.cashbackExpiryDays = days;
                return parsed;
            }
        }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_WALLET_CONFIG));
})();

let currentCustomerWallet = (function() {
    let directBal = 0;
    const directStored = localStorage.getItem('perfetto_wallet_balance');
    if (directStored !== null && !isNaN(Number(directStored))) {
        directBal = Math.max(0, Number(directStored));
    }
    try {
        const stored = localStorage.getItem('perfetto_customer_wallet');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (directStored !== null && !isNaN(Number(directStored))) {
                parsed.balance = directBal;
                parsed.nonExpiredBalance = directBal;
            } else if (typeof parsed.balance === 'number') {
                localStorage.setItem('perfetto_wallet_balance', parsed.balance);
            }
            return parsed;
        }
    } catch (e) {}
    return { balance: directBal, nonExpiredBalance: directBal, transactions: [] };
})();

function getEffectiveWalletBalance() {
    if (currentCustomerWallet && currentCustomerWallet.expiresAt) {
        const expMs = typeof currentCustomerWallet.expiresAt === 'number'
            ? currentCustomerWallet.expiresAt
            : new Date(currentCustomerWallet.expiresAt).getTime();
        if (!isNaN(expMs) && expMs > 0) {
            const remainingDays = Math.ceil((expMs - Date.now()) / (24 * 60 * 60 * 1000));
            if (remainingDays <= 0) {
                // Expire balance atomically
                currentCustomerWallet.balance = 0;
                currentCustomerWallet.nonExpiredBalance = 0;
                currentCustomerWallet.expired = true;
                try {
                    localStorage.setItem('perfetto_wallet_balance', 0);
                    localStorage.setItem('perfetto_customer_wallet', JSON.stringify(currentCustomerWallet));
                } catch (e) {}
                return 0;
            }
        }
    }
    const directStored = localStorage.getItem('perfetto_wallet_balance');
    if (directStored !== null && !isNaN(Number(directStored))) {
        return Math.max(0, Number(directStored));
    }
    if (currentCustomerWallet && typeof currentCustomerWallet.balance === 'number') {
        return Math.max(0, currentCustomerWallet.balance);
    }
    return 0;
}
window.getEffectiveWalletBalance = getEffectiveWalletBalance;

let isWalletRedemptionSelected = false;
let appliedWalletDiscountAmount = 0;
let customerWalletRealtimeUnsubscribe = null;
let walletConfigRealtimeUnsubscribe = null;

function calculateValidWalletBalance(walletDoc) {
    if (!walletDoc) return { balance: 0, nonExpiredBalance: 0 };
    const rawBalance = typeof walletDoc.balance === 'number' ? walletDoc.balance : (parseFloat(walletDoc.balance) || 0);
    let validBalance = rawBalance;

    // Check expiry timestamp on wallet doc
    if (walletDoc.expiresAt) {
        const exp = walletDoc.expiresAt.toDate ? walletDoc.expiresAt.toDate() : new Date(walletDoc.expiresAt);
        if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
            validBalance = 0;
        }
    }

    return {
        balance: Math.max(0, rawBalance),
        nonExpiredBalance: Math.max(0, validBalance)
    };
}

async function fetchCustomerWallet(phone) {
    if (!phone) return currentCustomerWallet;
    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone) return currentCustomerWallet;

    if (customerFirestore) {
        try {
            const doc = await customerFirestore.collection('wallets').doc(cleanPhone).get();
            if (doc.exists && doc.data()) {
                const valid = calculateValidWalletBalance(doc.data());
                currentCustomerWallet = {
                    ...doc.data(),
                    ...valid
                };
                localStorage.setItem('perfetto_customer_wallet', JSON.stringify(currentCustomerWallet));
                localStorage.setItem('perfetto_wallet_balance', currentCustomerWallet.balance);
                return currentCustomerWallet;
            }
        } catch (e) {
            console.warn('Error fetching customer wallet:', e.message);
        }
    }

    return currentCustomerWallet;
}
window.fetchCustomerWallet = fetchCustomerWallet;

function listenToCustomerWalletRealtime(phone) {
    if (!phone || !customerFirestore) return;
    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone) return;

    if (customerWalletRealtimeUnsubscribe) {
        try { customerWalletRealtimeUnsubscribe(); } catch (e) {}
        customerWalletRealtimeUnsubscribe = null;
    }

    try {
        customerWalletRealtimeUnsubscribe = customerFirestore.collection('wallets').doc(cleanPhone).onSnapshot((doc) => {
            if (doc.exists && doc.data()) {
                const valid = calculateValidWalletBalance(doc.data());
                currentCustomerWallet = {
                    ...doc.data(),
                    ...valid
                };
                localStorage.setItem('perfetto_customer_wallet', JSON.stringify(currentCustomerWallet));
                localStorage.setItem('perfetto_wallet_balance', currentCustomerWallet.balance);
                updateProfileWalletUI();
                updateCheckoutWalletUI();
            }
        }, (err) => {
            console.warn('Real-time wallet listener notice:', err.message);
        });
    } catch (e) {
        console.warn('Error setting up customer wallet listener:', e);
    }
}

/**
 * Resolves the qualified cashback slab and its fair [min, max] reward boundaries for a given subtotal.
 * Boundaries:
 * - Minimum bound: Previous tier's configured cashback amount + 1 (for Slab 1, minimum bound is 1)
 * - Maximum bound: Current qualified tier's configured cashback amount
 * @param {number} subtotal
 * @param {Object} [walletConfig]
 * @returns {{ qualified: boolean, min: number, max: number, tierIndex: number, slab: Object|null, nextSlab: Object|null }}
 */
function getCashbackRewardBoundaries(subtotal, walletConfig = customerWalletConfig) {
    if (!walletConfig || walletConfig.enabled === false || subtotal <= 0) {
        return { qualified: false, min: 0, max: 0, tierIndex: -1, slab: null, nextSlab: null };
    }

    const rawSlabs = Array.isArray(walletConfig.slabs) && walletConfig.slabs.length > 0
        ? walletConfig.slabs
        : DEFAULT_WALLET_CONFIG.slabs;

    // Slabs sorted ascending by minOrder
    const sorted = [...rawSlabs].sort((a, b) => (Number(a.minOrder) || 0) - (Number(b.minOrder) || 0));
    if (sorted.length === 0) {
        return { qualified: false, min: 0, max: 0, tierIndex: -1, slab: null, nextSlab: null };
    }

    let qualifiedIndex = -1;
    let nextSlab = null;

    for (let i = 0; i < sorted.length; i++) {
        const slabMin = Number(sorted[i].minOrder) || 0;
        if (subtotal >= slabMin) {
            qualifiedIndex = i;
        } else if (!nextSlab) {
            nextSlab = sorted[i];
        }
    }

    if (qualifiedIndex === -1) {
        return { qualified: false, min: 0, max: 0, tierIndex: -1, slab: null, nextSlab: sorted[0] || null };
    }

    const currentSlab = sorted[qualifiedIndex];
    const max = Number(currentSlab.cashback) || 0;

    // Minimum bound: Previous tier's configured cashback amount + 1 (for Slab 1, minimum bound is 1)
    let min = 1;
    if (qualifiedIndex > 0) {
        const prevCashback = Number(sorted[qualifiedIndex - 1].cashback) || 0;
        min = prevCashback + 1;
    }

    if (max < min) {
        min = Math.max(1, Math.min(min, max));
    }

    return {
        qualified: true,
        min,
        max,
        tierIndex: qualifiedIndex,
        slab: currentSlab,
        nextSlab
    };
}
window.getCashbackRewardBoundaries = getCashbackRewardBoundaries;

function updateCartCashbackIncentiveBar(subtotal) {
    const bar = document.getElementById('cart-cashback-bar');
    const content = document.getElementById('cart-cashback-content');
    if (!bar || !content) return;

    if (!customerWalletConfig || customerWalletConfig.enabled === false || cart.length === 0 || subtotal <= 0) {
        bar.style.display = 'none';
        return;
    }

    const boundaries = getCashbackRewardBoundaries(subtotal);
    const isHindiCashback = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';

    bar.style.display = 'block';

    if (boundaries.qualified && boundaries.max > 0) {
        const max = boundaries.max;
        const scratchText = isHindiCashback
            ? `₹${max} तक का कैशबैक जीतें (स्क्रैच कार्ड अनलॉक!)`
            : `Win up to ₹${max} Cashback (Scratch Card unlocked!)`;

        if (boundaries.nextSlab) {
            const nextMin = Number(boundaries.nextSlab.minOrder) || 0;
            const nextMax = Number(boundaries.nextSlab.cashback) || 0;
            const diff = Math.max(0, nextMin - subtotal);
            bar.classList.remove('cashback-max-unlocked');

            content.innerHTML = `
                <div class="cashback-bar-left">
                    <i class="fa-solid fa-gift"></i>
                    <span class="cashback-bar-text">
                        <strong>${scratchText}</strong> • ${isHindiCashback ? `<strong>${formatPrice(diff)}</strong> और जोड़ें (₹${nextMax} तक पाएं)` : `Add <strong>${formatPrice(diff)}</strong> more for up to <strong>${formatPrice(nextMax)}</strong>!`}
                    </span>
                </div>
                <span class="cashback-current-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> ${isHindiCashback ? 'स्क्रैच कार्ड अनलॉक' : 'Scratch Card Unlocked'}</span>
            `;
        } else {
            bar.classList.add('cashback-max-unlocked');
            content.innerHTML = `
                <div class="cashback-bar-left">
                    <i class="fa-solid fa-crown"></i>
                    <span class="cashback-bar-text">🎉 <strong>${scratchText}</strong></span>
                </div>
                <span class="cashback-current-badge"><i class="fa-solid fa-crown"></i> ${isHindiCashback ? 'अधिकतम स्क्रैच कार्ड' : 'Max Scratch Card'}</span>
            `;
        }
    } else if (boundaries.nextSlab) {
        const nextMin = Number(boundaries.nextSlab.minOrder) || 0;
        const nextMax = Number(boundaries.nextSlab.cashback) || 0;
        const diff = Math.max(0, nextMin - subtotal);
        bar.classList.remove('cashback-max-unlocked');

        content.innerHTML = `
            <div class="cashback-bar-left">
                <i class="fa-solid fa-coins"></i>
                <span class="cashback-bar-text">
                    ${isHindiCashback ? `<strong>${formatPrice(diff)}</strong> और जोड़ें और <strong>₹${nextMax} तक का कैशबैक जीतें</strong> (स्क्रैच कार्ड अनलॉक!)` : `Add <strong>${formatPrice(diff)}</strong> more to <strong>Win up to ${formatPrice(nextMax)} Cashback</strong> (Scratch Card unlocked!)`}
                </span>
            </div>
            <span class="cashback-current-badge"><i class="fa-solid fa-gift"></i> ${isHindiCashback ? 'स्क्रैच कार्ड' : 'Scratch Card'}</span>
        `;
    } else {
        bar.style.display = 'none';
    }
}
window.updateCartCashbackIncentiveBar = updateCartCashbackIncentiveBar;

function updateCheckoutWalletUI() {
    const walletCard = document.getElementById('checkout-wallet-card');
    const availValEl = document.getElementById('checkout-wallet-available-val');
    const checkbox = document.getElementById('checkbox-use-wallet');
    const labelEl = document.getElementById('checkout-wallet-use-label');
    const checkLabelWrap = document.getElementById('checkout-wallet-checkbox-label');
    const hintEl = document.getElementById('checkout-wallet-hint');
    const hintTextEl = document.getElementById('checkout-wallet-hint-text');
    const discountRow = document.getElementById('checkout-wallet-discount-row');
    const discountValEl = document.getElementById('checkout-wallet-discount');
    const totalEl = document.getElementById('checkout-total');

    if (!walletCard) return;

    const isSystemEnabled = customerWalletConfig && customerWalletConfig.enabled !== false;
    const availableBalance = getEffectiveWalletBalance();

    if (!isSystemEnabled || availableBalance <= 0 || cart.length === 0) {
        walletCard.style.display = 'none';
        isWalletRedemptionSelected = false;
        appliedWalletDiscountAmount = 0;
        if (discountRow) discountRow.style.display = 'none';
        return;
    }

    // Show wallet card
    walletCard.style.display = 'block';
    if (availValEl) availValEl.textContent = formatPrice(availableBalance);

    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const savedProfile = getSavedDeliveryProfile();
    const customCoords = (savedProfile && savedProfile.gpsLat && savedProfile.gpsLng)
        ? { lat: parseFloat(savedProfile.gpsLat), lng: parseFloat(savedProfile.gpsLng) }
        : null;
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal, customCoords);
    const deliveryFee = (cart.length > 0 && subtotal > 0)
        ? (deliveryInfo.isFreeDelivery ? 'FREE' : deliveryInfo.finalDeliveryFee)
        : 0;
    const baseTotal = (cart.length === 0 || subtotal <= 0)
        ? 0
        : (deliveryFee === 'FREE' || deliveryInfo.isFreeDelivery
            ? subtotal
            : Math.max(0, subtotal + (deliveryFee === 'FREE' ? 0 : Number(deliveryFee))));

    // 100% Unrestricted Redemption: Allow customers to redeem up to 100% of available wallet balance on any order value
    const maxRedeemable = Math.min(availableBalance, baseTotal);

    if (checkbox) {
        checkbox.disabled = false;
        checkbox.checked = isWalletRedemptionSelected;
    }
    if (checkLabelWrap) {
        checkLabelWrap.classList.remove('is-disabled');
    }
    if (labelEl) {
        labelEl.textContent = typeof t === 'function' 
            ? t('wallet_use_cash', { amount: formatPrice(maxRedeemable) }) 
            : `Use ${formatPrice(maxRedeemable)} Cash`;
    }
    if (hintEl) {
        hintEl.style.display = 'none';
    }

    if (isWalletRedemptionSelected) {
        appliedWalletDiscountAmount = maxRedeemable;
        const finalTotal = Math.max(0, baseTotal - appliedWalletDiscountAmount);
        if (discountRow) discountRow.style.display = 'flex';
        if (discountValEl) discountValEl.textContent = `-${formatPrice(appliedWalletDiscountAmount)}`;
        if (totalEl) totalEl.textContent = formatPrice(finalTotal);
    } else {
        appliedWalletDiscountAmount = 0;
        if (discountRow) discountRow.style.display = 'none';
        if (totalEl) totalEl.textContent = formatPrice(baseTotal);
    }

    updateCheckoutCashbackTeaser(subtotal);
}
window.updateCheckoutWalletUI = updateCheckoutWalletUI;

function updateCheckoutCashbackTeaser(subtotal) {
    const teaserEl = document.getElementById('checkout-cashback-teaser');
    const teaserText = document.getElementById('checkout-cashback-teaser-text');
    const teaserSub = document.getElementById('checkout-cashback-teaser-sub');
    if (!teaserEl) return;

    if (!customerWalletConfig || customerWalletConfig.enabled === false || cart.length === 0 || subtotal <= 0) {
        teaserEl.style.display = 'none';
        return;
    }

    const boundaries = getCashbackRewardBoundaries(subtotal);
    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';

    if (isWalletRedemptionSelected) {
        teaserEl.style.display = 'block';
        teaserEl.classList.add('teaser-wallet-applied');
        if (teaserText) {
            teaserText.textContent = isHindi 
                ? 'वॉलेट कैश लागू है (स्क्रैच कार्ड बिना वॉलेट उपयोग पर मिलते हैं)' 
                : 'Wallet cash applied (Scratch cards are awarded on orders without wallet discount)';
        }
        if (teaserSub) {
            teaserSub.textContent = isHindi 
                ? 'कैशबैक स्क्रैच कार्ड पाने के लिए वॉलेट बॉक्स को अनचेक करें' 
                : 'Uncheck wallet box if you prefer earning a cashback scratch card instead';
        }
    } else if (boundaries.qualified && boundaries.max > 0) {
        teaserEl.style.display = 'block';
        teaserEl.classList.remove('teaser-wallet-applied');
        if (teaserText) {
            teaserText.textContent = isHindi
                ? `₹${boundaries.max} तक का कैशबैक जीतें (स्क्रैच कार्ड अनलॉक!)`
                : `Win up to ₹${boundaries.max} Cashback (Scratch Card unlocked!)`;
        }
        if (teaserSub) {
            teaserSub.textContent = isHindi
                ? 'ऑर्डर करते ही तुरंत स्क्रैच करें और अपने वॉलेट में जोड़ें!'
                : 'Scratch immediately after placing order and claim to your wallet!';
        }
    } else if (boundaries.nextSlab) {
        const nextMin = Number(boundaries.nextSlab.minOrder) || 0;
        const nextMax = Number(boundaries.nextSlab.cashback) || 0;
        const diff = Math.max(0, nextMin - subtotal);
        teaserEl.style.display = 'block';
        teaserEl.classList.remove('teaser-wallet-applied');
        if (teaserText) {
            teaserText.textContent = isHindi
                ? `${formatPrice(diff)} और जोड़ें और ₹${nextMax} तक का कैशबैक जीतें (स्क्रैच कार्ड अनलॉक!)`
                : `Add ${formatPrice(diff)} more to Win up to ${formatPrice(nextMax)} Cashback (Scratch Card unlocked!)`;
        }
        if (teaserSub) {
            teaserSub.textContent = isHindi
                ? 'अगले स्तर का स्क्रैच कार्ड अनलॉक करने के लिए और सामान जोड़ें'
                : 'Add more items to unlock a higher cashback scratch card!';
        }
    } else {
        teaserEl.style.display = 'none';
    }
}
window.updateCheckoutCashbackTeaser = updateCheckoutCashbackTeaser;

function handleToggleUseWallet(isChecked) {
    isWalletRedemptionSelected = isChecked;
    updateCheckoutWalletUI();
}
window.handleToggleUseWallet = handleToggleUseWallet;

async function debitCustomerWallet(phone, amount, orderId) {
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '').slice(-10);
    const debitAmt = Number(amount) || 0;
    if (debitAmt <= 0) return;

    const currentWalletBalance = Number(localStorage.getItem('perfetto_wallet_balance') || (currentCustomerWallet && currentCustomerWallet.balance) || 0);
    const updatedWalletBalance = Math.max(0, currentWalletBalance - debitAmt);
    localStorage.setItem('perfetto_wallet_balance', updatedWalletBalance);

    if (!currentCustomerWallet) currentCustomerWallet = { balance: 0, nonExpiredBalance: 0, transactions: [] };
    currentCustomerWallet.phone = cleanPhone || currentCustomerWallet.phone || '';
    currentCustomerWallet.balance = updatedWalletBalance;
    currentCustomerWallet.nonExpiredBalance = updatedWalletBalance;

    const existingTx = Array.isArray(currentCustomerWallet.transactions) ? currentCustomerWallet.transactions : [];
    existingTx.unshift({
        type: 'debit',
        amount: debitAmt,
        orderId: String(orderId),
        description: `Redeemed on Order #${orderId}`,
        createdAt: new Date().toISOString()
    });
    currentCustomerWallet.transactions = existingTx.slice(0, 30);
    localStorage.setItem('perfetto_customer_wallet', JSON.stringify(currentCustomerWallet));

    updateProfileWalletUI();
    renderProfileWalletTxList();
    updateCheckoutWalletUI();

    try {
        if (customerFirestore && cleanPhone) {
            const walletRef = customerFirestore.collection('wallets').doc(cleanPhone);
            await walletRef.set({
                phone: cleanPhone,
                balance: updatedWalletBalance,
                updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : new Date().toISOString()
            }, { merge: true });

            await walletRef.collection('transactions').add({
                type: 'debit',
                amount: debitAmt,
                orderId: String(orderId),
                description: `Redeemed on Order #${orderId}`,
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : new Date().toISOString()
            });
        }
    } catch (err) {
        console.warn('Error debiting customer wallet in Firestore:', err);
    }
}
window.debitCustomerWallet = debitCustomerWallet;

/**
 * Generates the final scratch reward using unbiased uniform integer distribution:
 * Math.floor(Math.random() * (max - min + 1)) + min
 * All outcomes across the range, including the maximum cap, carry equal mathematical probability.
 * @param {number} subtotal
 * @returns {number}
 */
function calculateOrderCashback(subtotal) {
    const boundaries = getCashbackRewardBoundaries(subtotal);
    if (!boundaries.qualified || boundaries.max <= 0) return 0;

    const { min, max } = boundaries;
    if (min >= max) return max;

    return Math.floor(Math.random() * (max - min + 1)) + min;
}
window.calculateOrderCashback = calculateOrderCashback;

async function creditCustomerWallet(phone, amount, orderId) {
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '').slice(-10);
    const earnedCashback = Number(amount) || 0;
    if (earnedCashback <= 0) return;

    // Cumulative Addition Logic:
    const currentWalletBalance = Number(localStorage.getItem('perfetto_wallet_balance') || 0);
    const updatedWalletBalance = currentWalletBalance + earnedCashback;
    localStorage.setItem('perfetto_wallet_balance', updatedWalletBalance);

    let activeDays = getClampedCashbackExpiryDays(customerWalletConfig);
    let expiresAt = null;

    // Honor per-transaction immutable deadline if crediting from an existing order
    if (activeScratchOrder && (String(activeScratchOrder.id || activeScratchOrder.orderId) === String(orderId))) {
        if (activeScratchOrder.scratchExpiryDays || activeScratchOrder.cashbackExpiryDays) {
            activeDays = activeScratchOrder.scratchExpiryDays || activeScratchOrder.cashbackExpiryDays;
        }
        if (activeScratchOrder.scratchExpiresAt) {
            const expMs = typeof activeScratchOrder.scratchExpiresAt === 'number'
                ? activeScratchOrder.scratchExpiresAt
                : new Date(activeScratchOrder.scratchExpiresAt).getTime();
            if (!isNaN(expMs) && expMs > 0) {
                expiresAt = new Date(expMs).toISOString();
            }
        }
    }
    const now = new Date();
    if (!expiresAt) {
        expiresAt = new Date(now.getTime() + activeDays * 24 * 60 * 60 * 1000).toISOString();
    }

    if (!currentCustomerWallet) currentCustomerWallet = { balance: 0, nonExpiredBalance: 0, transactions: [] };
    currentCustomerWallet.phone = cleanPhone || currentCustomerWallet.phone || '';
    currentCustomerWallet.balance = updatedWalletBalance;
    currentCustomerWallet.nonExpiredBalance = updatedWalletBalance;
    currentCustomerWallet.expiresAt = expiresAt;
    currentCustomerWallet.expiryDays = activeDays;
    currentCustomerWallet.cashbackExpiryDays = activeDays;
    currentCustomerWallet.lastCreditedAt = now.toISOString();

    const existingTx = Array.isArray(currentCustomerWallet.transactions) ? currentCustomerWallet.transactions : [];
    existingTx.unshift({
        type: 'credit',
        amount: earnedCashback,
        orderId: String(orderId),
        description: `credited +₹${earnedCashback} for Order #${orderId}`,
        createdAt: now.toISOString(),
        expiresAt: expiresAt,
        expiryDays: activeDays,
        cashbackExpiryDays: activeDays,
        status: 'active'
    });
    currentCustomerWallet.transactions = existingTx.slice(0, 30);
    localStorage.setItem('perfetto_customer_wallet', JSON.stringify(currentCustomerWallet));

    updateProfileWalletUI();
    renderProfileWalletTxList();
    updateCheckoutWalletUI();

    try {
        if (customerFirestore && cleanPhone) {
            const txData = {
                type: 'credit',
                amount: earnedCashback,
                orderId: String(orderId),
                description: `credited +₹${earnedCashback} for Order #${orderId}`,
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : now.toISOString(),
                expiresAt: expiresAt,
                expiryDays: activeDays,
                cashbackExpiryDays: activeDays,
                status: 'active'
            };

            // 1. Permanently bind to users/{phone} and users/phone_{phone}
            const userDocRef = customerFirestore.collection('users').doc(`phone_${cleanPhone}`);
            const userDocRefRaw = customerFirestore.collection('users').doc(cleanPhone);
            const userUpdatePayload = {
                walletBalance: updatedWalletBalance,
                balance: updatedWalletBalance,
                walletExpiresAt: expiresAt,
                walletExpiryDays: activeDays,
                cashbackExpiryDays: activeDays,
                lastCreditedAt: now.toISOString(),
                updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : now.toISOString()
            };

            await userDocRef.set(userUpdatePayload, { merge: true }).catch(() => {});
            await userDocRefRaw.set(userUpdatePayload, { merge: true }).catch(() => {});
            userDocRef.collection('transactions').add(txData).catch(() => {});
            userDocRefRaw.collection('transactions').add(txData).catch(() => {});

            // 2. Backward compatibility: sync to /wallets/{cleanPhone}
            const walletRef = customerFirestore.collection('wallets').doc(cleanPhone);
            await walletRef.set({
                phone: cleanPhone,
                balance: updatedWalletBalance,
                expiresAt: expiresAt,
                expiryDays: activeDays,
                cashbackExpiryDays: activeDays,
                lastCreditedAt: now.toISOString(),
                updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : now.toISOString()
            }, { merge: true }).catch(() => {});

            walletRef.collection('transactions').add(txData).catch(() => {});
        }
    } catch (err) {
        console.warn('Error crediting customer wallet in Firestore:', err);
    }
}
window.creditCustomerWallet = creditCustomerWallet;

function updateProfileWalletUI() {
    const valEl = document.getElementById('profile-wallet-val');
    const expiryTag = document.getElementById('profile-wallet-expiry-tag');
    const expiryText = document.getElementById('profile-wallet-expiry-text');
    const rulesText = document.getElementById('profile-wallet-rules-text');

    if (!valEl) return;

    const isSystemEnabled = customerWalletConfig && customerWalletConfig.enabled !== false;
    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';

    // Read updated cumulative balance dynamically
    const balance = getEffectiveWalletBalance();

    valEl.textContent = balance;

    if (rulesText) {
        rulesText.textContent = isSystemEnabled
            ? (typeof t === 'function' ? t('wallet_rules_default') : 'Auto-cashback on eligible orders • 100% usable on any order')
            : (typeof t === 'function' ? t('wallet_paused') : 'Wallet rewards system is currently paused.');
    }

    if (balance > 0 && currentCustomerWallet && currentCustomerWallet.expiresAt) {
        const expMs = typeof currentCustomerWallet.expiresAt === 'number'
            ? currentCustomerWallet.expiresAt
            : new Date(currentCustomerWallet.expiresAt).getTime();
        if (!isNaN(expMs) && expMs > 0) {
            const remainingDays = Math.ceil((expMs - Date.now()) / (24 * 60 * 60 * 1000));
            if (remainingDays > 0) {
                if (expiryTag && expiryText) {
                    expiryTag.style.display = 'flex';
                    expiryText.textContent = formatExpiryDaysLabel(remainingDays, isHindi);
                }
            } else {
                // Mark balance as expired atomically
                currentCustomerWallet.balance = 0;
                currentCustomerWallet.nonExpiredBalance = 0;
                currentCustomerWallet.expired = true;
                try {
                    localStorage.setItem('perfetto_wallet_balance', 0);
                    localStorage.setItem('perfetto_customer_wallet', JSON.stringify(currentCustomerWallet));
                } catch (e) {}
                valEl.textContent = '0';
                if (expiryTag) expiryTag.style.display = 'none';
            }
        }
    } else if (balance > 0) {
        const activeDays = getClampedCashbackExpiryDays(customerWalletConfig);
        if (expiryTag && expiryText) {
            expiryTag.style.display = 'flex';
            expiryText.textContent = formatExpiryDaysLabel(activeDays, isHindi);
        }
    } else if (expiryTag) {
        expiryTag.style.display = 'none';
    }

    // Check for unclaimed scratch cards from delivered orders
    const unclaimedBanner = document.getElementById('profile-scratch-unclaimed-banner');
    if (unclaimedBanner) {
        const unclaimedOrder = getFirstUnclaimedDeliveredOrder();
        if (unclaimedOrder) {
            unclaimedBanner.style.display = 'flex';
        } else {
            unclaimedBanner.style.display = 'none';
        }
    }

    renderProfileWalletTxList();
}
window.updateProfileWalletUI = updateProfileWalletUI;

function toggleWalletLedgerView() {
    const list = document.getElementById('profile-wallet-tx-list');
    const arrow = document.getElementById('arrow-wallet-ledger');
    if (!list) return;

    const isHidden = list.style.display === 'none' || list.style.display === '';
    list.style.display = isHidden ? 'flex' : 'none';
    if (arrow) {
        arrow.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    }
}
window.toggleWalletLedgerView = toggleWalletLedgerView;

function renderProfileWalletTxList() {
    const container = document.getElementById('profile-wallet-tx-list');
    if (!container) return;

    try {
        const stored = localStorage.getItem('perfetto_customer_wallet');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed.transactions) && (!currentCustomerWallet.transactions || currentCustomerWallet.transactions.length === 0)) {
                currentCustomerWallet.transactions = parsed.transactions;
            }
        }
    } catch (e) {}

    const txList = Array.isArray(currentCustomerWallet.transactions) ? currentCustomerWallet.transactions : [];
    const now = Date.now();

    if (txList.length === 0) {
        container.innerHTML = `
            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px 0;">
                No wallet transactions yet. Place an order of ₹200+ to earn cashback!
            </div>
        `;
        return;
    }

    container.innerHTML = txList.slice(0, 15).map(tx => {
        const isCredit = tx.type === 'credit' || (tx.amount && Number(tx.amount) > 0);
        const amt = Math.abs(Number(tx.amount) || 0);
        const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

        let expiryNotice = '';
        if (isCredit && tx.expiresAt) {
            const expTime = new Date(tx.expiresAt).getTime();
            if (expTime < now) {
                expiryNotice = '<span style="color: #ef4444;">(Expired)</span>';
            } else {
                const days = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
                expiryNotice = `<span>(Valid for ${days}d)</span>`;
            }
        }

        const txTitle = tx.description || (isCredit ? `credited +₹${amt} for Order #${tx.orderId || ''}` : `Redeemed on Order #${tx.orderId || ''}`);

        return `
            <div class="wallet-tx-item ${isCredit ? 'tx-credit' : 'tx-debit'}">
                <div class="wallet-tx-left">
                    <span class="wallet-tx-title">${txTitle}</span>
                    <span class="wallet-tx-date">${dateStr}</span>
                </div>
                <div class="wallet-tx-right">
                    <span class="wallet-tx-amount ${isCredit ? 'amount-credit' : 'amount-debit'}">${isCredit ? '+' : '-'}₹${amt}</span>
                    <span class="wallet-tx-expiry">${expiryNotice}</span>
                </div>
            </div>
        `;
    }).join('');
}
window.renderProfileWalletTxList = renderProfileWalletTxList;

// --------------------------------------------------------------------------
// 4C. STORE NOTICE CLIENT CONTROLLER
// Static Home Chip, Profile Integration & Modal Dialog
// --------------------------------------------------------------------------
const DEFAULT_STORE_NOTICE = {
    key: 'store_notice',
    enabled: true,
    title: 'Store Notice',
    text: 'Welcome to Perfetto Pizza Plus! We take pride in serving freshly baked pizzas, delicious burgers, wraps, and fast food delights. For any special catering or bulk party orders, contact customer support.',
    updatedAt: null
};

let customerStoreNotice = (function() {
    try {
        const stored = localStorage.getItem('perfetto_store_notice');
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_STORE_NOTICE));
})();

let storeNoticeRealtimeUnsubscribe = null;

function updateStoreNoticeUI() {
    const chipWrapper = document.getElementById('home-store-notice-wrapper');
    const chipPreview = document.getElementById('home-notice-chip-preview');

    const notice = customerStoreNotice || DEFAULT_STORE_NOTICE;
    const isEnabled = notice.enabled !== false && notice.text && notice.text.trim().length > 0;

    if (chipWrapper) {
        chipWrapper.style.display = isEnabled ? 'block' : 'none';
    }

    if (chipPreview && notice.text) {
        const cleanText = notice.text.replace(/\s+/g, ' ').trim();
        chipPreview.textContent = cleanText.length > 75 ? cleanText.substring(0, 75) + '...' : cleanText;
    }
}
window.updateStoreNoticeUI = updateStoreNoticeUI;

function openStoreNoticeModal() {
    const modal = document.getElementById('store-notice-modal');
    if (!modal) return;

    const titleEl = document.getElementById('store-notice-modal-title');
    const contentEl = document.getElementById('store-notice-modal-content');
    const timeEl = document.getElementById('store-notice-modal-timestamp');

    const notice = customerStoreNotice || DEFAULT_STORE_NOTICE;

    if (titleEl) {
        titleEl.textContent = notice.title || 'Store Notice';
    }

    if (contentEl) {
        const rawText = notice.text || 'No active store announcements at the moment.';
        const paragraphs = rawText.split(/\n+/).filter(p => p.trim().length > 0);
        if (paragraphs.length > 0) {
            contentEl.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
        } else {
            contentEl.innerHTML = `<p>${escapeHtml(rawText)}</p>`;
        }
    }

    if (timeEl) {
        if (notice.updatedAt) {
            const date = notice.updatedAt.toDate ? notice.updatedAt.toDate() : new Date(notice.updatedAt);
            if (!isNaN(date.getTime())) {
                timeEl.textContent = `Updated on ${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
            } else {
                timeEl.textContent = 'Official Announcement';
            }
        } else {
            timeEl.textContent = 'Official Announcement';
        }
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}
window.openStoreNoticeModal = openStoreNoticeModal;

function closeStoreNoticeModal() {
    const modal = document.getElementById('store-notice-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}
window.closeStoreNoticeModal = closeStoreNoticeModal;

function initStoreNoticeModal() {
    const modal = document.getElementById('store-notice-modal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeStoreNoticeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeStoreNoticeModal();
        }
    });
}
window.initStoreNoticeModal = initStoreNoticeModal;

// REAL-TIME CROSS-TAB STORAGE SYNCHRONIZATION
window.addEventListener('storage', (e) => {
    if (!e.key || e.key === SHOP_STATUS_KEY || e.key === OPENING_TIME_KEY || e.key === CLOSING_TIME_KEY || e.key === AUTO_SCHEDULE_KEY || e.key === MANUAL_OVERRIDE_KEY) {
        checkAndUpdateShopStatusUI();
    }
    if (!e.key || e.key === MIN_ORDER_KEY || e.key === FREE_DELIVERY_KEY) {
        updateCartUI();
    }
    if (!e.key || e.key === 'perfetto_wallet_config' || e.key === 'perfetto_customer_wallet' || e.key === 'perfetto_wallet_balance') {
        try {
            if (e.key === 'perfetto_wallet_config') {
                customerWalletConfig = safeStorage.getJSON('perfetto_wallet_config', {});
                const days = getClampedCashbackExpiryDays(customerWalletConfig);
                customerWalletConfig.cashbackExpiryDays = days;
                customerWalletConfig.expiryDays = days;
            }
            if (e.key === 'perfetto_customer_wallet') currentCustomerWallet = safeStorage.getJSON('perfetto_customer_wallet', {});
        } catch (err) {}
        updateCartUI();
        updateProfileWalletUI();
        updateCheckoutWalletUI();
        if (typeof renderOrderHistoryDetails === 'function') {
            renderOrderHistoryDetails();
        }
    }
    if (!e.key || e.key === 'perfetto_store_notice') {
        try {
            customerStoreNotice = safeStorage.getJSON('perfetto_store_notice', {});
        } catch (err) {}
        updateStoreNoticeUI();
    }
    if (!e.key || e.key === MENU_STORAGE_KEY) {
        if (lastCategoryState.categoryName && activeTabName === 'category-detail') {
            openCategoryDetail(lastCategoryState.categoryName, lastCategoryState.categoryImg, true, true);
        }
    }
    if (!e.key || e.key === CART_STORAGE_KEY) {
        cart = loadCartFromStorage();
        updateCartUI();
    }
});

// --------------------------------------------------------------------------
// 5. FAST FOOD CARD INTERACTION (NAVIGATE TO CATEGORY DETAIL)
// --------------------------------------------------------------------------
function setupFastFoodCards() {
    const cards = document.querySelectorAll('.fast-food-card');
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent full page refresh
            if (activeTabName === 'home') {
                lastHomeScrollY = getHomeScrollPosition();
            }
            const categoryName = card.getAttribute('data-category') || card.getAttribute('aria-label') || 'Category';
            const categoryImg = card.querySelector('img').src;

            // Navigate to dynamic sub-category detail view (direct add-to-cart disabled)
            openCategoryDetail(categoryName, categoryImg);
        });
    });
}

// --------------------------------------------------------------------------
// 6. CART MANAGEMENT & CALCULATIONS
// --------------------------------------------------------------------------
function addToCart(name, price, img, addons = []) {
    if (getCustomerShopStatus() === 'closed') {
        showToast('This time shop is closed. We are not accepting orders right now.');
        return;
    }

    // Check if item is marked out-of-stock in latest menu data
    const allItems = getAllCustomerMenuItems();
    const cleanName = (name || '').replace(/\s*\([SML]\)$/i, '').replace(/\s*\(\+.*?\)$/i, '').trim();
    const menuItem = allItems.find(i => (i.name && i.name.toLowerCase() === cleanName.toLowerCase()));
    if (menuItem && menuItem.available === false) {
        showToast(`⚠️ "${cleanName}" is currently out of stock.`);
        return;
    }

    // Build item name and identifier taking add-ons into account
    const addonNames = Array.isArray(addons)
        ? addons.map(a => typeof a === 'string' ? a : a.name).filter(Boolean)
        : [];
    const fullItemName = addonNames.length > 0
        ? `${name} (+${addonNames.join(', ')})`
        : name;

    const existingIndex = cart.findIndex(item => item.name === fullItemName);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({
            name: fullItemName,
            baseName: name,
            price: Number(price),
            qty: 1,
            img: img || '',
            addons: addons
        });
    }
    saveCartToStorage();
    updateCartUI();

    // Display clean single-line notification with primary item name (and size if applicable)
    const cleanToastItemName = String(name || '').replace(/\s*\(\+.*?\)$/i, '').trim();
    showToast(`Added ${cleanToastItemName} to your cart!`);
}

function updateQuantity(index, change) {
    if (getCustomerShopStatus() === 'closed' && change > 0) {
        showToast('This time shop is closed. We are not accepting orders right now.');
        return;
    }
    cart[index].qty += change;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    saveCartToStorage();
    updateCartUI();
}

function clearCart() {
    cart = [];
    saveCartToStorage();
    updateCartUI();
    showToast('Cart cleared');
}

function updateCartUI() {
    // 1. Update Cart Badge Count & Clear All Button Visibility
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    cartBadge.textContent = totalCount;
    cartBadge.style.display = totalCount > 0 ? 'flex' : 'none';

    const clearCartBtn = document.getElementById('clear-cart-btn') || document.querySelector('.clear-cart-btn');
    if (clearCartBtn) {
        clearCartBtn.style.display = cart.length > 0 ? 'block' : 'none';
    }

    // 2. Render Cart Items List
    if (!cartContainer) return;

    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div class="empty-cart-view">
                <i class="fa-solid fa-pizza-slice empty-cart-icon"></i>
                <h4>${typeof t === 'function' ? t('cart_empty_title') : 'Your cart is empty'}</h4>
                <p>${typeof t === 'function' ? t('cart_empty_desc') : 'Browse categories on Home and add items to your cart!'}</p>
            </div>
        `;
    } else {
        cartContainer.innerHTML = cart.map((item, index) => {
            const hasAddons = Array.isArray(item.addons) && item.addons.length > 0;
            const addonTagsMarkup = hasAddons
                ? `<div class="cart-addons-tags">${item.addons.map(a => {
                    const rawName = typeof a === 'string' ? a : (a.name || '');
                    const aName = rawName.replace(/^\+\s*/, '').trim();
                    const translatedAddon = typeof tAddon === 'function' ? tAddon(aName) : aName;
                    const isMayo = aName.toLowerCase().includes('mayo');
                    const hasIcon = aName.startsWith('🧀') || aName.startsWith('🌶️') || aName.startsWith('🍥') || aName.startsWith('🍨');
                    const icon = hasIcon ? '' : (aName.toLowerCase().includes('cheese') ? '🧀 ' : (aName.toLowerCase().includes('spicy') ? '🌶️ ' : (isMayo ? '🍥 ' : (aName.toLowerCase().includes('ice cream') ? '🍨 ' : ''))));
                    return `<span class="cart-addon-pill ${isMayo ? 'cart-addon-mayo' : ''}">${icon}${translatedAddon}</span>`;
                }).join('')}</div>`
                : '';

            return `
            <div class="cart-item-card">
                <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h5 class="cart-item-name">${typeof tItem === 'function' ? tItem(item.baseName || item.name) : (item.baseName || item.name)}</h5>
                    ${addonTagsMarkup}
                    <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
                </div>
                <div class="qty-control">
                    <button class="qty-btn" onclick="updateQuantity(${index}, -1)">-</button>
                    <span class="qty-val">${item.qty}</span>
                    <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
                </div>
            </div>
            `;
        }).join('');
    }

    // 3. Recalculate Subtotal, Thresholds & Dynamic Delivery Fee
    const minOrderVal = getMinOrderValue();
    const freeDeliveryLim = getFreeDeliveryLimit();

    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal);

    const deliveryFee = (cart.length > 0 && subtotal > 0)
        ? (deliveryInfo.isFreeDelivery ? 'FREE' : deliveryInfo.finalDeliveryFee)
        : 0;

    // Ensure grandTotal = Math.max(0, subtotal + (deliveryFee === 'FREE' ? 0 : Number(deliveryFee)))
    // If delivery is FREE, the Grand Total must strictly equal the active Subtotal amount (e.g., ₹1098, not ₹0)
    const grandTotal = (cart.length === 0 || subtotal <= 0)
        ? 0
        : (deliveryFee === 'FREE' || deliveryInfo.isFreeDelivery
            ? subtotal
            : Math.max(0, subtotal + (deliveryFee === 'FREE' ? 0 : Number(deliveryFee))));

    const subtotalEl = document.getElementById('cart-subtotal');
    const deliveryEl = document.getElementById('cart-delivery');
    const totalEl = document.getElementById('cart-total');

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

    if (deliveryEl) {
        const freeTag = `<span class="free-delivery-tag">${typeof t === 'function' ? t('delivery_free') : 'FREE'}</span>`;
        if (cart.length > 0 && (deliveryInfo.isFreeDelivery || deliveryFee === 'FREE')) {
            if (deliveryInfo.baseDeliveryFee > 0) {
                deliveryEl.innerHTML = `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.85rem; margin-right: 4px;">${formatPrice(deliveryInfo.baseDeliveryFee)}</span>${freeTag}`;
            } else {
                deliveryEl.innerHTML = freeTag;
            }
        } else if (cart.length > 0) {
            if (Number(deliveryFee) === 0) {
                deliveryEl.innerHTML = freeTag;
            } else {
                deliveryEl.textContent = formatPrice(Number(deliveryFee));
            }
        } else {
            deliveryEl.textContent = formatPrice(0);
        }
    }

    // Sync computed Grand Total into cart drawer UI (fixes 0 amount bug)
    if (totalEl) {
        totalEl.textContent = formatPrice(grandTotal);
    }

    // Sync computed Grand Total into "Proceed to Checkout" button data attributes before review modal
    const checkoutBtns = document.querySelectorAll('.checkout-btn, #checkout-btn, [onclick*="processCheckout"]');
    checkoutBtns.forEach(btn => {
        btn.setAttribute('data-grand-total', String(grandTotal));
        btn.setAttribute('data-subtotal', String(subtotal));
        btn.setAttribute('data-delivery-fee', String(deliveryFee === 'FREE' ? 0 : Number(deliveryFee)));
    });

    // 4. Update Cart Threshold Banner, Cashback Incentive Bar & Checkout Button State
    updateCartThresholdBanner(subtotal, minOrderVal, freeDeliveryLim);
    updateCartCashbackIncentiveBar(subtotal);

    // 5. Ensure shop closed state overrides if shop is closed
    checkAndUpdateShopStatusUI();

    // 6. Update Sticky Floating Cart Pill Bar
    updateFloatingCartBar();
}

function renderCart() {
    return updateCartUI();
}
window.renderCart = renderCart;

function updateFloatingCartBar() {
    const floatingBar = document.getElementById('floating-cart-bar');
    const countBadge = document.getElementById('floating-cart-count');
    const priceDisplay = document.getElementById('floating-cart-total');

    if (!floatingBar) return;

    const totalCount = (cart && Array.isArray(cart)) ? cart.reduce((sum, item) => sum + item.qty, 0) : 0;
    const subtotal = (cart && Array.isArray(cart)) ? cart.reduce((sum, item) => sum + (item.price * item.qty), 0) : 0;

    // Show floating bar on Home, Category Detail, or Search Results views when cart has items
    const isApplicableTab = activeTabName === 'home' || activeTabName === 'category-detail' || activeTabName === 'search-results';

    if (totalCount > 0 && isApplicableTab) {
        floatingBar.style.display = 'flex';
        if (countBadge) {
            const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
            countBadge.textContent = isHindi ? `${totalCount} सामान` : `${totalCount} ITEM${totalCount !== 1 ? 'S' : ''}`;
        }
        if (priceDisplay) {
            priceDisplay.textContent = formatPrice(subtotal);
        }
    } else {
        floatingBar.style.display = 'none';
    }
}

function getSavedDeliveryProfile() {
    try {
        const profile = safeStorage.getJSON(DELIVERY_PROFILE_KEY, null);
        if (profile && typeof profile === 'object') {
            const fullName = (profile.fullName || '').trim();
            const email = (profile.email || '').trim();
            const phone = (profile.phone || '').replace(/[^0-9]/g, '').slice(0, 10);
            const colonyName = (profile.colonyName || '').trim();
            const nearBy = (profile.nearBy || '').trim();
            const streetName = (profile.streetName || '').trim();
            const wardNo = (profile.wardNo || '').trim();
            const isVerified = profile.isVerified === true;
            const gpsLat = profile.gpsLat !== undefined && profile.gpsLat !== null ? parseFloat(profile.gpsLat) : null;
            const gpsLng = profile.gpsLng !== undefined && profile.gpsLng !== null ? parseFloat(profile.gpsLng) : null;

            if (fullName && phone && phone.length === 10 && colonyName && nearBy && streetName && wardNo && gpsLat !== null && gpsLng !== null) {
                return { fullName, email, phone, colonyName, nearBy, streetName, wardNo, isVerified, gpsLat, gpsLng };
            }
        }
    } catch (e) {
        console.error('Error reading delivery profile:', e);
    }
    return null;
}

// --------------------------------------------------------------------------
// CHECKOUT & PAYMENT FLOW CONTROLLER
// --------------------------------------------------------------------------
let isCheckoutAddressConfirmed = false;

function processCheckout() {
    const storeStatus = evaluateCustomerStoreStatus();
    if (!storeStatus.isOpen) {
        showToast(storeStatus.message || 'We are currently closed.');
        return;
    }

    const itemCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);

    if (!cart || cart.length === 0 || itemCount === 0 || subtotal <= 0) {
        showToast('Your cart is empty! Please add items before placing an order.');
        return;
    }

    // Check if any cart item is currently out of stock
    const unavailableItems = validateCartAvailability();
    if (unavailableItems.length > 0) {
        showToast(`⚠️ "${unavailableItems[0]}" is currently out of stock. Please remove it from your cart.`);
        return;
    }

    const minOrderVal = getMinOrderValue();
    if (subtotal < minOrderVal) {
        const diff = (minOrderVal - subtotal).toFixed(2);
        showToast(`Minimum order is ${formatPrice(minOrderVal)}. Add ${formatPrice(diff)} more to place your order.`);
        return;
    }

    // Sync computed Grand Total into button data attributes before opening review order modal
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal);
    const deliveryFee = deliveryInfo.isFreeDelivery ? 'FREE' : deliveryInfo.finalDeliveryFee;
    const grandTotal = (deliveryFee === 'FREE' || deliveryInfo.isFreeDelivery)
        ? subtotal
        : Math.max(0, subtotal + (deliveryFee === 'FREE' ? 0 : Number(deliveryFee)));

    const checkoutBtns = document.querySelectorAll('.checkout-btn, #checkout-btn, [onclick*="processCheckout"]');
    checkoutBtns.forEach(btn => {
        btn.setAttribute('data-grand-total', String(grandTotal));
        btn.setAttribute('data-subtotal', String(subtotal));
        btn.setAttribute('data-delivery-fee', String(deliveryFee === 'FREE' ? 0 : Number(deliveryFee)));
    });

    // Check if delivery profile already exists and is complete
    const savedProfile = getSavedDeliveryProfile();
    if (savedProfile) {
        openCheckoutModal(savedProfile);
        return;
    }

    // If missing or incomplete, redirect directly to Profile tab form and open it!
    showProfileRedirectNotice(true);
    switchTab('profile', true);
    updateProfileTotalsUI();
    toggleEditProfileForm(true);
}

function openCheckoutModal(profile) {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;

    // Fetch latest wallet balance & attach real-time listener for current customer phone
    if (profile && profile.phone) {
        fetchCustomerWallet(profile.phone).then(() => {
            updateCheckoutWalletUI();
        });
        listenToCustomerWalletRealtime(profile.phone);
    }

    const itemCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const customCoords = (profile && profile.gpsLat !== undefined && profile.gpsLng !== undefined && profile.gpsLat !== null && profile.gpsLng !== null)
        ? { lat: parseFloat(profile.gpsLat), lng: parseFloat(profile.gpsLng) }
        : null;
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal, customCoords);
    const deliveryFee = deliveryInfo.isFreeDelivery ? 'FREE' : deliveryInfo.finalDeliveryFee;
    const grandTotal = (deliveryFee === 'FREE' || deliveryInfo.isFreeDelivery)
        ? subtotal
        : Math.max(0, subtotal + (deliveryFee === 'FREE' ? 0 : Number(deliveryFee)));

    // Sync button data attributes before opening review order modal
    const checkoutBtns = document.querySelectorAll('.checkout-btn, #checkout-btn, [onclick*="processCheckout"]');
    checkoutBtns.forEach(btn => {
        btn.setAttribute('data-grand-total', String(grandTotal));
        btn.setAttribute('data-subtotal', String(subtotal));
        btn.setAttribute('data-delivery-fee', String(deliveryFee === 'FREE' ? 0 : Number(deliveryFee)));
    });

    // 1. Update Order Summary inside Checkout Modal
    const itemCountEl = document.getElementById('checkout-item-count');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const deliveryEl = document.getElementById('checkout-delivery');
    const totalEl = document.getElementById('checkout-total');

    if (itemCountEl) itemCountEl.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (deliveryEl) {
        if (deliveryInfo.isFreeDelivery || deliveryFee === 'FREE') {
            if (deliveryInfo.baseDeliveryFee > 0) {
                deliveryEl.innerHTML = `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.82rem; margin-right: 4px;">${formatPrice(deliveryInfo.baseDeliveryFee)}</span><span class="free-delivery-tag">FREE</span>`;
            } else {
                deliveryEl.innerHTML = `<span class="free-delivery-tag">FREE</span>`;
            }
        } else if (Number(deliveryFee) === 0) {
            deliveryEl.innerHTML = `<span class="free-delivery-tag">FREE</span>`;
        } else {
            deliveryEl.textContent = formatPrice(Number(deliveryFee));
        }
    }
    if (totalEl) totalEl.textContent = formatPrice(grandTotal);

    // 2. Render Saved Address Summary Card inside Checkout
    const addressContentEl = document.getElementById('checkout-address-content');
    if (addressContentEl && profile) {
        const gpsInfo = (profile.gpsLat && profile.gpsLng)
            ? `<div style="margin-top: 6px; font-size: 0.8rem; color: #16a34a; font-weight: 700;">
                 <i class="fa-solid fa-location-crosshairs"></i> GPS Verified (${deliveryInfo.distanceKm !== null ? deliveryInfo.distanceKm + ' km from store' : 'Location pinned'})
               </div>`
            : '';

        addressContentEl.innerHTML = `
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 6px;">
                <i class="fa-solid fa-user" style="color: var(--primary-orange); margin-right: 6px;"></i>${profile.fullName || 'Customer'} (${profile.phone || ''})
            </div>
            <div><strong style="color: var(--text-muted);">Colony:</strong> ${profile.colonyName || 'N/A'}</div>
            <div><strong style="color: var(--text-muted);">Landmark:</strong> ${profile.nearBy || 'N/A'}</div>
            <div><strong style="color: var(--text-muted);">Street:</strong> ${profile.streetName || 'N/A'}</div>
            <div><strong style="color: var(--text-muted);">Ward No:</strong> ${profile.wardNo || 'N/A'}</div>
            ${gpsInfo}
        `;
    }

    // 3. Update & render customer wallet redemption state
    updateCheckoutWalletUI();

    // Reset Address confirmation state & hide payment alert
    isCheckoutAddressConfirmed = false;
    const confirmBtn = document.getElementById('btn-confirm-address-action');
    const paymentSection = document.getElementById('checkout-payment-section');
    const onlineAlert = document.getElementById('online-payment-alert');

    if (confirmBtn) {
        confirmBtn.className = 'btn-confirm-address-action';
        confirmBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${typeof t === 'function' ? t('confirm_address') : 'Confirm Address'}`;
    }
    if (paymentSection) {
        paymentSection.style.opacity = '0.5';
        paymentSection.style.pointerEvents = 'none';
    }
    if (onlineAlert) {
        onlineAlert.style.display = 'none';
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

function handleEditAddressFromCheckout() {
    closeCheckoutModal();
    openEditProfileModal();
    showToast('Update your profile and address details below.');
}

function handleConfirmAddressForCheckout() {
    isCheckoutAddressConfirmed = true;
    const confirmBtn = document.getElementById('btn-confirm-address-action');
    const paymentSection = document.getElementById('checkout-payment-section');

    if (confirmBtn) {
        confirmBtn.className = 'btn-confirm-address-action address-confirmed';
        confirmBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${typeof t === 'function' ? t('address_confirmed') : 'Address Confirmed ✓'}`;
    }
    if (paymentSection) {
        paymentSection.style.opacity = '1';
        paymentSection.style.pointerEvents = 'auto';
        paymentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    showToast('✅ Address confirmed! Please select your payment mode.');
}

// --------------------------------------------------------------------------
// ONLINE PAYMENT OPTION (CURRENTLY UNDER DEVELOPMENT / COMING SOON)
// --------------------------------------------------------------------------
function handleSelectOnlinePayment() {
    if (!isCheckoutAddressConfirmed) {
        showToast('⚠️ Please tap "Confirm Address" first.');
        return;
    }
    showToast('ℹ️ Online Payment (PhonePe / UPI / Cards) is currently under development. Please choose Cash on Delivery (COD) to place your order!');
}

function handleSelectCodPayment() {
    const storeStatus = evaluateCustomerStoreStatus();
    if (!storeStatus.isOpen) {
        showToast(storeStatus.message || 'We are currently closed.');
        return;
    }
    if (!isCheckoutAddressConfirmed) {
        showToast('⚠️ Please tap "Confirm Address" first.');
        return;
    }
    const unavailableItems = validateCartAvailability();
    if (unavailableItems.length > 0) {
        showToast(`⚠️ "${unavailableItems[0]}" is currently out of stock. Please remove it from your cart.`);
        return;
    }
    const savedProfile = getSavedDeliveryProfile();
    if (!savedProfile) {
        closeCheckoutModal();
        switchTab('profile', true);
        toggleEditProfileForm(true);
        showToast('Please complete your delivery address first.');
        return;
    }

    closeCheckoutModal();
    const orderId = getNextOrderSequenceNumber().toString();
    executeOrderPlacement(savedProfile, 'Cash on Delivery', 'Cash on Delivery', orderId, true);
}

function getNextOrderSequenceNumber() {
    let nextOrderSeq = 1;
    try {
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        if (storedOrders) {
            const ordersList = JSON.parse(storedOrders);
            if (Array.isArray(ordersList)) {
                const maxNum = ordersList.reduce((max, o) => {
                    const rawId = (o.id || o.orderId || '').toString().replace(/[^0-9]/g, '');
                    const num = parseInt(rawId, 10);
                    return !isNaN(num) && num > max ? num : max;
                }, 0);
                nextOrderSeq = maxNum + 1;
            }
        }
    } catch (e) {
        nextOrderSeq = 1;
    }
    return nextOrderSeq;
}

function executeOrderPlacement(profile, paymentMethod = 'Cash on Delivery', paymentStatus = 'Cash on Delivery', specificOrderId = null, clearCartNow = true) {
    const storeStatus = evaluateCustomerStoreStatus();
    if (!storeStatus.isOpen) {
        showToast(storeStatus.message || 'We are currently closed.');
        return;
    }
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);

    // Prioritize active in-memory custom pinned GPS, fallback to profile GPS or hidden inputs
    let finalLat = null;
    let finalLng = null;

    if (currentCustomerGps && typeof currentCustomerGps.lat === 'number' && typeof currentCustomerGps.lng === 'number') {
        finalLat = currentCustomerGps.lat;
        finalLng = currentCustomerGps.lng;
    } else if (profile && profile.gpsLat !== undefined && profile.gpsLng !== undefined && profile.gpsLat !== null && profile.gpsLng !== null) {
        finalLat = parseFloat(profile.gpsLat);
        finalLng = parseFloat(profile.gpsLng);
    } else {
        const latHidden = document.getElementById('customer-gps-lat');
        const lngHidden = document.getElementById('customer-gps-lng');
        if (latHidden && latHidden.value && lngHidden && lngHidden.value) {
            finalLat = parseFloat(latHidden.value);
            finalLng = parseFloat(lngHidden.value);
        }
    }

    const customCoords = (finalLat !== null && finalLng !== null && !isNaN(finalLat) && !isNaN(finalLng))
        ? { lat: finalLat, lng: finalLng }
        : null;

    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal, customCoords);
    const deliveryFee = deliveryInfo.finalDeliveryFee;
    const baseGrandTotal = subtotal + deliveryFee;
    const walletDiscountToApply = isWalletRedemptionSelected ? Math.min(appliedWalletDiscountAmount, baseGrandTotal) : 0;
    const grandTotal = Math.max(0, baseGrandTotal - walletDiscountToApply);
    // Cashback qualifies only when wallet balance was NOT redeemed on this order
    const qualifiesForCashback = (walletDiscountToApply <= 0);
    const earnedCashback = qualifiesForCashback ? calculateOrderCashback(subtotal) : 0;

    const resolvedPaymentMethod = (grandTotal === 0 && walletDiscountToApply > 0) ? 'Wallet Cash' : paymentMethod;
    const resolvedPaymentStatus = (grandTotal === 0 && walletDiscountToApply > 0) ? 'Paid via Wallet' : paymentStatus;

    const orderId = specificOrderId || getNextOrderSequenceNumber().toString();
    const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
    const orderItems = cart.map(item => ({
        id: item.id || item.name,
        name: `${item.qty}x ${item.name} (${item.size || 'Standard'})`,
        size: item.size || 'Standard',
        price: item.price,
        qty: item.qty,
        notes: (item.addons && item.addons.length > 0) ? item.addons.map(a => a.name).join(', ') : '',
        addons: item.addons || []
    }));

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const newOrder = {
        orderId: orderId,
        id: orderId,
        deliveryOtp: deliveryOtp,
        firebaseUid: (currentUserProfile && currentUserProfile.firebaseUid) || '',
        customerName: profile.fullName,
        customerPhone: profile.phone,
        customerEmail: (currentUserProfile && currentUserProfile.email) || profile.email || '',
        phone: profile.phone,
        address: `${profile.colonyName}, Near: ${profile.nearBy}, ${profile.streetName}, Ward No. ${profile.wardNo}`,
        gpsLat: (customCoords && customCoords.lat) || null,
        gpsLng: (customCoords && customCoords.lng) || null,
        gps: {
            lat: (customCoords && customCoords.lat) || null,
            lng: (customCoords && customCoords.lng) || null,
        },
        deliveryDetails: {
            colonyName: profile.colonyName,
            nearBy: profile.nearBy,
            streetName: profile.streetName,
            wardNo: profile.wardNo,
            gpsLat: (customCoords && customCoords.lat) || null,
            gpsLng: (customCoords && customCoords.lng) || null,
            distanceKm: deliveryInfo.distanceKm,
            zone: deliveryInfo.zoneInfo ? deliveryInfo.zoneInfo.zoneNum : null,
            zoneLabel: deliveryInfo.zoneInfo ? deliveryInfo.zoneInfo.zoneLabel : ''
        },
        timeAgo: `${timeFormatted} • Just now`,
        items: orderItems,
        subtotal: Math.round(subtotal),
        deliveryFee: deliveryFee,
        walletDiscount: Math.round(walletDiscountToApply),
        usedWalletCash: Math.round(walletDiscountToApply),
        earnedCashback: Math.round(earnedCashback),
        wonCashback: Math.round(earnedCashback),
        rewardStatus: 'unscratched',
        scratchRevealed: false,
        scratchClaimed: false,
        scratchExpired: false,
        scratchExpiresAt: (function() {
            const activeDays = getClampedCashbackExpiryDays(customerWalletConfig);
            return Date.now() + activeDays * 24 * 60 * 60 * 1000;
        })(),
        scratchExpiryDays: getClampedCashbackExpiryDays(customerWalletConfig),
        cashbackExpiryDays: getClampedCashbackExpiryDays(customerWalletConfig),
        scratchCard: (function() {
            const activeDays = getClampedCashbackExpiryDays(customerWalletConfig);
            const expMs = Date.now() + activeDays * 24 * 60 * 60 * 1000;
            return {
                amount: Math.round(earnedCashback),
                wonAmount: Math.round(earnedCashback),
                revealed: false,
                claimed: false,
                status: 'unscratched',
                claimedAt: null,
                createdAt: now.toISOString(),
                expiresAt: expMs,
                expiresAtISO: new Date(expMs).toISOString(),
                expiryDays: activeDays,
                cashbackExpiryDays: activeDays
            };
        })(),
        total: Math.round(grandTotal),
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: resolvedPaymentStatus,
        status: 'new',
        createdAt: now.toISOString()
    };

    const customerPhone = (profile && profile.phone) ? profile.phone : ((currentUserProfile && currentUserProfile.phone) || '');

    // If wallet cash was used, debit customer's wallet in Firestore & local state
    if (walletDiscountToApply > 0) {
        debitCustomerWallet(customerPhone, walletDiscountToApply, orderId);
        isWalletRedemptionSelected = false;
        appliedWalletDiscountAmount = 0;
    }

    // Note: Cashback scratch card reward is unlocked immediately upon order placement, with an immutable per-transaction expiry deadline!
    // (Wallet crediting occurs when the customer scratches & claims the card in the Scratch Card Modal)

    // 1. Save order to LocalStorage via SafeStorage (Immediate Offline Resilience)
    let ordersList = safeStorage.getJSON('perfettoCustomerOrders', []);
    if (!Array.isArray(ordersList)) ordersList = [];
    const existingIndex = ordersList.findIndex(o => o && (o.id || o.orderId) === orderId);
    if (existingIndex >= 0) {
        ordersList[existingIndex] = newOrder;
    } else {
        ordersList.unshift(newOrder);
    }
    safeStorage.setJSON('perfettoCustomerOrders', ordersList);

    // 2. Asynchronously save order to Firebase Firestore via Backend API
    saveOrderToBackendAPI(newOrder);

    if (clearCartNow) {
        cart = [];
        saveCartToStorage();
        updateCartUI();
        updateProfileTotalsUI();
        openOrderOtpSuccessModal(newOrder);
    }
}

// Real-Time & Backend Order Saver (Firebase Firestore)
async function saveOrderToBackendAPI(order) {
    const finalOrderId = String(order.orderId || order.id || Date.now());
    const cleanCustomerPhone = String(order.customerPhone || (order.customer && order.customer.phone) || order.phone || '').replace(/[^0-9]/g, '').slice(-10);

    const activeOrderDays = order.scratchExpiryDays || order.cashbackExpiryDays || (order.scratchCard && (order.scratchCard.expiryDays || order.scratchCard.cashbackExpiryDays)) || getClampedCashbackExpiryDays(customerWalletConfig);
    const scratchExpiryTimestamp = order.scratchExpiresAt || (order.scratchCard && order.scratchCard.expiresAt) || (Date.now() + activeOrderDays * 24 * 60 * 60 * 1000);
    const firestoreOrderPayload = {
        ...order,
        id: finalOrderId,
        orderId: finalOrderId,
        customerPhone: cleanCustomerPhone,
        phone: cleanCustomerPhone,
        status: order.status || 'pending',
        createdAt: order.createdAt || new Date().toISOString(),
        rewardStatus: order.rewardStatus || 'pending_delivery',
        wonCashback: order.wonCashback !== undefined ? order.wonCashback : Math.round(Number(order.earnedCashback || 0)),
        scratchRevealed: order.scratchRevealed !== undefined ? order.scratchRevealed : false,
        scratchClaimed: order.scratchClaimed !== undefined ? order.scratchClaimed : false,
        scratchExpired: order.scratchExpired !== undefined ? order.scratchExpired : false,
        scratchExpiresAt: scratchExpiryTimestamp,
        scratchExpiryDays: activeOrderDays,
        cashbackExpiryDays: activeOrderDays,
        scratchCard: order.scratchCard || {
            amount: Math.round(Number(order.earnedCashback || 0)),
            wonAmount: Math.round(Number(order.wonCashback || order.earnedCashback || 0)),
            revealed: order.scratchRevealed !== undefined ? order.scratchRevealed : false,
            claimed: false,
            status: order.rewardStatus || 'pending_delivery',
            claimedAt: null,
            createdAt: order.createdAt || new Date().toISOString(),
            expiresAt: scratchExpiryTimestamp,
            expiresAtISO: new Date(scratchExpiryTimestamp).toISOString(),
            expiryDays: activeOrderDays,
            cashbackExpiryDays: activeOrderDays
        },
        serverTimestamp: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) 
            ? firebase.firestore.FieldValue.serverTimestamp() 
            : new Date().toISOString()
    };

    // 1. Instantly write to Firestore for live Kitchen & Admin display
    if (customerFirestore) {
        try {
            await customerFirestore.collection('orders').doc(finalOrderId).set(firestoreOrderPayload, { merge: true });
        } catch (fsErr) {
            console.warn('Firestore live order push notice:', fsErr.message);
        }
    }

    // 2. Attach real-time listener to track this order
    if (typeof listenToCustomerActiveOrders === 'function') {
        listenToCustomerActiveOrders();
    }

    // 3. Sync to Firebase Firestore backend API
    try {
        const response = await apiCall('/orders', {
            method: 'POST',
            body: JSON.stringify(firestoreOrderPayload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `Server returned HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result && result.success) {
            console.log('Order successfully synced to Firebase Firestore:', result.order?.orderId || finalOrderId);
        }
    } catch (err) {
        console.warn('Firebase Firestore order sync (offline/local fallback active):', err.message);
    }
}

function setupDeliveryInputValidation() {
    const fieldIds = [
        'customer-fullname',
        'customer-phone',
        'customer-colony-name',
        'customer-nearby',
        'customer-street-name',
        'customer-ward-no'
    ];

    fieldIds.forEach(id => {
        const input = document.getElementById(id);
        if (input && !input.dataset.valListener) {
            input.dataset.valListener = "true";
            input.addEventListener('input', () => {
                if (input.value.trim() !== '') {
                    input.classList.remove('invalid-field');
                }
            });
        }
    });
}

function closeDeliveryModal() {
    closeCheckoutModal();
}

function initPhoneInputRestrictions() {
    const phoneInput = document.getElementById('customer-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    }
}

// --------------------------------------------------------------------------
// EDIT PROFILE & HOME ADDRESS POPUP MODAL CONTROLLER
// --------------------------------------------------------------------------
function openEditProfileModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Pre-fill profile fields from active delivery profile
    const currentProfile = getSavedDeliveryProfile();
    if (currentProfile) {
        renderProfileHeaderAndInputs(currentProfile);
    }
}

function closeEditProfileModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function toggleEditProfileForm(show) {
    if (show === false) {
        closeEditProfileModal();
    } else {
        openEditProfileModal();
    }
}

function initEditProfileModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditProfileModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeEditProfileModal();
        }
    });
}

function initClearHistoryModal() {
    const modal = document.getElementById('clear-history-confirm-modal');
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeClearHistoryModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeClearHistoryModal();
        }
    });
}

// --------------------------------------------------------------------------
// IN-APP ORDER SUCCESS & DELIVERY OTP MODAL CONTROLLER
// --------------------------------------------------------------------------
let activeOrderDeliveryOtp = '';

// --------------------------------------------------------------------------
// CELEBRATION CONFETTI BLAST EFFECT
// --------------------------------------------------------------------------
function triggerOrderSuccessCelebration() {
    const canvas = document.getElementById('order-success-confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ff6b00', '#f59e0b', '#22c55e', '#38bdf8', '#e11d48', '#a855f7', '#fbbf24', '#ffffff'];
    const particleCount = 80;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 60,
            y: canvas.height * 0.45 + (Math.random() - 0.5) * 40,
            radius: Math.random() * 4 + 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 16,
            vy: (Math.random() - 0.75) * 18 - 4,
            gravity: 0.38,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 14,
            shape: Math.random() > 0.35 ? 'rect' : 'circle',
            width: Math.random() * 10 + 6,
            height: Math.random() * 6 + 4,
            opacity: 1,
            fade: Math.random() * 0.015 + 0.012
        });
    }

    let animationId = null;
    const startTime = Date.now();

    function renderConfetti() {
        if (Date.now() - startTime > 3200) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cancelAnimationFrame(animationId);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.rotation += p.rotationSpeed;
            p.opacity -= p.fade;

            if (p.opacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });

        animationId = requestAnimationFrame(renderConfetti);
    }

    renderConfetti();
}

let activeOrderForScratch = null;

function openOrderOtpSuccessModal(order) {
    const modal = document.getElementById('order-otp-success-modal');
    if (!modal) return;

    activeOrderForScratch = order;

    const orderId = order.orderId || order.id || '--';
    const otp = String(order.deliveryOtp || order.otp || '0000');
    activeOrderDeliveryOtp = otp;

    const orderIdEl = document.getElementById('otp-modal-order-id');
    const digitsContainer = document.getElementById('otp-modal-digits-display');
    const paymentModeEl = document.getElementById('otp-modal-payment-mode');
    const totalAmountEl = document.getElementById('otp-modal-total-amount');
    const copyBtnText = document.getElementById('copy-otp-btn-text');

    const isHindiModal = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
    if (orderIdEl) orderIdEl.textContent = `#${orderId}`;
    if (paymentModeEl) {
        if (order.total === 0 && (order.walletDiscount > 0 || order.usedWalletCash > 0)) {
            paymentModeEl.textContent = isHindiModal ? 'वॉलेट कैश (भुगतान हो चुका)' : 'Wallet Cash (Fully Paid)';
        } else {
            paymentModeEl.textContent = isHindiModal ? 'कैश ऑन डिलीवरी (COD)' : (order.paymentMethod || order.paymentStatus || 'Cash on Delivery');
        }
    }
    if (totalAmountEl) totalAmountEl.textContent = `₹${order.total || 0}`;
    if (copyBtnText) copyBtnText.textContent = typeof t === 'function' ? t('copy_otp') : 'Copy OTP';

    // Render individual glowing digit boxes
    if (digitsContainer) {
        digitsContainer.innerHTML = otp.split('').map(d => `<span class="otp-digit-box">${d}</span>`).join('');
    }

    // Display enthusiastic scratch card unlocked confirmation if cashback was earned
    const cashbackCard = document.getElementById('otp-modal-cashback-card');
    const cashbackText = document.getElementById('otp-modal-cashback-text');
    const cashbackExpiry = document.getElementById('otp-modal-cashback-expiry');
    const earnedCashback = (order && order.earnedCashback) ? Number(order.earnedCashback) : 0;
    const activeOrderDays = (order && (order.scratchExpiryDays || order.cashbackExpiryDays || (order.scratchCard && (order.scratchCard.expiryDays || order.scratchCard.cashbackExpiryDays)))) || getClampedCashbackExpiryDays(customerWalletConfig);
    const expiryLabel = formatExpiryDaysLabel(activeOrderDays, isHindiModal);

    if (cashbackCard) {
        if (earnedCashback > 0) {
            const boundaries = getCashbackRewardBoundaries(order.subtotal || 0);
            const maxCap = boundaries.max || earnedCashback;
            cashbackCard.style.display = 'flex';
            if (cashbackText) {
                cashbackText.textContent = `🎁 Scratch & Win Cashback! (Win up to ₹${maxCap})`;
            }
            if (cashbackExpiry) {
                cashbackExpiry.textContent = isHindiModal 
                    ? `अपनी उंगली से स्क्रैच करें • ${expiryLabel} ✨` 
                    : `Tap to scratch now • ${expiryLabel} ✨`;
            }
            showToast(`🎁 Scratch & Win Cashback unlocked! Win up to ₹${maxCap}!`, 5000);
        } else {
            cashbackCard.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Locked modal: Prevent dismissal on background clicks
    modal.onclick = (e) => {
        if (e.target === modal) {
            e.stopPropagation();
        }
    };

    // Trigger celebratory celebration blast effect
    try {
        triggerOrderSuccessCelebration();
    } catch (e) { }

    // Trigger celebratory vibration if supported
    try {
        if (navigator.vibrate) navigator.vibrate([100, 50, 150]);
    } catch (e) { }
}

function handleOpenScratchFromOtpModal() {
    const modal = document.getElementById('order-otp-success-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');

    if (activeOrderForScratch && Number(activeOrderForScratch.earnedCashback) > 0) {
        const target = activeOrderForScratch;
        activeOrderForScratch = null;
        openScratchCardModal(target);
    } else {
        openFirstUnclaimedScratchCard();
    }
}
window.handleOpenScratchFromOtpModal = handleOpenScratchFromOtpModal;

function closeOrderOtpSuccessModal() {
    const modal = document.getElementById('order-otp-success-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');

    // High-priority interactive Scratch Card modal triggered as soon as user taps "Got It & Continue / ठीक है, आगे बढ़ें"
    if (activeOrderForScratch && Number(activeOrderForScratch.earnedCashback) > 0 && !activeOrderForScratch.scratchClaimed) {
        const targetOrder = activeOrderForScratch;
        activeOrderForScratch = null;
        setTimeout(() => {
            openScratchCardModal(targetOrder);
        }, 160);
        return;
    }

    switchTab('home', true);
}

function copyDeliveryOtpToClipboard() {
    if (!activeOrderDeliveryOtp) return;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(activeOrderDeliveryOtp);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = activeOrderDeliveryOtp;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        const copyBtnText = document.getElementById('copy-otp-btn-text');
        if (copyBtnText) copyBtnText.textContent = 'Copied! ✓';
        showToast(`📋 Delivery OTP (${activeOrderDeliveryOtp}) copied to clipboard!`);
        setTimeout(() => {
            if (copyBtnText) copyBtnText.textContent = 'Copy OTP';
        }, 2500);
    } catch (e) {
        showToast(`Delivery OTP: ${activeOrderDeliveryOtp}`);
    }
}

function copyOrderHistoryOtp(otp) {
    if (!otp) return;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(otp);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = otp;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
        showToast(`📋 Delivery OTP (${otp}) copied!`);
    } catch (e) {
        showToast(`Delivery OTP: ${otp}`);
    }
}

function viewOrderHistoryFromOtpModal() {
    closeOrderOtpSuccessModal();
    switchTab('profile', true);
    setTimeout(() => {
        const historyBox = document.getElementById('order-history-display-box');
        if (historyBox && historyBox.style.display !== 'block') {
            toggleOrderHistoryView();
        }
    }, 150);
}

function initOrderOtpSuccessModal() {
    const modal = document.getElementById('order-otp-success-modal');
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeOrderOtpSuccessModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeOrderOtpSuccessModal();
        }
    });
}

// --------------------------------------------------------------------------
// INTERACTIVE SCRATCH CARD REWARDS & METALLIC SHIMMER ENGINE
// --------------------------------------------------------------------------
let activeScratchOrder = null;
let activeScratchRewardAmount = 0;
let isScratchingCard = false;
let isScratchCardRevealed = false;
let scratchLastX = 0;
let scratchLastY = 0;
let scratchConfettiAnimId = null;
let scratchPixelCheckTimer = null;

function triggerScratchCelebrationConfetti() {
    const canvas = document.getElementById('scratch-confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (scratchConfettiAnimId) {
        cancelAnimationFrame(scratchConfettiAnimId);
        scratchConfettiAnimId = null;
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#f59e0b', '#ffd700', '#22c55e', '#ff6b00', '#ec4899', '#3b82f6', '#ffffff', '#eab308'];
    const particleCount = 100;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 80,
            y: canvas.height * 0.42 + (Math.random() - 0.5) * 60,
            radius: Math.random() * 4 + 2.5,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.78) * 20 - 4,
            gravity: 0.38,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 14,
            shape: Math.random() > 0.35 ? 'rect' : 'circle',
            width: Math.random() * 11 + 6,
            height: Math.random() * 6 + 4,
            opacity: 1,
            fade: Math.random() * 0.016 + 0.012
        });
    }

    const startTime = Date.now();

    function renderConfetti() {
        if (Date.now() - startTime > 3400) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cancelAnimationFrame(scratchConfettiAnimId);
            scratchConfettiAnimId = null;
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.98;
            p.rotation += p.rotationSpeed;
            p.opacity -= p.fade;

            if (p.opacity <= 0) return;

            ctx.save();
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });

        scratchConfettiAnimId = requestAnimationFrame(renderConfetti);
    }

    renderConfetti();
}

function setupScratchCanvas(order, rewardAmount) {
    const canvas = document.getElementById('scratch-interactive-canvas');
    const stage = document.getElementById('scratch-card-stage');
    if (!canvas || !stage) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = (rect.width > 0 ? rect.width : (stage.offsetWidth || 320));
    const height = (rect.height > 0 ? rect.height : (stage.offsetHeight || 215));

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.opacity = '1';
    canvas.style.pointerEvents = 'auto';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.globalCompositeOperation = 'source-over';

    // 1. 100% Solid, Fully Opaque Base Metallic Gold Fill (#e5a93b) to prevent any opacity bleed or premature visibility
    ctx.fillStyle = '#e5a93b';
    ctx.fillRect(0, 0, width, height);

    // 2. Rich 100% Solid Metallic Gold Shimmer Gradient (all fully opaque stops)
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#b8860b');
    grad.addColorStop(0.18, '#e5a93b');
    grad.addColorStop(0.35, '#fff0a3');
    grad.addColorStop(0.52, '#d97706');
    grad.addColorStop(0.72, '#fbbf24');
    grad.addColorStop(0.88, '#e5a93b');
    grad.addColorStop(1, '#92400e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 3. Elegant Foil Shimmer Diagonal Streaks (drawn on top of 100% solid gold base)
    const streakGrad = ctx.createLinearGradient(0, height, width, 0);
    streakGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    streakGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.12)');
    streakGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.35)');
    streakGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.12)');
    streakGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = streakGrad;
    ctx.fillRect(0, 0, width, height);

    // 4. Subtle Festive Foil Star / Dot Pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let x = 16; x < width; x += 32) {
        for (let y = 16; y < height; y += 32) {
            ctx.beginPath();
            ctx.arc(x, y, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 5. Gold Foil Border Inset
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.strokeStyle = 'rgba(180, 83, 9, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 14, width - 28, height - 28);

    // 6. Central Badge & Guidance Text
    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
    const boundaries = order ? getCashbackRewardBoundaries(order.subtotal || 0) : { max: rewardAmount };
    const maxBound = boundaries.max || rewardAmount;

    // Center pill box
    const badgeW = width - 70;
    const badgeH = 76;
    const badgeX = (width - badgeW) / 2;
    const badgeY = (height - badgeH) / 2;

    ctx.fillStyle = 'rgba(20, 15, 28, 0.55)';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14);
    } else {
        ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 235, 150, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Central typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 14px "Outfit", "Inter", sans-serif';
    ctx.fillStyle = '#fffdf0';
    ctx.fillText('✨ SCRATCH & WIN ✨', width / 2, badgeY + 20);

    ctx.font = '800 17px "Outfit", "Inter", sans-serif';
    ctx.fillStyle = '#fffae0';
    ctx.fillText(isHindi ? `₹${maxBound} तक जीतें 🎁` : `Win Up To ₹${maxBound} 🎁`, width / 2, badgeY + 42);

    ctx.font = '500 11px "Outfit", "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('अपनी उंगली से स्क्रैच करें (45%)', width / 2, badgeY + 61);

    initScratchCardCanvasEvents();
}

function initScratchCardCanvasEvents() {
    const canvas = document.getElementById('scratch-interactive-canvas');
    if (!canvas || canvas.__scratchEventsBound) return;
    canvas.__scratchEventsBound = true;

    const brushRadius = 22; // Smooth comfortable brush radius in CSS px

    function getCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function eraseBrush(x, y) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x * dpr, y * dpr, brushRadius * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function eraseContinuousPath(x1, y1, x2, y2) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;

        const dist = Math.hypot(x2 - x1, y2 - y1);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const step = Math.max(1, Math.round(brushRadius / 3));

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';

        // Interpolated smooth circular arcs along stroke
        for (let i = 0; i <= dist; i += step) {
            const ix = (x1 + Math.cos(angle) * i) * dpr;
            const iy = (y1 + Math.sin(angle) * i) * dpr;
            ctx.beginPath();
            ctx.arc(ix, iy, brushRadius * dpr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Connecting round-cap line to guarantee solid continuous erasure
        ctx.lineWidth = brushRadius * 2 * dpr;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x1 * dpr, y1 * dpr);
        ctx.lineTo(x2 * dpr, y2 * dpr);
        ctx.stroke();

        // End circle
        ctx.beginPath();
        ctx.arc(x2 * dpr, y2 * dpr, brushRadius * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function triggerCheck() {
        if (!scratchPixelCheckTimer) {
            scratchPixelCheckTimer = setTimeout(() => {
                scratchPixelCheckTimer = null;
                checkScratchCompletion();
            }, 80);
        }
    }

    // Touch Event Handlers (passive: false + preventDefault() eliminates mobile scroll freezing)
    function onTouchStart(e) {
        if (isScratchCardRevealed) return;
        if (e.cancelable) e.preventDefault();
        isScratchingCard = true;
        const touch = e.touches[0];
        const coords = getCoords(touch.clientX, touch.clientY);
        scratchLastX = coords.x;
        scratchLastY = coords.y;
        eraseBrush(coords.x, coords.y);
    }

    function onTouchMove(e) {
        if (!isScratchingCard || isScratchCardRevealed) return;
        if (e.cancelable) e.preventDefault();
        const touch = e.touches[0];
        const coords = getCoords(touch.clientX, touch.clientY);
        eraseContinuousPath(scratchLastX, scratchLastY, coords.x, coords.y);
        scratchLastX = coords.x;
        scratchLastY = coords.y;
        triggerCheck();
    }

    function onTouchEnd() {
        if (!isScratchingCard) return;
        isScratchingCard = false;
        checkScratchCompletion();
    }

    // Mouse Event Handlers
    function onMouseDown(e) {
        if (isScratchCardRevealed || e.button !== 0) return;
        e.preventDefault();
        isScratchingCard = true;
        const coords = getCoords(e.clientX, e.clientY);
        scratchLastX = coords.x;
        scratchLastY = coords.y;
        eraseBrush(coords.x, coords.y);
    }

    function onMouseMove(e) {
        if (!isScratchingCard || isScratchCardRevealed) return;
        e.preventDefault();
        const coords = getCoords(e.clientX, e.clientY);
        eraseContinuousPath(scratchLastX, scratchLastY, coords.x, coords.y);
        scratchLastX = coords.x;
        scratchLastY = coords.y;
        triggerCheck();
    }

    function onMouseUp() {
        if (!isScratchingCard) return;
        isScratchingCard = false;
        checkScratchCompletion();
    }

    // Bind touch events on canvas with passive: false so preventDefault() stops mobile scrolling
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    // Bind mouse events on canvas and window
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function checkScratchCompletion() {
    if (isScratchCardRevealed) return;
    const canvas = document.getElementById('scratch-interactive-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        let transparent = 0;
        let total = 0;
        // Sample every 16th pixel (stride = 64 bytes) for high accuracy and fast 60fps performance
        for (let i = 3; i < data.length; i += 64) {
            total++;
            if (data[i] < 128) transparent++;
        }

        const percentage = total > 0 ? (transparent / total) * 100 : 0;
        // Require customer to scratch at least 45% of the card area
        if (percentage >= 45) {
            revealScratchCardReward();
        }
    } catch (e) {
        console.warn('Scratch percentage check notice:', e);
    }
}

async function markScratchRewardPendingDelivery(order, wonAmount) {
    if (!order) return;
    const orderId = String(order.id || order.orderId || '');
    const amount = Math.max(1, Math.round(Number(wonAmount || order.wonCashback || order.earnedCashback || 0)));
    const activeDays = (order.scratchExpiryDays || order.cashbackExpiryDays || (order.scratchCard && (order.scratchCard.expiryDays || order.scratchCard.cashbackExpiryDays))) || getClampedCashbackExpiryDays(customerWalletConfig);
    const expiresAt = order.scratchExpiresAt || (order.scratchCard && order.scratchCard.expiresAt) || (Date.now() + activeDays * 24 * 60 * 60 * 1000);

    order.rewardStatus = 'pending_delivery';
    order.wonCashback = amount;
    order.earnedCashback = amount;
    order.scratchRevealed = true;
    order.scratchClaimed = false;
    order.scratchCard = {
        ...(order.scratchCard || {}),
        amount: amount,
        wonAmount: amount,
        revealed: true,
        claimed: false,
        status: 'pending_delivery',
        revealedAt: new Date().toISOString(),
        expiresAt: expiresAt,
        expiresAtISO: new Date(expiresAt).toISOString(),
        expiryDays: activeDays,
        cashbackExpiryDays: activeDays
    };

    // 1. Update localStorage
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const orders = JSON.parse(stored);
            if (Array.isArray(orders)) {
                const targetIdx = orders.findIndex(o => String(o.id || o.orderId) === orderId);
                if (targetIdx >= 0) {
                    orders[targetIdx].rewardStatus = 'pending_delivery';
                    orders[targetIdx].wonCashback = amount;
                    orders[targetIdx].earnedCashback = amount;
                    orders[targetIdx].scratchRevealed = true;
                    orders[targetIdx].scratchClaimed = false;
                    orders[targetIdx].scratchCard = order.scratchCard;
                    localStorage.setItem('perfettoCustomerOrders', JSON.stringify(orders));
                }
            }
        }
    } catch (e) {
        console.warn('LocalStorage pending_delivery scratch update error:', e);
    }

    // 2. Persist to Firestore under user's order document
    try {
        if (customerFirestore && orderId && orderId !== '--') {
            await customerFirestore.collection('orders').doc(orderId).set({
                rewardStatus: 'pending_delivery',
                wonCashback: amount,
                earnedCashback: amount,
                scratchRevealed: true,
                scratchClaimed: false,
                scratchExpiresAt: expiresAt,
                scratchExpiryDays: activeDays,
                cashbackExpiryDays: activeDays,
                'scratchCard.amount': amount,
                'scratchCard.wonAmount': amount,
                'scratchCard.revealed': true,
                'scratchCard.claimed': false,
                'scratchCard.status': 'pending_delivery',
                'scratchCard.revealedAt': new Date().toISOString(),
                'scratchCard.expiresAt': expiresAt,
                'scratchCard.expiresAtISO': new Date(expiresAt).toISOString(),
                'scratchCard.expiryDays': activeDays,
            }, { merge: true });

            const rawPhone = order.customerPhone || order.phone || ((currentUserProfile && currentUserProfile.phone) || '');
            const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);
            if (cleanPhone) {
                const userCardDoc = {
                    lastScratchCard: {
                        orderId: orderId,
                        rewardStatus: 'pending_delivery',
                        wonCashback: amount,
                        revealed: true,
                        claimed: false,
                        expiresAt: expiresAt,
                        updatedAt: new Date().toISOString()
                    }
                };
                customerFirestore.collection('users').doc(`phone_${cleanPhone}`).set(userCardDoc, { merge: true }).catch(() => {});
                customerFirestore.collection('users').doc(cleanPhone).set(userCardDoc, { merge: true }).catch(() => {});
            }
        }
    } catch (fsErr) {
        console.warn('Firestore pending_delivery scratch reward update notice:', fsErr);
    }

    // 3. Persist to backend API
    try {
        fetch(resolveApiUrl('/api/orders'), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: orderId,
                rewardStatus: 'pending_delivery',
                wonCashback: amount,
                earnedCashback: amount,
                scratchRevealed: true,
                scratchClaimed: false,
                scratchExpiresAt: expiresAt,
                scratchExpiryDays: activeDays,
                cashbackExpiryDays: activeDays
            })
        }).catch(() => {});
    } catch (apiErr) {}

    if (typeof renderOrderHistoryDetails === 'function') {
        renderOrderHistoryDetails();
    }
}
window.markScratchRewardPendingDelivery = markScratchRewardPendingDelivery;

function revealScratchCardReward() {
    if (isScratchCardRevealed) return;
    isScratchCardRevealed = true;

    const canvas = document.getElementById('scratch-interactive-canvas');
    const claimBtn = document.getElementById('btn-scratch-claim');
    const hintText = document.getElementById('scratch-instruction-text');
    const hintIcon = document.getElementById('scratch-hint-icon');
    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';

    if (canvas) {
        canvas.style.transition = 'opacity 0.45s ease';
        canvas.style.opacity = '0';
        canvas.style.pointerEvents = 'none';
        setTimeout(() => {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 450);
    }

    // Trigger celebratory confetti blast
    triggerScratchCelebrationConfetti();
    try {
        if (navigator.vibrate) navigator.vibrate([70, 40, 70]);
    } catch (e) { }

    const isDelivered = activeScratchOrder && (activeScratchOrder.status === 'completed' || activeScratchOrder.status === 'delivered');
    const isRejected = activeScratchOrder && (activeScratchOrder.status === 'rejected' || activeScratchOrder.status === 'cancelled');

    if (isDelivered) {
        // Order was ALREADY delivered by staff: Scratching it immediately transfers the balance to the active wallet!
        const customerPhone = (activeScratchOrder.customerPhone || activeScratchOrder.phone) 
            || ((currentUserProfile && currentUserProfile.phone) || '');
        const orderId = activeScratchOrder.id || activeScratchOrder.orderId || 'ORDER';

        creditCustomerWallet(customerPhone, activeScratchRewardAmount, orderId);

        activeScratchOrder.scratchRevealed = true;
        activeScratchOrder.scratchClaimed = true;
        activeScratchOrder.rewardStatus = 'active_credited';
        if (!activeScratchOrder.scratchCard) activeScratchOrder.scratchCard = {};
        activeScratchOrder.scratchCard.status = 'active_credited';
        activeScratchOrder.scratchCard.revealed = true;
        activeScratchOrder.scratchCard.claimed = true;
        activeScratchOrder.scratchCard.claimedAt = new Date().toISOString();

        // Persist to localStorage
        try {
            const stored = localStorage.getItem('perfettoCustomerOrders');
            if (stored) {
                const orders = JSON.parse(stored);
                if (Array.isArray(orders)) {
                    const idx = orders.findIndex(o => String(o.id || o.orderId) === String(orderId));
                    if (idx >= 0) {
                        orders[idx].scratchRevealed = true;
                        orders[idx].scratchClaimed = true;
                        orders[idx].rewardStatus = 'active_credited';
                        orders[idx].scratchCard = activeScratchOrder.scratchCard;
                        localStorage.setItem('perfettoCustomerOrders', JSON.stringify(orders));
                    }
                }
            }
        } catch (e) {}

        // Persist to Firestore & Backend API
        try {
            if (customerFirestore && orderId && orderId !== '--') {
                customerFirestore.collection('orders').doc(orderId).set({
                    scratchRevealed: true,
                    scratchClaimed: true,
                    rewardStatus: 'active_credited',
                    'scratchCard.status': 'active_credited',
                    'scratchCard.revealed': true,
                    'scratchCard.claimed': true,
                    'scratchCard.claimedAt': new Date().toISOString()
                }, { merge: true }).catch(() => {});
            }
            fetch(resolveApiUrl('/api/orders'), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: orderId,
                    scratchRevealed: true,
                    scratchClaimed: true,
                    rewardStatus: 'active_credited'
                })
            }).catch(() => {});
        } catch (e) {}

        if (hintText) {
            hintText.textContent = isHindi
                ? `बधाई हो! आपने ₹${activeScratchRewardAmount} जीते। यह कैशबैक आपके वॉलेट में जोड़ दिया गया है!`
                : `Congratulations! You won ₹${activeScratchRewardAmount}. Cashback credited to your active wallet!`;
        }
        if (hintIcon) {
            hintIcon.className = 'fa-solid fa-circle-check';
        }
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.className = 'btn-scratch-claim claimed-success';
            const claimText = document.getElementById('scratch-claim-btn-text');
            if (claimText) {
                claimText.innerHTML = isHindi
                    ? `<i class="fa-solid fa-circle-check"></i> वॉलेट में जुड़ गया (कन्फर्म)`
                    : `<i class="fa-solid fa-circle-check"></i> Credited to Wallet`;
            }
        }
        updateProfileWalletUI();
        renderOrderHistoryDetails();
    } else if (isRejected) {
        // Order was rejected: mark it voided
        activeScratchOrder.scratchRevealed = true;
        activeScratchOrder.rewardStatus = 'voided';
        activeScratchOrder.wonCashback = 0;
        activeScratchOrder.earnedCashback = 0;
        if (!activeScratchOrder.scratchCard) activeScratchOrder.scratchCard = {};
        activeScratchOrder.scratchCard.status = 'voided';
        activeScratchOrder.scratchCard.voided = true;
        activeScratchOrder.scratchCard.wonAmount = 0;

        if (hintText) {
            hintText.textContent = isHindi
                ? 'यह ऑर्डर रद्द/अस्वीकार कर दिया गया है। स्क्रैच कार्ड अमान्य (Voided) है।'
                : 'This order was cancelled or rejected. Scratch card is voided.';
        }
        if (hintIcon) hintIcon.className = 'fa-solid fa-ban';
        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.className = 'btn-scratch-claim expired-btn';
            const claimText = document.getElementById('scratch-claim-btn-text');
            if (claimText) claimText.innerHTML = '<i class="fa-solid fa-ban"></i> Voided / अमान्य';
        }
        renderOrderHistoryDetails();
    } else {
        // Order is still pending delivery:
        // Render explicit deferred status message
        if (hintText) {
            hintText.textContent = isHindi
                ? `बधाई हो! आपने ₹${activeScratchRewardAmount} जीते। यह कैशबैक ऑर्डर सफलतापूर्वक डिलीवर होते ही आपके वॉलेट में जुड़ जाएगा।`
                : `Congratulations! You won ₹${activeScratchRewardAmount}. This cashback will be credited to your wallet once your order is successfully delivered.`;
        }
        if (hintIcon) {
            hintIcon.className = 'fa-solid fa-truck-fast fa-bounce';
        }

        // Set reward status in Firestore under user order as "pending_delivery"
        if (activeScratchOrder) {
            markScratchRewardPendingDelivery(activeScratchOrder, activeScratchRewardAmount);
        }

        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.className = 'btn-scratch-claim btn-pending-delivery';
            const claimText = document.getElementById('scratch-claim-btn-text');
            if (claimText) {
                claimText.innerHTML = isHindi 
                    ? `<i class="fa-solid fa-circle-check"></i> ठीक है, समझ गया (डिलीवरी पर जुड़ेगा)` 
                    : `<i class="fa-solid fa-circle-check"></i> Got It (Credited on Delivery)`;
            }
        }
    }
}

async function handleClaimScratchReward() {
    if (!activeScratchOrder) {
        closeScratchCardModal();
        return;
    }

    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
    const amount = Number(activeScratchRewardAmount) || Number(activeScratchOrder.earnedCashback) || 0;
    const isDelivered = activeScratchOrder.status === 'completed' || activeScratchOrder.status === 'delivered';

    // Anti-Abuse Double Claim Prevention Check:
    if (activeScratchOrder.scratchClaimed || (activeScratchOrder.scratchCard && activeScratchOrder.scratchCard.claimed)) {
        showToast(isHindi ? 'यह स्क्रैच कार्ड पहले ही क्लेम किया जा चुका है!' : 'This scratch card has already been claimed!');
        closeScratchCardModal();
        return;
    }

    // Per-transaction Expiry Permanent Invalidation Check:
    if (isScratchCardExpired(activeScratchOrder)) {
        permanentlyInvalidateScratchCard(activeScratchOrder);
        const orderDays = (activeScratchOrder && (activeScratchOrder.scratchExpiryDays || activeScratchOrder.cashbackExpiryDays || (activeScratchOrder.scratchCard && (activeScratchOrder.scratchCard.expiryDays || activeScratchOrder.scratchCard.cashbackExpiryDays)))) || getClampedCashbackExpiryDays(customerWalletConfig);
        showToast(isHindi ? `यह स्क्रैच कार्ड ${orderDays} दिनों के बाद समाप्त हो चुका है और क्लेम नहीं किया जा सकता।` : `This scratch card has expired after ${orderDays} days and cannot be claimed.`);
        closeScratchCardModal();
        return;
    }

    if (amount <= 0) {
        closeScratchCardModal();
        return;
    }

    // If order is delivered, credit wallet now:
    if (isDelivered) {
        const customerPhone = (activeScratchOrder.customerPhone || activeScratchOrder.phone) 
            || ((currentUserProfile && currentUserProfile.phone) || '');
        const orderId = activeScratchOrder.id || activeScratchOrder.orderId || 'ORDER';
        await creditCustomerWallet(customerPhone, amount, orderId);
        activeScratchOrder.scratchClaimed = true;
        activeScratchOrder.rewardStatus = 'credited';
        if (activeScratchOrder.scratchCard) {
            activeScratchOrder.scratchCard.claimed = true;
            activeScratchOrder.scratchCard.status = 'credited';
            activeScratchOrder.scratchCard.claimedAt = new Date().toISOString();
        }
        showToast(isHindi ? `🎉 ₹${amount} कैशबैक आपके वॉलेट में जोड़ दिया गया!` : `🎉 ₹${amount} Cashback credited to your wallet!`);
        updateProfileWalletUI();
        renderOrderHistoryDetails();
        closeScratchCardModal();
        return;
    }

    // If order is not yet delivered, remind customer and close:
    showToast(isHindi 
        ? `🎁 बधाई! ₹${amount} कैशबैक ऑर्डर डिलीवर होने पर आपके वॉलेट में जुड़ जाएगा।` 
        : `🎁 Congratulations! ₹${amount} cashback will be credited to your wallet once delivered.`, 4500);
    closeScratchCardModal();
}

function openScratchCardForOrder(orderId) {
    let targetOrder = null;
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const orders = JSON.parse(stored);
            if (Array.isArray(orders)) {
                targetOrder = orders.find(o => String(o.id || o.orderId) === String(orderId));
            }
        }
    } catch (e) { }

    if (targetOrder) {
        openScratchCardModal(targetOrder);
    } else {
        openScratchCardModal({
            id: orderId,
            orderId: orderId,
            subtotal: 500,
            earnedCashback: 50,
            status: 'completed'
        });
    }
}

function openFirstUnclaimedScratchCard() {
    const order = getFirstUnclaimedOrder();
    if (order) {
        openScratchCardModal(order);
    } else {
        showToast(typeof getAppLanguage === 'function' && getAppLanguage() === 'hi' 
            ? 'कोई अनक्लेम्ड स्क्रैच कार्ड उपलब्ध नहीं है।' 
            : 'No unclaimed scratch cards available right now.');
    }
}

// Expiration and Invalidation Helpers for Scratch Cards
function isScratchCardExpired(order) {
    if (!order) return false;
    if (order.scratchExpired || (order.scratchCard && order.scratchCard.expired)) return true;

    let expiresAt = order.scratchExpiresAt || (order.scratchCard && (order.scratchCard.expiresAt || order.scratchCard.expiresAtISO));
    if (!expiresAt) {
        const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : 0;
        if (createdMs > 0) {
            const activeDays = (order && (order.scratchExpiryDays || order.cashbackExpiryDays || (order.scratchCard && (order.scratchCard.expiryDays || order.scratchCard.cashbackExpiryDays)))) || getClampedCashbackExpiryDays(customerWalletConfig);
            expiresAt = createdMs + activeDays * 24 * 60 * 60 * 1000;
        }
    }
    if (!expiresAt) return false;

    const expiresAtMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
    if (isNaN(expiresAtMs) || expiresAtMs <= 0) return false;

    const remainingDays = Math.ceil((expiresAtMs - Date.now()) / (24 * 60 * 60 * 1000));
    if (remainingDays <= 0) {
        permanentlyInvalidateScratchCard(order);
        return true;
    }
    return false;
}

function getScratchExpiryCountdownText(order) {
    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
    const activeOrderDays = (order && (order.scratchExpiryDays || order.cashbackExpiryDays || (order.scratchCard && (order.scratchCard.expiryDays || order.scratchCard.cashbackExpiryDays)))) || getClampedCashbackExpiryDays(customerWalletConfig);
    if (!order) return formatExpiryDaysLabel(activeOrderDays, isHindi);
    let expiresAt = order.scratchExpiresAt || (order.scratchCard && (order.scratchCard.expiresAt || order.scratchCard.expiresAtISO));
    if (!expiresAt) {
        const createdMs = order.createdAt ? new Date(order.createdAt).getTime() : 0;
        if (createdMs > 0) {
            expiresAt = createdMs + activeOrderDays * 24 * 60 * 60 * 1000;
        } else {
            return formatExpiryDaysLabel(activeOrderDays, isHindi);
        }
    }
    const expiresAtMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
    if (isNaN(expiresAtMs) || expiresAtMs <= 0) {
        return formatExpiryDaysLabel(activeOrderDays, isHindi);
    }
    const remainingDays = Math.ceil((expiresAtMs - Date.now()) / (24 * 60 * 60 * 1000));
    if (remainingDays <= 0) {
        permanentlyInvalidateScratchCard(order);
        return isHindi ? 'समाप्त (Expired)' : 'Expired';
    }
    return formatExpiryDaysLabel(remainingDays, isHindi);
}

function permanentlyInvalidateScratchCard(order) {
    if (!order) return;
    const orderId = String(order.id || order.orderId || '');
    order.scratchExpired = true;
    if (order.scratchCard) {
        order.scratchCard.expired = true;
    }

    // 1. Invalidate locally in localStorage
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const orders = JSON.parse(stored);
            if (Array.isArray(orders)) {
                const targetIdx = orders.findIndex(o => String(o.id || o.orderId) === orderId);
                if (targetIdx >= 0) {
                    orders[targetIdx].scratchExpired = true;
                    if (orders[targetIdx].scratchCard) {
                        orders[targetIdx].scratchCard.expired = true;
                    }
                    localStorage.setItem('perfettoCustomerOrders', JSON.stringify(orders));
                }
            }
        }
    } catch (e) {
        console.warn('Error invalidating scratch card in localStorage:', e);
    }

    // 2. Persist invalidation to Firestore
    try {
        if (customerFirestore && orderId && orderId !== '--') {
            customerFirestore.collection('orders').doc(orderId).set({
                scratchExpired: true,
                'scratchCard.expired': true,
                scratchExpiredAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
        }
    } catch (fsErr) {
        console.warn('Error persisting scratch invalidation to Firestore:', fsErr);
    }
}

function getFirstUnclaimedOrder() {
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const orders = JSON.parse(stored);
            if (Array.isArray(orders)) {
                return orders.find(o => {
                    const isCancelled = o.status === 'rejected' || o.status === 'cancelled';
                    const amount = Number(o.earnedCashback || (o.scratchCard && o.scratchCard.amount) || 0);
                    const isClaimed = !!(o.scratchClaimed || (o.scratchCard && o.scratchCard.claimed));
                    const isExpired = isScratchCardExpired(o);
                    return !isCancelled && amount > 0 && !isClaimed && !isExpired;
                });
            }
        }
    } catch (e) { }
    return null;
}
const getFirstUnclaimedDeliveredOrder = getFirstUnclaimedOrder;

function openScratchCardModal(order, demoAmount) {
    const modal = document.getElementById('scratch-card-modal');
    if (!modal) return;

    activeScratchOrder = order || {
        id: 'DEMO-' + Math.floor(1000 + Math.random() * 9000),
        orderId: 'DEMO-' + Math.floor(1000 + Math.random() * 9000),
        subtotal: 500,
        status: 'new',
        earnedCashback: demoAmount || 50
    };

    // Calculate or resolve exact rupee reward amount
    let rewardAmount = Number(activeScratchOrder.earnedCashback || (activeScratchOrder.scratchCard && activeScratchOrder.scratchCard.amount) || 0);
    if (rewardAmount <= 0) {
        const subtotal = Number(activeScratchOrder.subtotal) || 0;
        rewardAmount = subtotal > 0 ? calculateOrderCashback(subtotal) : (demoAmount || 35);
        activeScratchOrder.earnedCashback = rewardAmount;
    }
    activeScratchRewardAmount = Math.max(1, Math.round(rewardAmount));

    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
    const isAlreadyClaimed = !!(activeScratchOrder.scratchClaimed || (activeScratchOrder.scratchCard && activeScratchOrder.scratchCard.claimed));
    const isCardExpired = isScratchCardExpired(activeScratchOrder);

    // Update Modal DOM elements & Exact Requested Headers
    const titleEl = document.getElementById('scratch-modal-title');
    const subtitleEl = document.getElementById('scratch-modal-subtitle');
    const orderIdEl = document.getElementById('scratch-modal-order-id');
    const amountEl = document.getElementById('scratch-reveal-amount');
    const validityEl = document.getElementById('scratch-reveal-validity');
    const hintText = document.getElementById('scratch-instruction-text');
    const hintIcon = document.getElementById('scratch-hint-icon');
    const claimBtn = document.getElementById('btn-scratch-claim');
    const claimText = document.getElementById('scratch-claim-btn-text');

    if (titleEl) {
        titleEl.textContent = 'Scratch & Win Cashback';
    }
    if (subtitleEl) {
        subtitleEl.textContent = 'अपनी उंगली से स्क्रैच करें और कैशबैक जीतें!';
    }

    const orderDisplayId = activeScratchOrder.id || activeScratchOrder.orderId || '--';
    if (orderIdEl) orderIdEl.textContent = `#${orderDisplayId}`;
    if (amountEl) amountEl.textContent = `₹${activeScratchRewardAmount}`;

    const activeOrderDays = (activeScratchOrder && (activeScratchOrder.scratchExpiryDays || activeScratchOrder.cashbackExpiryDays || (activeScratchOrder.scratchCard && (activeScratchOrder.scratchCard.expiryDays || activeScratchOrder.scratchCard.cashbackExpiryDays)))) || getClampedCashbackExpiryDays(customerWalletConfig);
    if (validityEl) {
        validityEl.textContent = isHindi 
            ? `आपके वॉलेट में ${activeOrderDays} दिनों के लिए मान्य` 
            : `Valid for ${activeOrderDays} days in your wallet`;
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    initScratchCardCanvasEvents();

    if (isCardExpired) {
        // Permanently invalidate so it cannot be revealed or credited
        permanentlyInvalidateScratchCard(activeScratchOrder);
        isScratchCardRevealed = true;
        const canvas = document.getElementById('scratch-interactive-canvas');
        if (canvas) {
            canvas.style.opacity = '0';
            canvas.style.pointerEvents = 'none';
        }
        if (titleEl) {
            titleEl.textContent = isHindi ? 'स्क्रैच कार्ड समाप्त' : 'Scratch Card Expired';
        }
        if (subtitleEl) {
            subtitleEl.textContent = isHindi ? `${activeOrderDays} दिनों की वैधता समाप्त हो चुकी है` : `${activeOrderDays}-day validity period has expired`;
        }
        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.className = 'btn-scratch-claim expired-btn';
            if (claimText) claimText.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${isHindi ? 'कार्ड समाप्त (Expired)' : 'Card Expired'}`;
        }
        if (hintText) {
            hintText.textContent = isHindi 
                ? `यह स्क्रैच कार्ड ${activeOrderDays} दिनों की समय सीमा समाप्त होने के कारण अमान्य हो गया है।` 
                : `This scratch card expired after ${activeOrderDays} days and can no longer be revealed or claimed.`;
        }
        if (hintIcon) hintIcon.className = 'fa-solid fa-clock-rotate-left';
        showToast(isHindi ? `यह स्क्रैच कार्ड ${activeOrderDays} दिनों के बाद समाप्त हो चुका है।` : `This scratch card has expired after ${activeOrderDays} days.`);
        renderOrderHistoryDetails();
        return;
    } else if (isAlreadyClaimed) {
        // Render already-claimed state
        isScratchCardRevealed = true;
        const canvas = document.getElementById('scratch-interactive-canvas');
        if (canvas) {
            canvas.style.opacity = '0';
            canvas.style.pointerEvents = 'none';
        }
        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.className = 'btn-scratch-claim claimed-success';
            if (claimText) claimText.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${isHindi ? 'पहले ही क्लेम हो चुका है' : 'Already Claimed'}`;
        }
        if (hintText) {
            hintText.textContent = isHindi 
                ? 'यह स्क्रैच कार्ड पहले ही क्लेम किया जा चुका है।' 
                : 'This scratch card reward was already credited to your wallet.';
        }
        if (hintIcon) hintIcon.className = 'fa-solid fa-circle-check';
    } else if (activeScratchOrder.status === 'rejected' || activeScratchOrder.status === 'cancelled' || activeScratchOrder.rewardStatus === 'voided') {
        // Render voided state
        isScratchCardRevealed = true;
        const canvas = document.getElementById('scratch-interactive-canvas');
        if (canvas) {
            canvas.style.opacity = '0';
            canvas.style.pointerEvents = 'none';
        }
        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.className = 'btn-scratch-claim expired-btn';
            if (claimText) claimText.innerHTML = `<i class="fa-solid fa-ban"></i> ${isHindi ? 'ऑर्डर रद्द (Voided)' : 'Order Cancelled (Voided)'}`;
        }
        if (hintText) {
            hintText.textContent = isHindi 
                ? 'यह ऑर्डर रद्द होने के कारण स्क्रैच कार्ड अमान्य (Voided) कर दिया गया है।' 
                : 'This order was cancelled or rejected. The scratch reward has been voided.';
        }
        if (hintIcon) hintIcon.className = 'fa-solid fa-ban';
    } else if (activeScratchOrder.scratchRevealed && (activeScratchOrder.status !== 'completed' && activeScratchOrder.status !== 'delivered')) {
        // Render already revealed but pending delivery state
        isScratchCardRevealed = true;
        const canvas = document.getElementById('scratch-interactive-canvas');
        if (canvas) {
            canvas.style.opacity = '0';
            canvas.style.pointerEvents = 'none';
        }
        if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.className = 'btn-scratch-claim btn-pending-delivery';
            if (claimText) {
                claimText.innerHTML = isHindi 
                    ? `<i class="fa-solid fa-circle-check"></i> ठीक है, समझ गया (डिलीवरी पर जुड़ेगा)` 
                    : `<i class="fa-solid fa-circle-check"></i> Got It (Credited on Delivery)`;
            }
        }
        if (hintText) {
            hintText.textContent = isHindi
                ? `बधाई हो! आपने ₹${activeScratchRewardAmount} जीते। यह कैशबैक ऑर्डर सफलतापूर्वक डिलीवर होते ही आपके वॉलेट में जुड़ जाएगा।`
                : `Congratulations! You won ₹${activeScratchRewardAmount}. This cashback will be credited to your wallet once your order is successfully delivered.`;
        }
        if (hintIcon) hintIcon.className = 'fa-solid fa-truck-fast';
    } else {
        // Reset to unscratched state
        isScratchCardRevealed = false;
        isScratchingCard = false;

        const canvas = document.getElementById('scratch-interactive-canvas');
        if (canvas) {
            canvas.style.opacity = '1';
            canvas.style.pointerEvents = 'auto';
        }

        if (claimBtn) {
            claimBtn.disabled = true;
            claimBtn.className = 'btn-scratch-claim';
            if (claimText) {
                claimText.textContent = 'कन्फर्म करें और वॉलेट में जोड़ें / Claim to Wallet';
            }
        }
        if (hintText) {
            hintText.textContent = isHindi 
                ? 'कार्ड को उंगली या माउस से स्क्रैच करें! (कम से कम 45%)' 
                : 'Scratch the card using your finger or mouse! (45% required)';
        }
        if (hintIcon) hintIcon.className = 'fa-solid fa-hand-pointer fa-bounce';

        // Draw solid canvas IMMEDIATELY before or as modal opens so canvas is 100% solid before paint (eliminates premature visibility)
        setupScratchCanvas(activeScratchOrder, activeScratchRewardAmount);
        requestAnimationFrame(() => {
            setupScratchCanvas(activeScratchOrder, activeScratchRewardAmount);
        });
    }
}

function saveUnscratchedCardFallback(order) {
    if (!order) return;
    const orderId = String(order.id || order.orderId || '');
    if (!orderId || orderId === '--') return;

    const activeDays = (order.scratchExpiryDays || order.cashbackExpiryDays || (order.scratchCard && (order.scratchCard.expiryDays || order.scratchCard.cashbackExpiryDays))) || getClampedCashbackExpiryDays(customerWalletConfig);
    const expiresAt = order.scratchExpiresAt || (order.scratchCard && (order.scratchCard.expiresAt || order.scratchCard.expiresAtISO)) || (Date.now() + activeDays * 86400000);
    const expiresAtMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
    const amount = Math.max(1, Math.round(Number(order.wonCashback || order.earnedCashback || (order.scratchCard && (order.scratchCard.wonAmount || order.scratchCard.amount)) || activeScratchRewardAmount || 0)));

    order.scratchRevealed = false;
    order.scratchClaimed = false;
    order.scratchExpiresAt = expiresAtMs;
    order.scratchExpiryDays = activeDays;
    order.cashbackExpiryDays = activeDays;
    order.rewardStatus = 'unscratched';
    order.scratchCard = {
        ...(order.scratchCard || {}),
        amount: amount,
        wonAmount: amount,
        revealed: false,
        claimed: false,
        status: 'unscratched',
        expiresAt: expiresAtMs,
        expiresAtISO: new Date(expiresAtMs).toISOString(),
        expiryDays: activeDays,
        cashbackExpiryDays: activeDays
    };

    // 1. Update in-memory and localStorage
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const orders = JSON.parse(stored);
            if (Array.isArray(orders)) {
                const idx = orders.findIndex(o => String(o.id || o.orderId) === orderId);
                if (idx >= 0) {
                    orders[idx].scratchRevealed = false;
                    orders[idx].scratchClaimed = false;
                    orders[idx].scratchExpiresAt = expiresAtMs;
                    orders[idx].rewardStatus = 'unscratched';
                    orders[idx].scratchCard = order.scratchCard;
                    localStorage.setItem('perfettoCustomerOrders', JSON.stringify(orders));
                }
            }
        }
    } catch (e) {}

    // 2. Persist to Firestore order document
    try {
        if (customerFirestore && orderId && orderId !== '--') {
            customerFirestore.collection('orders').doc(orderId).set({
                scratchRevealed: false,
                scratchClaimed: false,
                rewardStatus: 'unscratched',
                scratchExpiresAt: expiresAtMs,
                scratchExpiryDays: activeDays,
                cashbackExpiryDays: activeDays,
                'scratchCard.status': 'unscratched',
                'scratchCard.revealed': false,
                'scratchCard.claimed': false,
                'scratchCard.expiresAt': expiresAtMs,
                'scratchCard.expiresAtISO': new Date(expiresAtMs).toISOString()
            }, { merge: true }).catch(() => {});

            const rawPhone = order.customerPhone || order.phone || ((currentUserProfile && currentUserProfile.phone) || '');
            const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);
            if (cleanPhone) {
                const userCardDoc = {
                    lastScratchCard: {
                        orderId: orderId,
                        rewardStatus: 'unscratched',
                        wonCashback: amount,
                        revealed: false,
                        claimed: false,
                        expiresAt: expiresAtMs,
                        updatedAt: new Date().toISOString()
                    }
                };
                customerFirestore.collection('users').doc(`phone_${cleanPhone}`).set(userCardDoc, { merge: true }).catch(() => {});
                customerFirestore.collection('users').doc(cleanPhone).set(userCardDoc, { merge: true }).catch(() => {});
            }
        }
    } catch (fsErr) {}

    // 3. Persist to backend API
    try {
        fetch(resolveApiUrl('/api/orders'), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: orderId,
                scratchRevealed: false,
                scratchClaimed: false,
                rewardStatus: 'unscratched',
                scratchExpiresAt: expiresAtMs
            })
        }).catch(() => {});
    } catch (e) {}

    if (typeof renderOrderHistoryDetails === 'function') {
        renderOrderHistoryDetails();
    }
}
window.saveUnscratchedCardFallback = saveUnscratchedCardFallback;

function closeScratchCardModal() {
    const modal = document.getElementById('scratch-card-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');
    if (scratchConfettiAnimId) {
        cancelAnimationFrame(scratchConfettiAnimId);
        scratchConfettiAnimId = null;
    }

    // Fallback for unrevealed scratch cards:
    // If user exits or reloads before scratching the card, save the card state as "unscratched" under their order document
    // with an immutable expiration timestamp (expiresAt = Date.now() + activeExpiryDays * 86400000).
    if (activeScratchOrder && !isScratchCardRevealed && !activeScratchOrder.scratchClaimed && !activeScratchOrder.scratchExpired) {
        saveUnscratchedCardFallback(activeScratchOrder);
    }
}

window.addEventListener('beforeunload', () => {
    const modal = document.getElementById('scratch-card-modal');
    if (modal && modal.style.display === 'flex' && activeScratchOrder && !isScratchCardRevealed) {
        saveUnscratchedCardFallback(activeScratchOrder);
    }
});

function initScratchCardModal() {
    const modal = document.getElementById('scratch-card-modal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeScratchCardModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeScratchCardModal();
        }
    });

    window.addEventListener('resize', () => {
        if (modal.style.display === 'flex' && !isScratchCardRevealed && activeScratchOrder) {
            setupScratchCanvas(activeScratchOrder, activeScratchRewardAmount);
        }
    });
}

// --------------------------------------------------------------------------
// MSG91 VOICE / FLASH CALL OTP CONTROLLER (VERCEL SERVERLESS FUNCTION POWERED)
// Endpoints: /api/send-voice-otp & /api/verify-otp
// --------------------------------------------------------------------------
let isPhoneVerified = false;
let currentTargetPhone = null;
let otpResendCountdown = 0;
let otpResendTimerId = null;

// --------------------------------------------------------------------------
// CUSTOMER INTERACTIVE LOCATION MAP CONTROLLER (LEAFLET + LIVE GPS)
// --------------------------------------------------------------------------
let customerLeafletMap = null;
let customerLocationMarker = null;
let customerStoreMarker = null;
let customerCoverageCircle = null;
let customerTempCoords = { lat: 29.533736, lng: 73.447895 }; // Raisingh Nagar default
let currentCustomerGps = null; // Confirmed coords { lat: number, lng: number }
let lastGpsAccuracyMeters = null; // Accuracy in meters from Geolocation API
const MAX_ALLOWED_ACCURACY_METERS = 250; // Threshold for precise location (anything higher is approximate/rough IP/cell fix)

function openCustomerMapModal() {
    const modal = document.getElementById('customer-map-modal');
    const openBtn = document.getElementById('btn-open-map-modal');
    const openBtnText = document.getElementById('gps-btn-text');
    if (!modal) return;

    // Check if we already have confirmed or saved coordinates
    const latHidden = document.getElementById('customer-gps-lat');
    const lngHidden = document.getElementById('customer-gps-lng');
    const hasExistingCoords = (latHidden && latHidden.value && lngHidden && lngHidden.value) || currentCustomerGps;

    // If geolocation is available and no existing coords, try detecting live GPS
    if (!hasExistingCoords && navigator.geolocation) {
        if (openBtn) openBtn.disabled = true;
        if (openBtnText) openBtnText.innerHTML = '<span class="btn-spinner"></span> Locating via GPS...';

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const liveLat = parseFloat(position.coords.latitude.toFixed(6));
                const liveLng = parseFloat(position.coords.longitude.toFixed(6));
                lastGpsAccuracyMeters = typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null;

                resetOpenMapButton(openBtn, openBtnText);

                // If accuracy is high/rough, clamp to delivery zone if needed and open modal for manual adjustment
                const radiusCheck = isWithinDeliveryRadius(liveLat, liveLng);
                let initialLat = liveLat;
                let initialLng = liveLng;
                if (!radiusCheck.isAllowed) {
                    const clamped = clampCoordsToDeliveryRadius(liveLat, liveLng);
                    initialLat = clamped.lat;
                    initialLng = clamped.lng;
                }

                launchCustomerMapModal(initialLat, initialLng);
            },
            (error) => {
                console.warn('Initial GPS detection fallback:', error);
                resetOpenMapButton(openBtn, openBtnText);
                lastGpsAccuracyMeters = null;

                // Fallback to store/default coordinates so user can still manually pin
                const storeLat = getRestaurantLat();
                const storeLng = getRestaurantLng();
                launchCustomerMapModal(storeLat, storeLng);
            },
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 60000
            }
        );
    } else {
        let initialLat = getRestaurantLat();
        let initialLng = getRestaurantLng();

        if (latHidden && latHidden.value && lngHidden && lngHidden.value) {
            initialLat = parseFloat(latHidden.value) || initialLat;
            initialLng = parseFloat(lngHidden.value) || initialLng;
        } else if (currentCustomerGps) {
            initialLat = currentCustomerGps.lat;
            initialLng = currentCustomerGps.lng;
        }

        launchCustomerMapModal(initialLat, initialLng);
    }
}

function resetOpenMapButton(btn, btnText) {
    if (btn) btn.disabled = false;
    if (btnText) {
        const isVerified = currentCustomerGps !== null || (document.getElementById('customer-gps-lat')?.value);
        btnText.innerHTML = isVerified ? '<i class="fa-solid fa-map-pin"></i> Change Location on Map' : '<i class="fa-solid fa-map"></i> Open Location Map';
    }
}

function launchCustomerMapModal(initialLat, initialLng) {
    const modal = document.getElementById('customer-map-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    customerTempCoords = { lat: initialLat, lng: initialLng };
    updateMapModalCoordsDisplay(initialLat, initialLng);

    setTimeout(() => {
        initCustomerLeafletMap(initialLat, initialLng);
        if (customerLeafletMap) {
            customerLeafletMap.invalidateSize();
        }
    }, 150);

    setTimeout(() => {
        if (customerLeafletMap) {
            customerLeafletMap.invalidateSize();
        }
    }, 350);
}

function closeCustomerMapModal() {
    const modal = document.getElementById('customer-map-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
}

function initCustomerLeafletMap(lat, lng) {
    const mapContainer = document.getElementById('customer-location-map');
    if (!mapContainer || typeof L === 'undefined') return;

    const customMarkerHtml = `
        <div style="
            background: linear-gradient(135deg, #ff6b00 0%, #ff385c 100%);
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(255, 107, 0, 0.6);
            border: 2.5px solid #ffffff;
        ">
            <i class="fa-solid fa-house-chimney" style="
                transform: rotate(45deg);
                color: #ffffff;
                font-size: 15px;
            "></i>
        </div>
    `;

    const customIcon = L.divIcon({
        className: 'customer-delivery-marker',
        html: customMarkerHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });

    const storeLat = getRestaurantLat();
    const storeLng = getRestaurantLng();
    const radiusKm = getDeliveryRadiusKm();

    const storeMarkerHtml = `
        <div style="
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            width: 38px;
            height: 38px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
            border: 2.5px solid #ff6b00;
        ">
            <i class="fa-solid fa-pizza-slice" style="
                transform: rotate(45deg);
                color: #ff6b00;
                font-size: 16px;
            "></i>
        </div>
    `;

    const storeIcon = L.divIcon({
        className: 'store-location-marker',
        html: storeMarkerHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38]
    });

    if (!customerLeafletMap) {
        customerLeafletMap = L.map('customer-location-map', {
            center: [lat, lng],
            zoom: 15,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(customerLeafletMap);

        // Store Location Marker
        customerStoreMarker = L.marker([storeLat, storeLng], {
            icon: storeIcon,
            zIndexOffset: 500
        }).addTo(customerLeafletMap);

        customerStoreMarker.bindPopup(`
            <div style="text-align: center; padding: 4px;">
                <strong style="color: #ff6b00; font-size: 0.95rem;">🍕 Perfetto Pizza Store</strong><br>
                <small style="color: #64748b; font-size: 0.76rem;">Kitchen & Pickup Hub</small>
            </div>
        `);

        // Delivery Coverage Circle
        if (radiusKm && !isNaN(radiusKm) && radiusKm > 0) {
            customerCoverageCircle = L.circle([storeLat, storeLng], {
                color: '#ff6b00',
                weight: 1.5,
                dashArray: '5, 5',
                fillColor: '#ff6b00',
                fillOpacity: 0.07,
                radius: radiusKm * 1000
            }).addTo(customerLeafletMap);
        }

        // Customer Location Marker
        customerLocationMarker = L.marker([lat, lng], {
            draggable: true,
            icon: customIcon,
            zIndexOffset: 1000
        }).addTo(customerLeafletMap);

        customerLocationMarker.bindPopup(`
            <div style="text-align: center; padding: 4px;">
                <strong style="color: #ff6b00; font-size: 0.9rem;">📍 Your Delivery Location</strong><br>
                <small style="color: #64748b; font-size: 0.72rem;">Drag or tap anywhere to fine-tune</small>
            </div>
        `);

        const handleMarkerPositionChange = (e) => {
            const pos = e.target.getLatLng();
            let newLat = parseFloat(pos.lat.toFixed(6));
            let newLng = parseFloat(pos.lng.toFixed(6));
            const clamped = clampCoordsToDeliveryRadius(newLat, newLng);
            if (clamped.wasClamped) {
                newLat = clamped.lat;
                newLng = clamped.lng;
                customerLocationMarker.setLatLng([newLat, newLng]);
            }
            customerTempCoords = { lat: newLat, lng: newLng };
            updateMapModalCoordsDisplay(newLat, newLng);
        };

        customerLocationMarker.on('drag', handleMarkerPositionChange);
        customerLocationMarker.on('dragend', handleMarkerPositionChange);
        customerLocationMarker.on('move', handleMarkerPositionChange);

        customerLeafletMap.on('click', (e) => {
            const pos = e.latlng;
            let newLat = parseFloat(pos.lat.toFixed(6));
            let newLng = parseFloat(pos.lng.toFixed(6));
            const clamped = clampCoordsToDeliveryRadius(newLat, newLng);
            if (clamped.wasClamped) {
                newLat = clamped.lat;
                newLng = clamped.lng;
                showToast(`⚠️ Location is outside our ${getDeliveryRadiusKm()} km delivery area. Pinned to nearest boundary point!`);
            }
            customerTempCoords = { lat: newLat, lng: newLng };
            if (customerLocationMarker) {
                customerLocationMarker.setLatLng([newLat, newLng]);
            }
            updateMapModalCoordsDisplay(newLat, newLng);
        });
    } else {
        customerTempCoords = { lat, lng };
        customerLeafletMap.invalidateSize();
        customerLeafletMap.setView([lat, lng], 15);
        if (customerLocationMarker) {
            customerLocationMarker.setLatLng([lat, lng]);
        }
        if (customerStoreMarker) {
            customerStoreMarker.setLatLng([storeLat, storeLng]);
        }
        if (customerCoverageCircle) {
            customerCoverageCircle.setLatLng([storeLat, storeLng]);
            if (radiusKm && !isNaN(radiusKm) && radiusKm > 0) {
                customerCoverageCircle.setRadius(radiusKm * 1000);
            }
        }
        updateMapModalCoordsDisplay(lat, lng);
    }
}

// Restricts / clamps a coordinate to lie strictly within the delivery radius circle if dragged outside
function clampCoordsToDeliveryRadius(lat, lng) {
    const storeLat = getRestaurantLat();
    const storeLng = getRestaurantLng();
    const radiusKm = getDeliveryRadiusKm();
    const dist = calculateDistanceHaversine(storeLat, storeLng, lat, lng);

    if (dist <= radiusKm) {
        return { lat, lng, wasClamped: false, distanceKm: parseFloat(dist.toFixed(2)) };
    }

    // Project coordinates onto circle perimeter (bearing projection)
    const dLat = (lat - storeLat) * (Math.PI / 180);
    const dLon = (lng - storeLng) * (Math.PI / 180);
    const y = Math.sin(dLon) * Math.cos(lat * (Math.PI / 180));
    const x = Math.cos(storeLat * (Math.PI / 180)) * Math.sin(lat * (Math.PI / 180)) -
        Math.sin(storeLat * (Math.PI / 180)) * Math.cos(lat * (Math.PI / 180)) * Math.cos(dLon);
    const bearing = Math.atan2(y, x);

    const R = 6371; // Earth's radius in KM
    const maxSafeRadius = Math.max(0.1, radiusKm - 0.05); // slight safety inset
    const angularDist = maxSafeRadius / R;
    const storeLatRad = storeLat * (Math.PI / 180);
    const storeLngRad = storeLng * (Math.PI / 180);

    const clampedLatRad = Math.asin(Math.sin(storeLatRad) * Math.cos(angularDist) +
        Math.cos(storeLatRad) * Math.sin(angularDist) * Math.cos(bearing));
    const clampedLngRad = storeLngRad + Math.atan2(Math.sin(bearing) * Math.sin(angularDist) * Math.cos(storeLatRad),
        Math.cos(angularDist) - Math.sin(storeLatRad) * Math.sin(clampedLatRad));

    return {
        lat: parseFloat((clampedLatRad * (180 / Math.PI)).toFixed(6)),
        lng: parseFloat((clampedLngRad * (180 / Math.PI)).toFixed(6)),
        wasClamped: true,
        distanceKm: parseFloat(dist.toFixed(2))
    };
}

function updateMapModalCoordsDisplay(lat, lng) {
    const banner = document.getElementById('map-zone-status-banner');
    const icon = document.getElementById('zone-status-icon');
    const text = document.getElementById('zone-status-text');
    const confirmBtn = document.getElementById('btn-confirm-map-location');

    const check = isWithinDeliveryRadius(lat, lng);

    if (banner && icon && text) {
        if (!check.isAllowed) {
            banner.className = 'map-zone-status-banner out-zone';
            if (icon) icon.className = 'fa-solid fa-triangle-exclamation';
            text.textContent = `Outside Delivery Zone (${check.distanceKm} km > ${check.maxRadiusKm} km limit)`;
        } else {
            banner.className = 'map-zone-status-banner in-zone';
            if (icon) icon.className = 'fa-solid fa-circle-check';
            text.textContent = `Within Delivery Zone (${check.distanceKm} km from store)`;
        }
    }

    if (confirmBtn) {
        confirmBtn.disabled = !check.isAllowed;
    }
}

function handleDetectLiveGps() {
    const btn = document.getElementById('btn-detect-live-gps');
    const btnText = document.getElementById('detect-gps-btn-text');

    if (!navigator.geolocation) {
        showToast('⚠️ Geolocation is not supported on this device/browser.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        if (btnText) btnText.innerHTML = '<span class="btn-spinner"></span> Detecting GPS...';
    }

    showToast('📡 Detecting your current live coordinates...');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            let lat = parseFloat(position.coords.latitude.toFixed(6));
            let lng = parseFloat(position.coords.longitude.toFixed(6));
            const accuracy = typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null;
            lastGpsAccuracyMeters = accuracy;

            const radiusCheck = isWithinDeliveryRadius(lat, lng);
            if (!radiusCheck.isAllowed) {
                const clamped = clampCoordsToDeliveryRadius(lat, lng);
                showToast(`⚠️ Location (${radiusCheck.distanceKm} km) is outside our ${radiusCheck.maxRadiusKm} km delivery zone. Marker placed at nearest point.`);
                lat = clamped.lat;
                lng = clamped.lng;
            } else {
                showToast(`📍 Location detected! Drag marker or tap anywhere to fine-tune.`);
            }

            customerTempCoords = { lat, lng };

            if (customerLeafletMap) {
                customerLeafletMap.setView([lat, lng], 16);
                if (customerLocationMarker) {
                    customerLocationMarker.setLatLng([lat, lng]);
                    customerLocationMarker.openPopup();
                }
            }

            updateMapModalCoordsDisplay(lat, lng);

            if (btn) {
                btn.disabled = false;
                if (btnText) btnText.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Re-detect Live GPS';
            }
        },
        (error) => {
            console.error('Geolocation Error:', error);
            if (btn) {
                btn.disabled = false;
                if (btnText) btnText.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Detect My Live GPS';
            }

            let errorMsg = '⚠️ Unable to detect location. You can manually drag the pin to your address.';
            if (error.code === error.PERMISSION_DENIED) {
                errorMsg = '⚠️ Location permission not granted. Please drag the map pin manually to set your address.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                errorMsg = '⚠️ Location unavailable. Please drag the map pin manually.';
            } else if (error.code === error.TIMEOUT) {
                errorMsg = '⚠️ Location request timed out. Please drag the map pin manually or tap retry.';
            }

            showToast(errorMsg);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

function handleConfirmMapLocation() {
    if (!customerTempCoords || isNaN(customerTempCoords.lat) || isNaN(customerTempCoords.lng)) {
        showToast('⚠️ Please select a location on the map first!');
        return;
    }

    const lat = parseFloat(customerTempCoords.lat);
    const lng = parseFloat(customerTempCoords.lng);

    // Delivery Radius Boundary Validation
    const radiusCheck = isWithinDeliveryRadius(lat, lng);
    if (!radiusCheck.isAllowed) {
        showToast(`🚫 Out of Delivery Area: Your selected location is ${radiusCheck.distanceKm} km away. We only deliver within ${radiusCheck.maxRadiusKm} km of our store. Please move your pin inside the circle.`);
        const banner = document.getElementById('map-zone-status-banner');
        if (banner) {
            banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    currentCustomerGps = { lat, lng };

    const latHidden = document.getElementById('customer-gps-lat');
    const lngHidden = document.getElementById('customer-gps-lng');
    const statusBadge = document.getElementById('gps-status-badge');
    const coordsDisplay = document.getElementById('gps-coordinates-display');
    const coordsText = document.getElementById('gps-coords-text');
    const gpsContainer = document.querySelector('.full-width-gps-field');
    const gpsBtnText = document.getElementById('gps-btn-text');
    const mapBtn = document.getElementById('btn-open-map-modal');

    if (latHidden) latHidden.value = lat;
    if (lngHidden) lngHidden.value = lng;

    if (statusBadge) {
        statusBadge.className = 'gps-status-badge gps-success';
        statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> GPS Verified';
        statusBadge.style.display = 'inline-flex';
    }

    if (coordsDisplay) {
        coordsDisplay.style.display = 'flex';
        if (coordsText) {
            coordsText.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    }

    if (gpsContainer) {
        gpsContainer.classList.remove('invalid-gps');
        gpsContainer.classList.add('gps-verified');
    }

    if (mapBtn) {
        mapBtn.classList.remove('invalid-gps-btn');
        mapBtn.classList.add('btn-gps-selected');
    }

    if (gpsBtnText) {
        gpsBtnText.innerHTML = '<i class="fa-solid fa-map-pin"></i> Change Location Pin';
    }

    // Immediately update existing profile in localStorage with newly confirmed custom coordinates
    try {
        const stored = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (stored) {
            const existingProfile = JSON.parse(stored);
            if (existingProfile && typeof existingProfile === 'object') {
                existingProfile.gpsLat = lat;
                existingProfile.gpsLng = lng;
                localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(existingProfile));
            }
        }
    } catch (e) { }

    closeCustomerMapModal();
    showToast(`📍 Delivery location confirmed (${radiusCheck.distanceKm} km from store)!`);

    // Recalculate dynamic delivery fee & update cart / profile UI in real-time
    updateCartUI();
    updateProfileTotalsUI();
}

// --------------------------------------------------------------------------
// CUSTOMER EMAIL + OTP VERIFICATION & CROSS-DEVICE SYNC
// --------------------------------------------------------------------------
/**
 * Cleanly formats API responses or errors into user-friendly strings.
 * Prevents "[object Object]" from ever displaying in toast notifications.
 */
function formatErrorMessage(errOrData, defaultFallback = 'An error occurred. Please try again.') {
    if (!errOrData) return defaultFallback;
    if (typeof errOrData === 'string') return errOrData;
    if (errOrData instanceof Error) return errOrData.message || defaultFallback;
    if (typeof errOrData === 'object') {
        if (errOrData.message) {
            return typeof errOrData.message === 'string' ? errOrData.message : (errOrData.message.message || JSON.stringify(errOrData.message));
        }
        if (errOrData.error) {
            return typeof errOrData.error === 'string' ? errOrData.error : (errOrData.error.message || JSON.stringify(errOrData.error));
        }
        if (errOrData.details) {
            return typeof errOrData.details === 'string' ? errOrData.details : (errOrData.details.message || JSON.stringify(errOrData.details));
        }
        try {
            return JSON.stringify(errOrData);
        } catch (e) {
            return defaultFallback;
        }
    }
    return String(errOrData);
}

function handlePhoneInputChange(input) {
    if (!input) return;
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 10);
    const cleanDigits = input.value;

    const storedVerifiedPhone = getStoredVerifiedPhone();
    if (storedVerifiedPhone && cleanDigits === storedVerifiedPhone) {
        isPhoneVerified = true;
        currentTargetPhone = '91' + cleanDigits;
        applyPhoneVerifiedUI(true, cleanDigits);
        return;
    }

    // Reset verification state if phone number changes from verified
    isPhoneVerified = false;
    currentTargetPhone = null;
    if (otpResendTimerId) {
        clearInterval(otpResendTimerId);
        otpResendTimerId = null;
    }
    applyPhoneVerifiedUI(false, cleanDigits);
}

function handleChangePhoneNumber() {
    const phoneInput = document.getElementById('customer-phone');
    isPhoneVerified = false;
    currentTargetPhone = null;

    if (otpResendTimerId) {
        clearInterval(otpResendTimerId);
        otpResendTimerId = null;
    }

    applyPhoneVerifiedUI(false, phoneInput ? phoneInput.value : '');

    if (phoneInput) {
        phoneInput.readOnly = false;
        phoneInput.style.backgroundColor = 'var(--bg-input)';
        phoneInput.style.cursor = 'text';
    }

    showToast('✏️ Mobile number unlocked. Update your number.');
}

// MSG91 OTP Widget Configuration Constants
const MSG91_WIDGET_CONFIG = {
    widgetId: "3668716b4f68313937363038",
    tokenAuth: "561143TsR6UbiIs0v6a82f3f8P1"
};

async function handleRequestOtp(isResend = false) {
    const phoneVal = (document.getElementById('customer-phone') || {}).value?.trim();
    if (!phoneVal || phoneVal.replace(/[^0-9]/g, '').length < 10) {
        showToast('⚠️ Please enter a valid 10-digit Indian mobile number!');
        const phoneInput = document.getElementById('customer-phone');
        if (phoneInput) {
            phoneInput.classList.add('invalid-field');
            phoneInput.focus();
        }
        return;
    }

    const cleanDigits = phoneVal.replace(/[^0-9]/g, '').slice(-10);
    const fullNumber = '91' + cleanDigits;
    currentTargetPhone = fullNumber;

    const phoneInput = document.getElementById('customer-phone');
    if (phoneInput) phoneInput.classList.remove('invalid-field');

    const verifyBtn = document.getElementById('btn-request-otp');
    const badge = document.getElementById('phone-verified-badge');
    const otpBox = document.getElementById('otp-verification-box');
    const otpInput = document.getElementById('otp-input');

    // UI Loading state
    if (verifyBtn && !isResend) {
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = '<span class="btn-spinner"></span><span class="verify-text">Sending...</span>';
    }

    showToast(`📲 Sending OTP to +91 ${cleanDigits}...`);

    const handleSendSuccess = (data) => {
        console.log('MSG91 sendOtp Success:', data);
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
        }
        // Reveal native custom OTP container
        if (otpBox) {
            otpBox.style.display = 'block';
            otpBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        if (otpInput) {
            otpInput.value = '';
            otpInput.focus();
        }
        startOtpResendTimer(45);
        showToast('✅ OTP sent successfully! Please enter code below.');
    };

    const handleSendFailure = (error) => {
        console.error('MSG91 sendOtp Error:', error);
        if (verifyBtn) {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
        }
        const errorMsg = (error && (error.message || error.description || error.msg)) || 'Failed to send OTP. Please try again.';
        showToast(`❌ ${errorMsg}`);
    };

    const executeSendOtp = () => {
        if (typeof window.sendOtp === 'function') {
            window.sendOtp(
                fullNumber,
                handleSendSuccess,
                handleSendFailure
            );
            return true;
        } else if (typeof window.initSendOTP === 'function') {
            window.initSendOTP({
                widgetId: MSG91_WIDGET_CONFIG.widgetId,
                tokenAuth: MSG91_WIDGET_CONFIG.tokenAuth,
                exposeMethods: true,
                identifier: fullNumber,
                success: handleSendSuccess,
                failure: handleSendFailure
            });
            setTimeout(() => {
                if (typeof window.sendOtp === 'function') {
                    window.sendOtp(fullNumber, handleSendSuccess, handleSendFailure);
                }
            }, 300);
            return true;
        }
        return false;
    };

    try {
        if (!executeSendOtp()) {
            console.log('MSG91 Widget SDK loading, retrying sendOtp in 800ms...');
            setTimeout(() => {
                if (!executeSendOtp()) {
                    handleSendFailure({ message: 'MSG91 Widget SDK is loading. Please try again in a few moments.' });
                }
            }, 800);
        }
    } catch (err) {
        handleSendFailure(err);
    }
}

function startOtpResendTimer(seconds) {
    otpResendCountdown = seconds;
    const timerText = document.getElementById('otp-timer-text');
    const resendBtn = document.getElementById('btn-resend-voice-otp');

    if (resendBtn) {
        resendBtn.style.pointerEvents = 'none';
        resendBtn.style.opacity = '0.5';
    }

    if (otpResendTimerId) clearInterval(otpResendTimerId);

    otpResendTimerId = setInterval(() => {
        otpResendCountdown--;
        if (timerText) {
            timerText.textContent = otpResendCountdown > 0 ? `Resend in ${otpResendCountdown}s` : "Didn't receive OTP?";
        }
        if (otpResendCountdown <= 0) {
            clearInterval(otpResendTimerId);
            otpResendTimerId = null;
            if (resendBtn) {
                resendBtn.style.pointerEvents = 'auto';
                resendBtn.style.opacity = '1';
                resendBtn.textContent = 'Resend OTP';
            }
        }
    }, 1000);
}

async function handleVerifyOtp() {
    const otpInput = document.getElementById('otp-input');
    const phoneInput = document.getElementById('customer-phone');
    const submitBtn = document.getElementById('btn-submit-otp');
    const enteredOtp = otpInput ? otpInput.value.trim() : '';

    if (!enteredOtp || enteredOtp.length < 4) {
        showToast('⚠️ Please enter the OTP code.');
        if (otpInput) otpInput.focus();
        return;
    }

    if (!currentTargetPhone) {
        const phone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').slice(0, 10) : '';
        currentTargetPhone = `91${phone}`;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    }

    const onVerifySuccess = (data) => {
        console.log('MSG91 OTP Verify Success:', data);
        const cleanDigits = (phoneInput ? phoneInput.value : '').replace(/[^0-9]/g, '').slice(-10) || (currentTargetPhone ? currentTargetPhone.slice(-10) : '');

        isPhoneVerified = true;
        setStoredPhoneVerified(cleanDigits, true);
        applyPhoneVerifiedUI(true, cleanDigits);

        if (otpResendTimerId) {
            clearInterval(otpResendTimerId);
            otpResendTimerId = null;
        }

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Confirm OTP';
        }

        showToast('🎉 Mobile number verified successfully!');
    };

    const onVerifyFailure = (error) => {
        console.error('MSG91 OTP Verify Error:', error);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Confirm OTP';
        }
        const errorMsg = (error && (error.message || error.description || error.msg)) || 'Invalid OTP. Please enter the correct code.';
        showToast(`❌ ${errorMsg}`);
        if (otpInput) {
            otpInput.value = '';
            otpInput.classList.add('invalid-field');
            otpInput.focus();
            setTimeout(() => otpInput.classList.remove('invalid-field'), 2000);
        }
    };

    try {
        if (typeof window.verifyOtp === 'function') {
            window.verifyOtp(enteredOtp, onVerifySuccess, onVerifyFailure);
        } else if (typeof window.OTPWidget !== 'undefined' && typeof window.OTPWidget.verifyOTP === 'function') {
            const resp = await window.OTPWidget.verifyOTP({
                widgetId: MSG91_WIDGET_CONFIG.widgetId,
                otp: enteredOtp
            });
            onVerifySuccess(resp);
        } else {
            console.warn('MSG91 SDK verifyOtp function not found on window');
            onVerifyFailure({ message: 'MSG91 Widget SDK verify method unavailable.' });
        }
    } catch (err) {
        onVerifyFailure(err);
    }
}

function handleSaveProfile(event) {
    if (event) event.preventDefault();

    const fieldIds = [
        'customer-fullname',
        'customer-phone',
        'customer-colony-name',
        'customer-nearby',
        'customer-street-name',
        'customer-ward-no'
    ];

    let hasEmpty = false;
    let firstEmpty = null;

    fieldIds.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            if (!input.value.trim()) {
                input.classList.add('invalid-field');
                hasEmpty = true;
                if (!firstEmpty) firstEmpty = input;
            } else {
                input.classList.remove('invalid-field');
            }
        }
    });

    if (hasEmpty) {
        if (firstEmpty) firstEmpty.focus();
        showToast('Please fill in all required profile fields!');
        return;
    }

    const fullName = document.getElementById('customer-fullname').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(0, 10);
    const colonyName = document.getElementById('customer-colony-name').value.trim();
    const nearBy = document.getElementById('customer-nearby').value.trim();
    const streetName = document.getElementById('customer-street-name').value.trim();
    const wardNo = document.getElementById('customer-ward-no').value.trim();

    if (cleanPhone.length < 10) {
        showToast('Please enter a valid 10-digit mobile number!');
        const phoneEl = document.getElementById('customer-phone');
        if (phoneEl) {
            phoneEl.classList.add('invalid-field');
            phoneEl.focus();
        }
        return;
    }

    // Check if phone matches stored verified state
    const storedVerified = getStoredVerifiedPhone();
    if (storedVerified && storedVerified === cleanPhone) {
        isPhoneVerified = true;
    }

    // MANDATORY OTP VERIFICATION CHECK (PHONE)
    if (!isPhoneVerified) {
        showToast('⚠️ Please verify your mobile number with OTP before saving your profile or checking out!');
        const phoneEl = document.getElementById('customer-phone');
        const verifyBtn = document.getElementById('btn-request-otp');
        if (phoneEl) {
            phoneEl.classList.add('invalid-field');
            phoneEl.focus();
        }
        if (verifyBtn) {
            verifyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            verifyBtn.style.animation = 'none';
            setTimeout(() => {
                verifyBtn.style.animation = 'pulseGlow 1.2s ease infinite';
            }, 10);
        }
        return;
    }

    // MANDATORY AUTO GPS LOCATION VERIFICATION CHECK
    const latHidden = document.getElementById('customer-gps-lat');
    const lngHidden = document.getElementById('customer-gps-lng');
    const latVal = latHidden && latHidden.value ? parseFloat(latHidden.value) : (currentCustomerGps ? currentCustomerGps.lat : null);
    const lngVal = lngHidden && lngHidden.value ? parseFloat(lngHidden.value) : (currentCustomerGps ? currentCustomerGps.lng : null);

    if (latVal === null || lngVal === null || isNaN(latVal) || isNaN(lngVal)) {
        showToast('⚠️ Mandatory: Please tap "Open Location Map" to pin & confirm your delivery location!');
        const gpsContainer = document.querySelector('.full-width-gps-field');
        const mapBtn = document.getElementById('btn-open-map-modal');
        if (gpsContainer) {
            gpsContainer.classList.add('invalid-gps');
            gpsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (mapBtn) {
            mapBtn.classList.add('invalid-gps-btn');
            mapBtn.focus();
        }
        return;
    }

    // Explicitly update in-memory GPS state
    currentCustomerGps = { lat: latVal, lng: lngVal };

    // Save profile with exact custom GPS Coordinates to localStorage
    const profile = {
        fullName,
        email: (document.getElementById('customer-email')?.value || '').trim(),
        phone: cleanPhone,
        colonyName,
        nearBy,
        streetName,
        wardNo,
        isVerified: true,
        gpsLat: latVal,
        gpsLng: lngVal
    };

    try {
        localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(profile));
        setStoredPhoneVerified(cleanPhone, true);
    } catch (e) {
        console.error('Error saving delivery profile to localStorage:', e);
    }

    // Sync user profile & address to Firebase Firestore backend
    syncProfileToFirestoreBackend(profile);

    // Hide the cart redirection notice banner upon successful profile completion & save
    showProfileRedirectNotice(false);

    // Immediately update header UI, form inputs & cart totals in real-time
    renderProfileHeaderAndInputs(profile);
    updateProfileTotalsUI();
    updateCartUI();
    closeEditProfileModal();

    showToast('✅ Profile & Custom Delivery Address saved successfully!');
}

async function syncProfileToFirestoreBackend(profile) {
    const cleanEmail = (profile.email || ((currentUserProfile && currentUserProfile.email) || '')).toLowerCase().trim();
    const cleanPhone = (profile.phone || '').replace(/[^0-9]/g, '').slice(-10);

    const latVal = profile.gpsLat !== null && profile.gpsLat !== undefined ? parseFloat(profile.gpsLat) : null;
    const lngVal = profile.gpsLng !== null && profile.gpsLng !== undefined ? parseFloat(profile.gpsLng) : null;

    const currentWalletBal = Number(localStorage.getItem('perfetto_wallet_balance') || 0);
    const existingOrders = [];
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            (JSON.parse(stored) || []).forEach(o => existingOrders.push(String(o.id || o.orderId)));
        }
    } catch (e) {}

    const userPayload = {
        firebaseUid: (currentUserProfile && currentUserProfile.firebaseUid) || '',
        email: cleanEmail,
        fullName: profile.fullName,
        phone: cleanPhone,
        photoURL: (currentUserProfile && currentUserProfile.photoURL) || '',
        address: {
            colonyName: profile.colonyName || '',
            nearBy: profile.nearBy || '',
            streetName: profile.streetName || '',
            wardNo: profile.wardNo || '',
        },
        gpsLat: latVal,
        gpsLng: lngVal,
        gps: {
            lat: latVal,
            lng: lngVal
        },
        isPhoneVerified: true,
        walletBalance: currentWalletBal,
        balance: currentWalletBal,
        walletTransactions: (currentCustomerWallet && Array.isArray(currentCustomerWallet.transactions)) ? currentCustomerWallet.transactions : [],
        orders: existingOrders,
        cartState: cart || []
    };

    // 1. Instantly write to Firestore client SDK if available under both phone keys
    if (customerFirestore) {
        try {
            if (cleanEmail) {
                customerFirestore.collection('users').doc(cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')).set(userPayload, { merge: true }).catch(() => { });
            }
            if (cleanPhone) {
                customerFirestore.collection('users').doc(`phone_${cleanPhone}`).set(userPayload, { merge: true }).catch(() => { });
                customerFirestore.collection('users').doc(cleanPhone).set(userPayload, { merge: true }).catch(() => { });
            }
        } catch (e) { }
    }

    // 2. Sync to Backend API
    try {
        const response = await apiCall('/users', {
            method: 'POST',
            body: JSON.stringify(userPayload)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP ${response.status}`);
        }
    } catch (err) {
        console.warn('Firebase Firestore user sync notice:', err.message);
    }
}

// Cross-Device Profile, Address, Wallet Balance & Order History Automatic Retrieval
async function restoreUserProfileFromFirestore(emailOrPhone, options = {}) {
    if (!emailOrPhone) return null;
    const identifier = String(emailOrPhone).trim();
    const isEmail = identifier.includes('@');
    const cleanPhone = isEmail ? '' : identifier.replace(/[^0-9]/g, '').slice(-10);
    const param = isEmail ? `email=${encodeURIComponent(identifier.toLowerCase())}` : `phone=${encodeURIComponent(cleanPhone)}`;

    try {
        let u = null;

        // 1. Fetch from Backend Users API
        try {
            const response = await apiCall(`/users?${param}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.success && data.user) {
                    u = data.user;
                }
            }
        } catch (apiErr) {
            console.warn('User lookup API notice:', apiErr.message);
        }

        // 2. Client SDK Fallback if API returned null
        if (!u && customerFirestore && cleanPhone) {
            try {
                let snap = await customerFirestore.collection('users').doc(`phone_${cleanPhone}`).get();
                if (!snap.exists) {
                    snap = await customerFirestore.collection('users').doc(cleanPhone).get();
                }
                if (snap.exists && snap.data()) {
                    u = snap.data();
                }
            } catch (fsErr) {
                console.warn('Firestore direct user lookup notice:', fsErr.message);
            }
        }

        if (u) {
            const isVerified = u.isPhoneVerified !== false;

            const lat = (u.gps && u.gps.lat !== undefined && u.gps.lat !== null) ? parseFloat(u.gps.lat) : ((u.gpsLat !== undefined && u.gpsLat !== null) ? parseFloat(u.gpsLat) : null);
            const lng = (u.gps && u.gps.lng !== undefined && u.gps.lng !== null) ? parseFloat(u.gps.lng) : ((u.gpsLng !== undefined && u.gpsLng !== null) ? parseFloat(u.gpsLng) : null);

            // Check if user currently has local custom coordinates saved in this session
            const currentLocalProfile = getSavedDeliveryProfile();
            const hasLocalGps = currentLocalProfile && currentLocalProfile.gpsLat !== null && currentLocalProfile.gpsLng !== null;

            const restoredProfile = {
                fullName: u.fullName || '',
                email: u.email || '',
                phone: u.phone || cleanPhone,
                colonyName: u.address?.colonyName || '',
                nearBy: u.address?.nearBy || '',
                streetName: u.address?.streetName || '',
                wardNo: u.address?.wardNo || '',
                isVerified: isVerified,
                gpsLat: hasLocalGps ? currentLocalProfile.gpsLat : lat,
                gpsLng: hasLocalGps ? currentLocalProfile.gpsLng : lng,
            };

            try {
                localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(restoredProfile));
                if (isVerified && restoredProfile.phone) {
                    setStoredPhoneVerified(restoredProfile.phone, true);
                }
            } catch (e) { }

            isPhoneVerified = Boolean(restoredProfile.isVerified);
            if (restoredProfile.gpsLat !== null && restoredProfile.gpsLng !== null) {
                currentCustomerGps = { lat: restoredProfile.gpsLat, lng: restoredProfile.gpsLng };
            }

            // Restore Wallet Balance permanently bound to this mobile number
            const restoredBalance = Number(u.walletBalance !== undefined ? u.walletBalance : (u.balance !== undefined ? u.balance : 0));
            localStorage.setItem('perfetto_wallet_balance', restoredBalance);

            let activeDays = getClampedCashbackExpiryDays(customerWalletConfig);
            if (!currentCustomerWallet) currentCustomerWallet = { balance: 0, nonExpiredBalance: 0, transactions: [] };
            currentCustomerWallet.phone = cleanPhone || restoredProfile.phone;
            currentCustomerWallet.balance = restoredBalance;
            currentCustomerWallet.nonExpiredBalance = restoredBalance;
            currentCustomerWallet.expiresAt = u.walletExpiresAt || u.expiresAt || null;
            currentCustomerWallet.expiryDays = u.walletExpiryDays || u.expiryDays || activeDays;
            currentCustomerWallet.cashbackExpiryDays = u.cashbackExpiryDays || activeDays;
            currentCustomerWallet.lastCreditedAt = u.lastCreditedAt || null;

            if (Array.isArray(u.walletTransactions) && u.walletTransactions.length > 0) {
                currentCustomerWallet.transactions = u.walletTransactions;
            } else if (Array.isArray(u.transactions) && u.transactions.length > 0) {
                currentCustomerWallet.transactions = u.transactions;
            }
            safeStorage.setJSON('perfetto_customer_wallet', currentCustomerWallet);

            // Restore complete order history bound to this phone number
            const targetPhone = cleanPhone || restoredProfile.phone;
            if (targetPhone) {
                try {
                    let remoteOrders = [];
                    const ordersRes = await apiCall(`/orders?phone=${encodeURIComponent(targetPhone)}`);
                    if (ordersRes.ok) {
                        const ordersData = await ordersRes.json();
                        if (ordersData && Array.isArray(ordersData.orders)) {
                            remoteOrders = ordersData.orders;
                        }
                    }

                    if (remoteOrders.length === 0 && customerFirestore) {
                        try {
                            const snap = await customerFirestore.collection('orders').where('customerPhone', '==', targetPhone).get();
                            if (!snap.empty) {
                                snap.forEach(doc => {
                                    remoteOrders.push({ id: doc.id, orderId: doc.id, ...doc.data() });
                                });
                            }
                        } catch (e) {}
                    }

                    if (remoteOrders.length > 0) {
                        const existingLocal = safeStorage.getJSON('perfettoCustomerOrders', []);

                        const map = new Map();
                        // Remote orders take precedence
                        remoteOrders.forEach(o => map.set(String(o.id || o.orderId), o));
                        existingLocal.forEach(o => {
                            const id = String(o.id || o.orderId);
                            if (!map.has(id)) map.set(id, o);
                        });
                        const merged = Array.from(map.values()).sort((a, b) => {
                            const timeA = new Date(a.createdAt || 0).getTime();
                            const timeB = new Date(b.createdAt || 0).getTime();
                            return timeB - timeA;
                        });
                        safeStorage.setJSON('perfettoCustomerOrders', merged);
                        if (typeof listenToCustomerActiveOrders === 'function') {
                            listenToCustomerActiveOrders();
                        }
                    }
                } catch (ordErr) {
                    console.warn('Notice restoring customer orders:', ordErr.message);
                }
            }

            renderProfileHeaderAndInputs(restoredProfile);
            updateProfileTotalsUI();
            updateProfileWalletUI();
            renderProfileWalletTxList();
            renderOrderHistoryDetails();
            updateCheckoutWalletUI();
            updateCartUI();

            if (!options.silent) {
                const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
                showToast(isHindi
                    ? `🎉 स्वागत है! आपका वॉलेट (₹${restoredBalance}) और ऑर्डर इतिहास रीस्टोर हो गए हैं।`
                    : `🎉 Welcome back! Wallet (₹${restoredBalance}) and order history restored.`);
            }

            console.log('✅ User profile, wallet (₹' + restoredBalance + ') & orders successfully restored from Firestore:', restoredProfile.fullName);
            return restoredProfile;
        }
    } catch (err) {
        console.warn('Cross-device profile lookup notice:', err.message);
    }
    return null;
}

function handleFinalOrderSubmit(event) {
    if (event) event.preventDefault();
    handleSaveProfile(event);
}

function renderProfileHeaderAndInputs(profile) {
    const nameEl = document.getElementById('profile-display-name');
    const subtextEl = document.getElementById('profile-display-subtext');
    const badge = document.getElementById('phone-verified-badge');
    const emailBadge = document.getElementById('email-verified-badge');
    const changeBtn = document.getElementById('btn-change-phone');
    const verifyBtn = document.getElementById('btn-request-otp');
    const phoneInput = document.getElementById('customer-phone');

    const latHidden = document.getElementById('customer-gps-lat');
    const lngHidden = document.getElementById('customer-gps-lng');
    const statusBadge = document.getElementById('gps-status-badge');
    const coordsDisplay = document.getElementById('gps-coordinates-display');
    const coordsText = document.getElementById('gps-coords-text');
    const gpsContainer = document.querySelector('.full-width-gps-field');
    const gpsBtnText = document.getElementById('gps-btn-text');
    const mapBtn = document.getElementById('btn-open-map-modal');

    const storedVerifiedPhone = getStoredVerifiedPhone();
    const profilePhone = profile ? (profile.phone || '').replace(/[^0-9]/g, '').slice(-10) : '';
    const currentInputPhone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').slice(-10) : '';

    const effectivePhone = profilePhone || currentInputPhone || storedVerifiedPhone || '';
    const isVerifiedUser = Boolean(
        (profile && profile.isVerified) || 
        (storedVerifiedPhone && effectivePhone === storedVerifiedPhone) ||
        (storedVerifiedPhone && !profilePhone && !currentInputPhone)
    );

    if (profile && typeof profile === 'object') {
        if (nameEl) {
            nameEl.textContent = profile.fullName ? profile.fullName : 'Customer Name';
        }
        if (subtextEl) {
            subtextEl.textContent = profile.phone ? `+91 ${profile.phone}` : (storedVerifiedPhone ? `+91 ${storedVerifiedPhone}` : '+91 Mobile Number');
        }

        // Set phone verification state & UI
        if (isVerifiedUser) {
            isPhoneVerified = true;
            applyPhoneVerifiedUI(true, profile.phone || storedVerifiedPhone);
        } else {
            isPhoneVerified = false;
            applyPhoneVerifiedUI(false, profile.phone);
        }

        // Pre-fill GPS coordinate state
        if (profile.gpsLat !== undefined && profile.gpsLat !== null && profile.gpsLng !== undefined && profile.gpsLng !== null) {
            currentCustomerGps = { lat: profile.gpsLat, lng: profile.gpsLng };
            if (latHidden) latHidden.value = profile.gpsLat;
            if (lngHidden) lngHidden.value = profile.gpsLng;
            if (statusBadge) {
                statusBadge.className = 'gps-status-badge gps-success';
                statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> GPS Location Fixed';
                statusBadge.style.display = 'inline-flex';
            }
            if (coordsDisplay) {
                coordsDisplay.style.display = 'flex';
                if (coordsText) {
                    coordsText.textContent = `${Number(profile.gpsLat).toFixed(4)}, ${Number(profile.gpsLng).toFixed(4)}`;
                }
            }
            if (gpsContainer) {
                gpsContainer.classList.remove('invalid-gps');
            }
            if (mapBtn) {
                mapBtn.classList.remove('invalid-gps-btn');
                mapBtn.classList.add('btn-gps-selected');
                if (gpsBtnText) gpsBtnText.textContent = 'Change Location Pin';
            }
        }

        // Pre-fill form inputs
        const fullNameInput = document.getElementById('customer-fullname');
        const colonyInput = document.getElementById('customer-colony-name');
        const nearbyInput = document.getElementById('customer-nearby');
        const streetInput = document.getElementById('customer-street-name');
        const wardInput = document.getElementById('customer-ward-no');
        const emailInput = document.getElementById('customer-email');

        if (profile.fullName && fullNameInput && (!fullNameInput.value || fullNameInput.value === '')) fullNameInput.value = profile.fullName;
        if (profile.email && emailInput && (!emailInput.value || emailInput.value === '')) emailInput.value = profile.email;
        if (profile.phone && phoneInput && (!phoneInput.value || phoneInput.value === '')) {
            phoneInput.value = profile.phone;
            if (isVerifiedUser) {
                phoneInput.readOnly = true;
                phoneInput.style.backgroundColor = 'var(--bg-surface-elevated)';
                phoneInput.style.cursor = 'not-allowed';
            } else if (verifyBtn) {
                verifyBtn.disabled = profile.phone.length !== 10;
            }
        }
        if (profile.colonyName && colonyInput && (!colonyInput.value || colonyInput.value === '')) colonyInput.value = profile.colonyName;
        if (profile.nearBy && nearbyInput && (!nearbyInput.value || nearbyInput.value === '')) nearbyInput.value = profile.nearBy;
        if (profile.streetName && streetInput && (!streetInput.value || streetInput.value === '')) streetInput.value = profile.streetName;
        if (profile.wardNo && wardInput && (!wardInput.value || wardInput.value === '')) wardInput.value = profile.wardNo;
    } else {
        if (storedVerifiedPhone) {
            isPhoneVerified = true;
            if (nameEl) nameEl.textContent = 'Customer Name';
            if (subtextEl) subtextEl.textContent = `+91 ${storedVerifiedPhone}`;
            applyPhoneVerifiedUI(true, storedVerifiedPhone);
        } else {
            isPhoneVerified = false;
            currentCustomerGps = null;
            if (nameEl) nameEl.textContent = 'Customer Name';
            if (subtextEl) subtextEl.textContent = '+91 Mobile Number';
            applyPhoneVerifiedUI(false, '');
            if (statusBadge) {
                statusBadge.className = 'gps-status-badge';
                statusBadge.innerHTML = '';
                statusBadge.style.display = 'none';
            }
            if (coordsDisplay) coordsDisplay.style.display = 'none';
            if (mapBtn) mapBtn.classList.remove('invalid-gps-btn');
        }
    }
}

function updateProfileTotalsUI() {
    // Update order total inside modal / summary with dynamic delivery fee
    const itemCount = cart.reduce((sum, i) => sum + (i.qty || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal);
    const deliveryFee = (cart.length > 0 && subtotal > 0) ? deliveryInfo.finalDeliveryFee : 0;
    const total = subtotal + deliveryFee;

    const itemCountEl = document.getElementById('modal-item-count');
    const orderTotalEl = document.getElementById('modal-order-total');
    if (itemCountEl) itemCountEl.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    if (orderTotalEl) orderTotalEl.textContent = formatPrice(total);

    // Update stats counters - clean Total Orders only
    let orderCount = 0;
    try {
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        if (storedOrders) {
            const list = JSON.parse(storedOrders);
            if (Array.isArray(list)) orderCount = list.length;
        }
    } catch (e) { }

    const totalOrdersEl = document.getElementById('stat-total-orders');
    if (totalOrdersEl) totalOrdersEl.textContent = orderCount;

    // Update profile display name/phone & prefill inputs
    let currentProfile = null;
    try {
        const savedProfile = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (savedProfile) {
            currentProfile = JSON.parse(savedProfile);
        }
    } catch (e) { }

    renderProfileHeaderAndInputs(currentProfile);

    // Update Perfetto Wallet UI in Profile Tab & sync latest Firestore balance
    updateProfileWalletUI();
    renderProfileWalletTxList();
    if (currentProfile && currentProfile.phone) {
        fetchCustomerWallet(currentProfile.phone).then(() => {
            updateProfileWalletUI();
            renderProfileWalletTxList();
        });
        listenToCustomerWalletRealtime(currentProfile.phone);
    }
}

function toggleSavedAddressesView() {
    const box = document.getElementById('saved-address-display-box');
    const arrow = document.getElementById('arrow-saved-addresses');
    const historyBox = document.getElementById('order-history-display-box');
    const historyArrow = document.getElementById('arrow-order-history');
    const legalBox = document.getElementById('legal-info-display-box');
    const legalArrow = document.getElementById('arrow-legal-info');

    if (historyBox) historyBox.style.display = 'none';
    if (historyArrow) historyArrow.classList.remove('expanded');
    if (legalBox) legalBox.style.display = 'none';
    if (legalArrow) legalArrow.classList.remove('expanded');

    if (!box) return;
    if (box.style.display === 'block') {
        box.style.display = 'none';
        if (arrow) arrow.classList.remove('expanded');
        return;
    }

    renderSavedAddressDetails();
    box.style.display = 'block';
    if (arrow) arrow.classList.add('expanded');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderSavedAddressDetails() {
    const textContentEl = document.getElementById('saved-address-text-content');
    if (!textContentEl) return;

    try {
        const savedProfile = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (savedProfile) {
            const p = JSON.parse(savedProfile);
            if (p.fullName || p.colonyName || p.streetName) {
                const gpsInfo = (p.gpsLat && p.gpsLng)
                    ? `<div style="margin-top: 6px; font-size: 0.8rem; color: #16a34a; font-weight: 700;">
                         <i class="fa-solid fa-location-crosshairs"></i> GPS: ${p.gpsLat}, ${p.gpsLng}
                       </div>`
                    : '';

                textContentEl.innerHTML = `
                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 6px;">
                        <i class="fa-solid fa-user" style="color: var(--primary-orange); margin-right: 6px;"></i>${p.fullName || 'Customer'} (${p.phone || ''})
                    </div>
                    <div><strong style="color: var(--text-muted);">Colony:</strong> ${p.colonyName || 'N/A'}</div>
                    <div><strong style="color: var(--text-muted);">Landmark:</strong> ${p.nearBy || 'N/A'}</div>
                    <div><strong style="color: var(--text-muted);">Street:</strong> ${p.streetName || 'N/A'}</div>
                    <div><strong style="color: var(--text-muted);">Ward No:</strong> ${p.wardNo || 'N/A'}</div>
                    ${gpsInfo}
                `;
                return;
            }
        }
    } catch (e) { }

    textContentEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">No saved address found. Click 'Edit Details' to set your delivery address.</span>`;
}

function editSavedAddress() {
    openEditProfileModal();
    showToast('Update your profile and address details below.');
}

function toggleOrderHistoryView() {
    const box = document.getElementById('order-history-display-box');
    const arrow = document.getElementById('arrow-order-history');
    const addressBox = document.getElementById('saved-address-display-box');
    const addressArrow = document.getElementById('arrow-saved-addresses');
    const legalBox = document.getElementById('legal-info-display-box');
    const legalArrow = document.getElementById('arrow-legal-info');

    if (addressBox) addressBox.style.display = 'none';
    if (addressArrow) addressArrow.classList.remove('expanded');
    if (legalBox) legalBox.style.display = 'none';
    if (legalArrow) legalArrow.classList.remove('expanded');

    if (!box) return;
    if (box.style.display === 'block') {
        box.style.display = 'none';
        if (arrow) arrow.classList.remove('expanded');
        return;
    }

    renderOrderHistoryDetails();
    box.style.display = 'block';
    if (arrow) arrow.classList.add('expanded');
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function toggleLegalInfoView() {
    const box = document.getElementById('legal-info-display-box');
    const arrow = document.getElementById('arrow-legal-info');
    const historyBox = document.getElementById('order-history-display-box');
    const historyArrow = document.getElementById('arrow-order-history');
    const addressBox = document.getElementById('saved-address-display-box');
    const addressArrow = document.getElementById('arrow-saved-addresses');

    if (historyBox) historyBox.style.display = 'none';
    if (historyArrow) historyArrow.classList.remove('expanded');
    if (addressBox) addressBox.style.display = 'none';
    if (addressArrow) addressArrow.classList.remove('expanded');

    if (!box) return;
    if (box.style.display === 'block') {
        box.style.display = 'none';
        if (arrow) arrow.classList.remove('expanded');
        return;
    }

    box.style.display = 'block';
    if (arrow) arrow.classList.add('expanded');

    // Smooth auto-scroll so the entire expanded content (including footer note) is fully visible
    setTimeout(() => {
        const bottomNavOffset = 80; // Clearance for the sticky bottom navigation bar
        const rect = box.getBoundingClientRect();
        const bottomPosition = window.pageYOffset + rect.bottom;
        const targetScrollTop = bottomPosition - window.innerHeight + bottomNavOffset;

        if (rect.bottom + bottomNavOffset > window.innerHeight) {
            window.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
            });
        }
    }, 60);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderOrderHistoryDetails() {
    const listEl = document.getElementById('order-history-list');
    const clearBtn = document.getElementById('btn-clear-history');
    if (!listEl) return;

    try {
        const orders = safeStorage.getJSON('perfettoCustomerOrders', []);
        if (Array.isArray(orders) && orders.length > 0) {
            if (clearBtn) clearBtn.style.display = 'inline-flex';
            listEl.innerHTML = orders.map(o => {
                const otpCode = o.deliveryOtp || o.otp || '';
                const isDelivered = o.status === 'completed' || o.status === 'delivered';
                const isCancelled = o.status === 'rejected' || o.status === 'cancelled';
                const itemsText = (o.items || []).map(i => escapeHtml(i.name)).join(', ');
                const orderCashback = Number(o.wonCashback || o.earnedCashback || (o.scratchCard && (o.scratchCard.wonAmount || o.scratchCard.amount)) || 0);
                let isScratchClaimed = !!(o.scratchClaimed || (o.scratchCard && o.scratchCard.claimed));
                const isCardExpired = isScratchCardExpired(o);
                const expiryCountdown = getScratchExpiryCountdownText(o);
                const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
                const orderDays = (o && (o.scratchExpiryDays || o.cashbackExpiryDays || (o.scratchCard && (o.scratchCard.expiryDays || o.scratchCard.cashbackExpiryDays)))) || getClampedCashbackExpiryDays(customerWalletConfig);
                if (isCardExpired && !o.scratchExpired) {
                    permanentlyInvalidateScratchCard(o);
                }

                const isScratchRevealed = Boolean(o.scratchRevealed || (o.scratchCard && o.scratchCard.revealed));

                // Auto-credit pending delivery cashback only if order was delivered AND card was already revealed
                if (isDelivered && isScratchRevealed && !isScratchClaimed && !isCardExpired) {
                    if (orderCashback > 0) {
                        o.scratchClaimed = true;
                        o.rewardStatus = 'active_credited';
                        if (o.scratchCard) {
                            o.scratchCard.claimed = true;
                            o.scratchCard.status = 'active_credited';
                            o.scratchCard.claimedAt = new Date().toISOString();
                        }
                        const phone = o.customerPhone || o.phone || ((currentUserProfile && currentUserProfile.phone) || '');
                        creditCustomerWallet(phone, orderCashback, o.id || o.orderId);
                        isScratchClaimed = true;
                        safeStorage.setJSON('perfettoCustomerOrders', orders);
                    }
                }

                    return `
                    <div style="background: var(--bg-surface); padding: 14px; border-radius: 12px; margin-top: 10px; border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <strong style="color: var(--primary-orange); font-size: 0.95rem;">#${escapeHtml(o.id || o.orderId)}</strong>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(o.timeAgo || '')}</span>
                        </div>
                        <div style="font-size: 0.84rem; color: var(--text-light); margin-bottom: 8px;">
                            ${itemsText}
                        </div>
                        
                        ${otpCode ? `
                        <div class="order-history-otp-box ${isDelivered ? 'otp-verified' : isCancelled ? 'otp-cancelled' : ''}">
                            <div class="order-history-otp-left">
                                <span class="order-history-otp-label">
                                    <i class="fa-solid ${isDelivered ? 'fa-circle-check' : isCancelled ? 'fa-ban' : 'fa-shield-halved'}"></i>
                                    ${isDelivered ? 'Delivered & Verified' : isCancelled ? 'Cancelled Order' : 'Delivery Verification OTP'}
                                </span>
                                <span class="order-history-otp-digits">${escapeHtml(otpCode)}</span>
                                ${!isDelivered && !isCancelled ? `<span class="order-history-otp-note">Share with delivery partner upon arrival</span>` : ''}
                            </div>
                            ${!isDelivered && !isCancelled ? `
                                <button type="button" class="order-history-copy-btn" onclick="copyOrderHistoryOtp('${escapeHtml(otpCode)}')" title="Copy Delivery OTP">
                                    <i class="fa-solid fa-copy"></i> Copy
                                </button>
                            ` : ''}
                        </div>
                        ` : ''}

                        ${orderCashback > 0 && !isCancelled ? `
                            ${isCardExpired ? `
                                <div class="order-history-scratch-expired">
                                    <i class="fa-solid fa-clock-rotate-left"></i>
                                    <span>⚠️ ${isHindi ? `स्क्रैच कार्ड समाप्त (${orderDays} दिन समाप्त)` : `Scratch Card Expired (${orderDays} days elapsed)`}</span>
                                </div>
                            ` : isScratchClaimed ? `
                                <div class="order-history-scratch-claimed">
                                    <i class="fa-solid fa-circle-check"></i>
                                    <span>${isHindi ? `स्क्रैच कार्ड क्लेम किया गया (+₹${orderCashback} वॉलेट में)` : `Scratch Card Claimed (+₹${orderCashback} in wallet)`}</span>
                                </div>
                            ` : !isScratchRevealed ? `
                                <div class="order-history-scratch-promo unclaimed-glowing" onclick="openScratchCardForOrder('${escapeHtml(o.id || o.orderId)}')">
                                    <div class="scratch-promo-left">
                                        <div class="scratch-promo-icon-wrap">
                                            <i class="fa-solid fa-gift fa-bounce"></i>
                                        </div>
                                        <div>
                                            <div class="scratch-promo-title">🎁 Scratch Card Available / स्क्रैच कार्ड उपलब्ध</div>
                                            <div class="scratch-promo-sub">
                                                <span class="scratch-countdown-pill">
                                                    <i class="fa-solid fa-clock"></i> ${escapeHtml(expiryCountdown)}
                                                </span>
                                                <span class="scratch-card-amount-hint">Win up to ₹${orderCashback}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button type="button" class="btn-open-scratch-card" onclick="event.stopPropagation(); openScratchCardForOrder('${escapeHtml(o.id || o.orderId)}')">
                                        Scratch Now ✨
                                    </button>
                                </div>
                            ` : `
                                <div class="order-history-scratch-pending" onclick="openScratchCardForOrder('${escapeHtml(o.id || o.orderId)}')">
                                    <i class="fa-solid fa-truck-fast"></i>
                                    <span>${isHindi ? `🎁 ₹${orderCashback} कैशबैक जीता • ऑर्डर डिलीवर होने पर वॉलेट में जुड़ेगा` : `🎁 ₹${orderCashback} Cashback Won • Credited once order is delivered`}</span>
                                </div>
                            `}
                        ` : ''}

                        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 700; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px;">
                            <span>Status: <span style="color: ${isDelivered ? '#22c55e' : isCancelled ? '#ef4444' : '#f59e0b'}; text-transform: uppercase;">${escapeHtml(o.status)}</span></span>
                            <span style="color: var(--primary-orange);">₹${o.total || (o.costs && o.costs.total) || 0}</span>
                        </div>
                    </div>
                `}).join('');
                return;
            }
    } catch (e) { }

    if (clearBtn) clearBtn.style.display = 'none';
    listEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">No order history found yet.</span>`;
}

function clearCustomerOrderHistory() {
    const modal = document.getElementById('clear-history-confirm-modal');
    if (!modal) {
        confirmClearCustomerOrderHistory();
        return;
    }
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeClearHistoryModal() {
    const modal = document.getElementById('clear-history-confirm-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
}

function confirmClearCustomerOrderHistory() {
    try {
        localStorage.removeItem('perfettoCustomerOrders');
    } catch (e) {
        console.error('Error clearing customer order history:', e);
    }
    closeClearHistoryModal();
    renderOrderHistoryDetails();
    updateProfileTotalsUI();
    showToast('🗑️ Order history cleared successfully!');
}

// --------------------------------------------------------------------------
// 7. TOAST NOTIFICATION SYSTEM
// --------------------------------------------------------------------------
let toastTimeout = null;
function showToast(msg, duration = 2400) {
    // Immediately clear any active timer to prevent stacked or flickering notifications
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }

    let text = msg;
    if (typeof text === 'object' && text !== null) {
        text = text.message || text.error || text.details || JSON.stringify(text);
    }
    const toastEl = document.getElementById('toast') || (typeof toast !== 'undefined' ? toast : null);
    if (!toastEl) return;

    const toastMsgEl = toastEl.querySelector('#toast-message') || (typeof toastMessage !== 'undefined' ? toastMessage : null);
    const toastIconEl = toastEl.querySelector('#toast-icon') || document.getElementById('toast-icon');

    if (toastMsgEl) {
        toastMsgEl.textContent = String(text || '');
    }
    if (toastIconEl) {
        const lower = String(text).toLowerCase();
        if (lower.includes('cheese')) {
            toastIconEl.className = 'toast-icon';
            toastIconEl.textContent = '🧀';
        } else if (lower.includes('spicy')) {
            toastIconEl.className = 'toast-icon';
            toastIconEl.textContent = '🌶️';
        } else if (lower.includes('mayo')) {
            toastIconEl.className = 'toast-icon';
            toastIconEl.textContent = '🍥';
        } else {
            toastIconEl.textContent = '';
            toastIconEl.className = 'fa-solid fa-circle-check toast-icon';
        }
    }

    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
        toastTimeout = null;
    }, duration);
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// 8. DAILY BANNERS DATA & FALLBACK LOGO SYSTEM (SEAMLESS DYNAMIC AUTO-CAROUSEL)
// --------------------------------------------------------------------------
const DEFAULT_FALLBACK_BANNER_LOGO = 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';
const DEFAULT_DAILY_BANNERS = [
    { id: 'b1', url: 'https://i.ibb.co/GQtdNF4v/free-cold-drink.png', enabled: true },
    { id: 'b2', url: 'https://i.ibb.co/kVpH7yM2/free-kitkat-shake.png', enabled: true },
    { id: 'b3', url: 'https://i.ibb.co/VYqnBKbM/free-medium-pizza.png', enabled: true },
    { id: 'b4', url: 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png', enabled: true }
];

window.DEFAULT_FALLBACK_BANNER_LOGO = DEFAULT_FALLBACK_BANNER_LOGO;
window.DEFAULT_DAILY_BANNERS = DEFAULT_DAILY_BANNERS;

function resolveBannerUrl(url) {
    if (!url || typeof url !== 'string') return DEFAULT_FALLBACK_BANNER_LOGO;
    const trimmed = url.trim();
    if (!trimmed || trimmed.length < 4) return DEFAULT_FALLBACK_BANNER_LOGO;
    return trimmed;
}
window.resolveBannerUrl = resolveBannerUrl;

function handleBannerImgError(imgEl) {
    if (!imgEl) return;
    if (imgEl.src !== DEFAULT_FALLBACK_BANNER_LOGO) {
        imgEl.src = DEFAULT_FALLBACK_BANNER_LOGO;
    }
}
window.handleBannerImgError = handleBannerImgError;

let offerSliderAutoScrollInterval = null;
let offerSliderPauseTimeout = null;
let currentOfferSlideIndex = 0;

function renderDynamicOfferSlider(customBanners = null) {
    let rawBanners = customBanners;
    if (!Array.isArray(rawBanners) || rawBanners.length === 0) {
        try {
            const saved = localStorage.getItem('perfetto_daily_banners');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    rawBanners = parsed;
                }
            }
        } catch (e) { }
    }
    if (!Array.isArray(rawBanners) || rawBanners.length === 0) {
        rawBanners = DEFAULT_DAILY_BANNERS;
    }

    // Filter only currently enabled banners from the 4 slots
    let activeBanners = rawBanners.slice(0, 4).filter(b => b && b.enabled !== false);
    if (activeBanners.length === 0) {
        // Fallback to slot 1 if all are somehow marked false
        activeBanners = [rawBanners[0] || DEFAULT_DAILY_BANNERS[0]];
    }

    const track = document.getElementById('offer-slider-track');
    const dotsContainer = document.getElementById('offer-dots');
    if (!track || !dotsContainer) return;

    if (currentOfferSlideIndex >= activeBanners.length) {
        currentOfferSlideIndex = 0;
    }

    // Render track slides dynamically for active banners
    track.innerHTML = activeBanners.map((banner, idx) => {
        const safeUrl = resolveBannerUrl(banner.url);
        return `
            <div class="offer-slide" data-banner-id="${banner.id || ('b' + (idx + 1))}" data-slide-index="${idx}">
                <img src="${safeUrl}" alt="Daily Offer ${idx + 1}" class="offer-img" onerror="handleBannerImgError(this)">
            </div>
        `;
    }).join('');

    // Single Banner Mode: Hide indicator dots completely
    if (activeBanners.length <= 1) {
        dotsContainer.style.display = 'none';
        dotsContainer.innerHTML = '';
    } else {
        dotsContainer.style.display = 'flex';
        dotsContainer.innerHTML = activeBanners.map((_, idx) => 
            `<span class="dot ${idx === currentOfferSlideIndex ? 'active' : ''}" data-index="${idx}"></span>`
        ).join('');
    }

    initOfferSlider(activeBanners.length);
}
window.renderDynamicOfferSlider = renderDynamicOfferSlider;

function initOfferSlider(activeBannerCount) {
    const wrapper = document.getElementById('offer-slider-wrapper');
    const track = document.getElementById('offer-slider-track');
    const dotsContainer = document.getElementById('offer-dots');
    if (!wrapper || !track || !dotsContainer) return;

    // Clear any running timers
    if (offerSliderAutoScrollInterval) {
        clearInterval(offerSliderAutoScrollInterval);
        offerSliderAutoScrollInterval = null;
    }
    if (offerSliderPauseTimeout) {
        clearTimeout(offerSliderPauseTimeout);
        offerSliderPauseTimeout = null;
    }

    const slides = Array.from(track.querySelectorAll('.offer-slide'));
    const totalSlides = slides.length;

    // Detach all previous swipe/drag listeners clean
    wrapper.ontouchstart = null;
    wrapper.ontouchmove = null;
    wrapper.ontouchend = null;
    wrapper.ontouchcancel = null;
    wrapper.onmousedown = null;
    wrapper.onmousemove = null;
    wrapper.onmouseup = null;
    wrapper.onmouseleave = null;

    // --------------------------------------------------------------------------
    // SINGLE BANNER MODE: Exactly 1 banner is active
    // Disable swiping/touch gestures and auto-scroll completely; fixed & static.
    // --------------------------------------------------------------------------
    if (totalSlides <= 1) {
        track.style.display = 'block';
        track.style.width = '100%';
        track.style.transform = 'translateX(0%)';
        track.style.transition = 'none';
        if (slides[0]) {
            slides[0].style.flex = '0 0 100%';
            slides[0].style.width = '100%';
            slides[0].style.minWidth = '100%';
        }
        dotsContainer.style.display = 'none';
        dotsContainer.innerHTML = '';
        wrapper.style.cursor = 'default';
        return;
    }

    // --------------------------------------------------------------------------
    // MULTI BANNER MODE: 2 to 4 banners active
    // 3s auto-scroll loop + 5.5s pause/hold delay after user touch/drag
    // --------------------------------------------------------------------------
    dotsContainer.style.display = 'flex';
    wrapper.style.cursor = 'grab';

    const dots = Array.from(dotsContainer.querySelectorAll('.dot'));

    track.style.display = 'flex';
    track.style.width = `${totalSlides * 100}%`;

    slides.forEach(slide => {
        slide.style.flex = `0 0 ${100 / totalSlides}%`;
        slide.style.width = `${100 / totalSlides}%`;
        slide.style.minWidth = `${100 / totalSlides}%`;
    });

    function goToSlide(index, animated = true) {
        currentOfferSlideIndex = (index % totalSlides + totalSlides) % totalSlides;
        if (animated) {
            track.style.transition = 'transform 0.5s ease-in-out';
        } else {
            track.style.transition = 'none';
        }
        const pct = -(currentOfferSlideIndex * (100 / totalSlides));
        track.style.transform = `translateX(${pct}%)`;

        dots.forEach((dot, idx) => {
            if (idx === currentOfferSlideIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // Set initial slide position
    goToSlide(currentOfferSlideIndex, false);

    function nextSlide() {
        goToSlide(currentOfferSlideIndex + 1, true);
    }

    function prevSlide() {
        goToSlide(currentOfferSlideIndex - 1, true);
    }

    function startAutoScroll() {
        stopAutoScroll();
        offerSliderAutoScrollInterval = setInterval(() => {
            nextSlide();
        }, 3000); // 3 seconds autoplay loop
    }

    function stopAutoScroll() {
        if (offerSliderAutoScrollInterval) {
            clearInterval(offerSliderAutoScrollInterval);
            offerSliderAutoScrollInterval = null;
        }
    }

    function handleUserInteractionEnd() {
        stopAutoScroll();
        if (offerSliderPauseTimeout) clearTimeout(offerSliderPauseTimeout);
        // 5.5 seconds hold delay after manual swipe/drag before resuming 3s auto-scroll
        offerSliderPauseTimeout = setTimeout(() => {
            startAutoScroll();
        }, 5500);
    }

    // Dot click navigation
    dots.forEach((dot, idx) => {
        dot.onclick = (e) => {
            e.stopPropagation();
            stopAutoScroll();
            goToSlide(idx, true);
            handleUserInteractionEnd();
        };
    });

    // Touch & Mouse Drag Listeners
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    function onStart(clientX) {
        stopAutoScroll();
        if (offerSliderPauseTimeout) clearTimeout(offerSliderPauseTimeout);
        startX = clientX;
        currentX = startX;
        isDragging = true;
        wrapper.style.cursor = 'grabbing';
    }

    function onMove(clientX) {
        if (!isDragging) return;
        currentX = clientX;
    }

    function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        wrapper.style.cursor = 'grab';
        const diffX = currentX - startX;

        if (Math.abs(diffX) > 35) {
            if (diffX < 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
        handleUserInteractionEnd();
    }

    wrapper.ontouchstart = (e) => {
        if (e.touches.length > 0) {
            onStart(e.touches[0].clientX);
        }
    };

    wrapper.ontouchmove = (e) => {
        if (e.touches.length > 0) {
            onMove(e.touches[0].clientX);
        }
    };

    wrapper.ontouchend = () => {
        onEnd();
    };

    wrapper.ontouchcancel = () => {
        if (isDragging) {
            isDragging = false;
            wrapper.style.cursor = 'grab';
            handleUserInteractionEnd();
        }
    };

    wrapper.onmousedown = (e) => {
        onStart(e.clientX);
    };

    wrapper.onmousemove = (e) => {
        onMove(e.clientX);
    };

    wrapper.onmouseup = () => {
        onEnd();
    };

    wrapper.onmouseleave = () => {
        if (isDragging) {
            isDragging = false;
            wrapper.style.cursor = 'grab';
            handleUserInteractionEnd();
        }
    };

    // Start initial 3-second autoplay loop
    startAutoScroll();
}

// --------------------------------------------------------------------------
// 9. WHATSAPP DP STYLE LOGO POPUP MODAL
// --------------------------------------------------------------------------
function initLogoModal() {
    const brandLogo = document.getElementById('app-logo');
    const brandLogoContainer = document.getElementById('brand-logo-container');
    const logoModal = document.getElementById('logo-modal');
    const logoModalContent = document.getElementById('logo-modal-content');
    const modalLogoImg = document.getElementById('modal-logo-img');

    if (!brandLogo || !logoModal || !modalLogoImg) return;

    function openLogoModal(isPopState = false) {
        modalLogoImg.src = brandLogo.src;
        logoModal.classList.add('active');
        logoModal.setAttribute('aria-hidden', 'false');
        if (!isPopState) {
            history.pushState({ page: 'logo-modal' }, '', '#logo-view');
        }
    }

    function closeLogoModal(isPopState = false) {
        if (!logoModal.classList.contains('active')) return;
        logoModal.classList.remove('active');
        logoModal.setAttribute('aria-hidden', 'true');
        if (!isPopState && history.state && history.state.page === 'logo-modal') {
            history.back();
        }
    }

    const triggerEl = brandLogoContainer || brandLogo;
    triggerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openLogoModal();
    });

    // Click outside circular image (on backdrop overlay) closes modal
    logoModal.addEventListener('click', (e) => {
        if (e.target === logoModal || (logoModalContent && !logoModalContent.contains(e.target))) {
            closeLogoModal();
        }
    });

    window.closeLogoModal = closeLogoModal;
}

// --------------------------------------------------------------------------
// 9.5 CUSTOMER CARE CALL MODAL CONTROLLER & VISIBILITY
// --------------------------------------------------------------------------
function checkCustomerCareVisibilityUI() {
    const isEnabled = getCustomerCareEnabled();
    const headerCallBtn = document.getElementById('header-call-btn');
    if (headerCallBtn) {
        headerCallBtn.style.display = isEnabled ? 'inline-flex' : 'none';
    }
}

function updateCustomerCareModalUI() {
    const phone = getCustomerCarePhone();
    const phoneTextEl = document.getElementById('care-phone-number-text');
    const callLinkEl = document.getElementById('customer-care-call-link');

    if (phoneTextEl) {
        // Nicely formatted 10-digit display (e.g., +91 98765 43210 or 98765 43210)
        if (phone.length === 10) {
            phoneTextEl.textContent = `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
        } else {
            phoneTextEl.textContent = phone;
        }
    }
    if (callLinkEl) {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        callLinkEl.href = cleanPhone.length === 10 ? `tel:+91${cleanPhone}` : `tel:${cleanPhone}`;
    }

    checkCustomerCareVisibilityUI();
}

function initCustomerCareModal() {
    const headerCallBtn = document.getElementById('header-call-btn');
    const careModal = document.getElementById('customer-care-modal');
    const closeBtn = document.getElementById('customer-care-close-btn');

    // Set initial visibility of call button in header
    checkCustomerCareVisibilityUI();

    if (!careModal) return;

    function openCareModal(isPopState = false) {
        updateCustomerCareModalUI();
        careModal.classList.add('active');
        careModal.setAttribute('aria-hidden', 'false');
        if (!isPopState) {
            history.pushState({ page: 'care-modal' }, '', '#customer-care');
        }
    }

    function closeCareModal(isPopState = false) {
        if (!careModal.classList.contains('active')) return;
        careModal.classList.remove('active');
        careModal.setAttribute('aria-hidden', 'true');
        if (!isPopState && history.state && history.state.page === 'care-modal') {
            history.back();
        }
    }

    if (headerCallBtn) {
        headerCallBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openCareModal();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCareModal();
        });
    }

    careModal.addEventListener('click', (e) => {
        if (e.target === careModal) {
            closeCareModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && careModal.classList.contains('active')) {
            closeCareModal();
        }
    });

    window.closeCustomerCareModal = closeCareModal;
    window.openCustomerCareModal = openCareModal;
    window.updateCustomerCareModalUI = updateCustomerCareModalUI;
    window.checkCustomerCareVisibilityUI = checkCustomerCareVisibilityUI;

    // Initial update of phone number and visibility
    updateCustomerCareModalUI();
}

// --------------------------------------------------------------------------
// 10. BROWSER HISTORY & MOBILE HARDWARE BACK BUTTON HANDLING
// --------------------------------------------------------------------------
function setupHistoryState() {
    // Set initial history state for root home dashboard
    if (!history.state) {
        history.replaceState({ page: 'home' }, '', window.location.pathname + window.location.search);
    }

    window.addEventListener('popstate', (e) => {
        // 1. If customer search is active, close search first
        if (isCustomerSearchActive) {
            closeCustomerSearch();
            return;
        }

        // 2. If logo modal is active, close it first
        const logoModal = document.getElementById('logo-modal');
        if (logoModal && logoModal.classList.contains('active')) {
            if (window.closeLogoModal) {
                window.closeLogoModal(true);
            }
            return;
        }

        // 2.5 If customer care modal is active, close it
        const careModal = document.getElementById('customer-care-modal');
        if (careModal && careModal.classList.contains('active')) {
            if (window.closeCustomerCareModal) {
                window.closeCustomerCareModal(true);
            }
            return;
        }

        // 3. Navigate SPA view based on history state
        const state = e.state;
        if (!state || state.page === 'home') {
            const wasCategoryDetail = activeTabName === 'category-detail';
            lastCategoryState.categoryName = null;
            lastCategoryState.categoryImg = null;
            lastCategoryState.scrollY = 0;
            switchTab('home', true, true, wasCategoryDetail);
            if (wasCategoryDetail) {
                restoreHomeScrollPosition();
            }
        } else if (state.page === 'category-detail' && state.categoryName) {
            openCategoryDetail(state.categoryName, state.categoryImg, false, true);
        } else if (state.page === 'cart') {
            switchTab('cart', false, true);
        } else if (state.page === 'profile') {
            switchTab('profile', false, true);
        }
    });
}

// --------------------------------------------------------------------------
// 11. GLOBAL FUZZY SEARCH SYSTEM (SPACE-INSENSITIVE & RANKED)
// --------------------------------------------------------------------------
const CUSTOMER_CATEGORY_META = {
    "Pizza": { name: "Pizza", img: "https://i.ibb.co/21fs0TqL/pizza.png" },
    "Bread": { name: "Bread & Sides", img: "https://i.ibb.co/fzBqSJJx/bread.png" },
    "Burger": { name: "Burgers", img: "https://i.ibb.co/jZDq51b6/burger.png" },
    "Chinese Food": { name: "Chinese Food", img: "https://i.ibb.co/YFYwbHmV/chinese-food.png" },
    "Colo Drinks": { name: "Cold Drinks", img: "https://i.ibb.co/dJxnm38L/colo-drinks.png" },
    "Pasta": { name: "Pasta", img: "https://i.ibb.co/Qvzgv353/pasta.png" },
    "Desserts": { name: "Desserts", img: "https://i.ibb.co/YBQ73fv2/dasserts.png" },
    "Shake": { name: "Shakes", img: "https://i.ibb.co/XZpkRRpJ/shake.png" },
    "Hot Cold Coffee": { name: "Hot Cold Coffee", img: "https://i.ibb.co/1GS88GN6/hot-cold-coffee.png" },
    "Mojito": { name: "Mojito", img: "https://i.ibb.co/kV2Wvsdq/mojito.png" },
    "Momos": { name: "Momos", img: "https://i.ibb.co/gbdrfGJK/momos.png" },
    "Noodles": { name: "Noodles", img: "https://i.ibb.co/v6LTBqFV/noodles.png" },
    "Rice": { name: "Rice", img: "https://i.ibb.co/gL0Z5F0C/rice.png" },
    "Salad": { name: "Salad", img: "https://i.ibb.co/W4V8XcNG/salad.png" },
    "Sandwich": { name: "Sandwich", img: "https://i.ibb.co/DPyPQfsT/sandwich.png" },
    "Side Orders": { name: "Side Orders", img: "https://i.ibb.co/JwXzvd1f/side-orders.png" },
    "Spring Rolls": { name: "Spring Rolls", img: "https://i.ibb.co/HLJWTt1D/spring-rolls.png" },
    "Wrap": { name: "Wrap", img: "https://i.ibb.co/V0c7gf6d/wrap.png" }
};

let isCustomerSearchActive = false;
let preSearchTabName = 'home';

function getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function calculateTextMatchScore(query, targetText) {
    if (!query || !targetText) return 0;
    const cleanQ = query.toLowerCase().trim();
    const cleanT = targetText.toLowerCase().trim();
    const stripQ = cleanQ.replace(/\s+/g, '');
    const stripT = cleanT.replace(/\s+/g, '');

    if (stripQ === '' || stripT === '') return 0;
    if (stripT === stripQ) return 1000;
    if (stripT.startsWith(stripQ)) return 900 - (stripT.length - stripQ.length);
    if (stripT.includes(stripQ)) return 800 - (stripT.length - stripQ.length);

    const words = cleanT.split(/\s+/);
    for (const word of words) {
        if (word === cleanQ) return 850;
        if (word.startsWith(cleanQ)) return 750;
        if (word.includes(cleanQ)) return 650;
    }

    const maxAllowedDist = stripQ.length <= 4 ? 1 : 2;
    let bestWordDist = 999;
    for (const word of words) {
        if (Math.abs(word.length - cleanQ.length) <= maxAllowedDist) {
            const dist = getLevenshteinDistance(cleanQ, word);
            if (dist < bestWordDist) bestWordDist = dist;
        }
    }
    if (bestWordDist <= maxAllowedDist) return 500 - (bestWordDist * 100);

    let minWindowDist = 999;
    const qLen = stripQ.length;
    for (let lenDelta = -1; lenDelta <= 1; lenDelta++) {
        const winLen = qLen + lenDelta;
        if (winLen < 2) continue;
        for (let i = 0; i <= stripT.length - winLen; i++) {
            const sub = stripT.substr(i, winLen);
            const dist = getLevenshteinDistance(stripQ, sub);
            if (dist < minWindowDist) minWindowDist = dist;
        }
    }
    if (minWindowDist <= maxAllowedDist) return 400 - (minWindowDist * 100);

    return 0;
}

function getAllCustomerMenuItems() {
    const stored = getStoredMenuItems();
    if (stored && Array.isArray(stored) && stored.length > 0) {
        return stored.map(item => ({
            ...item,
            id: item.id || item.name.toLowerCase().replace(/\s+/g, '-'),
            available: item.available !== false
        }));
    }
    const items = [];
    Object.keys(categorySubItems).forEach(cat => {
        categorySubItems[cat].forEach((i, idx) => {
            items.push({
                ...i,
                id: i.id || `${cat.toLowerCase()}-${idx + 1}`,
                category: cat,
                available: true
            });
        });
    });
    return items;
}

function openCustomerSearch() {
    const searchBar = document.getElementById('app-search-bar');
    const searchInput = document.getElementById('customer-search-input');
    if (searchBar) searchBar.style.display = 'block';
    if (searchInput) searchInput.focus();

    if (activeTabName !== 'search-results') {
        preSearchTabName = activeTabName;
    }
    isCustomerSearchActive = true;
}

function closeCustomerSearch() {
    const searchBar = document.getElementById('app-search-bar');
    const searchInput = document.getElementById('customer-search-input');
    if (searchInput) searchInput.value = '';
    if (searchBar) searchBar.style.display = 'none';

    isCustomerSearchActive = false;

    // Restore previous view
    if (preSearchTabName === 'category-detail' && lastCategoryState.categoryName) {
        openCategoryDetail(lastCategoryState.categoryName, lastCategoryState.categoryImg, true, true);
    } else {
        switchTab(preSearchTabName || 'home', true, true);
    }
}

function handleCustomerSearch(query) {
    const trimmed = query.toLowerCase().trim();

    if (trimmed === '') {
        if (isCustomerSearchActive) {
            closeCustomerSearch();
        }
        return;
    }

    if (!isCustomerSearchActive) {
        openCustomerSearch();
    }

    // Toggle main header vs category hero bar
    const mainHeader = document.getElementById('header');
    const categoryHeroBar = document.getElementById('category-hero-bar');
    if (mainHeader) mainHeader.style.display = 'block';
    if (categoryHeroBar) categoryHeroBar.style.display = 'none';

    // Show view-search-results
    tabViews.forEach(view => {
        if (view.id === 'view-search-results') {
            view.classList.add('active-tab');
        } else {
            view.classList.remove('active-tab');
        }
    });

    activeTabName = 'search-results';

    renderCustomerSearchResults(trimmed, query);
}

function renderCustomerSearchResults(queryLower, originalQuery) {
    const categoriesWrapper = document.getElementById('customer-search-categories-wrapper');
    const categoriesGrid = document.getElementById('customer-search-categories-grid');

    const pizzasWrapper = document.getElementById('customer-search-pizzas-wrapper');
    const pizzasGrid = document.getElementById('customer-search-pizzas-grid');

    const productsWrapper = document.getElementById('customer-search-products-wrapper');
    const productsGrid = document.getElementById('customer-search-products-grid');

    const emptyState = document.getElementById('customer-search-empty');
    const summaryEl = document.getElementById('customer-search-summary');

    if (categoriesGrid) categoriesGrid.innerHTML = '';
    if (pizzasGrid) pizzasGrid.innerHTML = '';
    if (productsGrid) productsGrid.innerHTML = '';

    const allItems = getAllCustomerMenuItems();

    // 1. MATCHING CATEGORIES (EXACT HOME SCREEN 2-COLUMN FAST-FOOD GRID)
    const matchingCategories = [];
    Object.keys(CUSTOMER_CATEGORY_META).forEach(catKey => {
        const catMeta = CUSTOMER_CATEGORY_META[catKey];
        const nameScore = calculateTextMatchScore(originalQuery, catMeta.name);
        const keyScore = calculateTextMatchScore(originalQuery, catKey);
        const score = Math.max(nameScore, keyScore);
        if (score > 0) {
            matchingCategories.push({ catKey, catMeta, score });
        }
    });
    matchingCategories.sort((a, b) => b.score - a.score);

    if (categoriesGrid && matchingCategories.length > 0) {
        categoriesGrid.innerHTML = matchingCategories.map(({ catKey, catMeta }) => `
            <a href="#" class="fast-food-card" data-category="${catKey}" onclick="openCategoryDetail('${catKey}', '${catMeta.img}'); return false;" aria-label="${catMeta.name}">
                <img src="${catMeta.img}" alt="${catMeta.name}" class="fast-food-img" loading="lazy">
            </a>
        `).join('');
        if (categoriesWrapper) categoriesWrapper.style.display = 'block';
    } else {
        if (categoriesWrapper) categoriesWrapper.style.display = 'none';
    }

    // 2. MATCHING PRODUCTS (SEPARATE PIZZAS vs OTHER MENU ITEMS FOR PERFECT GRID CONSISTENCY)
    const matchingPizzas = [];
    const matchingOtherProducts = [];

    allItems.forEach(item => {
        const nameScore = calculateTextMatchScore(originalQuery, item.name);
        const catScore = calculateTextMatchScore(originalQuery, item.category);
        const descScore = item.desc ? calculateTextMatchScore(originalQuery, item.desc) * 0.7 : 0;
        const score = Math.max(nameScore, catScore * 0.9, descScore);
        if (score > 0) {
            if (item.category === "Pizza" || item.prices) {
                matchingPizzas.push({ item, score });
            } else {
                matchingOtherProducts.push({ item, score });
            }
        }
    });

    matchingPizzas.sort((a, b) => b.score - a.score);
    matchingOtherProducts.sort((a, b) => b.score - a.score);

    // 2A. Render Matching Pizzas (Exact 2-Column Pizza Card Grid Layout)
    if (pizzasGrid && matchingPizzas.length > 0) {
        pizzasGrid.innerHTML = matchingPizzas.map(({ item }) => {
            const isAvailable = item.available !== false;
            const outOfStockClass = isAvailable ? '' : 'out-of-stock';
            const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${typeof t === 'function' ? t('product_not_available') : 'This time product is not available'}</div>`;

            const ingredients = item.desc ? item.desc.split(/[,&]/).map(s => s.trim()).filter(Boolean) : [];
            const hasMoreThanFive = ingredients.length > 5;

            let descMarkup = '';
            if (hasMoreThanFive) {
                const shortText = ingredients.slice(0, 5).join(', ') + '...';
                const escFull = escapeHtml(item.desc);
                const escShort = escapeHtml(shortText);
                descMarkup = `<p class="pizza-card-desc" id="desc-${item.id}">
                    <span class="desc-text truncated" data-full="${escFull}" data-short="${escShort}">${shortText}</span>
                    <button class="more-btn" onclick="toggleIngredients('${item.id}', event)">More</button>
                   </p>`;
            } else {
                descMarkup = `<p class="pizza-card-desc" id="desc-${item.id}">
                    <span class="desc-text">${escapeHtml(item.desc || '')}</span>
                   </p>`;
            }

            const addBtnMarkup = isAvailable
                ? `<button class="pizza-add-cart-btn" onclick="addPizzaToCart('${item.id}', event)"><i class="fa-solid fa-cart-shopping"></i> ${typeof t === 'function' ? t('add_to_cart') : 'ADD TO CART'}</button>`
                : `<button class="pizza-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'OUT OF STOCK'}</button>`;

            const prices = item.prices || { S: 199, M: 299, L: 399 };
            const selectedSize = 'M';
            const basePrice = (prices && prices.M) || 299;
            const rates = getPizzaSizeAddonRates(selectedSize);
            const selectedAddons = cardSelectedAddons[item.id] || { cheese: false, spicy: false, mayo: false };
            const currentTotal = basePrice + (selectedAddons.cheese ? rates.extraCheese : 0) + (selectedAddons.spicy ? rates.extraSpicy : 0) + (selectedAddons.mayo ? rates.extraMayo : 0);

            const addonsMarkup = isAvailable ? `
                <div class="burger-addon-selector pizza-addon-selector">
                    <div class="addon-label burger-addon-label">ADD-<br>${typeof t === 'function' ? t('addons_label').replace(/^.*?-/, '') : 'ONS:'}</div>
                    <div class="burger-addon-options">
                        <button type="button" class="burger-addon-box ${selectedAddons.cheese ? 'selected active active-cheese' : ''}" id="box-cheese-${item.id}" data-addon="cheese" title="${typeof tAddon === 'function' ? tAddon('Extra Cheese') : 'Extra Cheese'} (+₹${rates.extraCheese})" onclick="togglePizzaAddon('${item.id}', 'cheese', event)">
                            🧀
                        </button>
                        <button type="button" class="burger-addon-box ${selectedAddons.spicy ? 'selected active active-spicy' : ''}" id="box-spicy-${item.id}" data-addon="spicy" title="${typeof tAddon === 'function' ? tAddon('Extra Spicy') : 'Extra Spicy'} (${rates.extraSpicy > 0 ? `+₹${rates.extraSpicy}` : (typeof t === 'function' ? t('addon_free') : 'Free')})" onclick="togglePizzaAddon('${item.id}', 'spicy', event)">
                            🌶️
                        </button>
                        <button type="button" class="burger-addon-box ${selectedAddons.mayo ? 'selected active active-mayo' : ''}" id="box-mayo-${item.id}" data-addon="mayo" title="${typeof tAddon === 'function' ? tAddon('Extra Mayo') : 'Extra Mayo'} (+₹${rates.extraMayo})" onclick="togglePizzaAddon('${item.id}', 'mayo', event)">
                            🍥
                        </button>
                    </div>
                </div>
            ` : '';

            return `
            <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${currentTotal}">
                ${outOfStockBadge}
                <div class="pizza-card-image-wrapper">
                    <img src="${item.img}" alt="${escapeHtml(item.name)}" class="pizza-card-img" loading="lazy">
                </div>
                <div class="pizza-card-body">
                    <h4 class="pizza-card-title" title="${escapeHtml(item.name)}"><span class="card-title-text">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span></h4>
                    ${descMarkup}
                    
                    <div class="pizza-size-selector">
                        <span class="size-label">${typeof t === 'function' ? t('size_label') : 'Size:'}</span>
                        <div class="size-options">
                            <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                            <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                            <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
                        </div>
                    </div>

                    ${addonsMarkup}
                    
                    <div class="pizza-price-row">
                        <span class="price-prefix">${typeof t === 'function' ? t('price_label') : 'Price:'}</span>
                        <span class="pizza-card-price" id="price-${item.id}">${formatPrice(currentTotal)}</span>
                    </div>
                </div>
                ${addBtnMarkup}
            </div>
            `;
        }).join('');

        if (pizzasWrapper) pizzasWrapper.style.display = 'block';
    } else {
        if (pizzasWrapper) pizzasWrapper.style.display = 'none';
    }

    // 2B. Render Matching Other Products (Burgers, Pastas, Drinks, Side Orders, etc.)
    if (productsGrid && matchingOtherProducts.length > 0) {
        productsGrid.innerHTML = matchingOtherProducts.map(({ item }) => {
            const isAvailable = item.available !== false;
            const outOfStockClass = isAvailable ? '' : 'out-of-stock';
            const outOfStockBadge = isAvailable ? '' : `<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> ${typeof t === 'function' ? t('product_not_available') : 'This time product is not available'}</div>`;

            const addBtnMarkup = isAvailable
                ? `<button class="add-subitem-btn" onclick="addToCart('${escapeHtml(item.name)}', ${item.price || 199}, '${item.img}')"><i class="fa-solid fa-plus"></i> ${typeof t === 'function' ? t('add_to_cart') : 'Add'}</button>`
                : `<button class="add-subitem-btn disabled" disabled><i class="fa-solid fa-ban"></i> ${typeof t === 'function' ? t('out_of_stock') : 'Out of Stock'}</button>`;

            return `
            <div class="sub-item-card ${outOfStockClass}">
                ${outOfStockBadge}
                <div class="sub-item-img-wrapper">
                    <img src="${item.img}" alt="${escapeHtml(item.name)}" class="sub-item-img" loading="lazy">
                </div>
                <div class="sub-item-details">
                    <div class="sub-item-top-row">
                        <span class="sub-item-name">${typeof tItem === 'function' ? tItem(item.name) : item.name}</span>
                        ${item.tag ? `<span class="sub-item-tag">${escapeHtml(item.tag)}</span>` : ''}
                    </div>
                    <p class="sub-item-desc">${escapeHtml(item.desc || '')}</p>
                    <div class="sub-item-bottom-row">
                        <span class="sub-item-price">${formatPrice(item.price || 199)}</span>
                        ${addBtnMarkup}
                    </div>
                </div>
            </div>
            `;
        }).join('');

        if (productsWrapper) productsWrapper.style.display = 'block';
    } else {
        if (productsWrapper) productsWrapper.style.display = 'none';
    }

    const totalMatches = matchingCategories.length + matchingPizzas.length + matchingOtherProducts.length;
    if (summaryEl) {
        summaryEl.textContent = `Found ${totalMatches} item(s) matching "${originalQuery}"`;
    }

    if (emptyState) {
        emptyState.style.display = totalMatches === 0 ? 'block' : 'none';
    }

    // Check marquee auto-scroll for matching pizza cards
    applyMarqueeToOverflowTitles();
}

function initCustomerSearchEvents() {
    const searchToggle = document.getElementById('search-toggle');
    const searchClear = document.getElementById('customer-search-clear');
    const searchInput = document.getElementById('customer-search-input');
    const closeViewBtn = document.getElementById('close-search-view-btn');

    if (searchToggle) {
        searchToggle.addEventListener('click', () => {
            const searchBar = document.getElementById('app-search-bar');
            if (searchBar && searchBar.style.display === 'block') {
                closeCustomerSearch();
            } else {
                openCustomerSearch();
            }
        });
    }

    if (searchClear) {
        searchClear.addEventListener('click', () => {
            closeCustomerSearch();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            handleCustomerSearch(e.target.value);
        });
    }

    if (closeViewBtn) {
        closeViewBtn.addEventListener('click', () => {
            closeCustomerSearch();
        });
    }
}

// --------------------------------------------------------------------------
// 9. CROSS-TAB LOCALSTORAGE SYNCHRONIZATION
// --------------------------------------------------------------------------
function setupLocalStorageSync() {
    window.addEventListener('storage', (e) => {
        // 1. Shop Status changed by Admin
        if (!e.key || e.key === SHOP_STATUS_KEY) {
            checkAndUpdateShopStatusUI();
            updateCartUI();
        }
        // 2. Thresholds or Zone Charges changed by Admin (Min Order, Free Delivery, Zones, Restaurant Coords, Delivery Radius)
        if (!e.key || e.key === MIN_ORDER_KEY || e.key === FREE_DELIVERY_KEY || e.key === ZONE_CHARGES_KEY || e.key === RESTAURANT_LAT_KEY || e.key === RESTAURANT_LNG_KEY || e.key === DELIVERY_RADIUS_KEY) {
            updateCartUI();
            updateProfileTotalsUI();
        }
        // 3. Menu changed by Admin
        if (!e.key || e.key === MENU_STORAGE_KEY) {
            if (lastCategoryState.categoryName && activeTabName === 'category-detail') {
                openCategoryDetail(lastCategoryState.categoryName, lastCategoryState.categoryImg, true, true);
            }
        }
        // 4. Orders changed by Staff or another tab
        if (!e.key || e.key === 'perfettoCustomerOrders') {
            if (activeTabName === 'profile') {
                updateProfileTotalsUI();
                renderOrderHistoryDetails();
            }
        }
        // 5. Customer Profile or Verified Phone changed
        if (!e.key || e.key === DELIVERY_PROFILE_KEY || e.key === VERIFIED_PHONE_STORAGE_KEY || e.key === VERIFIED_PHONE_STATE_KEY) {
            initPhoneVerificationState();
            updateCartUI();
            updateProfileTotalsUI();
        }
        // 6. Customer Care Phone or Visibility changed by Admin
        if (!e.key || e.key === CUSTOMER_CARE_PHONE_KEY || e.key === CUSTOMER_CARE_ENABLED_KEY) {
            updateCustomerCareModalUI();
        }
    });
}

// --------------------------------------------------------------------------
// 10. FIREBASE AUTHENTICATION & REAL-TIME FIRESTORE SYSTEM
// --------------------------------------------------------------------------
// 10. FIREBASE REAL-TIME FIRESTORE SYNCHRONIZATION SYSTEM
// --------------------------------------------------------------------------
let firebaseAuthInstance = null;
let currentUserProfile = null;
let customerFirestore = null;
let menuRealtimeUnsubscribe = null;
let settingsRealtimeUnsubscribe = null;

// Centralized Firebase Configuration for Real-time sync
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
  authDomain: "website-fa79c.firebaseapp.com",
  projectId: "website-fa79c",
  storageBucket: "website-fa79c.firebasestorage.app",
  messagingSenderId: "1070276115284",
  appId: "1:1070276115284:web:ebcb37d56f3af2a2d326c1",
  measurementId: "G-DT7MRXDMZ0"
};
const FIREBASE_CONFIG = firebaseConfig;
window.FIREBASE_CONFIG = firebaseConfig;

async function initFirebaseRealtimeSync() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps) {
            // 1. Initialize Firebase App
            if (!firebase.apps.length) {
                const config = window.FIREBASE_CONFIG || FIREBASE_CONFIG;
                firebase.initializeApp(config);
            }
            if (firebase.auth) {
                firebaseAuthInstance = firebase.auth();
            }

            // 2. Initialize Firestore Real-Time Listeners
            if (firebase.firestore) {
                customerFirestore = firebase.firestore();
                listenToRealtimeMenuAndRates();
                listenToCustomerActiveOrders();
            }
        }
    } catch (e) {
        console.warn('Firebase init notice:', e.message);
    }
}

let menuCollectionRealtimeUnsubscribe = null;

// Real-Time Listeners for Menu Items, Prices, Availability & Store Rates
function listenToRealtimeMenuAndRates() {
    if (!customerFirestore) return;

    // A1. Real-Time Full Menu Array & Rates (settings/menu document)
    if (!menuRealtimeUnsubscribe) {
        try {
            menuRealtimeUnsubscribe = customerFirestore.collection('settings').doc('menu').onSnapshot((doc) => {
                if (doc.exists && doc.data() && Array.isArray(doc.data().items) && doc.data().items.length > 0) {
                    if (doc.data().categoryAddons) {
                        try {
                            customerCategoryAddons = { ...DEFAULT_CATEGORY_ADDONS, ...doc.data().categoryAddons };
                            localStorage.setItem('perfetto_category_addons', JSON.stringify(customerCategoryAddons));
                        } catch (e) { }
                    }
                    const freshItems = sanitizeStoredMenuItems(doc.data().items) || doc.data().items;
                    try {
                        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(freshItems));
                    } catch (e) { }
                    syncCartWithLatestMenu(freshItems);
                    refreshActiveCustomerView(freshItems);
                    updateCartUI();
                }
            }, (err) => {
                console.warn('Firestore menu real-time notice:', err.message);
            });
        } catch (e) {
            console.warn('Error setting up menu real-time listener:', e);
        }
    }

    // A2. Real-Time Individual Item Stream (menu collection)
    if (!menuCollectionRealtimeUnsubscribe) {
        try {
            menuCollectionRealtimeUnsubscribe = customerFirestore.collection('menu').onSnapshot((snapshot) => {
                let currentItems = getStoredMenuItems();
                if (!Array.isArray(currentItems) || currentItems.length === 0) return;
                
                let updated = false;
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const itemId = String(data.id || change.doc.id);
                    const idx = currentItems.findIndex(i => i.id === itemId);
                    
                    if (idx !== -1) {
                        if (data.available !== undefined && currentItems[idx].available !== data.available) {
                            currentItems[idx].available = data.available;
                            updated = true;
                        }
                        if (data.price !== undefined && currentItems[idx].price !== data.price) {
                            currentItems[idx].price = data.price;
                            updated = true;
                        }
                        if (data.prices !== undefined && JSON.stringify(currentItems[idx].prices) !== JSON.stringify(data.prices)) {
                            currentItems[idx].prices = { ...currentItems[idx].prices, ...data.prices };
                            updated = true;
                        }
                    }
                });

                if (updated) {
                    try {
                        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(currentItems));
                    } catch (e) { }
                    syncCartWithLatestMenu(currentItems);
                    refreshActiveCustomerView(currentItems);
                    updateCartUI();
                }
            }, (err) => {
                console.warn('Firestore menu collection notice:', err.message);
            });
        } catch (e) {
            console.warn('Error setting up menu collection listener:', e);
        }
    }

    // B. Real-Time Store Settings & Service Rates (Delivery charge, Min order, Customer care)
    if (!settingsRealtimeUnsubscribe) {
        try {
            settingsRealtimeUnsubscribe = customerFirestore.collection('settings').doc('storeSettings').onSnapshot((doc) => {
                if (doc.exists && doc.data()) {
                    const data = doc.data();
                    if (data.minOrderValue !== undefined) localStorage.setItem(MIN_ORDER_KEY, String(data.minOrderValue));
                    if (data.freeDeliveryLimit !== undefined) localStorage.setItem(FREE_DELIVERY_KEY, String(data.freeDeliveryLimit));
                    if (data.customerCarePhone !== undefined) localStorage.setItem(CUSTOMER_CARE_PHONE_KEY, String(data.customerCarePhone));
                    if (data.customerCareEnabled !== undefined) localStorage.setItem(CUSTOMER_CARE_ENABLED_KEY, String(data.customerCareEnabled));
                    if (data.restaurantLat !== undefined) localStorage.setItem(RESTAURANT_LAT_KEY, String(data.restaurantLat));
                    if (data.restaurantLng !== undefined) localStorage.setItem(RESTAURANT_LNG_KEY, String(data.restaurantLng));
                    if (data.deliveryRadius !== undefined) localStorage.setItem(DELIVERY_RADIUS_KEY, String(data.deliveryRadius));
                    if (data.zoneCharges !== undefined) localStorage.setItem(ZONE_CHARGES_KEY, JSON.stringify(data.zoneCharges));
                    if (data.shopStatus !== undefined) localStorage.setItem(SHOP_STATUS_KEY, String(data.shopStatus));
                    if (data.openingTime !== undefined) localStorage.setItem(OPENING_TIME_KEY, String(data.openingTime));
                    if (data.closingTime !== undefined) localStorage.setItem(CLOSING_TIME_KEY, String(data.closingTime));
                    if (data.autoScheduleEnabled !== undefined) localStorage.setItem(AUTO_SCHEDULE_KEY, String(data.autoScheduleEnabled));
                    if (data.manualOverride !== undefined) localStorage.setItem(MANUAL_OVERRIDE_KEY, String(data.manualOverride));
                    if (data.manualCloseDate !== undefined) {
                        if (data.manualCloseDate) localStorage.setItem(MANUAL_CLOSE_DATE_KEY, String(data.manualCloseDate));
                        else localStorage.removeItem(MANUAL_CLOSE_DATE_KEY);
                    }

                    // Instantly apply updated rates & settings to customer UI
                    applyRealtimeStoreSettings();
                    checkAndUpdateShopStatusUI();
                }
            }, (err) => {
                console.warn('Firestore settings real-time notice:', err.message);
            });
        } catch (e) {
            console.warn('Error setting up settings real-time listener:', e);
        }
    }

    // B.2 Real-Time Daily Banners Sync ('settings/daily_banners')
    if (!bannersRealtimeUnsubscribe && customerFirestore) {
        try {
            bannersRealtimeUnsubscribe = customerFirestore.collection('settings').doc('daily_banners').onSnapshot((doc) => {
                let banners = DEFAULT_DAILY_BANNERS;
                if (doc.exists && doc.data() && Array.isArray(doc.data().banners) && doc.data().banners.length > 0) {
                    banners = doc.data().banners.slice(0, 4).map((b, i) => ({
                        id: b.id || `b${i + 1}`,
                        url: resolveBannerUrl(b.url),
                        enabled: b.enabled !== false
                    }));
                }
                localStorage.setItem('perfetto_daily_banners', JSON.stringify(banners));
                renderDynamicOfferSlider(banners);
            }, (err) => {
                console.warn('Firestore daily banners real-time notice:', err.message);
            });
        } catch (e) {
            console.warn('Error setting up daily banners real-time listener:', e);
        }
    }

    if (!walletConfigRealtimeUnsubscribe && customerFirestore) {
        try {
            walletConfigRealtimeUnsubscribe = customerFirestore.collection('settings').doc('wallet_config').onSnapshot((doc) => {
                if (doc.exists && doc.data()) {
                    const rawData = doc.data();
                    const clampedDays = getClampedCashbackExpiryDays(rawData);
                    customerWalletConfig = {
                        ...DEFAULT_WALLET_CONFIG,
                        ...rawData,
                        cashbackExpiryDays: clampedDays,
                        expiryDays: clampedDays
                    };
                    localStorage.setItem('perfetto_wallet_config', JSON.stringify(customerWalletConfig));
                    updateCartUI();
                    updateCheckoutWalletUI();
                    updateProfileWalletUI();
                    if (typeof renderOrderHistoryDetails === 'function') {
                        renderOrderHistoryDetails();
                    }
                }
            }, (err) => {
                console.warn('Firestore wallet_config real-time notice:', err.message);
            });
        } catch (e) {
            console.warn('Error setting up wallet_config real-time listener:', e);
        }
    }

    // B.4 Real-Time Store Notice Sync ('settings/store_notice')
    if (!storeNoticeRealtimeUnsubscribe && customerFirestore) {
        try {
            storeNoticeRealtimeUnsubscribe = customerFirestore.collection('settings').doc('store_notice').onSnapshot((doc) => {
                if (doc.exists && doc.data()) {
                    customerStoreNotice = {
                        ...DEFAULT_STORE_NOTICE,
                        ...doc.data()
                    };
                    localStorage.setItem('perfetto_store_notice', JSON.stringify(customerStoreNotice));
                    updateStoreNoticeUI();
                }
            }, (err) => {
                console.warn('Firestore store_notice real-time notice:', err.message);
            });
        } catch (e) {
            console.warn('Error setting up store_notice real-time listener:', e);
        }
    }
}

// C. Real-Time Listener for Customer Active Placed Orders
const customerOrdersUnsubscribeMap = new Map();

function listenToCustomerActiveOrders() {
    if (!customerFirestore) return;

    // 1. Listen to individual orders stored locally
    let storedOrders = [];
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            storedOrders = JSON.parse(stored) || [];
        }
    } catch (e) { }

    if (Array.isArray(storedOrders)) {
        storedOrders.forEach(o => {
            const orderId = String(o.id || o.orderId || '');
            if (!orderId || customerOrdersUnsubscribeMap.has(orderId)) return;

            try {
                const unsub = customerFirestore.collection('orders').doc(orderId).onSnapshot((doc) => {
                    if (doc.exists) {
                        const freshData = doc.data();
                        if (freshData) {
                            handleRealtimeCustomerOrderUpdate(orderId, freshData);
                        }
                    }
                }, (err) => {
                    console.warn(`Firestore order #${orderId} listener notice:`, err.message);
                });
                customerOrdersUnsubscribeMap.set(orderId, unsub);
            } catch (e) {
                console.warn(`Error attaching listener to order #${orderId}:`, e);
            }
        });
    }
}

function handleRealtimeCustomerOrderUpdate(orderId, freshOrderData) {
    try {
        let storedOrders = [];
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            storedOrders = JSON.parse(stored) || [];
        }

        let updated = false;
        let oldStatus = null;

        const target = storedOrders.find(o => String(o.id || o.orderId) === String(orderId));
        if (target) {
            oldStatus = target.status;
            if (freshOrderData.status && freshOrderData.status !== target.status) {
                target.status = freshOrderData.status;
                updated = true;
            }
            if (freshOrderData.deliveryOtp && freshOrderData.deliveryOtp !== target.deliveryOtp) {
                target.deliveryOtp = freshOrderData.deliveryOtp;
                updated = true;
            }
            if (freshOrderData.paymentStatus && freshOrderData.paymentStatus !== target.paymentStatus) {
                target.paymentStatus = freshOrderData.paymentStatus;
                updated = true;
            }
            if (freshOrderData.rewardStatus && freshOrderData.rewardStatus !== target.rewardStatus) {
                target.rewardStatus = freshOrderData.rewardStatus;
                updated = true;
            }
            if (freshOrderData.wonCashback && freshOrderData.wonCashback !== target.wonCashback) {
                target.wonCashback = freshOrderData.wonCashback;
                updated = true;
            }
            if (freshOrderData.scratchRevealed !== undefined && freshOrderData.scratchRevealed !== target.scratchRevealed) {
                target.scratchRevealed = freshOrderData.scratchRevealed;
                updated = true;
            }
            if (freshOrderData.scratchClaimed !== undefined && freshOrderData.scratchClaimed !== target.scratchClaimed) {
                target.scratchClaimed = freshOrderData.scratchClaimed;
                updated = true;
            }

            // Auto-credit pending delivery cashback if order transitioned to completed/delivered
            const isNowDelivered = (freshOrderData.status === 'completed' || freshOrderData.status === 'delivered');
            if (isNowDelivered) {
                const orderCashback = Number(target.wonCashback || target.earnedCashback || (target.scratchCard && (target.scratchCard.wonAmount || target.scratchCard.amount)) || 0);
                const isScratchClaimed = !!(target.scratchClaimed || (target.scratchCard && target.scratchCard.claimed));
                const isCardExpired = typeof isScratchCardExpired === 'function' ? isScratchCardExpired(target) : false;
                const isPendingDelivery = (target.rewardStatus === 'pending_delivery' || (target.scratchCard && target.scratchCard.status === 'pending_delivery') || target.scratchRevealed);

                if (isPendingDelivery && !isScratchClaimed && !isCardExpired && orderCashback > 0) {
                    target.scratchClaimed = true;
                    target.rewardStatus = 'credited';
                    if (target.scratchCard) {
                        target.scratchCard.claimed = true;
                        target.scratchCard.status = 'credited';
                        target.scratchCard.claimedAt = new Date().toISOString();
                    }
                    const phone = target.customerPhone || target.phone || ((currentUserProfile && currentUserProfile.phone) || '');
                    creditCustomerWallet(phone, orderCashback, target.id || target.orderId);
                    const isHindi = typeof getAppLanguage === 'function' && getAppLanguage() === 'hi';
                    showToast(isHindi 
                        ? `🎉 बधाई हो! ऑर्डर #${orderId} डिलीवर हो गया - ₹${orderCashback} कैशबैक आपके वॉलेट में जोड़ दिया गया है!` 
                        : `🎉 Order #${orderId} Delivered! ₹${orderCashback} Cashback has been credited to your wallet!`);
                    updated = true;
                }
            }
        } else {
            storedOrders.unshift({
                ...freshOrderData,
                id: orderId,
                orderId: orderId
            });
            updated = true;
        }

        if (updated) {
            localStorage.setItem('perfettoCustomerOrders', JSON.stringify(storedOrders));
            renderOrderHistoryDetails();
            updateProfileTotalsUI();
            updateProfileWalletUI();

            // Status notification toast if status changed
            if (oldStatus && freshOrderData.status && oldStatus !== freshOrderData.status) {
                const statusNames = {
                    'pending': 'Order Placed & Queued ⏳',
                    'preparing': 'Chef is Preparing your Pizza! 👨‍🍳🔥',
                    'out_for_delivery': 'Out for Delivery! 🛵💨',
                    'completed': 'Delivered & Verified! 🎉',
                    'rejected': 'Order Cancelled / Declined ❌'
                };
                const display = statusNames[freshOrderData.status] || freshOrderData.status.toUpperCase();
                showToast(`🔔 Order #${orderId}: ${display}`);
            }
        }
    } catch (e) {
        console.warn('Error applying live customer order update:', e);
    }
}

function applyRealtimeStoreSettings() {
    try {
        const phone = getCustomerCarePhone();
        const careEnabled = getCustomerCareEnabled();

        // Update header call button
        const headerCallBtn = document.getElementById('header-call-btn');
        if (headerCallBtn) {
            headerCallBtn.style.display = careEnabled ? 'inline-flex' : 'none';
        }

        // Update modal phone text and call link
        const phoneTextEl = document.getElementById('care-phone-number-text');
        const callLinkEl = document.getElementById('customer-care-call-link');
        if (phoneTextEl) {
            if (phone.length === 10) {
                phoneTextEl.textContent = `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
            } else {
                phoneTextEl.textContent = phone;
            }
        }
        if (callLinkEl) {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            callLinkEl.href = cleanPhone.length === 10 ? `tel:+91${cleanPhone}` : `tel:${cleanPhone}`;
        }

        // Backward-compatible updates for any legacy references
        const callBtn = document.getElementById('customer-care-btn');
        const phoneDisplay = document.getElementById('customer-care-number-display');
        if (callBtn) {
            callBtn.href = `tel:+91${phone}`;
            callBtn.style.display = careEnabled ? 'flex' : 'none';
        }
        if (phoneDisplay) {
            phoneDisplay.textContent = `+91 ${phone}`;
        }

        updateCartUI();
    } catch (e) {
        console.warn('Error applying live store settings:', e);
    }
}

// --------------------------------------------------------------------------
// 11. PHONEPE PAYMENT RETURN VERIFICATION (PAGE LOAD HOOK)
// --------------------------------------------------------------------------
async function checkPaymentReturnParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentReturn = urlParams.get('payment') === 'success';
    const orderId = urlParams.get('orderId');
    const txnId = urlParams.get('txnId');

    if (isPaymentReturn && orderId) {
        try {
            const statusRes = await fetch(resolveApiUrl(`/api/payment/status?orderId=${encodeURIComponent(orderId)}&txnId=${encodeURIComponent(txnId || '')}`));
            if (statusRes && statusRes.ok) {
                try {
                    await statusRes.json();
                } catch (jsonErr) { }
            }

            // Mark order as paid in LocalStorage
            try {
                const stored = localStorage.getItem('perfettoCustomerOrders');
                if (stored) {
                    const orders = JSON.parse(stored);
                    if (Array.isArray(orders)) {
                        const target = orders.find(o => (o.id || o.orderId) === orderId);
                        if (target) {
                            target.paymentStatus = 'Paid';
                            target.paymentMethod = 'PhonePe';
                            localStorage.setItem('perfettoCustomerOrders', JSON.stringify(orders));
                        }
                    }
                }
            } catch (storageErr) {
                console.warn('Error updating payment return order in localStorage:', storageErr);
            }

            // Clean URL query parameters without reloading
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            showToast(`🎉 Payment Verified! Order #${orderId} has been confirmed & sent to Kitchen.`);
            cart = [];
            saveCartToStorage();
            updateCartUI();
            updateProfileTotalsUI();
        } catch (e) {
            console.error('Error verifying payment return:', e);
        }
    }
}

function setupGlobalCustomerModalDismissals() {
    const modalDismissMap = [
        { id: 'customer-map-modal', dismiss: () => { if (typeof closeCustomerMapModal === 'function') closeCustomerMapModal(); } },
        { id: 'scratch-card-modal', dismiss: () => { if (typeof closeScratchCardModal === 'function') closeScratchCardModal(); } },
        { id: 'store-notice-modal', dismiss: () => { if (typeof closeStoreNoticeModal === 'function') closeStoreNoticeModal(); } },
        { id: 'checkout-modal', dismiss: () => { if (typeof closeCheckoutModal === 'function') closeCheckoutModal(); } },
        { id: 'profile-edit-modal', dismiss: () => { if (typeof closeEditProfileModal === 'function') closeEditProfileModal(); } },
        { id: 'order-otp-success-modal', dismiss: () => { if (typeof closeOrderOtpSuccessModal === 'function') closeOrderOtpSuccessModal(); } },
        { id: 'clear-history-confirm-modal', dismiss: () => { if (typeof closeClearHistoryModal === 'function') closeClearHistoryModal(); } },
        { id: 'logo-modal', dismiss: () => { if (typeof window.closeLogoModal === 'function') window.closeLogoModal(); } },
        { id: 'customer-care-modal', dismiss: () => { if (typeof window.closeCustomerCareModal === 'function') window.closeCustomerCareModal(); } }
    ];

    modalDismissMap.forEach(({ id, dismiss }) => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    dismiss();
                }
            });
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            for (const { id, dismiss } of modalDismissMap) {
                const modal = document.getElementById(id);
                if (modal) {
                    const isVisible = (modal.style.display && modal.style.display !== 'none') || modal.classList.contains('active') || modal.getAttribute('aria-hidden') === 'false';
                    if (isVisible) {
                        dismiss();
                        return;
                    }
                }
            }
        }
    });
}

// --------------------------------------------------------------------------
// INITIALIZATION ON DOM LOAD
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Setup universal backdrop and Escape key modal dismissals
    setupGlobalCustomerModalDismissals();

    // Initialize customer GPS coords from saved profile if available
    const savedProfile = getSavedDeliveryProfile();
    if (savedProfile && savedProfile.gpsLat !== null && savedProfile.gpsLng !== null) {
        currentCustomerGps = { lat: savedProfile.gpsLat, lng: savedProfile.gpsLng };
    }

    initTheme();
    setupNavigation();
    setupFastFoodCards();
    updateCartUI();
    renderDynamicOfferSlider();
    initLogoModal();
    initEditProfileModal();
    initClearHistoryModal();
    initCustomerCareModal();
    initOrderOtpSuccessModal();
    initScratchCardModal();
    setupHistoryState();
    initCustomerSearchEvents();
    checkAndUpdateShopStatusUI();
    initPhoneVerificationState();
    updateProfileTotalsUI();
    setupLocalStorageSync();
    initFirebaseRealtimeSync();
    initPhoneInputRestrictions();
    updateStoreNoticeUI();
    initStoreNoticeModal();
    if (typeof initFirstVisitLanguageModal === 'function') {
        initFirstVisitLanguageModal();
    }
    // 1. Initial live menu & settings fetch
    fetchLiveMenuFromBackend();
    fetchLiveSettingsFromBackend();

    // 2. Cross-Device Profile & Address Automatic Sync
    const effectiveSyncPhone = (savedProfile && savedProfile.phone) || getStoredVerifiedPhone();
    if (effectiveSyncPhone) {
        restoreUserProfileFromFirestore(effectiveSyncPhone);
    }

    const phoneInput = document.getElementById('customer-phone');
    if (phoneInput) {
        let lastRestoredPhone = '';
        const handlePhoneLookup = (e) => {
            const val = String(e.target.value || '').replace(/[^0-9]/g, '').slice(-10);
            if (val.length === 10 && val !== lastRestoredPhone) {
                lastRestoredPhone = val;
                restoreUserProfileFromFirestore(val);
            }
        };
        phoneInput.addEventListener('blur', handlePhoneLookup);
        phoneInput.addEventListener('input', handlePhoneLookup);
    }

    const checkoutPhoneInput = document.getElementById('checkout-phone');
    if (checkoutPhoneInput) {
        let lastRestoredCheckoutPhone = '';
        const handleCheckoutPhoneLookup = (e) => {
            const val = String(e.target.value || '').replace(/[^0-9]/g, '').slice(-10);
            if (val.length === 10 && val !== lastRestoredCheckoutPhone) {
                lastRestoredCheckoutPhone = val;
                restoreUserProfileFromFirestore(val);
            }
        };
        checkoutPhoneInput.addEventListener('blur', handleCheckoutPhoneLookup);
        checkoutPhoneInput.addEventListener('input', handleCheckoutPhoneLookup);
    }

    window.restoreUserProfileFromFirestore = restoreUserProfileFromFirestore;
    window.restoreCustomerFullProfileAndWallet = restoreUserProfileFromFirestore;

    // 2. Real-Time Background Polling (Every 3.5s for instant multi-device synchronization)
    const menuIntervalId = setInterval(fetchLiveMenuFromBackend, 3500);
    const settingsIntervalId = setInterval(fetchLiveSettingsFromBackend, 5000);

    // 3. Instant sync on tab focus or app visibility return (mobile apps / multi-tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            fetchLiveMenuFromBackend();
            fetchLiveSettingsFromBackend();
        }
    });
    window.addEventListener('focus', () => {
        fetchLiveMenuFromBackend();
        fetchLiveSettingsFromBackend();
    });
});

// --------------------------------------------------------------------------
// 12. CLEANUP & MEMORY LEAK PREVENTION (PAGE UNMOUNT / REFRESH)
// --------------------------------------------------------------------------
function cleanupAllCustomerListeners() {
    try {
        if (typeof menuRealtimeUnsubscribe === 'function') {
            menuRealtimeUnsubscribe();
            menuRealtimeUnsubscribe = null;
        }
        if (typeof menuCollectionRealtimeUnsubscribe === 'function') {
            menuCollectionRealtimeUnsubscribe();
            menuCollectionRealtimeUnsubscribe = null;
        }
        if (typeof settingsRealtimeUnsubscribe === 'function') {
            settingsRealtimeUnsubscribe();
            settingsRealtimeUnsubscribe = null;
        }
        if (typeof storeNoticeRealtimeUnsubscribe === 'function') {
            storeNoticeRealtimeUnsubscribe();
            storeNoticeRealtimeUnsubscribe = null;
        }
        if (customerOrdersUnsubscribeMap && customerOrdersUnsubscribeMap.size > 0) {
            customerOrdersUnsubscribeMap.forEach((unsub) => {
                if (typeof unsub === 'function') {
                    try { unsub(); } catch (e) { }
                }
            });
            customerOrdersUnsubscribeMap.clear();
        }
    } catch (e) {
        console.warn('Error during customer listener cleanup:', e);
    }
}

window.addEventListener('beforeunload', cleanupAllCustomerListeners);
window.addEventListener('pagehide', cleanupAllCustomerListeners);

// Global Error & Promise Rejection Safety Boundaries
window.addEventListener('unhandledrejection', (event) => {
    console.warn('🛡️ [Perfetto App] Unhandled Promise Rejection intercepted:', event.reason);
    if (event.reason && (event.reason.message?.includes('Failed to fetch') || event.reason.message?.includes('NetworkError') || event.reason.name === 'AbortError')) {
        event.preventDefault(); // Suppress harmless network connection aborts
    }
});

window.addEventListener('error', (event) => {
    console.warn('🛡️ [Perfetto App] Runtime Error intercepted:', event.message);
});

// --------------------------------------------------------------------------
// 13. GLOBAL WINDOW EXPORTS FOR RELIABLE INLINE HTML EVENT HANDLING
// --------------------------------------------------------------------------
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.toggleOrderHistoryView = toggleOrderHistoryView;
window.clearCustomerOrderHistory = clearCustomerOrderHistory;
window.closeClearHistoryModal = closeClearHistoryModal;
window.confirmClearCustomerOrderHistory = confirmClearCustomerOrderHistory;
window.toggleSavedAddressesView = toggleSavedAddressesView;
window.editSavedAddress = editSavedAddress;
window.toggleLegalInfoView = toggleLegalInfoView;
window.clearCart = clearCart;
window.processCheckout = processCheckout;
window.closeCustomerSearch = closeCustomerSearch;
window.openCustomerSearch = openCustomerSearch;
window.switchTab = switchTab;
window.handleChangePhoneNumber = handleChangePhoneNumber;
window.handleRequestOtp = handleRequestOtp;
window.handleVerifyOtp = handleVerifyOtp;
window.openCustomerMapModal = openCustomerMapModal;
window.closeCustomerMapModal = closeCustomerMapModal;
window.closeCheckoutModal = closeCheckoutModal;
window.handleEditAddressFromCheckout = handleEditAddressFromCheckout;
window.handleConfirmAddressForCheckout = handleConfirmAddressForCheckout;
window.handleSelectCodPayment = handleSelectCodPayment;
window.handleSelectOnlinePayment = handleSelectOnlinePayment;
window.copyDeliveryOtpToClipboard = copyDeliveryOtpToClipboard;
window.viewOrderHistoryFromOtpModal = viewOrderHistoryFromOtpModal;
window.closeOrderOtpSuccessModal = closeOrderOtpSuccessModal;
window.handleDetectLiveGps = handleDetectLiveGps;
window.handleConfirmMapLocation = handleConfirmMapLocation;
window.cleanupAllCustomerListeners = cleanupAllCustomerListeners;
window.openStoreNoticeModal = openStoreNoticeModal;
window.closeStoreNoticeModal = closeStoreNoticeModal;
window.updateStoreNoticeUI = updateStoreNoticeUI;
window.openCategoryDetail = openCategoryDetail;
window.openScratchCardModal = openScratchCardModal;
window.closeScratchCardModal = closeScratchCardModal;
window.openScratchCardForOrder = openScratchCardForOrder;
window.openFirstUnclaimedScratchCard = openFirstUnclaimedScratchCard;
window.handleClaimScratchReward = handleClaimScratchReward;
window.triggerScratchCelebrationConfetti = triggerScratchCelebrationConfetti;
