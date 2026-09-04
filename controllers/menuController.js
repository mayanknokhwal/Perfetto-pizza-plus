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
    { id: "chn-honey-chilly-cauliflower", name: "Honey Chilly Cauliflower", category: "Chinese Food", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/kgp9bjrS/Honey-Chilly-Cauliflower.jpg", desc: "Crispy florets tossed in sweet honey chilli glaze" },
    { id: "chn-honey-chilly-potato", name: "Honey Chilly Potato", category: "Chinese Food", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/GfY6XTJR/Honey-Chilly-Potato.jpg", desc: "Crispy potato fries glazed with honey, sesame and spicy chilli" },
    { id: "chn-veg-manchurian", name: "Veg Manchurian", category: "Chinese Food", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/NgMyx9My/Veg-Manchurian.jpg", desc: "Vegetable dumplings tossed in spicy garlic soy Manchurian sauce" },
    { id: "chn-chilly-cauliflower", name: "Chilly Cauliflower", category: "Chinese Food", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/pBPy144w/Chilly-Cauliflower.jpg", desc: "Crispy fried cauliflower tossed with bell peppers and chilli sauce" },
    { id: "chn-chilly-paneer", name: "Chilly Paneer", category: "Chinese Food", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/HTm4J9Vh/Chilly-Paneer.jpg", desc: "Cubes of cottage cheese tossed with onion, capsicum & dark soy sauce" },
    { id: "chn-chilly-potato", name: "Chilly Potato", category: "Chinese Food", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/9k7pS8S3/Chilly-Potato.jpg", desc: "Spicy crisp potato fingers tossed in garlic chilli sauce" },

    // 5. COLD DRINKS
    { id: "drk-coke-300ml", name: "Coke (300ml)", category: "Colo Drinks", isMultiSize: false, price: 40, available: true, img: "https://i.ibb.co/r2JVJSMg/Coke-300ml.jpg", desc: "Chilled refreshing Coca-Cola bottle (300ml)" },
    { id: "drk-coke-ice-cream", name: "Coke With Ice Cream", category: "Colo Drinks", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/jcQ2SVP/Coke-With-Ice-Cream.jpg", desc: "Classic chilled Coca-Cola served with a scoop of vanilla ice cream" },
    { id: "drk-milky-cola", name: "Milky Cola", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/Mk3VkTbK/Milky-Cola.jpg", desc: "Smooth and creamy cola blend with a velvety milky twist" },
    { id: "drk-milky-mango", name: "Milky Mango", category: "Colo Drinks", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/35LxWDgq/Milky-Mango.jpg", desc: "Rich and refreshing creamy mango flavored chilled beverage" },

    // 6. PASTA
    { id: "pst-baked-mix", name: "Baked Mix Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/Z1k7wYcZ/Baked-Mix-Pasta.jpg", desc: "Oven baked pasta with rich combination of red and white sauces topped with melted cheese" },
    { id: "pst-baked-red", name: "Baked Red Pasta", category: "Pasta", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/0pLfYKfN/Baked-Red-Pasta.jpg", desc: "Tangy tomato arrabbiata pasta baked with extra mozzarella" },
    { id: "pst-baked-sweet-spicy", name: "Baked Sweet & Spicy Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/PzgbnkXp/Baked-Sweet-Spicy-Pasta.jpg", desc: "Sweet chilli and herb infused pasta baked to cheesy perfection" },
    { id: "pst-baked-tandoori", name: "Baked Tandoori Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/mFhbQZsN/Baked-Tandoori-Pasta.jpg", desc: "Smoky tandoori sauce pasta baked with golden cheese layer" },
    { id: "pst-baked-white", name: "Baked White Pasta", category: "Pasta", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/0jQLrKgh/Baked-White-Pasta.jpg", desc: "Creamy alfredo sauce pasta baked with Italian herbs and cheese" },
    { id: "pst-creamy", name: "Creamy Pasta", category: "Pasta", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/Q3yyX7ss/Creamy-Pasta.jpg", desc: "Rich smooth parmesan cream sauce tossed with penne" },
    { id: "pst-red", name: "Red Pasta", category: "Pasta", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/mCHkdqkg/Red-Pasta.jpg", desc: "Classic spicy tomato sauce pasta with Italian basil" },
    { id: "pst-supreme", name: "Supreme Pasta", category: "Pasta", isMultiSize: false, price: 159, available: true, img: "https://i.ibb.co/NDByPtY/Supreme-Pasta.jpg", desc: "Chef special pasta with fresh veggies, olives, jalapenos and secret herbs" },
    { id: "pst-tandoori", name: "Tandoori Pasta", category: "Pasta", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/hRg5D667/Tandoori-Pasta.jpg", desc: "Indian fusion pasta tossed in spicy tandoori mayo sauce" },
    { id: "pst-baked-makhani", name: "Baked Makhani Pasta", category: "Pasta", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/v4KDB6tm/Baked-Makhani-Pasta.jpg", desc: "Rich butter makhani gravy pasta baked with melted mozzarella" },

    // 7. DESSERTS
    { id: "des-ice-cream-vanilla", name: "Ice Cream Vanilla", category: "Desserts", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/t5SyXgM/Ice-Cream-Vanilla.jpg", desc: "Creamy classic vanilla ice cream scoop" },
    { id: "des-lava-cake-ice-cream", name: "Lava Cake With Ice Cream", category: "Desserts", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/7tVhrnxQ/Lava-Cake-With-Ice-Cream.jpg", desc: "Warm molten chocolate lava cake served with rich vanilla ice cream" },
    { id: "des-lava-cake", name: "Lava Cake", category: "Desserts", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/wZQSKRvS/Lava-Cake.jpg", desc: "Decadent chocolate cake with a warm molten chocolate center" },

    // 8. HOT COLD COFFEE
    { id: "cof-cold", name: "Cold Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/NdjHqdXP/Cold-Coffee.jpg", desc: "Creamy chilled coffee blended to rich perfection" },
    { id: "cof-hot", name: "Hot Coffee", category: "Hot Cold Coffee", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/mVQ3X1wp/Hot-Coffee.jpg", desc: "Freshly brewed aromatic hot coffee" },

    // 9. MOJITO
    { id: "moj-fresh-lime-soda", name: "Fresh Lime Soda", category: "Mojito", isMultiSize: false, price: 59, available: true, img: "https://i.ibb.co/tMGr4c9y/Fresh-Lime-Soda.jpg", desc: "Crisp and sparkling fresh lemon lime soda with a touch of mint" },
    { id: "moj-green-apple", name: "Green Apple Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/fGy3Rt0C/Green-Apple-Mojito.jpg", desc: "Crisp green apple flavored sparkling mojito with crushed mint and lime" },
    { id: "moj-mineral-water", name: "Mineral Water Soft Drink", category: "Mojito", isMultiSize: false, price: 20, available: true, img: "https://i.ibb.co/35d2ZxDD/Mineral-Water-Soft-Drink.jpg", desc: "Pure and refreshing chilled packaged drinking water" },
    { id: "moj-mint", name: "Mint Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/Lzn2WZPk/Mint-Mojito.jpg", desc: "Classic cooling mint infused sparkling beverage with zesty lemon" },
    { id: "moj-strawberry", name: "Strawberry Mojito", category: "Mojito", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/5XnrXt5d/Strawberry-Mojito.jpg", desc: "Sweet and tangy strawberry blended with fresh mint, lime and sparkling soda" },
    { id: "moj-virgin", name: "Virgin Mojito", category: "Mojito", isMultiSize: false, price: 79, available: true, img: "https://i.ibb.co/B24VCS65/Virgin-Mojito.jpg", desc: "Signature refreshing non-alcoholic mojito with lime wedges & crushed mint leaves" },

    // 10. MOMOS
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
    { id: "mom-veg", name: "Veg Momos", category: "Momos", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/0RTw1B4c/Veg-Momos.jpg", desc: "Classic steamed dumplings packed with fresh garden vegetables" },

    // 11. NOODLES (6 Exact Noodles items)
    { id: "ndl-butter-paneer", name: "Butter Paneer Noodles", category: "Noodles", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/Qv9TGVwy/Butter-Paneer-Noodles.jpg", desc: "Wok-tossed noodles with soft paneer cubes in rich butter masala sauce" },
    { id: "ndl-chilly-garlic", name: "Chilly Garlic Noodles", category: "Noodles", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/ycQT35rB/Chilly-Garlic-Noodles.jpg", desc: "Spicy wok-tossed noodles flavored with pungent garlic and red chillies" },
    { id: "ndl-haka", name: "Haka Noodles", category: "Noodles", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/WvG995DF/Haka-Noodles.jpg", desc: "Classic Hakka style noodles stir-fried with crisp garden vegetables" },
    { id: "ndl-paneer", name: "Paneer Noodles", category: "Noodles", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/Cpwx1BY5/Paneer-Noodles.jpg", desc: "Delicious stir-fried noodles tossed with spiced paneer cubes and crunchy veggies" },
    { id: "ndl-singapuri", name: "Singapuri Noodles", category: "Noodles", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/M0KJsvz/Singapuri-Noodles.jpg", desc: "Zesty Singapore style noodles with exotic spices and fresh bell peppers" },
    { id: "ndl-veg", name: "Veg Noodles", category: "Noodles", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/21JBqyRP/Veg-Noodles.jpg", desc: "Classic stir-fried noodles loaded with fresh seasoned vegetables" },

    // 12. RICE
    { id: "ric-veg-fried", name: "Veg Fried Rice", category: "Rice", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/0j2C4vR2/Veg-Fried-Rice.jpg", desc: "Classic stir-fried rice tossed with fresh garden vegetables & aromatic seasonings" },
    { id: "ric-singapuri", name: "Singapuri Rice", category: "Rice", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/q3wnW2kC/Singapuri-Rice.jpg", desc: "Spicy & exotic Singapore style fried rice infused with mild curry spices" },
    { id: "ric-chilly-garlic", name: "Chilly Garlic Rice", category: "Rice", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/wFBqyMBD/Chilly-Garlic-Rice.jpg", desc: "Zesty fried rice wok-tossed with pungent chili garlic sauce" },
    { id: "ric-haka", name: "Haka Rice", category: "Rice", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/4g1rfZ9V/Haka-Rice.jpg", desc: "Authentic Hakka style wok-tossed rice with crisp vegetables" },

    // 13. SALAD
    { id: "sld-green", name: "Green Salad", category: "Salad", isMultiSize: false, price: 69, available: true, img: "https://i.ibb.co/dwWmX7HX/Green-Salad.jpg", desc: "Fresh assortment of sliced cucumbers, tomatoes, carrots, onions & lemon wedges" },
    { id: "sld-perfetto-special", name: "Perfetto Special Salad", category: "Salad", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/2YS2PS1s/Perfetto-Special-Salad.jpg", desc: "Chef special fresh garden salad tossed with paneer cubes, olives and house dressing" },
    { id: "sld-russian", name: "Russian Salad", category: "Salad", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/ds4XYn5d/Russian-Salad.jpg", desc: "Classic diced vegetables, boiled potatoes and sweet corn folded in creamy mayo dressing" },

    // 14. SANDWICH
    { id: "sdw-double-decker", name: "Double Decker Sandwich", category: "Sandwich", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/CsVRK0p0/Double-Decker-Sandwich.jpg", desc: "Layered grilled sandwich packed with fresh veggies, sauces & spices" },
    { id: "sdw-grilled", name: "Grilled Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/rGDgsJbM/Grilled-Sandwich.jpg", desc: "Crispy golden grilled sandwich with house seasoning & herb filling" },
    { id: "sdw-paneer", name: "Paneer Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/dsw5G4Kk/Paneer-Sandwich.jpg", desc: "Rich paneer chunks tossed with aromatic spices & fresh veggies" },
    { id: "sdw-spicy", name: "Spicy Sandwich", category: "Sandwich", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/YTb1G6fh/Spicy-Sandwich.jpg", desc: "Zesty spicy spread with crunchy vegetable filling & hot seasonings" },
    { id: "sdw-cheesy", name: "Cheesy Sandwich", category: "Sandwich", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/XZKVpGT8/Cheesy-Sandwich.jpg", desc: "Melted gooey cheese blend seasoned with Italian herbs" },

    // 15. SHAKE
    { id: "shk-black-currant", name: "Black Currant Shake", category: "Shake", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/nN8ZnFYV/Black-Currant-Shake.jpg", desc: "Rich creamy shake blended with luscious black currant flavor" },
    { id: "shk-butter-scotch", name: "Butter Scotch Shake", category: "Shake", isMultiSize: false, price: 129, available: true, img: "https://i.ibb.co/Wvy1Zfbj/Butter-Scotch-Shake.jpg", desc: "Smooth butterscotch milkshake topped with crunchy caramel nuggets" },
    { id: "shk-chocolate", name: "Chocolate Shake", category: "Shake", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/dsmztpV7/Chocolate-Shake.jpg", desc: "Classic rich cocoa chocolate shake blended to perfection" },
    { id: "shk-kitkat-crunchy", name: "Kit Kat Crunchy Shake", category: "Shake", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/wZZf2jWy/Kit-Kat-Crunchy-Shake.jpg", desc: "Delicious chocolate shake blended with real crispy KitKat wafers" },
    { id: "shk-oreo-feast", name: "Oreo Feast Shake", category: "Shake", isMultiSize: false, price: 139, available: true, img: "https://i.ibb.co/YqNxTL3/Oreo-Feast-Shake.jpg", desc: "Thick creamy shake loaded with crushed Oreo cookies" },
    { id: "shk-pineapple", name: "Pineapple Shake", category: "Shake", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/pc2FGBh/Pineapple-Shake.jpg", desc: "Refreshing tropical pineapple milkshake" },
    { id: "shk-rasmalai", name: "Rasmalai Shake", category: "Shake", isMultiSize: false, price: 149, available: true, img: "https://i.ibb.co/vCtBxC5V/Rasmalai-Shake.jpg", desc: "Royal Indian fusion shake with authentic rasmalai flavor & dry fruits" },
    { id: "shk-strawberry", name: "Strawberry Shake", category: "Shake", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/jvcrqP0Z/Strawberry-Shake.jpg", desc: "Sweet and tangy fresh strawberry milkshake" },
    { id: "shk-vanilla", name: "Vanilla Shake", category: "Shake", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/nqzRxxjB/Vanilla-Shake.jpg", desc: "Smooth classic Madagascar vanilla milkshake" },

    // 16. SIDE ORDERS
    { id: "sde-french-fries", name: "French Fries", category: "Side Orders", isMultiSize: false, price: 89, available: true, img: "https://i.ibb.co/3y4xtxj7/French-Fries.jpg", desc: "Crispy golden fried potato fries lightly salted to perfection" },
    { id: "sde-masala-fries", name: "Masala Fries", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/KxGpWPHz/Masala-Fries.jpg", desc: "Crispy french fries tossed with tangy chaat masala and spicy seasonings" },
    { id: "sde-paneer-parcel", name: "Paneer Parcel", category: "Side Orders", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/dwSwJ6zK/Paneer-Parcel.jpg", desc: "Flaky baked golden pastry filled with seasoned paneer & herbs" },
    { id: "sde-peri-peri-fries", name: "Peri Peri Fries", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/PGK7N3mJ/Peri-Peri-Fries.jpg", desc: "Crisp potato fries dusted with hot and zesty peri peri spice mix" },
    { id: "sde-saucy-fries", name: "Saucy Fries", category: "Side Orders", isMultiSize: false, price: 109, available: true, img: "https://i.ibb.co/gZ0RCYrS/Saucy-Fries.jpg", desc: "Crispy fries drizzled generously with signature savory and cheesy sauces" },
    { id: "sde-taco", name: "Taco", category: "Side Orders", isMultiSize: false, price: 119, available: true, img: "https://i.ibb.co/ZzKMq3h7/Taco.jpg", desc: "Crispy folded taco shell stuffed with spiced fillings, crunchy veggies & creamy sauce" },
    { id: "sde-zingy-parcel", name: "Zingy Parcel", category: "Side Orders", isMultiSize: false, price: 99, available: true, img: "https://i.ibb.co/WNfHNVBk/Zingy-Parcel.jpg", desc: "Warm oven-baked parcel stuffed with zingy spiced filling and melted cheese" },

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
