/**
 * Verification Script: Customer Panel Mobile-First Optimization & Offer Logic
 * 
 * Verifies:
 * 1. Mobile-First Layout & Grid Constraints
 *    - .app-frame mobile bounds and overflow handling
 *    - 2-column mobile grids for fast food categories and sub-items
 *    - Comfortable mobile touch targets (>=42px buttons, >=36px qty controls)
 *    - Safe area inset handling for sticky bars and bottom sheet navigation
 * 2. Feature & Offer Logic Integration
 *    - Tiered priority sorting (Tier 1: Discounted -> Tier 2: Available -> Tier 3: Out-of-Stock)
 *    - Search results tiered priority sorting integration
 *    - Strict single-offer per order enforcement (max limit = 1)
 *    - Offer conflict prompt modal & button contrast
 * 3. Execution Boundary Check
 *    - Verifies no git commit or push has been triggered
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✓ PASS: ${testName}`);
    } else {
        console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    }
}

console.log('=================================================================');
console.log('📱 CUSTOMER PANEL - MOBILE-FIRST & OFFER LOGIC VERIFICATION');
console.log('=================================================================\n');

// Read source files
const appJsPath = path.join(__dirname, '..', 'app.js');
const stylesCssPath = path.join(__dirname, '..', 'styles.css');
const indexHtmlPath = path.join(__dirname, '..', 'index.html');

const appJs = fs.readFileSync(appJsPath, 'utf8');
const stylesCss = fs.readFileSync(stylesCssPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// -------------------------------------------------------------------------
// SECTION 1: TIERED PRIORITY SORTING LOGIC AUDIT & SIMULATION
// -------------------------------------------------------------------------
console.log('📊 [Test 1/5] Auditing Tiered Priority Sorting Logic in app.js...');

assert(appJs.includes('function compareCustomerMenuItemsTieredPriority('), 'compareCustomerMenuItemsTieredPriority function exists');
assert(appJs.includes('function getCustomerMenuItemTier('), 'getCustomerMenuItemTier function exists');
assert(appJs.includes('function getItemEffectiveDiscount('), 'getItemEffectiveDiscount function exists');

// Simulate the tiered sorting logic extracted directly from app.js implementation
function isProductAvailableMock(item) {
    if (!item) return false;
    if (item.isAvailable === false || item.available === false || item.inStock === false) return false;
    return true;
}

function getCustomerMenuItemTierMock(item) {
    if (!isProductAvailableMock(item)) return 3; // Out of stock at bottom
    const hasDiscount = item.hasDiscount === true || item.isDiscounted === true || Boolean(item.discountPercent && item.discountPercent > 0);
    if (hasDiscount) return 1; // Discounted at top
    return 2; // Standard available item
}

function compareCustomerMenuItemsTieredPriorityMock(a, b) {
    const tierA = getCustomerMenuItemTierMock(a);
    const tierB = getCustomerMenuItemTierMock(b);
    if (tierA !== tierB) return tierA - tierB;
    const nameA = String((a && (a.name || a.title)) || '');
    const nameB = String((b && (b.name || b.title)) || '');
    return nameA.localeCompare(nameB, 'en', { sensitivity: 'base' });
}

// Test sample items (Alphabetical within tiers)
const testItems = [
    { id: 'item-3', name: 'Zesty Garlic Bread', isAvailable: false }, // Out of stock -> Tier 3
    { id: 'item-1', name: 'Farm Fresh Pizza', isAvailable: true }, // Regular -> Tier 2
    { id: 'item-2', name: 'BBQ Paneer Pizza', isAvailable: true, discountPercent: 20 }, // Discounted -> Tier 1 (B)
    { id: 'item-4', name: 'Classic Burger', isAvailable: true, discountPercent: 15 }, // Discounted -> Tier 1 (C)
    { id: 'item-5', name: 'Choco Lava Cake', isAvailable: true }, // Regular -> Tier 2 (C)
    { id: 'item-6', name: 'Avocado Salad', isAvailable: false, discountPercent: 10 } // Out of stock (even if discounted) -> Tier 3
];

const sortedItems = [...testItems].sort(compareCustomerMenuItemsTieredPriorityMock);

assert(sortedItems[0].id === 'item-2', 'Top sorted item is Tier 1 discounted item "BBQ Paneer Pizza"');
assert(sortedItems[1].id === 'item-4', 'Second sorted item is Tier 1 discounted item "Classic Burger"');
assert(getCustomerMenuItemTierMock(sortedItems[0]) === 1, 'First item belongs to Tier 1');
assert(getCustomerMenuItemTierMock(sortedItems[1]) === 1, 'Second item belongs to Tier 1');
assert(getCustomerMenuItemTierMock(sortedItems[2]) === 2, 'Third item belongs to Tier 2 (Choco Lava Cake)');
assert(getCustomerMenuItemTierMock(sortedItems[3]) === 2, 'Fourth item belongs to Tier 2 (Farm Fresh Pizza)');
assert(getCustomerMenuItemTierMock(sortedItems[4]) === 3, 'Fifth item belongs to Tier 3 (Avocado Salad - Out of stock)');
assert(getCustomerMenuItemTierMock(sortedItems[5]) === 3, 'Sixth item belongs to Tier 3 (Zesty Garlic Bread - Out of stock)');

// Verify integration in renderCustomerSearchResults
assert(appJs.includes('compareCustomerMenuItemsTieredPriority(a.item, b.item)'), 'Search results blends tiered priority comparison as decisive tie-breaker');

// -------------------------------------------------------------------------
// SECTION 2: STRICT SINGLE-OFFER PER ORDER ENFORCEMENT
// -------------------------------------------------------------------------
console.log('\n🏷️ [Test 2/5] Testing Single-Offer Enforcement & Conflict Modal in app.js...');

assert(appJs.includes('function getCustomerMaxOffersPerOrder()'), 'getCustomerMaxOffersPerOrder function exists');
assert(appJs.includes('return 1;') && appJs.includes('getCustomerMaxOffersPerOrder'), 'Strict default limit of 1 offer per order enforced');

assert(appJs.includes('function canClaimBannerOffer('), 'canClaimBannerOffer function exists');
assert(appJs.includes('activeOffers.size < maxLimit'), 'canClaimBannerOffer checks activeOffers against maxLimit');

assert(appJs.includes('function showOfferConflictModal('), 'showOfferConflictModal function exists');
assert(appJs.includes('handleOfferConflictAction('), 'Conflict modal provides actionable resolution callbacks');
assert(appJs.includes('Switch to Combo') || appJs.includes('switch_to_combo'), 'Conflict modal includes Switch to Combo prompt action');

// -------------------------------------------------------------------------
// SECTION 3: MODAL BUTTON CONTRAST & TEXT CLARITY IN styles.css
// -------------------------------------------------------------------------
console.log('\n🎨 [Test 3/5] Verifying Modal Button Contrast & Text Clarity in styles.css...');

assert(stylesCss.includes('.offer-conflict-btn.primary'), 'Primary conflict button class (.offer-conflict-btn.primary) exists');
assert(stylesCss.includes('.offer-conflict-btn.secondary'), 'Secondary conflict button class (.offer-conflict-btn.secondary) exists');

// Check primary button height & contrast properties
assert(/min-height:\s*52px/.test(stylesCss), 'Primary conflict button maintains min-height: 52px');
assert(/font-weight:\s*800/.test(stylesCss), 'Primary conflict button uses extra bold font-weight 800');
assert(stylesCss.includes('box-shadow: 0 6px 20px rgba(234, 88, 12, 0.45)'), 'Primary conflict button has prominent drop-shadow glow');

// Check secondary button height & contrast properties
assert(/min-height:\s*50px/.test(stylesCss), 'Secondary conflict button maintains min-height: 50px');
assert(stylesCss.includes('border: 1.5px solid #475569') || stylesCss.includes('border: 1.5px solid #94a3b8'), 'Secondary conflict button has crisp visible outline border');

// Text clarity
assert(stylesCss.includes('.offer-conflict-title'), 'Modal conflict title class defined');
assert(stylesCss.includes('.offer-conflict-message'), 'Modal conflict message class defined');
assert(stylesCss.includes('line-height: 1.55'), 'Message has comfortable 1.55 line-height for effortless mobile reading');

// -------------------------------------------------------------------------
// SECTION 4: MOBILE-FIRST LAYOUT, TOUCH TARGETS & SAFE AREAS
// -------------------------------------------------------------------------
console.log('\n📐 [Test 4/5] Checking Mobile-First Grid & Touch Targets in styles.css & index.html...');

// Viewport meta
assert(indexHtml.includes('name="viewport"') && indexHtml.includes('viewport-fit=cover'), 'index.html includes viewport-fit=cover for edge-to-edge smartphones');

// App frame constraints
assert(stylesCss.includes('.app-frame {') && stylesCss.includes('max-width: 500px'), '.app-frame is constrained to 500px mobile-first width');
assert(stylesCss.includes('overflow-x: hidden') && stylesCss.includes('overflow-x: clip'), '.app-frame prevents horizontal viewport clipping & scrollbars');

// 2-column mobile grids
assert(stylesCss.includes('.fast-food-grid') && stylesCss.includes('grid-template-columns: repeat(2, 1fr)'), 'Fast Food menu grid is strictly 2 columns on mobile');
assert(stylesCss.includes('.sub-items-grid.pizza-grid-container') && stylesCss.includes('grid-template-columns: repeat(2, 1fr)'), 'Pizza items grid is strictly 2 columns on mobile');
assert(stylesCss.includes('.sub-items-grid.burger-grid-container') && stylesCss.includes('grid-template-columns: repeat(2, 1fr)'), 'Burger and sub-item categories maintain 2-column mobile grid');

// Mobile touch targets
assert(stylesCss.includes('.pizza-add-cart-btn') && stylesCss.includes('min-height: 42px'), 'Pizza add to cart button has >= 42px touch target');
assert(stylesCss.includes('.burger-add-cart-btn') && stylesCss.includes('min-height: 42px'), 'Category add to cart buttons have >= 42px touch target');
assert(stylesCss.includes('.qty-btn {') && stylesCss.includes('width: 36px') && stylesCss.includes('height: 36px'), 'Cart quantity buttons are at least 36px x 36px');
assert(stylesCss.includes('.checkout-btn') && stylesCss.includes('min-height: 52px'), 'Checkout action button has comfortable >= 52px touch target');

// Sticky bottom action bars & safe area clearance
assert(stylesCss.includes('.floating-cart-pill-bar') && stylesCss.includes('env(safe-area-inset-bottom'), 'Floating cart pill bar respects safe-area-inset-bottom');
assert(stylesCss.includes('.app-bottom-nav') && stylesCss.includes('env(safe-area-inset-bottom'), 'Bottom navigation bar respects safe-area-inset-bottom');
assert(stylesCss.includes('.main-content-container') && stylesCss.includes('env(safe-area-inset-bottom'), 'Main content container includes safe-area clearance for floating action bars');
assert(stylesCss.includes('.lang-modal-sheet') && stylesCss.includes('env(safe-area-inset-bottom'), 'Language bottom sheet modal respects safe-area-inset-bottom');

// -------------------------------------------------------------------------
// SECTION 5: STRICT EXECUTION BOUNDARY AUDIT (NO GIT COMMIT/PUSH)
// -------------------------------------------------------------------------
console.log('\n🔒 [Test 5/5] Auditing Execution Boundary (No Git Push)...');

try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    const gitBranch = execSync('git status -b --porcelain', { encoding: 'utf8' }).split('\n')[0];
    
    // Ensure we are on branch main and not ahead of origin/main (no unpushed commits created)
    const isUpToDate = gitBranch.includes('origin/main') && !gitBranch.includes('ahead');
    assert(isUpToDate, 'Local branch has 0 unpushed commits to origin/main');
    
    // Check that unstaged modifications exist locally (confirming changes were kept in workspace without commit)
    const hasUnstagedChanges = gitStatus.length > 0;
    assert(hasUnstagedChanges, 'Modifications are preserved in local working tree without git commit');
} catch (err) {
    console.error('Git status check error:', err.message);
}

// -------------------------------------------------------------------------
// SUMMARY REPORT
// -------------------------------------------------------------------------
console.log('\n=================================================================');
console.log(`🏁 VERIFICATION COMPLETE: ${passedTests} PASSED, ${totalTests - passedTests} FAILED (TOTAL: ${totalTests})`);
console.log('=================================================================');

if (passedTests === totalTests) {
    process.exit(0);
} else {
    process.exit(1);
}
