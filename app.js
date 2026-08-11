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

function getSubItems(categoryName, categoryImg) {
    if (categorySubItems[categoryName]) {
        return categorySubItems[categoryName].map(item => ({
            ...item,
            img: item.img || categoryImg
        }));
    }
    
    return [
        { name: `${categoryName} Option 1 (Placeholder)`, desc: `Freshly prepared item variation for ${categoryName}`, price: 179.00, tag: "Variety 1", img: categoryImg },
        { name: `${categoryName} Option 2 (Placeholder)`, desc: `Special chef recipe variation for ${categoryName}`, price: 199.00, tag: "Variety 2", img: categoryImg },
        { name: `${categoryName} Option 3 (Placeholder)`, desc: `Deluxe portion variation for ${categoryName}`, price: 219.00, tag: "Variety 3", img: categoryImg },
        { name: `${categoryName} Option 4 (Placeholder)`, desc: `Combo style variation for ${categoryName}`, price: 259.00, tag: "Variety 4", img: categoryImg }
    ];
}

function changePizzaSize(pizzaId, size, price, event) {
    if (event) event.stopPropagation();
    
    const card = document.querySelector(`.pizza-card[data-pizza-id="${pizzaId}"]`);
    if (!card) return;
    
    card.setAttribute('data-selected-size', size);
    card.setAttribute('data-current-price', price);
    
    // Update active state without applying any background color fill to size buttons
    const sizeBtns = card.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
        if (btn.getAttribute('data-size') === size) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
        btn.classList.remove('active'); // Remove active color fill
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
    
    const pizzaList = categorySubItems["Pizza"];
    const item = pizzaList.find(p => p.id === pizzaId);
    if (!item) return;
    
    const selectedSize = card.getAttribute('data-selected-size') || 'M';
    const price = parseFloat(card.getAttribute('data-current-price')) || item.prices[selectedSize];
    
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
                       
                return `
                <div class="pizza-card" data-pizza-id="${item.id}" data-selected-size="M" data-current-price="${item.prices.M}">
                    <div class="pizza-card-image-wrapper">
                        <img src="${item.img}" alt="${item.name}" class="pizza-card-img" loading="lazy">
                    </div>
                    <div class="pizza-card-body">
                        <h4 class="pizza-card-title">${item.name}</h4>
                        ${descMarkup}
                        
                        <div class="pizza-size-selector">
                            <span class="size-label">Size:</span>
                            <div class="size-options">
                                <button class="size-btn" data-size="S" onclick="changePizzaSize('${item.id}', 'S', ${item.prices.S}, event)">S</button>
                                <button class="size-btn selected" data-size="M" onclick="changePizzaSize('${item.id}', 'M', ${item.prices.M}, event)">M</button>
                                <button class="size-btn" data-size="L" onclick="changePizzaSize('${item.id}', 'L', ${item.prices.L}, event)">L</button>
                            </div>
                        </div>
                        
                        <div class="pizza-price-row">
                            <span class="price-prefix">Price:</span>
                            <span class="pizza-card-price" id="price-${item.id}">${formatPrice(item.prices.M)}</span>
                        </div>
                    </div>
                    <button class="pizza-add-cart-btn" onclick="addPizzaToCart('${item.id}', event)">
                        <i class="fa-solid fa-cart-shopping"></i> ADD TO CART
                    </button>
                </div>
                `;
            }).join('');
        } else {
            subItemsGrid.classList.remove('pizza-grid-container');
            subItemsGrid.innerHTML = items.map(item => `
                <div class="sub-item-card">
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
                            <button class="add-subitem-btn" onclick="addToCart('${item.name.replace(/'/g, "\\'")}', ${item.price}, '${item.img}')">
                                <i class="fa-solid fa-plus"></i> Add
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
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

    // 3. Recalculate Subtotal & Totals
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const delivery = cart.length > 0 ? 49.00 : 0.00;
    const tax = subtotal * 0.05;
    const total = subtotal + delivery + tax;

    document.getElementById('cart-subtotal').textContent = formatPrice(subtotal);
    document.getElementById('cart-delivery').textContent = formatPrice(delivery);
    document.getElementById('cart-tax').textContent = formatPrice(tax);
    document.getElementById('cart-total').textContent = formatPrice(total);
}

function processCheckout() {
    if (cart.length === 0) {
        showToast('Please add items to your cart first!');
        return;
    }
    showToast('🎉 Order placed successfully! Arriving in 25 mins.');
    cart = [];
    saveCartToStorage();
    updateCartUI();
    switchTab('home', true);
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
        // 1. If logo modal is active, close it first
        const logoModal = document.getElementById('logo-modal');
        if (logoModal && logoModal.classList.contains('active')) {
            if (window.closeLogoModal) {
                window.closeLogoModal(true);
            }
            return;
        }

        // 2. Navigate SPA view based on history state
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
});
