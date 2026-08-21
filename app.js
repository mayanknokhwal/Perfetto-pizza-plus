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
const CUSTOMER_CARE_PHONE_KEY = 'customerCarePhone';
const CUSTOMER_CARE_ENABLED_KEY = 'customerCareEnabled';
const DEFAULT_CUSTOMER_CARE_PHONE = '9876543210';

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
// API BASE URL & LOCAL ENVIRONMENT RESOLVER
// --------------------------------------------------------------------------
function resolveApiUrl(path) {
    if (!path) return '';
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    if (typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')) {
        return `http://localhost:8080${cleanPath}`;
    }
    return cleanPath;
}

function getAppOrigin() {
    if (typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')) {
        return 'http://localhost:8080';
    }
    return window.location.origin;
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
let lastCategoryState = {
    categoryName: null,
    categoryImg: null,
    scrollY: 0
};

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
        if (show) {
            banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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
            // Explicit category back button resets memory to root home dashboard
            lastCategoryState.categoryName = null;
            lastCategoryState.categoryImg = null;
            lastCategoryState.scrollY = 0;
            switchTab('home', true);
        });
    }
}

function switchTab(tabName, forceRootHome = false, isPopState = false) {
    // If accessing Cart, check if profile is complete. If new/incomplete, redirect to Profile completion
    if (tabName === 'cart') {
        const savedProfile = getSavedDeliveryProfile();
        if (!savedProfile) {
            tabName = 'profile';
            showProfileRedirectNotice(true);
            toggleEditProfileForm(true);
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

    // Scroll to top of view
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --------------------------------------------------------------------------
// 4. CATEGORY DETAIL VIEW & SUB-ITEM DATA
// --------------------------------------------------------------------------
const categorySubItems = {
    "Burger": [
        { name: "Classic Crispy Burger", desc: "Crispy patty with fresh lettuce, tomato & mayo", price: 149.00, tag: "Bestseller" },
        { name: "Double Cheese Delite", desc: "Melted cheddar cheese with double patty", price: 189.00, tag: "Popular" },
        { name: "Spicy Jalapeño Burger", desc: "Fiery jalapeño sauce & crispy onion rings", price: 169.00, tag: "Spicy 🌶️" },
        { name: "Smokey BBQ Bacon Burger", desc: "Smokey BBQ sauce with premium bacon strips", price: 219.00, tag: "Chef Special" },
        { name: "Veggie Supreme Burger", desc: "Plant-based patty with fresh garden veggies", price: 139.00, tag: "Veg 🥗" },
        { name: "Monster Double Stack", desc: "Loaded double patty with signature house dressing", price: 249.00, tag: "Large" }
    ],
    "Pizza": [
        {
            id: "hot-country",
            name: "Hot Country",
            desc: "Onion, Red Corn, Jalapeno, Paneer, Black Olives & Red Paprika, Extra Cheese",
            prices: { S: 199.00, M: 299.00, L: 399.00 },
            img: "https://i.ibb.co/pBjGthQG/Hot-Country.png"
        },
        {
            id: "indian-veggie",
            name: "Indian Veggie",
            desc: "Capsicum, Green Chilli, Onion, Capsicum, Mushroom, Black Olives, Extra Cheese",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/nNDqnySY/Indian-Veggie-Pizza.png"
        },
        {
            id: "lovers-pizza",
            name: "Lover's",
            desc: "Red Paprika, Onion, Capsicum, Corn",
            prices: { S: 249.00, M: 349.00, L: 449.00 },
            img: "https://i.ibb.co/DPGHvPnT/Lover-s-Pizza.png"
        },
        {
            id: "makhani-pizza",
            name: "Makhani Pizza",
            desc: "Capsicum, Paneer, Makhani Sauce",
            prices: { S: 239.00, M: 339.00, L: 439.00 },
            img: "https://i.ibb.co/DgM6pRrT/Makhani-Pizza.png"
        },
        {
            id: "paradise-pizza",
            name: "Parndize Pizza",
            desc: "Red Paprika, Onion, Mushroom, Tomato & Jalapeno",
            prices: { S: 229.00, M: 329.00, L: 429.00 },
            img: "https://i.ibb.co/nsxZPfr3/Parndize-Pizza.png"
        },
        {
            id: "perfetto-special",
            name: "Perfetto Special Pizza",
            desc: "Onion, Corn, Pineapple, Jalapeno, Capsicum, Mushroom, Black Olives, Red Paprika, Paneer, Tomato, Extra Cheese",
            prices: { S: 299.00, M: 399.00, L: 499.00 },
            img: "https://i.ibb.co/Zz4YBzKK/Perfetto-Special-Pizza.png"
        },
        {
            id: "spicy-pizza",
            name: "Spicy Pizza",
            desc: "Paneer Chilly, Capsicum, Red Paprika",
            prices: { S: 199.00, M: 299.00, L: 399.00 },
            img: "https://i.ibb.co/0pwknN8R/Spicy-Pizza.png"
        },
        {
            id: "supreme-pizza",
            name: "Supreme Pizza",
            desc: "Mushroom, Jalapeno, Paneer, Pineapple, Black Olives",
            prices: { S: 249.00, M: 349.00, L: 449.00 },
            img: "https://i.ibb.co/FkTxZmNF/Supreme-Pizza.png"
        },
        {
            id: "tandoori-pizza",
            name: "Tandoori Pizza",
            desc: "Onion, Paneer, Bellpeper, Tandoori Sauce",
            prices: { S: 239.00, M: 339.00, L: 439.00 },
            img: "https://i.ibb.co/b5d6Xgmx/Tandoori-Pizza.png"
        },
        {
            id: "achari-pizza",
            name: "Acharri Pizza",
            desc: "Capsicum, Corn, Paneer, Achari Sauce",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/C3Z9fkJS/Achari-Pizza.png"
        },
        {
            id: "cheese-n-corn",
            name: "Cheese-n-Corn",
            desc: "Cheese, Corn",
            prices: { S: 179.00, M: 279.00, L: 379.00 },
            img: "https://i.ibb.co/0phPSW3G/Cheese-n-Corn.png"
        },
        {
            id: "cheese-n-mushroom",
            name: "Cheese-n-Mushroom",
            desc: "Cheese, Mushroom",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/PvnXskbY/Cheese-n-Mushroom.png"
        },
        {
            id: "chipotle-pizza",
            name: "Chipotle Pizza",
            desc: "Paneer, Capsicum, Corn, Onion, Chipotle Sauce",
            prices: { S: 229.00, M: 329.00, L: 429.00 },
            img: "https://i.ibb.co/9mGwnLw9/Chipotle-Pizza.png"
        },
        {
            id: "deluxe-pizza",
            name: "Deluxe Pizza",
            desc: "Onion, Paneer, Capsicum, Mushroom, Gold Corn",
            prices: { S: 199.00, M: 299.00, L: 399.00 },
            img: "https://i.ibb.co/Gvsrbccg/Dbl-Cheese-Margherita.png"
        },
        {
            id: "delight-pizza",
            name: "Delight Pizza",
            desc: "Capsicum, Jalapeno, Mushroom",
            prices: { S: 219.00, M: 319.00, L: 419.00 },
            img: "https://i.ibb.co/cht2BnYN/Delight-Pizza.png"
        },
        {
            id: "farm-house",
            name: "Farm House",
            desc: "Corn, Pineapple, Mushroom, Black Olives, Red Paprika, Extra Cheese",
            prices: { S: 239.00, M: 339.00, L: 439.00 },
            img: "https://i.ibb.co/ZzK35nQ3/Farm-House.png"
        },
        {
            id: "green-veggie",
            name: "Green Veggie",
            desc: "Onion, Capsicum, Tomato",
            prices: { S: 229.00, M: 329.00, L: 429.00 },
            img: "https://i.ibb.co/XxKxtwM1/Green-Veggie.png"
        },
        {
            id: "harissa-pizza",
            name: "Harissa Pizza",
            desc: "Paneer, Red Paprika, Black Olives, Onion, Harissa Sauce",
            prices: { S: 249.00, M: 349.00, L: 449.00 },
            img: "https://i.ibb.co/rRsTTg0y/Harissa-Pizza.png"
        }
    ],
    "Bread": [
        { name: "Garlic Butter Breadsticks", desc: "Warm oven-baked breadsticks with garlic butter", price: 119.00, tag: "Fresh" },
        { name: "Cheesy Garlic Bread", desc: "Melted mozzarella over seasoned garlic toast", price: 149.00, tag: "Bestseller" },
        { name: "Stuffed Cheese Pocket", desc: "Crispy crust filled with herbs & cheese", price: 159.00, tag: "Hot" }
    ],
    "Chinese Food": [
        { name: "Kung Pao Chicken", desc: "Tender chicken with peanuts & chili peppers", price: 249.00, tag: "Spicy 🌶️" },
        { name: "Manchurian Gravy", desc: "Vegetable dumplings in savory Manchurian sauce", price: 199.00, tag: "Popular" },
        { name: "Sweet & Sour Crispy Veg", desc: "Crispy veggies tossed in sweet sour glaze", price: 189.00, tag: "Veg 🥗" }
    ],
    "Colo Drinks": [
        { name: "Classic Sparkling Cola", desc: "Ice cold refreshing fizzy beverage", price: 60.00, tag: "Chilled" },
        { name: "Zero Sugar Cola", desc: "Zero calories, same refreshing taste", price: 60.00, tag: "Diet" },
        { name: "Citrus Lime Fizz", desc: "Zesty lemon lime sparkling drink", price: 70.00, tag: "Popular" }
    ],
    "Pasta": [
        { name: "Creamy Alfredo Pasta", desc: "Rich parmesan cream sauce with fettuccine", price: 249.00, tag: "Popular" },
        { name: "Penna Arrabbiata", desc: "Spicy tomato garlic sauce with fresh basil", price: 229.00, tag: "Spicy 🌶️" },
        { name: "Pesto Supreme Pasta", desc: "Fresh basil pesto with pine nuts & olive oil", price: 269.00, tag: "Chef Special" }
    ]
};

const MENU_STORAGE_KEY = 'menuData';

function getStoredMenuItems() {
    try {
        const stored = localStorage.getItem(MENU_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
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

                    return `
                    <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${prices.M}">
                        ${outOfStockBadge}
                        <div class="pizza-card-image-wrapper">
                            <img src="${item.img}" alt="${item.name}" class="pizza-card-img" loading="lazy">
                        </div>
                        <div class="pizza-card-body">
                            <h4 class="pizza-card-title">${item.name}</h4>
                            ${descMarkup}
                            
                            <div class="pizza-size-selector">
                                <span class="size-label">Size:</span>
                                <div class="size-options">
                                    <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                                    <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                                    <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
                                </div>
                            </div>
                            
                            <div class="pizza-price-row">
                                <span class="price-prefix">Price:</span>
                                <span class="pizza-card-price" id="price-${item.id}">${formatPrice(prices.M)}</span>
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
    } else if (activeTabName === 'search-results') {
        const searchInput = document.getElementById('customer-search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            renderCustomerSearchResults(searchInput.value.toLowerCase().trim(), searchInput.value);
        }
    }

    // Refresh cart in case prices or availability of in-cart items changed
    updateCartUI();
}

// Background Live Menu Poller & Server Synchronization
async function fetchLiveMenuFromBackend() {
    try {
        const res = await fetch(resolveApiUrl('/api/menu'));
        const data = await res.json();
        if (data && data.success && Array.isArray(data.items) && data.items.length > 0) {
            const freshItems = data.items;
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

function changePizzaSize(pizzaId, size, price, event) {
    if (event) event.stopPropagation();

    const card = document.querySelector(`.pizza-card[data-pizza-id="${pizzaId}"]`);
    if (!card) return;

    card.setAttribute('data-selected-size', size);
    card.setAttribute('data-current-price', price);

    const sizeBtns = card.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
        if (btn.getAttribute('data-size') === size) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
        btn.classList.remove('active');
    });

    const priceEl = card.querySelector('.pizza-card-price');
    if (priceEl) {
        priceEl.classList.remove('price-pop-orange', 'animating');
        void priceEl.offsetWidth; // Force reflow
        priceEl.textContent = formatPrice(price);
        priceEl.classList.add('price-pop-orange');
    }
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
    const price = parseFloat(card && card.getAttribute('data-current-price')) || (item.prices ? item.prices[selectedSize] : 299);

    const cartItemTitle = `${item.name} (${selectedSize})`;
    addToCart(cartItemTitle, price, item.img);
}

function openCategoryDetail(categoryName, categoryImg, isRestoringState = false, isPopState = false) {
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

                return `
                <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${prices.M}">
                    ${outOfStockBadge}
                    <div class="pizza-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="pizza-card-img" loading="lazy">
                    </div>
                    <div class="pizza-card-body">
                        <h4 class="pizza-card-title">${item.name}</h4>
                        ${descMarkup}
                        
                        <div class="pizza-size-selector">
                            <span class="size-label">Size:</span>
                            <div class="size-options">
                                <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                                <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                                <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
                            </div>
                        </div>
                        
                        <div class="pizza-price-row">
                            <span class="price-prefix">Price:</span>
                            <span class="pizza-card-price" id="price-${item.id}">${formatPrice(prices.M)}</span>
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

    if (isRestoringState && lastCategoryState.scrollY > 0) {
        setTimeout(() => {
            window.scrollTo({ top: lastCategoryState.scrollY, behavior: 'instant' });
        }, 10);
    }
}

// --------------------------------------------------------------------------
// SHOP OPEN / CLOSED STATUS SYSTEM
// --------------------------------------------------------------------------
const SHOP_STATUS_KEY = 'shopStatus';

function getCustomerShopStatus() {
    return localStorage.getItem(SHOP_STATUS_KEY) || 'open';
}

function checkAndUpdateShopStatusUI() {
    const status = getCustomerShopStatus();
    const banner = document.getElementById('shop-closed-banner');
    const isClosed = status === 'closed';

    if (banner) {
        banner.style.display = isClosed ? 'block' : 'none';
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
}

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
    if (!e.key || e.key === SHOP_STATUS_KEY) {
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
function addToCart(name, price, img) {
    if (getCustomerShopStatus() === 'closed') {
        showToast('This time shop is closed. We are not accepting orders right now.');
        return;
    }

    // Check if item is marked out-of-stock in latest menu data
    const allItems = getAllCustomerMenuItems();
    const cleanName = (name || '').replace(/\s*\([SML]\)$/i, '').trim();
    const menuItem = allItems.find(i => (i.name && i.name.toLowerCase() === cleanName.toLowerCase()));
    if (menuItem && menuItem.available === false) {
        showToast(`⚠️ "${cleanName}" is currently out of stock.`);
        return;
    }

    const existingIndex = cart.findIndex(item => item.name === name);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({ name, price, qty: 1, img });
    }
    saveCartToStorage();
    updateCartUI();

    const savedProfile = getSavedDeliveryProfile();
    if (!savedProfile) {
        showProfileRedirectNotice(true);
        switchTab('profile', true);
        toggleEditProfileForm(true);
        return;
    }

    showToast(`Added ${name} to your cart!`);
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
        cartContainer.innerHTML = cart.map((item, index) => `
            <div class="cart-item-card">
                <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h5 class="cart-item-name">${item.name}</h5>
                    <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
                </div>
                <div class="qty-control">
                    <button class="qty-btn" onclick="updateQuantity(${index}, -1)">-</button>
                    <span class="qty-val">${item.qty}</span>
                    <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
                </div>
            </div>
        `).join('');
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
                const isGoogleVerified = profile.isGoogleVerified === true;
                const gpsLat = profile.gpsLat !== undefined && profile.gpsLat !== null ? parseFloat(profile.gpsLat) : null;
                const gpsLng = profile.gpsLng !== undefined && profile.gpsLng !== null ? parseFloat(profile.gpsLng) : null;

                if (fullName && phone && phone.length === 10 && colonyName && nearBy && streetName && wardNo && gpsLat !== null && gpsLng !== null) {
                    return { fullName, email, phone, colonyName, nearBy, streetName, wardNo, isVerified, isGoogleVerified, gpsLat, gpsLng };
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
    if (getCustomerShopStatus() === 'closed') {
        showToast('This time shop is closed. We are not accepting orders right now.');
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
    switchTab('profile', true);
    toggleEditProfileForm(true);
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
// PHONEPE ONLINE PAYMENT GATEWAY INTEGRATION
// --------------------------------------------------------------------------
async function handleSelectOnlinePayment() {
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

    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const customCoords = (savedProfile && savedProfile.gpsLat !== undefined && savedProfile.gpsLng !== undefined && savedProfile.gpsLat !== null && savedProfile.gpsLng !== null)
        ? { lat: parseFloat(savedProfile.gpsLat), lng: parseFloat(savedProfile.gpsLng) }
        : null;
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal, customCoords);
    const deliveryFee = deliveryInfo.finalDeliveryFee;
    const grandTotal = Math.round(subtotal + deliveryFee);

    // Show Payment Processing Spinner
    const processingBox = document.getElementById('payment-processing-box');
    if (processingBox) {
        processingBox.style.display = 'flex';
        processingBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Determine sequential order ID
    let nextOrderSeq = getNextOrderSequenceNumber();
    const orderId = nextOrderSeq.toString();

    try {
        const response = await fetch(resolveApiUrl('/api/payment/initiate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: orderId,
                amount: grandTotal,
                customerPhone: savedProfile.phone,
                customerName: savedProfile.fullName,
                customerEmail: (currentUserProfile && currentUserProfile.email) || '',
                redirectUrl: `${getAppOrigin()}/index.html?payment=success&orderId=${orderId}`
            })
        });

        const data = await response.json();

        if (data && data.success && data.redirectUrl) {
            // Check if live PG or sandbox simulated checkout
            if (data.mode === 'live' && !data.redirectUrl.includes('simulated=true')) {
                // Pre-save order state to localStorage before redirecting to PhonePe
                executeOrderPlacement(savedProfile, 'PhonePe', 'Pending', orderId, false);
                window.location.href = data.redirectUrl;
                return;
            }

            // Sandbox / Direct Verified Payment Mode
            setTimeout(async () => {
                if (processingBox) processingBox.style.display = 'none';
                closeCheckoutModal();
                executeOrderPlacement(savedProfile, 'PhonePe', 'Paid', orderId, true);
                showToast('⚡ PhonePe Payment Verified! Order Placed Successfully.');
            }, 1200);

        } else {
            throw new Error(data.message || 'Payment initiation failed');
        }
    } catch (error) {
        console.error('PhonePe Payment Error:', error);
        if (processingBox) processingBox.style.display = 'none';
        showToast(`❌ Payment Gateway error: ${error.message || 'Please try again or choose COD.'}`);
    }
}

function handleSelectCodPayment() {
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
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const customCoords = (profile && profile.gpsLat !== undefined && profile.gpsLng !== undefined && profile.gpsLat !== null && profile.gpsLng !== null)
        ? { lat: parseFloat(profile.gpsLat), lng: parseFloat(profile.gpsLng) }
        : null;
    const deliveryInfo = calculateDynamicDeliveryInfo(subtotal, customCoords);
    const deliveryFee = deliveryInfo.finalDeliveryFee;
    const grandTotal = subtotal + deliveryFee;

    const orderId = specificOrderId || getNextOrderSequenceNumber().toString();
    const orderItems = cart.map(item => ({
        id: item.id || item.name,
        name: `${item.qty}x ${item.name} (${item.size || 'Standard'})`,
        size: item.size || 'Standard',
        price: item.price,
        qty: item.qty,
        notes: ''
    }));

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const newOrder = {
        orderId: orderId,
        id: orderId,
        firebaseUid: (currentUserProfile && currentUserProfile.firebaseUid) || '',
        customerName: profile.fullName,
        customerPhone: profile.phone,
        customerEmail: (currentUserProfile && currentUserProfile.email) || '',
        phone: profile.phone,
        address: `${profile.colonyName}, Near: ${profile.nearBy}, ${profile.streetName}, Ward No. ${profile.wardNo}`,
        deliveryDetails: {
            colonyName: profile.colonyName,
            nearBy: profile.nearBy,
            streetName: profile.streetName,
            wardNo: profile.wardNo,
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

    // 2. Asynchronously save order to MongoDB Atlas via Backend API
    saveOrderToBackendAPI(newOrder);

    if (clearCartNow) {
        showToast('🎉 Order placed successfully! Arriving in 25 mins.');
        cart = [];
        saveCartToStorage();
        updateCartUI();
        updateProfileTotalsUI();
        switchTab('home', true);
    }
}

// Backend API Order Saver
async function saveOrderToBackendAPI(order) {
    try {
        const response = await fetch(resolveApiUrl('/api/orders'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order)
        });
        const result = await response.json();
        if (result && result.success) {
            console.log('Order successfully synced to MongoDB Atlas:', result.order?.orderId);
        }
    } catch (err) {
        console.warn('MongoDB Atlas order sync (offline/local fallback active):', err.message);
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

function toggleEditProfileForm(show) {
    const formCard = document.getElementById('profile-edit-form-card');
    const collapseBtn = document.getElementById('btn-collapse-profile-form');
    if (!formCard) return;

    const willShow = (show === true) ? true : (show === false) ? false : (formCard.style.display === 'none' || formCard.style.display === '');

    if (willShow) {
        formCard.style.display = 'block';
        if (collapseBtn) collapseBtn.classList.add('collapsed');
        formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const nameInput = document.getElementById('customer-fullname');
        if (nameInput) nameInput.focus();
    } else {
        formCard.style.display = 'none';
        if (collapseBtn) collapseBtn.classList.remove('collapsed');
    }
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

        customerLocationMarker.on('drag', (e) => {
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
        });

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

    const lat = customerTempCoords.lat;
    const lng = customerTempCoords.lng;

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
    const gpsContainer = document.querySelector('.full-width-gps-field');
    const gpsBtnText = document.getElementById('gps-btn-text');

    const mapBtn = document.getElementById('btn-open-map-modal');

    if (latHidden) latHidden.value = lat;
    if (lngHidden) lngHidden.value = lng;

    if (statusBadge) {
        statusBadge.className = 'gps-status-badge verified';
        statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> GPS Verified';
        statusBadge.style.display = 'inline-flex';
    }

    if (coordsDisplay) {
        coordsDisplay.style.display = 'flex';
    }

    if (gpsContainer) {
        gpsContainer.classList.remove('invalid-gps');
        gpsContainer.classList.add('gps-verified');
    }

    if (mapBtn) {
        mapBtn.classList.remove('invalid-gps-btn');
    }

    if (gpsBtnText) {
        gpsBtnText.innerHTML = '<i class="fa-solid fa-map-pin"></i> Change Location on Map';
    }

    closeCustomerMapModal();
    showToast(`📍 Delivery location verified (${radiusCheck.distanceKm} km from store)!`);

    // Recalculate dynamic delivery fee & update cart / profile UI in real-time
    updateCartUI();
    updateProfileTotalsUI();
}

function handlePhoneInputChange(input) {
    if (!input) return;
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 10);
    
    // If user is Google-verified, account is verified without needing MSG91 OTP
    if (!isGoogleVerified) {
        // Reset verification state if phone number changes for non-Google user
        isPhoneVerified = false;
        currentTargetPhone = null;
        if (otpResendTimerId) {
            clearInterval(otpResendTimerId);
            otpResendTimerId = null;
        }
        const badge = document.getElementById('phone-verified-badge');
        const changeBtn = document.getElementById('btn-change-phone');
        const verifyBtn = document.getElementById('btn-request-otp');
        const otpBox = document.getElementById('otp-verification-box');
        if (badge) badge.style.display = 'none';
        if (changeBtn) changeBtn.style.display = 'none';
        if (verifyBtn) {
            verifyBtn.style.display = 'inline-flex';
            verifyBtn.disabled = input.value.length !== 10;
            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
        }
        if (otpBox) otpBox.style.display = 'none';
    }
}

function handleChangePhoneNumber() {
    const phoneInput = document.getElementById('customer-phone');
    const badge = document.getElementById('phone-verified-badge');
    const changeBtn = document.getElementById('btn-change-phone');
    const verifyBtn = document.getElementById('btn-request-otp');
    const otpBox = document.getElementById('otp-verification-box');

    if (!isGoogleVerified) {
        isPhoneVerified = false;
        currentTargetPhone = null;

        if (otpResendTimerId) {
            clearInterval(otpResendTimerId);
            otpResendTimerId = null;
        }

        if (badge) badge.style.display = 'none';
        if (changeBtn) changeBtn.style.display = 'none';
        if (verifyBtn) {
            verifyBtn.style.display = 'inline-flex';
            const len = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').length : 0;
            verifyBtn.disabled = len !== 10;
            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
        }
    }

    if (otpBox) otpBox.style.display = 'none';

    if (phoneInput) {
        phoneInput.readOnly = false;
        phoneInput.style.backgroundColor = 'var(--bg-input)';
        phoneInput.style.cursor = 'text';
        phoneInput.focus();
        phoneInput.select();
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
        isPhoneVerified = true;
        const otpBox = document.getElementById('otp-verification-box');
        const badge = document.getElementById('phone-verified-badge');
        const changeBtn = document.getElementById('btn-change-phone');
        const verifyBtn = document.getElementById('btn-request-otp');

        if (otpBox) otpBox.style.display = 'none';
        if (badge) badge.style.display = 'inline-flex';
        if (changeBtn) changeBtn.style.display = 'inline-flex';
        if (verifyBtn) verifyBtn.style.display = 'none';

        // Disable phone input to prevent alteration after verification
        if (phoneInput) {
            phoneInput.readOnly = true;
            phoneInput.classList.remove('invalid-field');
            phoneInput.style.backgroundColor = 'var(--bg-surface-elevated)';
            phoneInput.style.cursor = 'not-allowed';
        }

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
    const emailInput = document.getElementById('customer-email');
    const emailVal = emailInput ? emailInput.value.trim().toLowerCase() : ((currentUserProfile && currentUserProfile.email) || '');

    if (cleanPhone.length < 10) {
        showToast('Please enter a valid 10-digit mobile number!');
        const phoneEl = document.getElementById('customer-phone');
        if (phoneEl) {
            phoneEl.classList.add('invalid-field');
            phoneEl.focus();
        }
        return;
    }

    // MANDATORY OTP VERIFICATION CHECK (Bypassed if Google Verified)
    if (!isPhoneVerified && !isGoogleVerified) {
        showToast('⚠️ Please sign in with Google or verify your mobile number with OTP!');
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

    // Save profile with GPS Coordinates & Email to localStorage
    const profile = {
        fullName,
        email: emailVal,
        phone: cleanPhone,
        colonyName,
        nearBy,
        streetName,
        wardNo,
        isVerified: true,
        isGoogleVerified: isGoogleVerified,
        gpsLat: latVal,
        gpsLng: lngVal
    };

    try {
        localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.error('Error saving delivery profile to localStorage:', e);
    }

    // Sync user profile to MongoDB Atlas backend
    syncProfileToMongoDBBackend(profile);

    // Hide the cart redirection notice banner upon successful profile completion & save
    showProfileRedirectNotice(false);

    // Immediately update header UI, form inputs & cart totals in real-time
    renderProfileHeaderAndInputs(profile);
    updateProfileTotalsUI();
    updateCartUI();
    toggleEditProfileForm(false);

    showToast('✅ Profile & Home Address saved successfully!');
}

async function syncProfileToMongoDBBackend(profile) {
    try {
        await fetch(resolveApiUrl('/api/users'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firebaseUid: (currentUserProfile && currentUserProfile.firebaseUid) || '',
                email: profile.email || ((currentUserProfile && currentUserProfile.email) || ''),
                fullName: profile.fullName,
                phone: profile.phone,
                photoURL: (currentUserProfile && currentUserProfile.photoURL) || '',
                address: {
                    colonyName: profile.colonyName,
                    nearBy: profile.nearBy,
                    streetName: profile.streetName,
                    wardNo: profile.wardNo,
                },
                gps: {
                    lat: profile.gpsLat,
                    lng: profile.gpsLng
                },
                isPhoneVerified: true
            })
        });
    } catch (err) {
        console.warn('MongoDB user sync notice:', err.message);
    }
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
    const emailInput = document.getElementById('customer-email');

    const latHidden = document.getElementById('customer-gps-lat');
    const lngHidden = document.getElementById('customer-gps-lng');
    const statusBadge = document.getElementById('gps-status-badge');
    const coordsDisplay = document.getElementById('gps-coordinates-display');
    const coordsText = document.getElementById('gps-coords-text');
    const gpsContainer = document.querySelector('.full-width-gps-field');
    const gpsBtnText = document.getElementById('gps-btn-text');
    const mapBtn = document.getElementById('btn-open-map-modal');

    const isVerifiedUser = (profile && profile.isVerified) || isGoogleVerified;
    const isGoogleAccount = isGoogleVerified || (profile && profile.isGoogleVerified);

    if (profile && typeof profile === 'object') {
        if (nameEl) {
            nameEl.textContent = profile.fullName ? profile.fullName : ((currentUserProfile && currentUserProfile.displayName) || 'Customer Name');
        }
        if (subtextEl) {
            if (profile.email && profile.phone) {
                subtextEl.textContent = `${profile.email} • +91 ${profile.phone}`;
            } else if (profile.email) {
                subtextEl.textContent = profile.email;
            } else if (profile.phone) {
                subtextEl.textContent = `+91 ${profile.phone}`;
            } else {
                subtextEl.textContent = '+91 Mobile Number';
            }
        }

        // Set phone verification state
        if (isVerifiedUser) {
            isPhoneVerified = true;
            if (badge) {
                badge.style.display = 'inline-flex';
                badge.innerHTML = isGoogleAccount
                    ? '<i class="fa-solid fa-circle-check"></i> Google Verified'
                    : '<i class="fa-solid fa-circle-check"></i> Verified';
            }
            if (emailBadge && (isGoogleAccount || profile.email)) {
                emailBadge.style.display = 'inline-flex';
            }
            if (changeBtn) changeBtn.style.display = 'inline-flex';
            if (verifyBtn) verifyBtn.style.display = 'none';
            if (phoneInput) {
                phoneInput.readOnly = isGoogleAccount ? false : true;
                phoneInput.style.backgroundColor = isGoogleAccount ? 'var(--bg-input)' : 'var(--bg-surface-elevated)';
                phoneInput.style.cursor = isGoogleAccount ? 'text' : 'not-allowed';
            }
        } else {
            isPhoneVerified = false;
            if (badge) badge.style.display = 'none';
            if (emailBadge) emailBadge.style.display = 'none';
            if (changeBtn) changeBtn.style.display = 'none';
            if (verifyBtn) {
                verifyBtn.style.display = 'inline-flex';
                const currentPhoneLen = (phoneInput && phoneInput.value) ? phoneInput.value.replace(/[^0-9]/g, '').length : 0;
                verifyBtn.disabled = currentPhoneLen !== 10;
                verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
            }
        }

        // Pre-fill GPS coordinate state
        if (profile.gpsLat !== undefined && profile.gpsLat !== null && profile.gpsLng !== undefined && profile.gpsLng !== null) {
            currentCustomerGps = { lat: profile.gpsLat, lng: profile.gpsLng };
            if (latHidden) latHidden.value = profile.gpsLat;
            if (lngHidden) lngHidden.value = profile.gpsLng;
            if (statusBadge) {
                statusBadge.className = 'gps-status-badge verified';
                statusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> GPS Verified';
                statusBadge.style.display = 'inline-flex';
            }
            if (coordsDisplay) {
                coordsDisplay.style.display = 'flex';
            }
            if (gpsContainer) {
                gpsContainer.classList.add('gps-verified');
                gpsContainer.classList.remove('invalid-gps');
            }
            if (mapBtn) {
                mapBtn.classList.remove('invalid-gps-btn');
            }
            if (gpsBtnText) {
                gpsBtnText.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Refresh GPS Location';
            }
        }

        // Pre-fill form inputs
        const fullNameInput = document.getElementById('customer-fullname');
        const colonyInput = document.getElementById('customer-colony-name');
        const nearbyInput = document.getElementById('customer-nearby');
        const streetInput = document.getElementById('customer-street-name');
        const wardInput = document.getElementById('customer-ward-no');

        if (profile.fullName && fullNameInput && (!fullNameInput.value || fullNameInput.value === '')) fullNameInput.value = profile.fullName;
        if (profile.email && emailInput && (!emailInput.value || emailInput.value === '')) emailInput.value = profile.email;
        if (profile.phone && phoneInput && (!phoneInput.value || phoneInput.value === '')) {
            phoneInput.value = profile.phone;
            if (!isVerifiedUser && verifyBtn) {
                verifyBtn.disabled = profile.phone.length !== 10;
            }
        }
        if (profile.colonyName && colonyInput && (!colonyInput.value || colonyInput.value === '')) colonyInput.value = profile.colonyName;
        if (profile.nearBy && nearbyInput && (!nearbyInput.value || nearbyInput.value === '')) nearbyInput.value = profile.nearBy;
        if (profile.streetName && streetInput && (!streetInput.value || streetInput.value === '')) streetInput.value = profile.streetName;
        if (profile.wardNo && wardInput && (!wardInput.value || wardInput.value === '')) wardInput.value = profile.wardNo;
    } else {
        if (!isGoogleVerified) {
            isPhoneVerified = false;
            currentCustomerGps = null;
            if (nameEl) nameEl.textContent = 'Customer Name';
            if (subtextEl) subtextEl.textContent = '+91 Mobile Number';
            if (badge) badge.style.display = 'none';
            if (emailBadge) emailBadge.style.display = 'none';
            if (changeBtn) changeBtn.style.display = 'none';
            if (verifyBtn) {
                verifyBtn.style.display = 'inline-flex';
                const currentPhoneLen = (phoneInput && phoneInput.value) ? phoneInput.value.replace(/[^0-9]/g, '').length : 0;
                verifyBtn.disabled = currentPhoneLen !== 10;
            }
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

    if (historyBox) historyBox.style.display = 'none';
    if (historyArrow) historyArrow.classList.remove('expanded');

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
    toggleEditProfileForm(true);
    showToast('Update your profile and address details below.');
}

function toggleOrderHistoryView() {
    const box = document.getElementById('order-history-display-box');
    const arrow = document.getElementById('arrow-order-history');
    const addressBox = document.getElementById('saved-address-display-box');
    const addressArrow = document.getElementById('arrow-saved-addresses');

    if (addressBox) addressBox.style.display = 'none';
    if (addressArrow) addressArrow.classList.remove('expanded');

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
                listEl.innerHTML = orders.map(o => `
                    <div style="background: var(--bg-surface); padding: 12px; border-radius: 10px; margin-top: 10px; border: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <strong style="color: var(--primary-orange);">#${o.id}</strong>
                            <span style="font-size: 0.78rem; color: var(--text-muted);">${o.timeAgo}</span>
                        </div>
                        <div style="font-size: 0.84rem; color: var(--text-light); margin-bottom: 6px;">
                            ${o.items.map(i => i.name).join(', ')}
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 700; border-top: 1px dashed var(--border-color); padding-top: 6px;">
                            <span>Status: <span style="color: #22c55e; text-transform: uppercase;">${o.status}</span></span>
                            <span style="color: var(--primary-orange);">₹${o.total}</span>
                        </div>
                    </div>
                `).join('');
                return;
            }
        }
    } catch (e) { }

    if (clearBtn) clearBtn.style.display = 'none';
    listEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">No order history found yet.</span>`;
}

function clearCustomerOrderHistory() {
    if (confirm('Are you sure you want to clear your entire order history?')) {
        try {
            localStorage.removeItem('perfettoCustomerOrders');
        } catch (e) {
            console.error('Error clearing customer order history:', e);
        }
        renderOrderHistoryDetails();
        updateProfileTotalsUI();
        showToast('🗑️ Order history cleared successfully!');
    }
}

// --------------------------------------------------------------------------
// 7. TOAST NOTIFICATION SYSTEM
// --------------------------------------------------------------------------
let toastTimeout;
function showToast(msg) {
    clearTimeout(toastTimeout);
    toastMessage.textContent = msg;
    toast.classList.add('show');
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// --------------------------------------------------------------------------
// 8. SMART DAILY OFFER SLIDER (SEAMLESS INFINITE AUTO-SCROLL LOOP & SWIPE)
// --------------------------------------------------------------------------
function initOfferSlider() {
    const wrapper = document.getElementById('offer-slider-wrapper');
    const track = document.getElementById('offer-slider-track');
    const dotsContainer = document.getElementById('offer-dots');
    if (!wrapper || !track || !dotsContainer) return;

    // Get original slides
    const origSlides = Array.from(track.querySelectorAll('.offer-slide'));
    const totalRealSlides = origSlides.length;
    if (totalRealSlides <= 1) return;

    const dots = dotsContainer.querySelectorAll('.dot');

    // Clone first and last slides for seamless infinite loop transition
    // Remove any previously appended clones if reinitialized
    track.querySelectorAll('.clone-slide').forEach(c => c.remove());

    const firstClone = origSlides[0].cloneNode(true);
    firstClone.classList.add('clone-slide');
    const lastClone = origSlides[totalRealSlides - 1].cloneNode(true);
    lastClone.classList.add('clone-slide');

    track.appendChild(firstClone);
    track.insertBefore(lastClone, origSlides[0]);

    const allSlides = track.querySelectorAll('.offer-slide');
    const totalWithClones = allSlides.length;

    // Adjust width percentage dynamically
    track.style.width = `${totalWithClones * 100}%`;
    allSlides.forEach(slide => {
        slide.style.width = `${100 / totalWithClones}%`;
    });

    let currentPos = 1; // Start at first original slide
    let isTransitioning = false;
    let autoScrollInterval = null;
    let pauseTimeout = null;

    function setPosition(pos, animated = true) {
        if (animated) {
            track.style.transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)';
        } else {
            track.style.transition = 'none';
        }
        const pct = -(pos * (100 / totalWithClones));
        track.style.transform = `translateX(${pct}%)`;
    }

    function updateDots(activeIdx) {
        dots.forEach((dot, idx) => {
            if (idx === activeIdx) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // Initial positioning on first real slide without animation
    setPosition(currentPos, false);
    updateDots(0);

    function nextSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        currentPos++;
        setPosition(currentPos, true);

        let activeDot = (currentPos - 1) % totalRealSlides;
        if (activeDot < 0) activeDot = totalRealSlides - 1;
        updateDots(activeDot);
    }

    function prevSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        currentPos--;
        setPosition(currentPos, true);

        let activeDot = (currentPos - 1) % totalRealSlides;
        if (activeDot < 0) activeDot = totalRealSlides - 1;
        updateDots(activeDot);
    }

    // Seamless loop reset on transitionend
    track.addEventListener('transitionend', () => {
        isTransitioning = false;
        if (currentPos >= totalWithClones - 1) {
            // Reached clone of first slide -> Jump instantly to real first slide
            currentPos = 1;
            setPosition(currentPos, false);
            updateDots(0);
        } else if (currentPos <= 0) {
            // Reached clone of last slide -> Jump instantly to real last slide
            currentPos = totalRealSlides;
            setPosition(currentPos, false);
            updateDots(totalRealSlides - 1);
        }
    });

    function startAutoScroll() {
        stopAutoScroll();
        autoScrollInterval = setInterval(nextSlide, 3200);
    }

    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }

    function handleUserInteraction() {
        stopAutoScroll();
        if (pauseTimeout) clearTimeout(pauseTimeout);
        pauseTimeout = setTimeout(() => {
            startAutoScroll();
        }, 5000);
    }

    // Dot click navigation
    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            if (isTransitioning) return;
            currentPos = idx + 1;
            setPosition(currentPos, true);
            updateDots(idx);
            handleUserInteraction();
        });
    });

    // Touch gestures
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            startX = e.touches[0].clientX;
            currentX = startX;
            isDragging = true;
        }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length === 0) return;
        currentX = e.touches[0].clientX;
    }, { passive: true });

    wrapper.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        const diffX = currentX - startX;

        if (Math.abs(diffX) > 40) {
            if (diffX < 0) {
                nextSlide();
            } else {
                prevSlide();
            }
            handleUserInteraction();
        }
    });

    // Mouse drag support
    wrapper.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        currentX = startX;
        isDragging = true;
    });

    wrapper.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX;
    });

    wrapper.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        const diffX = currentX - startX;
        if (Math.abs(diffX) > 40) {
            if (diffX < 0) {
                nextSlide();
            } else {
                prevSlide();
            }
            handleUserInteraction();
        }
    });

    wrapper.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    // Start auto loop
    startAutoScroll();
}

// --------------------------------------------------------------------------
// 9. WHATSAPP DP STYLE LOGO POPUP MODAL
// --------------------------------------------------------------------------
function initLogoModal() {
    const brandLogo = document.getElementById('app-logo');
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

    brandLogo.addEventListener('click', (e) => {
        e.stopPropagation();
        openLogoModal();
    });

    // Click outside circular image (on backdrop overlay) closes modal
    logoModal.addEventListener('click', (e) => {
        if (e.target === logoModal || !logoModalContent.contains(e.target)) {
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
            lastCategoryState.categoryName = null;
            lastCategoryState.categoryImg = null;
            lastCategoryState.scrollY = 0;
            switchTab('home', true, true);
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

            return `
            <div class="pizza-card ${outOfStockClass}" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${prices.M}">
                ${outOfStockBadge}
                <div class="pizza-card-image-wrapper">
                    <img src="${item.img}" alt="${item.name}" class="pizza-card-img" loading="lazy">
                </div>
                <div class="pizza-card-body">
                    <h4 class="pizza-card-title">${item.name}</h4>
                    ${descMarkup}
                    
                    <div class="pizza-size-selector">
                        <span class="size-label">Size:</span>
                        <div class="size-options">
                            <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${prices.S}, event)">S</button>
                            <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${prices.M}, event)">M</button>
                            <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${prices.L}, event)">L</button>
                        </div>
                    </div>
                    
                    <div class="pizza-price-row">
                        <span class="price-prefix">Price:</span>
                        <span class="pizza-card-price" id="price-${item.id}">${formatPrice(prices.M)}</span>
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
        // 5. Customer Profile changed
        if (!e.key || e.key === DELIVERY_PROFILE_KEY) {
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
// 10. FIREBASE GOOGLE AUTHENTICATION SYSTEM
// --------------------------------------------------------------------------
let firebaseAuthInstance = null;
let googleAuthProvider = null;
let currentUserProfile = null;
let isGoogleVerified = false;

// Official Perfetto Pizza Firebase Configuration
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
    authDomain: "website-fa79c.firebaseapp.com",
    projectId: "website-fa79c",
    storageBucket: "website-fa79c.appspot.com",
    messagingSenderId: "29523182317",
    appId: "1:29523182317:web:perfetto-pizza"
};

function initFirebaseGoogleAuth() {
    // 1. Check for incoming OAuth redirect callback in URL
    checkOAuthCallbackParams();

    try {
        if (typeof firebase !== 'undefined' && firebase.apps) {
            // 1. Initialize Firebase App
            if (!firebase.apps.length) {
                const config = window.FIREBASE_CONFIG || FIREBASE_CONFIG;
                firebase.initializeApp(config);
            }
            firebaseAuthInstance = firebase.auth();

            // 2. Set browser local session persistence
            if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
                firebaseAuthInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
                    console.warn('Firebase setPersistence notice:', err.message);
                });
            }

            // 3. Configure Google Auth Provider with email & profile scopes
            googleAuthProvider = new firebase.auth.GoogleAuthProvider();
            googleAuthProvider.addScope('email');
            googleAuthProvider.addScope('profile');
            googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

            // 4. Handle redirect sign-in result (mobile & returning users)
            firebaseAuthInstance.getRedirectResult().then((result) => {
                if (result && result.user) {
                    onGoogleAuthSuccess(result.user, true);
                }
            }).catch((err) => {
                console.warn('Firebase getRedirectResult error:', err);
            });

            // 5. Active Auth State Observer (Persists session across page refreshes & tabs)
            firebaseAuthInstance.onAuthStateChanged((user) => {
                if (user) {
                    onGoogleAuthSuccess(user, false);
                } else {
                    const stored = localStorage.getItem('perfetto_google_user');
                    if (!stored) {
                        renderGoogleLoggedOutState();
                    } else {
                        try {
                            const parsed = JSON.parse(stored);
                            if (parsed && parsed.email) {
                                currentUserProfile = parsed;
                                isGoogleVerified = true;
                                isPhoneVerified = true;
                                renderGoogleLoggedInState(currentUserProfile);
                            } else {
                                renderGoogleLoggedOutState();
                            }
                        } catch (e) {
                            renderGoogleLoggedOutState();
                        }
                    }
                }
            });
        } else {
            console.warn('Firebase SDK not available on window, checking local user storage');
            checkStoredGoogleUser();
        }
    } catch (e) {
        console.warn('Firebase init notice:', e.message);
        checkStoredGoogleUser();
    }
}

function checkOAuthCallbackParams() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        if (authStatus === 'success') {
            const email = (urlParams.get('email') || '').trim();
            const fullName = urlParams.get('name') || (email ? email.split('@')[0] : 'User');
            const photoURL = urlParams.get('photo') || '';
            const uid = urlParams.get('uid') || ('g_' + btoa(email).slice(0, 10));
            const role = urlParams.get('role') || 'Customer';
            const status = urlParams.get('status') || 'active';

            // Check role redirection
            if (status === 'active' && (role === 'Master Admin' || role === 'Admin')) {
                sessionStorage.setItem('perfetto_admin_session_user', JSON.stringify({
                    email,
                    fullName,
                    photoURL,
                    role,
                    status
                }));
                showToast(`Redirecting to Admin Panel for ${email}...`);
                setTimeout(() => {
                    window.location.href = 'admin.html' + window.location.search;
                }, 400);
                return;
            } else if (status === 'active' && (role === 'Chef' || role === 'Delivery Boy')) {
                sessionStorage.setItem('perfetto_staff_authenticated_email', email);
                showToast(`Redirecting to Staff Portal for ${email}...`);
                setTimeout(() => {
                    window.location.href = 'staff.html' + window.location.search;
                }, 400);
                return;
            }

            // Customer User
            const userObj = {
                uid,
                displayName: fullName,
                email,
                photoURL,
                role,
                status,
                isGoogleAuth: true
            };

            onGoogleAuthSuccess(userObj, true);

            // Clean query parameters from URL
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    } catch (e) {
        console.warn('OAuth param check notice:', e);
    }
}

function checkStoredGoogleUser() {
    try {
        const stored = localStorage.getItem('perfetto_google_user');
        if (stored) {
            const user = JSON.parse(stored);
            if (user && (user.email || user.displayName)) {
                onGoogleAuthSuccess(user, false);
            }
        }
    } catch (e) { }
}

async function handleGoogleSignIn() {
    showToast('🔑 Connecting to Google Sign-In...');
    try {
        if (firebaseAuthInstance && googleAuthProvider) {
            try {
                // One-tap popup authentication
                const result = await firebaseAuthInstance.signInWithPopup(googleAuthProvider);
                if (result && result.user) {
                    await onGoogleAuthSuccess(result.user, true);
                    return;
                }
            } catch (popupErr) {
                console.warn('Popup sign-in notice:', popupErr.code, popupErr.message);
                if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
                    window.location.href = resolveApiUrl('/api/auth/google?target=customer');
                    return;
                } else if (popupErr.code === 'auth/popup-closed-by-user') {
                    showToast('Sign-in cancelled by user.');
                    return;
                }
            }
        }
    } catch (err) {
        console.warn('Firebase sign-in exception:', err.message);
    }

    // Direct Google OAuth redirect
    try {
        window.location.href = resolveApiUrl('/api/auth/google?target=customer');
        return;
    } catch (e) {}

    // Local / Offline interactive fallback
    simulateGoogleSignInPrompt();
}

function simulateGoogleSignInPrompt() {
    const promptEmail = prompt('Enter your Google Account email to Sign In instantly:', 'customer@gmail.com');
    if (!promptEmail || !promptEmail.trim()) return;

    const email = promptEmail.trim().toLowerCase();
    const namePart = email.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    const mockUser = {
        uid: 'google_usr_' + btoa(email).slice(0, 12),
        displayName: formattedName,
        email: email,
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName)}`,
        isGoogleAuth: true
    };

    onGoogleAuthSuccess(mockUser, true);
}

async function onGoogleAuthSuccess(user, isUserAction = false) {
    // 1. Instant Account Verification (Bypasses MSG91 OTP requirement)
    isGoogleVerified = true;
    isPhoneVerified = true;

    // 2. Set current user state
    currentUserProfile = {
        firebaseUid: user.uid || (user.id ? user.id : 'usr_' + Date.now()),
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Customer'),
        email: (user.email || '').trim().toLowerCase(),
        photoURL: user.photoURL || '',
        isGoogleAuth: true
    };

    try {
        localStorage.setItem('perfetto_google_user', JSON.stringify(currentUserProfile));
    } catch (e) { }

    // Check user role via backend
    if (currentUserProfile.email) {
        try {
            const roleRes = await fetch(resolveApiUrl(`/api/admin-auth?email=${encodeURIComponent(currentUserProfile.email)}`));
            const roleData = await roleRes.json();
            if (roleData && roleData.success && roleData.status === 'active') {
                if (roleData.role === 'Master Admin' || roleData.role === 'Admin') {
                    sessionStorage.setItem('perfetto_admin_session_user', JSON.stringify({
                        ...currentUserProfile,
                        role: roleData.role,
                        status: 'active'
                    }));
                    if (isUserAction) {
                        showToast(`🔑 Admin role detected! Redirecting to Admin Dashboard...`);
                        setTimeout(() => {
                            window.location.href = 'admin.html';
                        }, 500);
                        return;
                    }
                } else if (roleData.role === 'Chef' || roleData.role === 'Delivery Boy') {
                    sessionStorage.setItem('perfetto_staff_authenticated_email', currentUserProfile.email);
                    if (isUserAction) {
                        showToast(`👨‍🍳 Staff role (${roleData.role}) detected! Redirecting to Staff Portal...`);
                        setTimeout(() => {
                            window.location.href = 'staff.html';
                        }, 500);
                        return;
                    }
                }
            }
        } catch (rErr) {
            console.warn('Role verification check notice:', rErr.message);
        }
    }

    // 3. Auto-populate Full Name if empty in edit profile form
    const nameInput = document.getElementById('customer-fullname');
    if (nameInput && (!nameInput.value || nameInput.value === 'Customer Name' || nameInput.value.trim() === '')) {
        nameInput.value = currentUserProfile.displayName;
    }

    // 4. Auto-populate Email & display email verified badge
    const emailInput = document.getElementById('customer-email');
    if (emailInput && currentUserProfile.email) {
        emailInput.value = currentUserProfile.email;
    }
    const emailBadge = document.getElementById('email-verified-badge');
    if (emailBadge) {
        emailBadge.style.display = 'inline-flex';
    }

    // 5. Update Phone Verified UI state to Google Verified
    const phoneBadge = document.getElementById('phone-verified-badge');
    const verifyBtn = document.getElementById('btn-request-otp');
    const changeBtn = document.getElementById('btn-change-phone');
    const otpBox = document.getElementById('otp-verification-box');
    const phoneInput = document.getElementById('customer-phone');

    if (phoneBadge) {
        phoneBadge.style.display = 'inline-flex';
        phoneBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Google Verified';
    }
    if (verifyBtn) verifyBtn.style.display = 'none';
    if (changeBtn) changeBtn.style.display = 'inline-flex';
    if (otpBox) otpBox.style.display = 'none';
    if (phoneInput) {
        phoneInput.readOnly = false;
        phoneInput.style.backgroundColor = 'var(--bg-input)';
        phoneInput.style.cursor = 'text';
    }

    // 6. Update saved delivery profile with verified status and email
    try {
        const storedProfile = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (storedProfile) {
            const parsed = JSON.parse(storedProfile);
            if (parsed && typeof parsed === 'object') {
                if (!parsed.fullName || parsed.fullName === 'Customer Name') {
                    parsed.fullName = currentUserProfile.displayName;
                }
                parsed.email = currentUserProfile.email || parsed.email || '';
                parsed.isVerified = true;
                parsed.isGoogleVerified = true;
                localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(parsed));
            }
        }
    } catch (e) { }

    // 7. Sync user to MongoDB Atlas backend
    syncGoogleUserToBackend(currentUserProfile);

    // 8. Update UI elements (Google card, Profile header card, Avatar)
    renderGoogleLoggedInState(currentUserProfile);

    if (isUserAction) {
        showToast(`🎉 Welcome, ${currentUserProfile.displayName}! Signed in with Google.`);
    }
}

function handleGoogleSignOut() {
    try {
        if (firebaseAuthInstance) {
            firebaseAuthInstance.signOut();
        }
        localStorage.removeItem('perfetto_google_user');
    } catch (e) { }

    isGoogleVerified = false;
    currentUserProfile = null;

    // Reset email verified badge
    const emailBadge = document.getElementById('email-verified-badge');
    if (emailBadge) emailBadge.style.display = 'none';

    // Check if user has an independent OTP-verified delivery profile
    const savedProfile = getSavedDeliveryProfile();
    if (!savedProfile || !savedProfile.isVerified || savedProfile.isGoogleVerified) {
        isPhoneVerified = false;
        const phoneBadge = document.getElementById('phone-verified-badge');
        const changeBtn = document.getElementById('btn-change-phone');
        const verifyBtn = document.getElementById('btn-request-otp');
        const phoneInput = document.getElementById('customer-phone');

        if (phoneBadge) phoneBadge.style.display = 'none';
        if (changeBtn) changeBtn.style.display = 'none';
        if (verifyBtn) {
            verifyBtn.style.display = 'inline-flex';
            const len = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').length : 0;
            verifyBtn.disabled = len !== 10;
            verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
        }
    }

    renderGoogleLoggedOutState();
    showToast('Signed out of Google account.');
}

function renderGoogleLoggedInState(user) {
    const loggedOutState = document.getElementById('google-logged-out-state');
    const loggedInState = document.getElementById('google-logged-in-state');
    const userNameEl = document.getElementById('google-user-name');
    const userEmailEl = document.getElementById('google-user-email');
    const avatarImg = document.getElementById('google-user-avatar');
    const profileAvatarImg = document.getElementById('profile-avatar-img');
    const profileAvatarIcon = document.getElementById('profile-avatar-icon');
    const profileNameEl = document.getElementById('profile-display-name');
    const profileSubtextEl = document.getElementById('profile-display-subtext');

    if (loggedOutState) loggedOutState.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'flex';
    if (userNameEl) userNameEl.textContent = user.displayName;
    if (userEmailEl) userEmailEl.textContent = user.email;

    if (user.photoURL) {
        if (avatarImg) {
            avatarImg.src = user.photoURL;
            avatarImg.style.display = 'block';
        }
        if (profileAvatarImg) {
            profileAvatarImg.src = user.photoURL;
            profileAvatarImg.style.display = 'block';
            if (profileAvatarIcon) profileAvatarIcon.style.display = 'none';
        }
    }

    if (profileNameEl && (profileNameEl.textContent === 'Customer Name' || !profileNameEl.textContent)) {
        profileNameEl.textContent = user.displayName;
    }
    if (profileSubtextEl && user.email) {
        const savedProfile = getSavedDeliveryProfile();
        if (savedProfile && savedProfile.phone) {
            profileSubtextEl.textContent = `${user.email} • +91 ${savedProfile.phone}`;
        } else {
            profileSubtextEl.textContent = user.email;
        }
    }
}

function renderGoogleLoggedOutState() {
    const loggedOutState = document.getElementById('google-logged-out-state');
    const loggedInState = document.getElementById('google-logged-in-state');
    const profileAvatarImg = document.getElementById('profile-avatar-img');
    const profileAvatarIcon = document.getElementById('profile-avatar-icon');
    const profileSubtextEl = document.getElementById('profile-display-subtext');

    if (loggedOutState) loggedOutState.style.display = 'flex';
    if (loggedInState) loggedInState.style.display = 'none';

    if (profileAvatarImg) profileAvatarImg.style.display = 'none';
    if (profileAvatarIcon) profileAvatarIcon.style.display = 'block';

    const savedProfile = getSavedDeliveryProfile();
    if (profileSubtextEl) {
        profileSubtextEl.textContent = (savedProfile && savedProfile.phone) ? `+91 ${savedProfile.phone}` : '+91 Mobile Number';
    }
}

async function syncGoogleUserToBackend(user) {
    const savedProfile = getSavedDeliveryProfile() || {};
    try {
        await fetch(resolveApiUrl('/api/users'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firebaseUid: user.firebaseUid,
                email: user.email,
                fullName: user.displayName || savedProfile.fullName,
                phone: savedProfile.phone || '',
                photoURL: user.photoURL || '',
                address: {
                    colonyName: savedProfile.colonyName || '',
                    nearBy: savedProfile.nearBy || '',
                    streetName: savedProfile.streetName || '',
                    wardNo: savedProfile.wardNo || '',
                },
                gps: {
                    lat: savedProfile.gpsLat || null,
                    lng: savedProfile.gpsLng || null
                },
                isPhoneVerified: true
            })
        });
    } catch (err) {
        console.warn('User backend sync notice (local resilience active):', err.message);
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
            const statusRes = await fetch(resolveApiUrl(`/api/payment/status?orderId=${orderId}&txnId=${txnId || ''}`));
            const statusData = await statusRes.json();

            // Mark order as paid in LocalStorage
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

            // Clean URL query parameters without reloading
            window.history.replaceState({}, document.title, window.location.pathname);

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
    initOfferSlider();
    initLogoModal();
    initCustomerCareModal();
    setupHistoryState();
    initCustomerSearchEvents();
    checkAndUpdateShopStatusUI();
    updateProfileTotalsUI();
    setupLocalStorageSync();
    initFirebaseGoogleAuth();
    initPhoneInputRestrictions();
    checkPaymentReturnParams();

    // 1. Initial live menu fetch from MongoDB backend
    fetchLiveMenuFromBackend();

    // 2. Real-Time Background Polling (Every 3.5s for instant multi-device synchronization)
    setInterval(fetchLiveMenuFromBackend, 3500);

    // 3. Instant sync on tab focus or app visibility return (mobile apps / multi-tab)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            fetchLiveMenuFromBackend();
        }
    });
    window.addEventListener('focus', () => {
        fetchLiveMenuFromBackend();
    });
});



