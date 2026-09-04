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

// Price Formatter Helper: Whole numbers only (e.g. ₹299)
function formatPrice(amount) {
    return `₹${Math.round(amount)}`;
}

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
        const direct = localStorage.getItem(VERIFIED_PHONE_STORAGE_KEY) || sessionStorage.getItem(VERIFIED_PHONE_STORAGE_KEY);
        if (direct && typeof direct === 'string') {
            const clean = direct.replace(/[^0-9]/g, '').slice(-10);
            if (clean.length === 10) return clean;
        }

        // 2. Check structured verified phone state object
        const rawState = localStorage.getItem(VERIFIED_PHONE_STATE_KEY);
        if (rawState) {
            const parsed = JSON.parse(rawState);
            if (parsed && parsed.isVerified && parsed.phone) {
                const clean = String(parsed.phone).replace(/[^0-9]/g, '').slice(-10);
                if (clean.length === 10) return clean;
            }
        }

        // 3. Check delivery profile if marked isVerified
        const rawProfile = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (rawProfile) {
            const parsed = JSON.parse(rawProfile);
            if (parsed && parsed.isVerified && parsed.phone) {
                const clean = String(parsed.phone).replace(/[^0-9]/g, '').slice(-10);
                if (clean.length === 10) return clean;
            }
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
            localStorage.setItem(VERIFIED_PHONE_STORAGE_KEY, cleanPhone);
            sessionStorage.setItem(VERIFIED_PHONE_STORAGE_KEY, cleanPhone);
            localStorage.setItem(VERIFIED_PHONE_STATE_KEY, JSON.stringify({
                phone: cleanPhone,
                isVerified: true,
                verifiedAt: new Date().toISOString()
            }));

            // Sync with existing delivery profile if present
            const stored = localStorage.getItem(DELIVERY_PROFILE_KEY);
            if (stored) {
                const profile = JSON.parse(stored);
                if (profile && typeof profile === 'object') {
                    profile.phone = cleanPhone;
                    profile.isVerified = true;
                    localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(profile));
                }
            }
        } else {
            localStorage.removeItem(VERIFIED_PHONE_STORAGE_KEY);
            sessionStorage.removeItem(VERIFIED_PHONE_STORAGE_KEY);
            localStorage.removeItem(VERIFIED_PHONE_STATE_KEY);

            const stored = localStorage.getItem(DELIVERY_PROFILE_KEY);
            if (stored) {
                const profile = JSON.parse(stored);
                if (profile && typeof profile === 'object') {
                    profile.isVerified = false;
                    localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(profile));
                }
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
    try {
        const stored = localStorage.getItem(CART_STORAGE_KEY);
        if (stored !== null) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Failed to load cart from localStorage:', e);
    }
    return [];
}

function saveCartToStorage() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {
        console.warn('Failed to save cart to localStorage:', e);
    }
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
        { name: "Classic Sparkling Cola", desc: "Ice cold refreshing fizzy beverage", price: 60.00, tag: "Chilled" },
        { name: "Zero Sugar Cola", desc: "Zero calories, same refreshing taste", price: 60.00, tag: "Diet" },
        { name: "Citrus Lime Fizz", desc: "Zesty lemon lime sparkling drink", price: 70.00, tag: "Popular" }
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
    ]
};

const MENU_STORAGE_KEY = 'menuData';

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
                const normalized = doc.data().banners.map((b, i) => ({
                    id: b.id || `b${i + 1}`,
                    url: resolveBannerUrl(b.url)
                })).slice(0, 7);
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
                const normalized = data.banners.map((b, i) => ({
                    id: b.id || `b${i + 1}`,
                    url: resolveBannerUrl(b.url)
                })).slice(0, 7);
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

    const titleText = categoryName.toLowerCase().includes('menu') ? categoryName : `${categoryName} Menu`;
    if (heroTitleEl) heroTitleEl.textContent = titleText;
    if (heroImgEl) heroImgEl.src = categoryImg;
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
                const selectedSize = 'M';
                const basePrice = (prices && prices.M) || 299;
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
                <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${currentTotal}">
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
                                <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                                <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                                <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
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
        } else {
            subItemsGrid.classList.remove('pizza-grid-container');
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
            '.pizza-card-title, .burger-card-title, .wrap-card-title, .bread-card-title, .sandwich-card-title, .momos-card-title, .pasta-card-title, .chinese-card-title, .shake-card-title, .rice-card-title, .coffee-card-title, .noodles-card-title, .desserts-card-title'
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

    if (subtotal < minOrderVal) {
        // CONDITION A: Below Minimum Order Value
        const diff = (minOrderVal - subtotal).toFixed(2);
        banner.className = 'cart-threshold-banner status-below-min';
        content.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Minimum order is ${formatPrice(minOrderVal)}. Add ${formatPrice(diff)} more to place your order.</span>
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
            <span>Add ${formatPrice(diff)} more to get FREE Home Delivery!</span>
        `;
        if (checkoutBtn && !isShopClosed) {
            checkoutBtn.removeAttribute('disabled');
        }
    } else {
        // CONDITION C: Free Delivery Unlocked!
        banner.className = 'cart-threshold-banner status-unlocked-free';
        content.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>Congratulations! You have unlocked FREE Delivery.</span>
        `;
        if (checkoutBtn && !isShopClosed) {
            checkoutBtn.removeAttribute('disabled');
        }
    }
}

// REAL-TIME CROSS-TAB STORAGE SYNCHRONIZATION
window.addEventListener('storage', (e) => {
    if (!e.key || e.key === SHOP_STATUS_KEY || e.key === OPENING_TIME_KEY || e.key === CLOSING_TIME_KEY || e.key === AUTO_SCHEDULE_KEY || e.key === MANUAL_OVERRIDE_KEY) {
        checkAndUpdateShopStatusUI();
    }
    if (!e.key || e.key === MIN_ORDER_KEY || e.key === FREE_DELIVERY_KEY) {
        updateCartUI();
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
                <h4>Your cart is empty</h4>
                <p>Browse categories on Home and add items to your cart!</p>
            </div>
        `;
    } else {
        cartContainer.innerHTML = cart.map((item, index) => {
            const hasAddons = Array.isArray(item.addons) && item.addons.length > 0;
            const addonTagsMarkup = hasAddons
                ? `<div class="cart-addons-tags">${item.addons.map(a => {
                    const rawName = typeof a === 'string' ? a : (a.name || '');
                    const aName = rawName.replace(/^\+\s*/, '').trim();
                    const isMayo = aName.toLowerCase().includes('mayo');
                    const hasIcon = aName.startsWith('🧀') || aName.startsWith('🌶️') || aName.startsWith('🍥');
                    const icon = hasIcon ? '' : (aName.toLowerCase().includes('cheese') ? '🧀 ' : (aName.toLowerCase().includes('spicy') ? '🌶️ ' : (isMayo ? '🍥 ' : '')));
                    return `<span class="cart-addon-pill ${isMayo ? 'cart-addon-mayo' : ''}">${icon}${aName}</span>`;
                }).join('')}</div>`
                : '';

            return `
            <div class="cart-item-card">
                <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h5 class="cart-item-name">${item.baseName || item.name}</h5>
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

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal);

    let delivery = 0.00;
    if (cart.length > 0) {
        delivery = deliveryInfo.finalDeliveryFee;
    }

    const total = subtotal + delivery;

    const subtotalEl = document.getElementById('cart-subtotal');
    const deliveryEl = document.getElementById('cart-delivery');
    const totalEl = document.getElementById('cart-total');

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

    if (deliveryEl) {
        if (cart.length > 0 && deliveryInfo.isFreeDelivery) {
            if (deliveryInfo.baseDeliveryFee > 0) {
                deliveryEl.innerHTML = `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.85rem; margin-right: 4px;">${formatPrice(deliveryInfo.baseDeliveryFee)}</span><span class="free-delivery-tag">FREE</span>`;
            } else {
                deliveryEl.innerHTML = `<span class="free-delivery-tag">FREE</span>`;
            }
        } else if (cart.length > 0) {
            if (delivery === 0) {
                deliveryEl.innerHTML = `<span class="free-delivery-tag">FREE</span>`;
            } else {
                deliveryEl.textContent = formatPrice(delivery);
            }
        } else {
            deliveryEl.textContent = formatPrice(0);
        }
    }

    if (totalEl) totalEl.textContent = formatPrice(total);

    // 4. Update Cart Threshold Banner & Checkout Button State
    updateCartThresholdBanner(subtotal, minOrderVal, freeDeliveryLim);

    // 5. Ensure shop closed state overrides if shop is closed
    checkAndUpdateShopStatusUI();

    // 6. Update Sticky Floating Cart Pill Bar
    updateFloatingCartBar();
}

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
            countBadge.textContent = `${totalCount} ITEM${totalCount !== 1 ? 'S' : ''}`;
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
        const stored = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (stored) {
            const profile = JSON.parse(stored);
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

    const itemCount = cart.reduce((sum, item) => sum + (item.qty || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const customCoords = (profile && profile.gpsLat !== undefined && profile.gpsLng !== undefined && profile.gpsLat !== null && profile.gpsLng !== null)
        ? { lat: parseFloat(profile.gpsLat), lng: parseFloat(profile.gpsLng) }
        : null;
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal, customCoords);
    const deliveryFee = deliveryInfo.finalDeliveryFee;
    const grandTotal = subtotal + deliveryFee;

    // 1. Update Order Summary inside Checkout Modal
    const itemCountEl = document.getElementById('checkout-item-count');
    const subtotalEl = document.getElementById('checkout-subtotal');
    const deliveryEl = document.getElementById('checkout-delivery');
    const totalEl = document.getElementById('checkout-total');

    if (itemCountEl) itemCountEl.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (deliveryEl) {
        if (deliveryInfo.isFreeDelivery) {
            if (deliveryInfo.baseDeliveryFee > 0) {
                deliveryEl.innerHTML = `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.82rem; margin-right: 4px;">${formatPrice(deliveryInfo.baseDeliveryFee)}</span><span class="free-delivery-tag">FREE</span>`;
            } else {
                deliveryEl.innerHTML = `<span class="free-delivery-tag">FREE</span>`;
            }
        } else if (deliveryFee === 0) {
            deliveryEl.innerHTML = `<span class="free-delivery-tag">FREE</span>`;
        } else {
            deliveryEl.textContent = formatPrice(deliveryFee);
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

    // Reset Address confirmation state & hide payment alert
    isCheckoutAddressConfirmed = false;
    const confirmBtn = document.getElementById('btn-confirm-address-action');
    const paymentSection = document.getElementById('checkout-payment-section');
    const onlineAlert = document.getElementById('online-payment-alert');

    if (confirmBtn) {
        confirmBtn.className = 'btn-confirm-address-action';
        confirmBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirm Address';
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
        confirmBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Address Confirmed ✓';
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
    const grandTotal = subtotal + deliveryFee;

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
        total: Math.round(grandTotal),
        paymentMethod: paymentMethod,
        paymentStatus: paymentStatus,
        status: 'new',
        createdAt: now.toISOString()
    };

    // 1. Save order to LocalStorage (Immediate Offline Resilience)
    let ordersList = [];
    try {
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        if (storedOrders) {
            ordersList = JSON.parse(storedOrders) || [];
        }
        // Check if order already exists in list (e.g. updating status)
        const existingIndex = ordersList.findIndex(o => (o.id || o.orderId) === orderId);
        if (existingIndex >= 0) {
            ordersList[existingIndex] = newOrder;
        } else {
            ordersList.unshift(newOrder);
        }
        localStorage.setItem('perfettoCustomerOrders', JSON.stringify(ordersList));
    } catch (e) {
        console.error('Error saving order to localStorage:', e);
    }

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

    const firestoreOrderPayload = {
        ...order,
        id: finalOrderId,
        orderId: finalOrderId,
        customerPhone: cleanCustomerPhone,
        phone: cleanCustomerPhone,
        status: order.status || 'pending',
        createdAt: order.createdAt || new Date().toISOString(),
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

function openOrderOtpSuccessModal(order) {
    const modal = document.getElementById('order-otp-success-modal');
    if (!modal) return;

    const orderId = order.orderId || order.id || '--';
    const otp = String(order.deliveryOtp || order.otp || '0000');
    activeOrderDeliveryOtp = otp;

    const orderIdEl = document.getElementById('otp-modal-order-id');
    const digitsContainer = document.getElementById('otp-modal-digits-display');
    const paymentModeEl = document.getElementById('otp-modal-payment-mode');
    const totalAmountEl = document.getElementById('otp-modal-total-amount');
    const copyBtnText = document.getElementById('copy-otp-btn-text');

    if (orderIdEl) orderIdEl.textContent = `#${orderId}`;
    if (paymentModeEl) paymentModeEl.textContent = order.paymentMethod || order.paymentStatus || 'Cash on Delivery';
    if (totalAmountEl) totalAmountEl.textContent = `₹${order.total || 0}`;
    if (copyBtnText) copyBtnText.textContent = 'Copy OTP';

    // Render individual glowing digit boxes
    if (digitsContainer) {
        digitsContainer.innerHTML = otp.split('').map(d => `<span class="otp-digit-box">${d}</span>`).join('');
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

function closeOrderOtpSuccessModal() {
    const modal = document.getElementById('order-otp-success-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('modal-open');
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
    }, 150);
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
        cartState: cart || []
    };

    // 1. Instantly write to Firestore client SDK if available
    if (customerFirestore) {
        try {
            if (cleanEmail) {
                customerFirestore.collection('users').doc(cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')).set(userPayload, { merge: true }).catch(() => { });
            }
            if (cleanPhone) {
                customerFirestore.collection('users').doc(`phone_${cleanPhone}`).set(userPayload, { merge: true }).catch(() => { });
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

// Cross-Device Profile & Address Automatic Retrieval
async function restoreUserProfileFromFirestore(emailOrPhone) {
    if (!emailOrPhone) return null;
    const identifier = String(emailOrPhone).trim();
    const isEmail = identifier.includes('@');
    const param = isEmail ? `email=${encodeURIComponent(identifier.toLowerCase())}` : `phone=${encodeURIComponent(identifier.replace(/[^0-9]/g, '').slice(-10))}`;

    try {
        const response = await apiCall(`/users?${param}`);
        if (!response.ok) {
            return null;
        }
        const data = await response.json();

        if (data && data.success && data.user) {
            const u = data.user;
            const isVerified = u.isPhoneVerified !== false;

            const lat = (u.gps && u.gps.lat !== undefined && u.gps.lat !== null) ? parseFloat(u.gps.lat) : ((u.gpsLat !== undefined && u.gpsLat !== null) ? parseFloat(u.gpsLat) : null);
            const lng = (u.gps && u.gps.lng !== undefined && u.gps.lng !== null) ? parseFloat(u.gps.lng) : ((u.gpsLng !== undefined && u.gpsLng !== null) ? parseFloat(u.gpsLng) : null);

            // Check if user currently has local custom coordinates saved in this session
            const currentLocalProfile = getSavedDeliveryProfile();
            const hasLocalGps = currentLocalProfile && currentLocalProfile.gpsLat !== null && currentLocalProfile.gpsLng !== null;

            const restoredProfile = {
                fullName: u.fullName || '',
                email: u.email || '',
                phone: u.phone || '',
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

            renderProfileHeaderAndInputs(restoredProfile);
            updateProfileTotalsUI();
            updateCartUI();

            console.log('✅ User profile successfully restored across devices from Firebase Firestore:', restoredProfile.fullName);
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
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        if (storedOrders) {
            const orders = JSON.parse(storedOrders);
            if (Array.isArray(orders) && orders.length > 0) {
                if (clearBtn) clearBtn.style.display = 'inline-flex';
                listEl.innerHTML = orders.map(o => {
                    const otpCode = o.deliveryOtp || o.otp || '';
                    const isDelivered = o.status === 'completed';
                    const isCancelled = o.status === 'rejected';
                    const itemsText = (o.items || []).map(i => escapeHtml(i.name)).join(', ');

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

                        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 700; border-top: 1px dashed var(--border-color); padding-top: 8px; margin-top: 4px;">
                            <span>Status: <span style="color: ${isDelivered ? '#22c55e' : isCancelled ? '#ef4444' : '#f59e0b'}; text-transform: uppercase;">${escapeHtml(o.status)}</span></span>
                            <span style="color: var(--primary-orange);">₹${o.total || (o.costs && o.costs.total) || 0}</span>
                        </div>
                    </div>
                `}).join('');
                return;
            }
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
// 8. DAILY BANNERS DATA & FALLBACK LOGO SYSTEM (SEAMLESS AUTO-CAROUSEL)
// --------------------------------------------------------------------------
const DEFAULT_FALLBACK_BANNER_LOGO = 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';
const DEFAULT_DAILY_BANNERS = [
    { id: 'b1', url: 'https://i.ibb.co/GQtdNF4v/free-cold-drink.png' },
    { id: 'b2', url: 'https://i.ibb.co/kVpH7yM2/free-kitkat-shake.png' },
    { id: 'b3', url: 'https://i.ibb.co/VYqnBKbM/free-medium-pizza.png' }
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
    let banners = customBanners;
    if (!Array.isArray(banners) || banners.length === 0) {
        try {
            const saved = localStorage.getItem('perfetto_daily_banners');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    banners = parsed;
                }
            }
        } catch (e) { }
    }
    if (!Array.isArray(banners) || banners.length === 0) {
        banners = DEFAULT_DAILY_BANNERS;
    }
    if (banners.length > 7) banners = banners.slice(0, 7);

    const track = document.getElementById('offer-slider-track');
    const dotsContainer = document.getElementById('offer-dots');
    if (!track || !dotsContainer) return;

    if (currentOfferSlideIndex >= banners.length) {
        currentOfferSlideIndex = 0;
    }

    // Render track slides dynamically for all banners
    track.innerHTML = banners.map((banner, idx) => {
        const safeUrl = resolveBannerUrl(banner.url);
        return `
            <div class="offer-slide" data-banner-id="${banner.id || ('b' + (idx + 1))}" data-slide-index="${idx}">
                <img src="${safeUrl}" alt="Daily Offer ${idx + 1}" class="offer-img" onerror="handleBannerImgError(this)">
            </div>
        `;
    }).join('');

    // Render pagination dots for all banners
    dotsContainer.innerHTML = banners.map((_, idx) => 
        `<span class="dot ${idx === currentOfferSlideIndex ? 'active' : ''}" data-index="${idx}"></span>`
    ).join('');

    initOfferSlider();
}
window.renderDynamicOfferSlider = renderDynamicOfferSlider;

function initOfferSlider() {
    const wrapper = document.getElementById('offer-slider-wrapper');
    const track = document.getElementById('offer-slider-track');
    const dotsContainer = document.getElementById('offer-dots');
    if (!wrapper || !track || !dotsContainer) return;

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
    if (totalSlides <= 1) {
        track.style.transform = 'translateX(0%)';
        track.style.transition = 'none';
        return;
    }

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
        }, 3000); // 3 seconds autoplay
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
        // Wait 6 seconds idle cooldown before resuming 3-second autoplay
        offerSliderPauseTimeout = setTimeout(() => {
            startAutoScroll();
        }, 6000);
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
    }

    function onMove(clientX) {
        if (!isDragging) return;
        currentX = clientX;
    }

    function onEnd() {
        if (!isDragging) return;
        isDragging = false;
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
            handleUserInteractionEnd();
        }
    };

    // Start initial 3-second autoplay
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
            const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';

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
                    <span class="desc-text">${item.desc || ''}</span>
                   </p>`;
            }

            const addBtnMarkup = isAvailable
                ? `<button class="pizza-add-cart-btn" onclick="addPizzaToCart('${item.id}', event)"><i class="fa-solid fa-cart-shopping"></i> ADD TO CART</button>`
                : `<button class="pizza-add-cart-btn disabled" disabled><i class="fa-solid fa-ban"></i> OUT OF STOCK</button>`;

            const prices = item.prices || { S: 199, M: 299, L: 399 };
            const selectedSize = 'M';
            const basePrice = (prices && prices.M) || 299;
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
            <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${currentTotal}">
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
                            <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                            <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                            <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
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

        if (pizzasWrapper) pizzasWrapper.style.display = 'block';
    } else {
        if (pizzasWrapper) pizzasWrapper.style.display = 'none';
    }

    // 2B. Render Matching Other Products (Burgers, Pastas, Drinks, Side Orders, etc.)
    if (productsGrid && matchingOtherProducts.length > 0) {
        productsGrid.innerHTML = matchingOtherProducts.map(({ item }) => {
            const isAvailable = item.available !== false;
            const outOfStockClass = isAvailable ? '' : 'out-of-stock';
            const outOfStockBadge = isAvailable ? '' : '<div class="out-of-stock-badge"><i class="fa-solid fa-circle-exclamation"></i> This time product is not available</div>';

            const addBtnMarkup = isAvailable
                ? `<button class="add-subitem-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price || 199}, '${item.img}')"><i class="fa-solid fa-plus"></i> Add</button>`
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
                    <p class="sub-item-desc">${item.desc || ''}</p>
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
                    banners = doc.data().banners.map((b, i) => ({
                        id: b.id || `b${i + 1}`,
                        url: resolveBannerUrl(b.url)
                    })).slice(0, 7);
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

// --------------------------------------------------------------------------
// INITIALIZATION ON DOM LOAD
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
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
    setupHistoryState();
    initCustomerSearchEvents();
    checkAndUpdateShopStatusUI();
    initPhoneVerificationState();
    updateProfileTotalsUI();
    setupLocalStorageSync();
    initFirebaseRealtimeSync();
    initPhoneInputRestrictions();
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
        phoneInput.addEventListener('blur', (e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (val.length === 10) {
                restoreUserProfileFromFirestore(val);
            }
        });
    }

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
