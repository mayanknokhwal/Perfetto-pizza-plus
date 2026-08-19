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
// 3. FIXED BOTTOM NAVIGATION TAB CONTROLLER
// --------------------------------------------------------------------------
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
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
            toggleEditProfileForm(true);
            showToast('👋 Welcome! Please complete your profile and delivery address first.');
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
    if (!card) return;

    if (card.classList.contains('out-of-stock')) return;
    
    const pizzaList = getSubItems("Pizza");
    const item = pizzaList.find(p => p.id === pizzaId);
    if (!item || item.available === false) return;
    
    const selectedSize = card.getAttribute('data-selected-size') || 'M';
    const price = parseFloat(card.getAttribute('data-current-price')) || (item.prices ? item.prices[selectedSize] : 299);
    
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

const DEFAULT_RESTAURANT_LAT = 29.533736;
const DEFAULT_RESTAURANT_LNG = 73.447895;
const DEFAULT_DELIVERY_RADIUS_KM = 10;

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
    const existingIndex = cart.findIndex(item => item.name === name);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({ name, price, qty: 1, img });
    }
    saveCartToStorage();
    updateCartUI();
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

    // 3. Recalculate Subtotal, Thresholds & Delivery Fee
    const minOrderVal = getMinOrderValue();
    const freeDeliveryLim = getFreeDeliveryLimit();

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    let delivery = 0.00;
    if (cart.length > 0) {
        if (subtotal >= freeDeliveryLim) {
            delivery = 0.00; // Condition C: Free Delivery Unlocked
        } else {
            delivery = 49.00; // Standard Delivery Fee
        }
    }

    const tax = subtotal * 0.05;
    const total = subtotal + delivery + tax;

    const subtotalEl = document.getElementById('cart-subtotal');
    const deliveryEl = document.getElementById('cart-delivery');
    const taxEl = document.getElementById('cart-tax');
    const totalEl = document.getElementById('cart-total');

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

    if (deliveryEl) {
        if (cart.length > 0 && subtotal >= freeDeliveryLim) {
            deliveryEl.innerHTML = `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.85rem; margin-right: 4px;">₹49</span><span class="free-delivery-tag">FREE</span>`;
        } else {
            deliveryEl.textContent = formatPrice(delivery);
        }
    }

    if (taxEl) taxEl.textContent = formatPrice(tax);
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
                const phone = (profile.phone || '').replace(/[^0-9]/g, '').slice(0, 10);
                const colonyName = (profile.colonyName || '').trim();
                const nearBy = (profile.nearBy || '').trim();
                const streetName = (profile.streetName || '').trim();
                const wardNo = (profile.wardNo || '').trim();
                const gpsLat = profile.gpsLat !== undefined && profile.gpsLat !== null ? parseFloat(profile.gpsLat) : null;
                const gpsLng = profile.gpsLng !== undefined && profile.gpsLng !== null ? parseFloat(profile.gpsLng) : null;

                if (fullName && phone && phone.length === 10 && colonyName && nearBy && streetName && wardNo && gpsLat !== null && gpsLng !== null) {
                    return { fullName, phone, colonyName, nearBy, streetName, wardNo, gpsLat, gpsLng };
                }
            }
        }
    } catch (e) {
        console.error('Error reading delivery profile:', e);
    }
    return null;
}

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

    const minOrderVal = getMinOrderValue();
    if (subtotal < minOrderVal) {
        const diff = (minOrderVal - subtotal).toFixed(2);
        showToast(`Minimum order is ${formatPrice(minOrderVal)}. Add ${formatPrice(diff)} more to place your order.`);
        return;
    }

    // Check if delivery profile already exists and is complete
    const savedProfile = getSavedDeliveryProfile();
    if (savedProfile) {
        // Automatically place the order with existing profile
        executeOrderPlacement(savedProfile);
        return;
    }

    // If missing or incomplete, redirect directly to Profile tab form and open it!
    switchTab('profile', true);
    updateProfileTotalsUI();
    toggleEditProfileForm(true);
    showToast('Please enter your delivery details to complete checkout.');
}

function executeOrderPlacement(profile) {
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const tax = subtotal * 0.05;
    const deliveryFee = subtotal >= getFreeDeliveryLimit() ? 0 : 49;
    const grandTotal = subtotal + tax + deliveryFee;

    // Calculate Sequential Order Number (#1, #2, #3, ...)
    let nextOrderSeq = 1;
    let ordersList = [];
    try {
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        if (storedOrders) {
            ordersList = JSON.parse(storedOrders);
            if (Array.isArray(ordersList)) {
                // Find maximum sequential number among existing orders
                const maxNum = ordersList.reduce((max, o) => {
                    const rawId = (o.id || o.orderId || '').toString().replace(/[^0-9]/g, '');
                    const num = parseInt(rawId, 10);
                    return !isNaN(num) && num > max ? num : max;
                }, 0);
                nextOrderSeq = maxNum + 1;
            } else {
                ordersList = [];
            }
        }
    } catch (e) {
        ordersList = [];
    }

    const orderId = nextOrderSeq.toString();
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
        customerPhone: profile.phone,
        customerName: profile.fullName,
        phone: profile.phone,
        address: `${profile.colonyName}, Near: ${profile.nearBy}, ${profile.streetName}, Ward No. ${profile.wardNo}`,
        deliveryDetails: {
            colonyName: profile.colonyName,
            nearBy: profile.nearBy,
            streetName: profile.streetName,
            wardNo: profile.wardNo
        },
        timeAgo: `${timeFormatted} • Just now`,
        items: orderItems,
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        deliveryFee: deliveryFee,
        total: Math.round(grandTotal),
        paymentStatus: 'Cash on Delivery',
        status: 'new',
        createdAt: now.toISOString()
    };

    // Save order to localStorage
    try {
        ordersList.unshift(newOrder);
        localStorage.setItem('perfettoCustomerOrders', JSON.stringify(ordersList));
    } catch (e) {
        console.error('Error saving order:', e);
    }

    showToast('🎉 Order placed successfully! Arriving in 25 mins.');
    cart = [];
    saveCartToStorage();
    updateCartUI();
    updateProfileTotalsUI();
    switchTab('home', true);
}

function openDeliveryModal() {
    const modal = document.getElementById('delivery-modal');
    if (!modal) return;

    // Update order summary inside modal
    const itemCount = cart.reduce((sum, i) => sum + (i.qty || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const tax = subtotal * 0.05;
    const deliveryFee = (cart.length > 0 && subtotal > 0) ? (subtotal >= getFreeDeliveryLimit() ? 0 : 49) : 0;
    const total = subtotal + tax + deliveryFee;

    const itemCountEl = document.getElementById('modal-item-count');
    const orderTotalEl = document.getElementById('modal-order-total');
    if (itemCountEl) itemCountEl.textContent = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
    if (orderTotalEl) orderTotalEl.textContent = formatPrice(total);

    // Pre-fill profile if saved previously in localStorage
    try {
        const savedProfile = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            if (profile.fullName && document.getElementById('customer-fullname')) {
                document.getElementById('customer-fullname').value = profile.fullName;
            }
            if (profile.phone && document.getElementById('customer-phone')) {
                document.getElementById('customer-phone').value = profile.phone;
            }
            if (profile.colonyName && document.getElementById('customer-colony-name')) {
                document.getElementById('customer-colony-name').value = profile.colonyName;
            }
            if (profile.nearBy && document.getElementById('customer-nearby')) {
                document.getElementById('customer-nearby').value = profile.nearBy;
            }
            if (profile.streetName && document.getElementById('customer-street-name')) {
                document.getElementById('customer-street-name').value = profile.streetName;
            }
            if (profile.wardNo && document.getElementById('customer-ward-no')) {
                document.getElementById('customer-ward-no').value = profile.wardNo;
            }
        }
    } catch (e) {
        console.error('Error loading saved delivery profile:', e);
    }

    setupDeliveryInputValidation();
    updateProfileTotalsUI();
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
    const modal = document.getElementById('delivery-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

// Attach input restrictions to mobile number field (10 digits only)
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('customer-phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    }
});

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
}

function handlePhoneInputChange(input) {
    if (!input) return;
    input.value = input.value.replace(/[^0-9]/g, '').slice(0, 10);
    // Reset verification state if phone number changes
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

function handleChangePhoneNumber() {
    const phoneInput = document.getElementById('customer-phone');
    const badge = document.getElementById('phone-verified-badge');
    const changeBtn = document.getElementById('btn-change-phone');
    const verifyBtn = document.getElementById('btn-request-otp');
    const otpBox = document.getElementById('otp-verification-box');

    isPhoneVerified = false;
    currentTargetPhone = null;

    if (otpResendTimerId) {
        clearInterval(otpResendTimerId);
        otpResendTimerId = null;
    }

    if (badge) badge.style.display = 'none';
    if (changeBtn) changeBtn.style.display = 'none';
    if (otpBox) otpBox.style.display = 'none';

    if (phoneInput) {
        phoneInput.readOnly = false;
        phoneInput.style.backgroundColor = 'var(--bg-input)';
        phoneInput.style.cursor = 'text';
        phoneInput.focus();
        phoneInput.select();
    }

    if (verifyBtn) {
        verifyBtn.style.display = 'inline-flex';
        const len = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '').length : 0;
        verifyBtn.disabled = len !== 10;
        verifyBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span class="verify-text">Verify</span>';
    }

    showToast('✏️ Mobile number unlocked. Enter number and verify.');
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

    if (cleanPhone.length < 10) {
        showToast('Please enter a valid 10-digit mobile number!');
        const phoneEl = document.getElementById('customer-phone');
        if (phoneEl) {
            phoneEl.classList.add('invalid-field');
            phoneEl.focus();
        }
        return;
    }

    // MANDATORY OTP VERIFICATION CHECK
    if (!isPhoneVerified) {
        showToast('⚠️ Please verify your mobile number before saving your profile!');
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

    // Save profile with GPS Coordinates to localStorage
    const profile = { 
        fullName, 
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
    } catch (e) {
        console.error('Error saving delivery profile to localStorage:', e);
    }

    // Immediately update header UI & form inputs
    renderProfileHeaderAndInputs(profile);
    updateProfileTotalsUI();
    toggleEditProfileForm(false);

    showToast('✅ Profile & Home Address saved successfully!');
}

function handleFinalOrderSubmit(event) {
    if (event) event.preventDefault();
    handleSaveProfile(event);
}

function renderProfileHeaderAndInputs(profile) {
    const nameEl = document.getElementById('profile-display-name');
    const subtextEl = document.getElementById('profile-display-subtext');
    const badge = document.getElementById('phone-verified-badge');
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

    if (profile && typeof profile === 'object') {
        if (nameEl) {
            nameEl.textContent = profile.fullName ? profile.fullName : 'Customer Name';
        }
        if (subtextEl) {
            subtextEl.textContent = profile.phone ? `+91 ${profile.phone}` : '+91 Mobile Number';
        }

        // Set phone verification state
        if (profile.isVerified) {
            isPhoneVerified = true;
            if (badge) badge.style.display = 'inline-flex';
            if (changeBtn) changeBtn.style.display = 'inline-flex';
            if (verifyBtn) verifyBtn.style.display = 'none';
            if (phoneInput) {
                phoneInput.readOnly = true;
                phoneInput.style.backgroundColor = 'var(--bg-surface-elevated)';
                phoneInput.style.cursor = 'not-allowed';
            }
        } else {
            isPhoneVerified = false;
            if (badge) badge.style.display = 'none';
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
        if (profile.phone && phoneInput && (!phoneInput.value || phoneInput.value === '')) {
            phoneInput.value = profile.phone;
            if (!profile.isVerified && verifyBtn) {
                verifyBtn.disabled = profile.phone.length !== 10;
            }
        }
        if (profile.colonyName && colonyInput && (!colonyInput.value || colonyInput.value === '')) colonyInput.value = profile.colonyName;
        if (profile.nearBy && nearbyInput && (!nearbyInput.value || nearbyInput.value === '')) nearbyInput.value = profile.nearBy;
        if (profile.streetName && streetInput && (!streetInput.value || streetInput.value === '')) streetInput.value = profile.streetName;
        if (profile.wardNo && wardInput && (!wardInput.value || wardInput.value === '')) wardInput.value = profile.wardNo;
    } else {
        isPhoneVerified = false;
        currentCustomerGps = null;
        if (nameEl) nameEl.textContent = 'Customer Name';
        if (subtextEl) subtextEl.textContent = '+91 Mobile Number';
        if (badge) badge.style.display = 'none';
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

function updateProfileTotalsUI() {
    // Update order total inside modal / summary if needed
    const itemCount = cart.reduce((sum, i) => sum + (i.qty || 0), 0);
    const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
    const tax = subtotal * 0.05;
    const deliveryFee = (cart.length > 0 && subtotal > 0) ? (subtotal >= 499 ? 0 : 49) : 0;
    const total = subtotal + tax + deliveryFee;

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
    } catch (e) {}

    const totalOrdersEl = document.getElementById('stat-total-orders');
    if (totalOrdersEl) totalOrdersEl.textContent = orderCount;

    // Update profile display name/phone & prefill inputs
    let currentProfile = null;
    try {
        const savedProfile = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (savedProfile) {
            currentProfile = JSON.parse(savedProfile);
        }
    } catch (e) {}

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
    } catch (e) {}

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
    } catch (e) {}

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
            currentPos = 1;
            setPosition(currentPos, false);
            updateDots(0);
        } else if (currentPos <= 0) {
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

    // Mouse drag support for desktop
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
        // 2. Thresholds changed by Admin (Min Order, Free Delivery)
        if (!e.key || e.key === MIN_ORDER_KEY || e.key === FREE_DELIVERY_KEY) {
            updateCartUI();
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
            if (activeTabName === 'profile') {
                updateProfileTotalsUI();
            }
        }
    });
}

// --------------------------------------------------------------------------
// INITIALIZATION ON DOM LOAD
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupNavigation();
    setupFastFoodCards();
    updateCartUI();
    initOfferSlider();
    initLogoModal();
    setupHistoryState();
    initCustomerSearchEvents();
    checkAndUpdateShopStatusUI();
    updateProfileTotalsUI();
    setupLocalStorageSync();
});


