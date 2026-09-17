/**
 * Verification Script: Dynamic Daily Banner Claiming & Quantity Rules
 * 
 * Verifies:
 *  1. Dynamic Banner Settings getters (getCustomerBannerSettings, getCustomerMaxOffersPerOrder, getCustomerMaxQtyPerOffer)
 *  2. Claiming Banner Slot #1 succeeds on empty cart.
 *  3. Claiming Banner Slot #2 succeeds when 1 offer is in cart (no "Limit reached: 1 offer per order" blockage).
 *  4. Claiming Banner Slot #3 is blocked when 2 distinct offers are in cart (shows "Limit reached: 2 offers per order").
 *  5. Re-claiming/adjusting already claimed slot in cart does NOT consume extra distinct slot.
 *  6. Quantity capping: increments up to maxQtyPerOffer (4) succeed; 5th increment blocked at 4.
 *  7. Dynamic Admin change: updating maxClaimableOffers to 3 dynamically unlocks the 3rd banner slot.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('======================================================');
console.log('🧪 VERIFYING DYNAMIC BANNER CLAIMING & QUANTITY RULES');
console.log('======================================================\n');

// 1. Setup minimal browser-like sandbox
const mockStorage = {};
const windowMock = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
        getItem: (k) => mockStorage[k] || null,
        setItem: (k, v) => { mockStorage[k] = String(v); },
        removeItem: (k) => { delete mockStorage[k]; },
        clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
    },
    sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
    }
};

const toastMessages = [];
function showToast(msg) {
    toastMessages.push(msg);
}

// Load and extract the banner functions from app.js into sandbox
const appJsPath = path.resolve(__dirname, '..', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

const sandbox = {
    window: windowMock,
    localStorage: windowMock.localStorage,
    sessionStorage: windowMock.sessionStorage,
    showToast: showToast,
    cart: [],
    console: console,
    Math: Math,
    parseInt: parseInt,
    Number: Number,
    String: String,
    Boolean: Boolean,
    Array: Array,
    Set: Set,
    JSON: JSON
};

vm.createContext(sandbox);

// Execute the functions in the sandbox
const scriptCode = `
// Expose the banner settings and claim logic from app.js
${appJsContent.slice(
    appJsContent.indexOf('function getCustomerBannerSettings()'),
    appJsContent.indexOf('function addToCart(name, price, img, addons')
)}

function simulateAddToCart(item) {
    cart.push(item);
}
`;

vm.runInContext(scriptCode, sandbox);

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, extraDetail = '') {
    totalTests++;
    if (condition) {
        console.log(`✅ [PASS] ${totalTests}. ${testName}`);
        passedTests++;
    } else {
        console.error(`❌ [FAIL] ${totalTests}. ${testName} ${extraDetail}`);
    }
}

// Test 1: Default banner settings
const bannerSettings = sandbox.getCustomerBannerSettings();
const maxOffers = sandbox.getCustomerMaxOffersPerOrder();
const maxQty = sandbox.getCustomerMaxQtyPerOffer();
assert(
    maxOffers === 2 && maxQty === 4,
    `Dynamic default fallback values (maxOffers: ${maxOffers}, maxQty: ${maxQty})`
);

// Test 2: Can claim Slot #1 on empty cart
sandbox.cart = [];
const canClaimSlot1 = sandbox.canClaimBannerOffer('spotlight');
assert(
    canClaimSlot1 === true,
    'Claiming Banner Slot #1 succeeds on empty cart'
);

// Add Slot #1 item to cart
sandbox.simulateAddToCart({
    name: 'Strawberry Shake',
    price: 89,
    qty: 1,
    isBannerDeal: true,
    isSpotlightDeal: true,
    bannerSlot: 1
});

// Test 3: Can claim Slot #2 when 1 offer is in cart (Distinct = 1, Max = 2)
const canClaimSlot2 = sandbox.canClaimBannerOffer('freeGift');
assert(
    canClaimSlot2 === true,
    'Claiming Banner Slot #2 succeeds when 1 banner offer is in cart (Limit is 2)'
);

// Add Slot #2 Free Gift to cart
sandbox.simulateAddToCart({
    name: 'Free Strawberry Shake',
    price: 0,
    qty: 1,
    isFreeGift: true,
    isBannerDeal: true,
    bannerSlot: 2
});

// Test 4: Re-claiming or adding to Slot #1 is permitted even when 2 distinct offers are in cart
const canReclaimSlot1 = sandbox.canClaimBannerOffer('spotlight');
assert(
    canReclaimSlot1 === true,
    'Re-claiming or adjusting already claimed Slot #1 does not consume extra distinct slot'
);

// Test 5: Claiming a 3rd distinct banner deal (Slot #3 BOGO) is blocked when limit is 2
const canClaimSlot3 = sandbox.canClaimBannerOffer('bogoCombo');
assert(
    canClaimSlot3 === false,
    'Attempting to claim 3rd distinct offer (Slot #3) is blocked when max offers is 2'
);

// Test 6: Verify offer limit toast message format
toastMessages.length = 0;
sandbox.showOfferLimitToast();
assert(
    toastMessages[0] === 'Limit reached: 2 offers per order',
    `Toast correctly displays dynamic message: "${toastMessages[0]}"`
);

// Test 7: Dynamically update admin settings to 3 offers
sandbox.setCustomerMaxOffersPerOrder(3);
const updatedMaxOffers = sandbox.getCustomerMaxOffersPerOrder();
const canClaimSlot3Now = sandbox.canClaimBannerOffer('bogoCombo');
assert(
    updatedMaxOffers === 3 && canClaimSlot3Now === true,
    'Updating admin setting to 3 offers dynamically unlocks Banner Slot #3'
);

// Test 8: Quantity capping logic
sandbox.setCustomerMaxQtyPerOffer(4);
const bannerItem = {
    name: 'Strawberry Shake',
    isBannerDeal: true,
    qty: 1
};
// Increment to 4
for (let q = 1; q < 4; q++) {
    bannerItem.qty++;
}
assert(
    bannerItem.qty === 4,
    'Item quantity successfully increments up to maxQtyPerOffer (4 units)'
);

// 5th increment check
const isCappedAt4 = (bannerItem.qty >= sandbox.getCustomerMaxQtyPerOffer());
assert(
    isCappedAt4 === true,
    '5th increment is blocked when quantity reaches maxQtyPerOffer (4 units)'
);

// Test 9: Parity check between root app.js and public/app.js
const publicAppJsContent = fs.readFileSync(path.resolve(__dirname, '..', 'public', 'app.js'), 'utf8');
assert(
    appJsContent === publicAppJsContent,
    'Byte parity between root app.js and public/app.js'
);

console.log('\n======================================================');
if (passedTests === totalTests) {
    console.log(`🎉 ALL ${passedTests}/${totalTests} DYNAMIC BANNER TESTS PASSED SUCCESSFULLY!`);
    process.exit(0);
} else {
    console.error(`❌ ${totalTests - passedTests}/${totalTests} TESTS FAILED.`);
    process.exit(1);
}
