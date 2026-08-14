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
    return [
        {
            name: 'Pizza (M)',
            price: 299,
            qty: 1,
            img: 'https://i.ibb.co/21fs0TqL/pizza.png'
        }
    ];
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
        appLogo.src = LOGO_DARK;
    } else {
        htmlElement.setAttribute('data-theme', 'light');
        appLogo.src = LOGO_LIGHT;
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
        if (isClosed) {
            checkoutBtn.setAttribute('disabled', 'true');
        } else {
            checkoutBtn.removeAttribute('disabled');
        }
    }
}

// --------------------------------------------------------------------------
// ORDER & DELIVERY THRESHOLDS SYSTEM
// --------------------------------------------------------------------------
const MIN_ORDER_KEY = 'minOrderValue';
const FREE_DELIVERY_KEY = 'freeDeliveryLimit';

function getMinOrderValue() {
    const val = localStorage.getItem(MIN_ORDER_KEY);
    return val !== null ? parseFloat(val) : 80;
}

function getFreeDeliveryLimit() {
    const val = localStorage.getItem(FREE_DELIVERY_KEY);
    return val !== null ? parseFloat(val) : 500;
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
    // 1. Update Cart Badge Count
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    cartBadge.textContent = totalCount;
    cartBadge.style.display = totalCount > 0 ? 'flex' : 'none';

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

const DELIVERY_PROFILE_KEY = 'customerDeliveryProfile';

function processCheckout() {
    if (getCustomerShopStatus() === 'closed') {
        showToast('This time shop is closed. We are not accepting orders right now.');
        return;
    }
    const minOrderVal = getMinOrderValue();
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    if (cart.length === 0) {
        showToast('Please add items to your cart first!');
        return;
    }

    if (subtotal < minOrderVal) {
        const diff = (minOrderVal - subtotal).toFixed(2);
        showToast(`Minimum order is ${formatPrice(minOrderVal)}. Add ${formatPrice(diff)} more to place your order.`);
        return;
    }

    // Redirect directly to Profile tab!
    switchTab('profile', true);
    updateProfileTotalsUI();
    showToast('Please enter your delivery details to complete checkout.');
    
    // Scroll to delivery details form
    const formCard = document.querySelector('.profile-delivery-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
}

function openDeliveryModal() {
    const modal = document.getElementById('delivery-modal');
    if (!modal) return;

    // Update order summary inside modal
    const itemCount = cart.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * 0.05;
    const deliveryFee = subtotal >= getFreeDeliveryLimit() ? 0 : 49;
    const total = subtotal + tax + deliveryFee;

    const itemCountEl = document.getElementById('modal-item-count');
    const orderTotalEl = document.getElementById('modal-order-total');
    if (itemCountEl) itemCountEl.textContent = `${itemCount} item${itemCount > 1 ? 's' : ''}`;
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

function handleSendOTP(event) {
    if (event) event.preventDefault();
    const phoneInput = document.getElementById('customer-phone');
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!phone) {
        if (phoneInput) {
            phoneInput.classList.add('invalid-field');
            phoneInput.focus();
        }
        showToast('Please enter your mobile number first!');
        return;
    }

    if (phoneInput) phoneInput.classList.remove('invalid-field');
    showToast(`📱 OTP sent to ${phone}!`);
}

function handleFinalOrderSubmit(event) {
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
        showToast('Please fill in all required delivery details!');
        return;
    }

    const fullName = document.getElementById('customer-fullname').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const colonyName = document.getElementById('customer-colony-name').value.trim();
    const nearBy = document.getElementById('customer-nearby').value.trim();
    const streetName = document.getElementById('customer-street-name').value.trim();
    const wardNo = document.getElementById('customer-ward-no').value.trim();

    // Save profile for future convenience
    const profile = { fullName, phone, colonyName, nearBy, streetName, wardNo };
    try {
        localStorage.setItem(DELIVERY_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.error('Error saving delivery profile:', e);
    }

    // Process & store order object
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * 0.05;
    const deliveryFee = subtotal >= getFreeDeliveryLimit() ? 0 : 49;
    const grandTotal = subtotal + tax + deliveryFee;

    const newOrder = {
        id: (Math.floor(1000 + Math.random() * 9000)).toString(),
        customerName: fullName,
        phone: phone,
        address: `${colonyName}, Near: ${nearBy}, ${streetName}, Ward No. ${wardNo}`,
        timeAgo: 'Just Now',
        items: cart.map(item => ({
            name: `${item.qty}x ${item.name} (${item.size || 'Standard'})`,
            notes: ''
        })),
        total: Math.round(grandTotal),
        paymentStatus: 'Cash on Delivery',
        status: 'new',
        createdAt: new Date().toISOString()
    };

    // Save order to localStorage
    try {
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        const ordersList = storedOrders ? JSON.parse(storedOrders) : [];
        ordersList.unshift(newOrder);
        localStorage.setItem('perfettoCustomerOrders', JSON.stringify(ordersList));
    } catch (e) {
        console.error('Error saving order:', e);
    }

    showToast('🎉 Order placed successfully! Arriving in 25 mins.');
    cart = [];
    saveCartToStorage();
    updateCartUI();
    switchTab('home', true);
}

function updateProfileTotalsUI() {
    // Update order total inside profile form if cart has items
    const itemCount = cart.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = subtotal * 0.05;
    const deliveryFee = subtotal >= getFreeDeliveryLimit() ? 0 : 49;
    const total = subtotal + tax + deliveryFee;

    const itemCountEl = document.getElementById('modal-item-count');
    const orderTotalEl = document.getElementById('modal-order-total');
    if (itemCountEl) itemCountEl.textContent = `${itemCount} item${itemCount > 1 ? 's' : ''}`;
    if (orderTotalEl) orderTotalEl.textContent = formatPrice(total);

    // Update stats counters to 0 default
    let orderCount = 0;
    try {
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        if (storedOrders) {
            const list = JSON.parse(storedOrders);
            if (Array.isArray(list)) orderCount = list.length;
        }
    } catch (e) {}

    const totalOrdersEl = document.getElementById('stat-total-orders');
    const rewardsEl = document.getElementById('stat-rewards-pts');
    const ratingEl = document.getElementById('stat-rating');

    if (totalOrdersEl) totalOrdersEl.textContent = orderCount;
    if (rewardsEl) rewardsEl.textContent = '0';
    if (ratingEl) ratingEl.textContent = '0 ★';

    // Update profile display name/phone if profile saved
    try {
        const savedProfile = localStorage.getItem(DELIVERY_PROFILE_KEY);
        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            const nameEl = document.getElementById('profile-display-name');
            const subtextEl = document.getElementById('profile-display-subtext');
            if (nameEl && profile.fullName) nameEl.textContent = profile.fullName;
            if (subtextEl && profile.phone) subtextEl.textContent = `+91 ${profile.phone}`;
            
            // Pre-fill inputs if empty
            if (profile.fullName && document.getElementById('customer-fullname')) document.getElementById('customer-fullname').value = profile.fullName;
            if (profile.phone && document.getElementById('customer-phone')) document.getElementById('customer-phone').value = profile.phone;
            if (profile.colonyName && document.getElementById('customer-colony-name')) document.getElementById('customer-colony-name').value = profile.colonyName;
            if (profile.nearBy && document.getElementById('customer-nearby')) document.getElementById('customer-nearby').value = profile.nearBy;
            if (profile.streetName && document.getElementById('customer-street-name')) document.getElementById('customer-street-name').value = profile.streetName;
            if (profile.wardNo && document.getElementById('customer-ward-no')) document.getElementById('customer-ward-no').value = profile.wardNo;
        }
    } catch (e) {}
}

function toggleSavedAddressesView() {
    const box = document.getElementById('saved-address-display-box');
    const historyBox = document.getElementById('order-history-display-box');
    if (historyBox) historyBox.style.display = 'none';

    if (!box) return;
    if (box.style.display === 'block') {
        box.style.display = 'none';
        return;
    }

    renderSavedAddressDetails();
    box.style.display = 'block';
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
                textContentEl.innerHTML = `
                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; margin-bottom: 6px;">
                        <i class="fa-solid fa-user" style="color: var(--primary-orange); margin-right: 6px;"></i>${p.fullName || 'Customer'} (${p.phone || ''})
                    </div>
                    <div><strong style="color: var(--text-muted);">Colony:</strong> ${p.colonyName || 'N/A'}</div>
                    <div><strong style="color: var(--text-muted);">Landmark:</strong> ${p.nearBy || 'N/A'}</div>
                    <div><strong style="color: var(--text-muted);">Street:</strong> ${p.streetName || 'N/A'}</div>
                    <div><strong style="color: var(--text-muted);">Ward No:</strong> ${p.wardNo || 'N/A'}</div>
                `;
                return;
            }
        }
    } catch (e) {}

    textContentEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">No saved address found. Please fill out the Delivery Details form above.</span>`;
}

function editSavedAddress() {
    const formCard = document.querySelector('.profile-delivery-card');
    if (formCard) formCard.scrollIntoView({ behavior: 'smooth' });
    const nameInput = document.getElementById('customer-fullname');
    if (nameInput) nameInput.focus();
    showToast('You can update your address details in the form above.');
}

function toggleOrderHistoryView() {
    const box = document.getElementById('order-history-display-box');
    const addressBox = document.getElementById('saved-address-display-box');
    if (addressBox) addressBox.style.display = 'none';

    if (!box) return;
    if (box.style.display === 'block') {
        box.style.display = 'none';
        return;
    }

    renderOrderHistoryDetails();
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderOrderHistoryDetails() {
    const listEl = document.getElementById('order-history-list');
    if (!listEl) return;

    try {
        const storedOrders = localStorage.getItem('perfettoCustomerOrders');
        if (storedOrders) {
            const orders = JSON.parse(storedOrders);
            if (Array.isArray(orders) && orders.length > 0) {
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

    listEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">No order history found yet.</span>`;
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
// 8. SMART DAILY OFFER SLIDER (AUTO-SCROLL & TOUCH GESTURES)
// --------------------------------------------------------------------------
function initOfferSlider() {
    const wrapper = document.getElementById('offer-slider-wrapper');
    const track = document.getElementById('offer-slider-track');
    const dotsContainer = document.getElementById('offer-dots');
    if (!wrapper || !track || !dotsContainer) return;

    const slides = track.querySelectorAll('.offer-slide');
    const dots = dotsContainer.querySelectorAll('.dot');
    const totalSlides = slides.length;
    let currentIndex = 0;

    let autoScrollInterval = null;
    let pauseTimeout = null;

    function goToSlide(index) {
        currentIndex = (index + totalSlides) % totalSlides;
        const translateX = -(currentIndex * (100 / totalSlides));
        track.style.transform = `translateX(${translateX}%)`;

        dots.forEach((dot, idx) => {
            if (idx === currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    function nextSlide() {
        goToSlide(currentIndex + 1);
    }

    function prevSlide() {
        goToSlide(currentIndex - 1);
    }

    function startAutoScroll() {
        stopAutoScroll();
        autoScrollInterval = setInterval(nextSlide, 3000);
    }

    function stopAutoScroll() {
        if (autoScrollInterval) {
            clearInterval(autoScrollInterval);
            autoScrollInterval = null;
        }
    }

    function handleUserInteraction() {
        stopAutoScroll();
        if (pauseTimeout) {
            clearTimeout(pauseTimeout);
        }
        // Pause auto-scrolling for 6 seconds after manual interaction, then resume 3s loop
        pauseTimeout = setTimeout(() => {
            startAutoScroll();
        }, 6000);
    }

    // Dot click navigation
    dots.forEach((dot, idx) => {
        dot.addEventListener('click', () => {
            goToSlide(idx);
            handleUserInteraction();
        });
    });

    // Touch & Swipe gestures
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

    // Start 3-second auto-scroll loop
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
});
