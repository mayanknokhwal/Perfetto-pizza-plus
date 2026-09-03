/**
 * Perfetto Pizza - Menu Controller
 * Powered by Firebase Firestore ('settings/menu' & 'menu' collection)
 * Handles GET, PATCH, PUT, POST for menu items with real-time state synchronization
 */

const { getFirestoreDoc, setFirestoreDoc } = require('../lib/firestore');

const DEFAULT_MENU_ITEMS = [
    // 1. PIZZAS (19 Multi-Size Pizzas)
    { id: "hot-country", name: "Hot Country", category: "Pizza", isMultiSize: true, prices: { S: 199, M: 299, L: 399 }, available: true, img: "https://i.ibb.co/C59X7CVY/Hot-Country.jpg", desc: "Onion, Red Corn, Jalapeno, Paneer, Black Olives & Red Paprika, Extra Cheese" },
    { id: "indian-veggie", name: "Indian Veggie", category: "Pizza", isMultiSize: true, prices: { S: 219, M: 319, L: 419 }, available: true, img: "https://i.ibb.co/fdKZMq2H/Indian-Veggie.jpg", desc: "Capsicum, Green Chilli, Onion, Capsicum, Mushroom, Black Olives, Extra Cheese" },
    { id: "lovers-pizza", name: "Lover's Pizza", category: "Pizza", isMultiSize: true, prices: { S: 249, M: 349, L: 449 }, available: true, img: "https://i.ibb.co/xKgtXvQ3/Lover-s-Pizza.jpg", desc: "Red Paprika, Onion, Capsicum, Corn" },
    { id: "makhani-pizza", name: "Makhani Pizza", category: "Pizza", isMultiSize: true, prices: { S: 239, M: 339, L: 439 }, available: true, img: "https://i.ibb.co/5gkQ7SSv/Makhani-Pizza.jpg", desc: "Capsicum, Paneer, Makhani Sauce" },
    { id: "paradise-pizza", name: "Paradize Pizza", category: "Pizza", isMultiSize: true, prices: { S: 229, M: 329, L: 429 }, available: true, img: "https://i.ibb.co/605cWN7n/Paradize-Pizza.jpg", desc: "Red Paprika, Onion, Mushroom, Tomato & Jalapeno" },
    { id: "perfetto-special", name: "Perfetto Special Pizza", category: "Pizza", isMultiSize: true, prices: { S: 299, M: 399, L: 499 }, available: true, img: "https://i.ibb.co/B5ZHyQ9q/Perfetto-Special-Pizza.jpg", desc: "Onion, Corn, Pineapple, Jalapeno, Capsicum, Mushroom, Black Olives, Red Paprika, Paneer, Tomato, Extra Cheese" },
    { id: "spicy-pizza", name: "Spicy Pizza", category: "Pizza", isMultiSize: true, prices: { S: 199, M: 299, L: 399 }, available: true, img: "https://i.ibb.co/Nd788pWq/Spicy-Pizza.jpg", desc: "Paneer Chilly, Capsicum, Red Paprika" },
    { id: "supreme-pizza", name: "Supreme Pizza", category: "Pizza", isMultiSize: true, prices: { S: 249, M: 349, L: 449 }, available: true, img: "https://i.ibb.co/Ng1kGnR6/Supreme-Pizza.jpg", desc: "Mushroom, Jalapeno, Paneer, Pineapple, Black Olives" },
    { id: "tandoori-pizza", name: "Tandoori Pizza", category: "Pizza", isMultiSize: true, prices: { S: 239, M: 339, L: 439 }, available: true, img: "https://i.ibb.co/jkpyY1b0/Tandoori-Pizza.jpg", desc: "Onion, Paneer, Bellpeper, Tandoori Sauce" },
    { id: "achari-pizza", name: "Acharri Pizza", category: "Pizza", isMultiSize: true, prices: { S: 219, M: 319, L: 419 }, available: true, img: "https://i.ibb.co/5XgKZM2Z/Acharri-Pizza.jpg", desc: "Capsicum, Corn, Paneer, Achari Sauce" },
    { id: "cheese-n-corn", name: "Cheese 'n Corn", category: "Pizza", isMultiSize: true, prices: { S: 179, M: 279, L: 379 }, available: true, img: "https://i.ibb.co/FkgyjwHx/Cheese-n-Corn.jpg", desc: "Cheese, Corn" },
    { id: "cheese-n-mushroom", name: "Cheese 'n Mushroom", category: "Pizza", isMultiSize: true, prices: { S: 219, M: 319, L: 419 }, available: true, img: "https://i.ibb.co/j96pyGyf/Cheese-n-Mushroom.jpg", desc: "Cheese, Mushroom" },
    { id: "chipotle-pizza", name: "Chipotle Pizza", category: "Pizza", isMultiSize: true, prices: { S: 229, M: 329, L: 429 }, available: true, img: "https://i.ibb.co/WvHtzxPQ/Chipotle-Pizza.jpg", desc: "Paneer, Capsicum, Corn, Onion, Chipotle Sauce" },
    { id: "double-cheese-margherita", name: "Double Cheese Margherita", category: "Pizza", isMultiSize: true, prices: { S: 199, M: 299, L: 399 }, available: true, img: "https://i.ibb.co/k6xGq83k/Dbl-Cheese-Margherita.jpg", desc: "Loaded with extra gooey mozzarella cheese & classic Italian herb tomato sauce" },
    { id: "deluxe-pizza", name: "Deluxe Pizza", category: "Pizza", isMultiSize: true, prices: { S: 199, M: 299, L: 399 }, available: true, img: "https://i.ibb.co/kgZXHP6J/Deluxe-Pizza.jpg", desc: "Onion, Paneer, Capsicum, Mushroom, Gold Corn" },
    { id: "delight-pizza", name: "Delight Pizza", category: "Pizza", isMultiSize: true, prices: { S: 219, M: 319, L: 419 }, available: true, img: "https://i.ibb.co/DDQ7zY7n/Delight-Pizza.jpg", desc: "Capsicum, Jalapeno, Mushroom" },
    { id: "farm-house", name: "Farm House", category: "Pizza", isMultiSize: true, prices: { S: 239, M: 339, L: 439 }, available: true, img: "https://i.ibb.co/nNsWCp9t/Farm-House.jpg", desc: "Corn, Pineapple, Mushroom, Black Olives, Red Paprika, Extra Cheese" },
    { id: "green-veggie", name: "Green Veggie", category: "Pizza", isMultiSize: true, prices: { S: 229, M: 329, L: 429 }, available: true, img: "https://i.ibb.co/FbZ23hF3/Green-Veggie.jpg", desc: "Onion, Capsicum, Tomato" },
    { id: "harissa-pizza", name: "Harissa Pizza", category: "Pizza", isMultiSize: true, prices: { S: 249, M: 349, L: 449 }, available: true, img: "https://i.ibb.co/fVq0W6hp/Harissa-Pizza.jpg", desc: "Paneer, Red Paprika, Black Olives, Onion, Harissa Sauce" },

    // 2. BURGERS (9 Single-Variant Direct Burgers)
    { id: "bgr-acharri", name: "Acharri Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/W44mjwxN/Acharri-Burger.jpg", desc: "" },
    { id: "bgr-aloo-patty", name: "Aloo Patty Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/Df2JH9fb/Aloo-Patty-Burger.jpg", desc: "" },
    { id: "bgr-cheese-spicy", name: "Cheese Spicy", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/WvX6jhYM/Cheese-Spicy.jpg", desc: "" },
    { id: "bgr-cheesy", name: "Cheesy Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/v6vK86T1/Cheesy-Burger.jpg", desc: "" },
    { id: "bgr-crispy-paneer", name: "Crispy Paneer", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/DD26cbg3/Crispy-Paneer.jpg", desc: "" },
    { id: "bgr-peri-peri", name: "Peri Peri Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/xqST9xJT/Peri-Peri-Burger.jpg", desc: "" },
    { id: "bgr-special", name: "Special Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/CKF4Vqw0/Special-Burger.jpg", desc: "" },
    { id: "bgr-tandoori", name: "Tandoori Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/kVsYKYhJ/Tandoori-Burger.jpg", desc: "" },
    { id: "bgr-veggie", name: "Veggie Burger", category: "Burger", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/840Qp6qQ/Veggie-Burger.jpg", desc: "" },

    // 3. BREAD & SIDES
    { id: "brd-cheese-corn", name: "Cheese Corn Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/d4sByypr/Cheese-Corn-Bread.jpg", desc: "" },
    { id: "brd-garlic", name: "Garlic Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/JFRG0cD0/Garlic-Bread.jpg", desc: "" },
    { id: "brd-perfetto-stuffed", name: "Perfetto Stuffed Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/j2ZXJWh/Perfetto-Stuffed-Bread.jpg", desc: "" },
    { id: "brd-stuffed", name: "Stuffed Bread", category: "Bread", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/6c66XWJn/Stuffed-Bread.jpg", desc: "" },

    // 4. CHINESE FOOD
    { id: "chn-1", name: "Kung Pao Chicken", category: "Chinese Food", isMultiSize: false, price: 249, available: true, img: "https://i.ibb.co/YFYwbHmV/chinese-food.png", desc: "Tender chicken with peanuts & chili peppers" },
    { id: "chn-2", name: "Manchurian Gravy", category: "Chinese Food", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/YFYwbHmV/chinese-food.png", desc: "Vegetable dumplings in savory Manchurian sauce" },
    { id: "chn-3", name: "Sweet & Sour Crispy Veg", category: "Chinese Food", isMultiSize: false, price: 189, available: true, img: "https://i.ibb.co/YFYwbHmV/chinese-food.png", desc: "Crispy veggies tossed in sweet sour glaze" },

    // 5. COLD DRINKS
    { id: "drk-1", name: "Classic Sparkling Cola", category: "Colo Drinks", isMultiSize: false, price: 60, available: true, img: "https://i.ibb.co/dJxnm38L/colo-drinks.png", desc: "Ice cold refreshing fizzy beverage" },
    { id: "drk-2", name: "Zero Sugar Cola", category: "Colo Drinks", isMultiSize: false, price: 60, available: true, img: "https://i.ibb.co/dJxnm38L/colo-drinks.png", desc: "Zero calories, same refreshing taste" },
    { id: "drk-3", name: "Citrus Lime Fizz", category: "Colo Drinks", isMultiSize: false, price: 70, available: true, img: "https://i.ibb.co/dJxnm38L/colo-drinks.png", desc: "Zesty lemon lime sparkling drink" },

    // 6. PASTA
    { id: "pst-1", name: "Creamy Alfredo Pasta", category: "Pasta", isMultiSize: false, price: 249, available: true, img: "https://i.ibb.co/Qvzgv353/pasta.png", desc: "Rich parmesan cream sauce with fettuccine" },
    { id: "pst-2", name: "Penna Arrabbiata", category: "Pasta", isMultiSize: false, price: 229, available: true, img: "https://i.ibb.co/Qvzgv353/pasta.png", desc: "Spicy tomato garlic sauce with fresh basil" },
    { id: "pst-3", name: "Pesto Supreme Pasta", category: "Pasta", isMultiSize: false, price: 269, available: true, img: "https://i.ibb.co/Qvzgv353/pasta.png", desc: "Fresh basil pesto with pine nuts & olive oil" },

    // 7. DESSERTS
    { id: "des-1", name: "Desserts Option 1", category: "Desserts", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/YBQ73fv2/dasserts.png", desc: "Freshly prepared item variation for Desserts" },
    { id: "des-2", name: "Desserts Option 2", category: "Desserts", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/YBQ73fv2/dasserts.png", desc: "Special chef recipe variation for Desserts" },
    { id: "des-3", name: "Desserts Option 3", category: "Desserts", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/YBQ73fv2/dasserts.png", desc: "Deluxe portion variation for Desserts" },
    { id: "des-4", name: "Desserts Option 4", category: "Desserts", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/YBQ73fv2/dasserts.png", desc: "Combo style variation for Desserts" },

    // 8. HOT COLD COFFEE
    { id: "cof-1", name: "Hot Cold Coffee Option 1", category: "Hot Cold Coffee", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/1GS88GN6/hot-cold-coffee.png", desc: "Freshly prepared item variation for Hot Cold Coffee" },
    { id: "cof-2", name: "Hot Cold Coffee Option 2", category: "Hot Cold Coffee", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/1GS88GN6/hot-cold-coffee.png", desc: "Special chef recipe variation for Hot Cold Coffee" },
    { id: "cof-3", name: "Hot Cold Coffee Option 3", category: "Hot Cold Coffee", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/1GS88GN6/hot-cold-coffee.png", desc: "Deluxe portion variation for Hot Cold Coffee" },
    { id: "cof-4", name: "Hot Cold Coffee Option 4", category: "Hot Cold Coffee", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/1GS88GN6/hot-cold-coffee.png", desc: "Combo style variation for Hot Cold Coffee" },

    // 9. MOJITO
    { id: "moj-1", name: "Mojito Option 1", category: "Mojito", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/kV2Wvsdq/mojito.png", desc: "Freshly prepared item variation for Mojito" },
    { id: "moj-2", name: "Mojito Option 2", category: "Mojito", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/kV2Wvsdq/mojito.png", desc: "Special chef recipe variation for Mojito" },
    { id: "moj-3", name: "Mojito Option 3", category: "Mojito", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/kV2Wvsdq/mojito.png", desc: "Deluxe portion variation for Mojito" },
    { id: "moj-4", name: "Mojito Option 4", category: "Mojito", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/kV2Wvsdq/mojito.png", desc: "Combo style variation for Mojito" },

    // 10. MOMOS
    { id: "mom-1", name: "Momos Option 1", category: "Momos", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/gbdrfGJK/momos.png", desc: "Freshly prepared item variation for Momos" },
    { id: "mom-2", name: "Momos Option 2", category: "Momos", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/gbdrfGJK/momos.png", desc: "Special chef recipe variation for Momos" },
    { id: "mom-3", name: "Momos Option 3", category: "Momos", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/gbdrfGJK/momos.png", desc: "Deluxe portion variation for Momos" },
    { id: "mom-4", name: "Momos Option 4", category: "Momos", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/gbdrfGJK/momos.png", desc: "Combo style variation for Momos" },

    // 11. NOODLES
    { id: "ndl-1", name: "Noodles Option 1", category: "Noodles", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/v6LTBqFV/noodles.png", desc: "Freshly prepared item variation for Noodles" },
    { id: "ndl-2", name: "Noodles Option 2", category: "Noodles", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/v6LTBqFV/noodles.png", desc: "Special chef recipe variation for Noodles" },
    { id: "ndl-3", name: "Noodles Option 3", category: "Noodles", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/v6LTBqFV/noodles.png", desc: "Deluxe portion variation for Noodles" },
    { id: "ndl-4", name: "Noodles Option 4", category: "Noodles", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/v6LTBqFV/noodles.png", desc: "Combo style variation for Noodles" },

    // 12. RICE
    { id: "ric-1", name: "Rice Option 1", category: "Rice", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/gL0Z5F0C/rice.png", desc: "Freshly prepared item variation for Rice" },
    { id: "ric-2", name: "Rice Option 2", category: "Rice", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/gL0Z5F0C/rice.png", desc: "Special chef recipe variation for Rice" },
    { id: "ric-3", name: "Rice Option 3", category: "Rice", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/gL0Z5F0C/rice.png", desc: "Deluxe portion variation for Rice" },
    { id: "ric-4", name: "Rice Option 4", category: "Rice", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/gL0Z5F0C/rice.png", desc: "Combo style variation for Rice" },

    // 13. SALAD
    { id: "sld-1", name: "Salad Option 1", category: "Salad", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/W4V8XcNG/salad.png", desc: "Freshly prepared item variation for Salad" },
    { id: "sld-2", name: "Salad Option 2", category: "Salad", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/W4V8XcNG/salad.png", desc: "Special chef recipe variation for Salad" },
    { id: "sld-3", name: "Salad Option 3", category: "Salad", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/W4V8XcNG/salad.png", desc: "Deluxe portion variation for Salad" },
    { id: "sld-4", name: "Salad Option 4", category: "Salad", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/W4V8XcNG/salad.png", desc: "Combo style variation for Salad" },

    // 14. SANDWICH
    { id: "sdw-double-decker", name: "Double Decker Sandwich", category: "Sandwich", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/CsVRK0p0/Double-Decker-Sandwich.jpg", desc: "Layered grilled sandwich packed with fresh veggies, sauces & spices" },
    { id: "sdw-grilled", name: "Grilled Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/rGDgsJbM/Grilled-Sandwich.jpg", desc: "Crispy golden grilled sandwich with house seasoning & herb filling" },
    { id: "sdw-paneer", name: "Paneer Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/dsw5G4Kk/Paneer-Sandwich.jpg", desc: "Rich paneer chunks tossed with aromatic spices & fresh veggies" },
    { id: "sdw-spicy", name: "Spicy Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/YTb1G6fh/Spicy-Sandwich.jpg", desc: "Zesty spicy spread with crunchy vegetable filling & hot seasonings" },
    { id: "sdw-cheesy", name: "Cheesy Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/XZKVpGT8/Cheesy-Sandwich.jpg", desc: "Melted gooey cheese blend seasoned with Italian herbs" },

    // 15. SHAKE
    { id: "shk-1", name: "Shake Option 1", category: "Shake", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/XZpkRRpJ/shake.png", desc: "Freshly prepared item variation for Shake" },
    { id: "shk-2", name: "Shake Option 2", category: "Shake", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/XZpkRRpJ/shake.png", desc: "Special chef recipe variation for Shake" },
    { id: "shk-3", name: "Shake Option 3", category: "Shake", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/XZpkRRpJ/shake.png", desc: "Deluxe portion variation for Shake" },
    { id: "shk-4", name: "Shake Option 4", category: "Shake", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/XZpkRRpJ/shake.png", desc: "Combo style variation for Shake" },

    // 16. SIDE ORDERS
    { id: "sde-1", name: "Side Orders Option 1", category: "Side Orders", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/JwXzvd1f/side-orders.png", desc: "Freshly prepared item variation for Side Orders" },
    { id: "sde-2", name: "Side Orders Option 2", category: "Side Orders", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/JwXzvd1f/side-orders.png", desc: "Special chef recipe variation for Side Orders" },
    { id: "sde-3", name: "Side Orders Option 3", category: "Side Orders", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/JwXzvd1f/side-orders.png", desc: "Deluxe portion variation for Side Orders" },
    { id: "sde-4", name: "Side Orders Option 4", category: "Side Orders", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/JwXzvd1f/side-orders.png", desc: "Combo style variation for Side Orders" },

    // 17. SPRING ROLLS
    { id: "spr-1", name: "Spring Rolls Option 1", category: "Spring Rolls", isMultiSize: false, price: 179, available: true, img: "https://i.ibb.co/HLJWTt1D/spring-rolls.png", desc: "Freshly prepared item variation for Spring Rolls" },
    { id: "spr-2", name: "Spring Rolls Option 2", category: "Spring Rolls", isMultiSize: false, price: 199, available: true, img: "https://i.ibb.co/HLJWTt1D/spring-rolls.png", desc: "Special chef recipe variation for Spring Rolls" },
    { id: "spr-3", name: "Spring Rolls Option 3", category: "Spring Rolls", isMultiSize: false, price: 219, available: true, img: "https://i.ibb.co/HLJWTt1D/spring-rolls.png", desc: "Deluxe portion variation for Spring Rolls" },
    { id: "spr-4", name: "Spring Rolls Option 4", category: "Spring Rolls", isMultiSize: false, price: 259, available: true, img: "https://i.ibb.co/HLJWTt1D/spring-rolls.png", desc: "Combo style variation for Spring Rolls" },

    // 18. WRAP
    { id: "wrp-tandoori", name: "Tandoori Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/vx34djt8/Tandoori-Wrap.jpg", desc: "" },
    { id: "wrp-aloo-patty", name: "Aloo Patty Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/MDpP2m0Q/Aloo-Patty-Wrap.jpg", desc: "" },
    { id: "wrp-cheesy-saucy", name: "Cheesy Saucy Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/NkgGphz/Cheesy-Saucy-Wrap.jpg", desc: "" },
    { id: "wrp-cheesy", name: "Cheesy Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/JRZWfVvX/Cheesy-Wrap.jpg", desc: "" },
    { id: "wrp-crispy-paneer", name: "Crispy Paneer Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/Tx8G92GX/Crispy-Paneer-Wrap.jpg", desc: "" },
    { id: "wrp-spicy", name: "Spicy Wrap", category: "Wrap", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/0jx7P4sj/Spicy-Wrap.png", desc: "" }
];

const DEFAULT_CATEGORY_ADDONS = {
    "Burger": {
        extraCheese: 25,
        extraSpicy: 0
    },
    "Wrap": {
        extraCheese: 30,
        extraSpicy: 0
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
    }
};

// Initialize in-memory runtime store
if (!global.__perfettoMenuState) {
    global.__perfettoMenuState = JSON.parse(JSON.stringify(DEFAULT_MENU_ITEMS));
}
if (!global.__perfettoCategoryAddons) {
    global.__perfettoCategoryAddons = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_ADDONS));
}

async function getLiveMenuFromFirestore() {
    try {
        const doc = await getFirestoreDoc('settings', 'menu');
        if (doc && Array.isArray(doc.items) && doc.items.length > 0) {
            global.__perfettoMenuState = doc.items;
            if (doc.categoryAddons) {
                global.__perfettoCategoryAddons = doc.categoryAddons;
            }
            return { items: doc.items, categoryAddons: doc.categoryAddons || global.__perfettoCategoryAddons };
        }
    } catch (e) {
        console.warn('Firestore menu read note:', e.message);
    }
    return { items: global.__perfettoMenuState, categoryAddons: global.__perfettoCategoryAddons };
}

async function handleMenuRequest(req, res) {
    try {
        // 1. GET: Fetch Live Menu Items & Category Addons
        if (req.method === 'GET') {
            const { category } = req.query || {};

            const { items: allItems, categoryAddons } = await getLiveMenuFromFirestore();
            let items = allItems;
            if (category) {
                items = items.filter(i => i.category === category);
            }

            return res.status(200).json({
                success: true,
                count: items.length,
                items: items,
                categoryAddons: categoryAddons || DEFAULT_CATEGORY_ADDONS
            });
        }

        // 2. PATCH: Instant Single-Item Update
        if (req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const { id, available, price, prices, name, desc, img, isMultiSize } = body || {};

            if (!id) {
                return res.status(400).json({ success: false, message: 'Missing required field: id' });
            }

            const targetId = String(id);
            const { items: allItems, categoryAddons } = await getLiveMenuFromFirestore();
            let items = [...allItems];
            let itemIndex = items.findIndex(i => i.id === targetId);

            if (itemIndex >= 0) {
                if (available !== undefined) items[itemIndex].available = Boolean(available);
                if (price !== undefined) items[itemIndex].price = Number(price);
                if (prices !== undefined) items[itemIndex].prices = prices;
                if (name !== undefined) items[itemIndex].name = name;
                if (desc !== undefined) items[itemIndex].desc = desc;
                if (img !== undefined) items[itemIndex].img = img;
                if (isMultiSize !== undefined) items[itemIndex].isMultiSize = Boolean(isMultiSize);
            } else {
                items.push({
                    id: targetId,
                    name: name || 'Food Item',
                    category: 'Pizza',
                    isMultiSize: Boolean(isMultiSize),
                    price: Number(price || 0),
                    prices: prices || { S: 199, M: 299, L: 399 },
                    available: available !== undefined ? Boolean(available) : true,
                    img: img || '',
                    desc: desc || '',
                    tag: '',
                });
                itemIndex = items.length - 1;
            }

            global.__perfettoMenuState = items;
            const updatedItem = items[itemIndex];

            // Sync to Firestore
            try {
                await setFirestoreDoc('settings', 'menu', {
                    items: items,
                    categoryAddons: categoryAddons || global.__perfettoCategoryAddons || DEFAULT_CATEGORY_ADDONS,
                    updatedAt: new Date().toISOString()
                });
                await setFirestoreDoc('menu', targetId, updatedItem);
            } catch (err) {
                console.error('CRITICAL: Firestore menu sync error:', err.message);
            }

            return res.status(200).json({
                success: true,
                message: `Menu item '${id}' updated successfully in Firestore`,
                item: updatedItem,
            });
        }

        // 3. PUT / POST: Bulk Menu Sync & Reset
        if (req.method === 'PUT' || req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const isReset = body?.reset === true || req.query?.reset === 'true';
            const rawItems = isReset ? DEFAULT_MENU_ITEMS : (Array.isArray(body) ? body : (body?.items || []));
            const newAddons = body?.categoryAddons || global.__perfettoCategoryAddons || DEFAULT_CATEGORY_ADDONS;

            if (!Array.isArray(rawItems) || rawItems.length === 0) {
                return res.status(400).json({ success: false, message: 'Missing or invalid items array' });
            }

            try {
                global.__perfettoMenuState = JSON.parse(JSON.stringify(rawItems));
                global.__perfettoCategoryAddons = JSON.parse(JSON.stringify(newAddons));
            } catch (cloneErr) {
                global.__perfettoMenuState = Array.isArray(rawItems) ? [...rawItems] : [];
                global.__perfettoCategoryAddons = newAddons;
            }

            // Sync to Firestore
            await setFirestoreDoc('settings', 'menu', {
                items: global.__perfettoMenuState,
                categoryAddons: global.__perfettoCategoryAddons,
                updatedAt: new Date().toISOString()
            });

            return res.status(200).json({
                success: true,
                message: isReset ? 'Menu reset to defaults in Firestore' : 'Bulk menu updated successfully in Firestore',
                count: global.__perfettoMenuState.length,
                items: global.__perfettoMenuState,
                categoryAddons: global.__perfettoCategoryAddons,
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleMenuRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
}

module.exports = {
    handleMenuRequest,
    DEFAULT_MENU_ITEMS,
};
