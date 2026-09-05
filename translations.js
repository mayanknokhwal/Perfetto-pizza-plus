/**
 * PERFETTO PIZZA - CENTRALIZED LOCALIZATION SYSTEM
 * Professional Bilingual Support (English / Hindi)
 * Complete Devanagari mappings for dish names, addons, categories & UI controls
 */

(function () {
    const TRANSLATIONS = {
        en: {
            // Navigation & Headers
            nav_home: "Home",
            nav_cart: "Cart",
            nav_profile: "Profile",
            back: "Back",
            options_available: "options available",
            fast_food_title: "FAST FOOD",
            search_placeholder: "Search pizza, burger, pasta...",
            customer_care: "Customer Care Support",
            shop_closed_banner: "This time shop is closed. We are not accepting orders right now.",
            daily_offer: "DAILY OFFER",
            change_language: "Language / भाषा",
            choose_language_header: "Choose your language / अपनी भाषा चुनें",

            // Cards & Controls
            varieties_options: "Varieties & Options",
            size_label: "Size:",
            price_label: "Price:",
            addons_label: "ADD-ONS:",
            add_to_cart: "ADD TO CART",
            added_to_cart: "ADDED! ✓",
            out_of_stock: "OUT OF STOCK",
            product_not_available: "This time product is not available",
            view_cart: "View Cart",
            customize: "Customize",

            // Add-on Labels
            addon_extra_cheese: "Extra Cheese",
            addon_extra_spicy: "Extra Spicy",
            addon_extra_mayo: "Extra Mayo",
            addon_with_ice_cream: "With Ice Cream",
            addon_free: "Free",

            // Cart & Checkout
            cart_title: "Your Food Cart",
            cart_empty_title: "Your cart is empty",
            cart_empty_desc: "Browse categories on Home and add items to your cart!",
            cart_explore_btn: "Explore Menu",
            cart_bill_details: "Bill Details",
            subtotal: "Subtotal",
            delivery_fee: "Delivery Fee",
            delivery_free: "FREE",
            grand_total: "Grand Total",
            proceed_to_checkout: "Proceed to Checkout",
            add_items_checkout_btn: "Add items to checkout",
            delivery_address: "Delivery Address",
            delivering_to: "Delivering To",
            edit_details: "Edit Details",
            confirm_address: "Confirm Address",
            address_confirmed: "Address Confirmed ✓",
            select_payment_mode: "Select Payment Mode",
            payment_cod: "Cash on Delivery (COD)",
            cod_badge: "AVAILABLE & RECOMMENDED",
            cod_subtext: "Pay via cash or scan QR using any UPI app upon delivery",
            payment_online: "Online Payment (PhonePe / UPI / Cards)",
            online_subtext: "PhonePe, Google Pay, Paytm, Cards & Net Banking (Coming Soon)",
            work_in_progress: "WORK IN PROGRESS",
            coming_soon: "Coming Soon",
            place_order: "Place Order",
            review_place_order: "Review & Place Order",
            review_subtitle: "Confirm your delivery address & choose payment",

            // Wallet & Profile
            wallet_title: "Perfetto Wallet",
            wallet_subtitle: "Cashback Rewards & Balance",
            wallet_active: "Active",
            wallet_expires_in: "Expires in",
            wallet_expires_in_days: "Expires in {days} days",
            wallet_expires_in_one_day: "Expires in 1 day",
            expires_in_7_days: "Expires in 7 days",
            wallet_expires_in_7_days: "Expires in 7 days",
            wallet_use_cash: "Use {amount} Cash",
            wallet_use_zero: "Use ₹0",
            wallet_available: "Available:",
            wallet_rules_default: "Auto-cashback on eligible orders • 100% usable on any order",
            wallet_paused: "Wallet rewards system is currently paused.",
            wallet_transactions: "Wallet Transactions",
            wallet_no_transactions: "No wallet transactions yet. Place an order of ₹200+ to earn cashback!",
            total_orders: "Total Orders",
            account_settings: "Account Settings",
            order_history: "Order History",
            order_history_sub: "View past orders & details",
            edit_profile_address: "Edit Profile & Home Address",
            edit_profile_sub: "Manage your name, phone number & saved addresses",
            store_notice: "Store Notice",
            store_notice_sub: "Important news & announcements",
            recent_orders: "Recent Orders",
            no_orders_placed: "No orders placed yet",
            clear_history: "Clear History",
            items_count: "Items ({count} items)",

            // Order Success OTP Modal
            order_placed_success: "ORDER PLACED SUCCESSFULLY! 🎉",
            order_being_prepared: "Order {id} is being prepared",
            screenshot_advice: "PLEASE TAKE A SCREENSHOT OF THIS OTP!",
            delivery_verification_otp: "Delivery Verification OTP",
            copy_otp: "Copy OTP",
            copied_otp: "Copied! ✓",
            payment_method: "Payment Method:",
            total_amount: "Total Amount:",
            cashback_credited: "🎉 ₹{amount} Cashback credited to your wallet!",
            cashback_validity: "Valid for {days} days. Use on your next order!",
            view_in_order_history: "View in Order History",
            got_it_continue: "Got It & Continue",

            // Toasts & Messages
            toast_item_added: "added to cart!",
            toast_cart_updated: "Cart updated!",
            toast_otp_copied: "Delivery OTP ({otp}) copied to clipboard!",
            toast_order_success: "Order placed successfully!"
        },
        hi: {
            // Navigation & Headers
            nav_home: "होम",
            nav_cart: "कार्ट",
            nav_profile: "प्रोफ़ाइल",
            back: "वापस",
            options_available: "विकल्प उपलब्ध",
            fast_food_title: "फ़ास्ट फ़ूड",
            search_placeholder: "पिज़्ज़ा, बर्गर, पास्ता खोजें...",
            customer_care: "कस्टमर केयर सपोर्ट",
            shop_closed_banner: "इस समय रेस्टोरेंट बंद है। अभी ऑर्डर स्वीकार नहीं किए जा रहे हैं।",
            daily_offer: "दैनिक ऑफ़र",
            change_language: "भाषा / Language",
            choose_language_header: "अपनी भाषा चुनें / Choose your language",

            // Cards & Controls
            varieties_options: "वैरायटी और विकल्प",
            size_label: "साइज़:",
            price_label: "कीमत:",
            addons_label: "ऐड-ऑन्स:",
            add_to_cart: "कार्ट में जोड़ें",
            added_to_cart: "कार्ट में जोड़ा गया! ✓",
            out_of_stock: "अभी उपलब्ध नहीं",
            product_not_available: "यह आइटम अभी उपलब्ध नहीं है",
            view_cart: "कार्ट देखें",
            customize: "कस्टमाइज़ करें",

            // Add-on Labels
            addon_extra_cheese: "एक्स्ट्रा चीज़",
            addon_extra_spicy: "एक्स्ट्रा स्पाइसी",
            addon_extra_mayo: "एक्स्ट्रा मेयो",
            addon_with_ice_cream: "विद आइसक्रीम",
            addon_free: "मुफ़्त",

            // Cart & Checkout
            cart_title: "आपकी फ़ूड कार्ट",
            cart_empty_title: "आपकी कार्ट खाली है",
            cart_empty_desc: "होम पर जाकर अपनी पसंद का खाना चुनें और कार्ट में जोड़ें!",
            cart_explore_btn: "मेन्यू देखें",
            cart_bill_details: "बिल विवरण",
            subtotal: "कुल सामान",
            delivery_fee: "डिलीवरी शुल्क",
            delivery_free: "मुफ़्त",
            grand_total: "कुल राशि",
            proceed_to_checkout: "ऑर्डर पूरा करने बढ़ें",
            add_items_checkout_btn: "ऑर्डर के लिए आइटम जोड़ें",
            delivery_address: "डिलीवरी का पता",
            delivering_to: "डिलीवरी स्थान",
            edit_details: "बदलें / एडिट करें",
            confirm_address: "पता कन्फर्म करें",
            address_confirmed: "पता कन्फर्म हो गया ✓",
            select_payment_mode: "भुगतान का तरीका चुनें",
            payment_cod: "कैश ऑन डिलीवरी (COD)",
            cod_badge: "उपलब्ध एवं सुरक्षित",
            cod_subtext: "डिलीवरी पर कैश दें या किसी भी UPI ऐप से QR स्कैन करके पे करें",
            payment_online: "ऑनलाइन पेमेंट (PhonePe / UPI / कार्ड)",
            online_subtext: "PhonePe, Google Pay, Paytm, कार्ड और नेट बैंकिंग (शीघ्र उपलब्ध)",
            work_in_progress: "कार्य प्रगति पर",
            coming_soon: "शीघ्र उपलब्ध",
            place_order: "ऑर्डर कन्फर्म करें",
            review_place_order: "ऑर्डर चेक करें और कन्फर्म करें",
            review_subtitle: "डिलीवरी पता चेक करें और भुगतान का तरीका चुनें",

            // Wallet & Profile
            wallet_title: "पर्फेटो वॉलेट",
            wallet_subtitle: "कैशबैक रिवॉर्ड और बैलेंस",
            wallet_active: "एक्टिव",
            wallet_expires_in: "वैधता",
            wallet_expires_in_days: "{days} दिनों में समाप्त",
            wallet_expires_in_one_day: "1 दिन में समाप्त",
            expires_in_7_days: "7 दिनों में समाप्त",
            wallet_expires_in_7_days: "7 दिनों में समाप्त",
            wallet_use_cash: "{amount} कैशबैक इस्तेमाल करें",
            wallet_use_zero: "₹0 इस्तेमाल करें",
            wallet_available: "उपलब्ध बैलेंस:",
            wallet_rules_default: "योग्य ऑर्डर्स पर ऑटो-कैशबैक • किसी भी ऑर्डर पर 100% इस्तेमाल करें",
            wallet_paused: "वॉलेट रिवॉर्ड सिस्टम अभी रोक दिया गया है।",
            wallet_transactions: "वॉलेट लेन-देन",
            wallet_no_transactions: "अभी कोई लेन-देन नहीं है। ₹200+ का ऑर्डर करके कैशबैक पाएं!",
            total_orders: "कुल ऑर्डर",
            account_settings: "अकाउंट सेटिंग्स",
            order_history: "पिछले ऑर्डर",
            order_history_sub: "अपने पुराने ऑर्डर्स और विवरण देखें",
            edit_profile_address: "प्रोफ़ाइल और घर का पता एडिट करें",
            edit_profile_sub: "अपना नाम, मोबाइल नंबर और सेव पते बदलें",
            store_notice: "स्टोर सूचना",
            store_notice_sub: "ज़रूरी सूचनाएं और घोषणाएं",
            recent_orders: "हाल के ऑर्डर",
            no_orders_placed: "अभी तक कोई ऑर्डर नहीं किया गया है",
            clear_history: "हिस्ट्री हटाएं",
            items_count: "सामान ({count} आइटम)",

            // Order Success OTP Modal
            order_placed_success: "ऑर्डर सफलतापूर्वक दर्ज हुआ! 🎉",
            order_being_prepared: "ऑर्डर {id} तैयार किया जा रहा है",
            screenshot_advice: "कृपया इस OTP का स्क्रीनशॉट ले लें!",
            delivery_verification_otp: "डिलीवरी वेरिफिकेशन OTP",
            copy_otp: "OTP कॉपी करें",
            copied_otp: "कॉपी हो गया! ✓",
            payment_method: "भुगतान का प्रकार:",
            total_amount: "कुल राशि:",
            cashback_credited: "🎉 ₹{amount} कैशबैक आपके वॉलेट में जोड़ दिया गया!",
            cashback_validity: "{days} दिनों तक मान्य। अपने अगले ऑर्डर पर इस्तेमाल करें!",
            view_in_order_history: "ऑर्डर हिस्ट्री में देखें",
            got_it_continue: "ठीक है, आगे बढ़ें",

            // Toasts & Messages
            toast_item_added: "कार्ट में जोड़ दिया गया!",
            toast_cart_updated: "कार्ट अपडेट हो गई!",
            toast_otp_copied: "डिलीवरी OTP ({otp}) क्लिपबोर्ड पर कॉपी हो गया!",
            toast_order_success: "ऑर्डर सफलतापूर्वक दर्ज हो गया!"
        }
    };

    // Category Name Mappings
    const CATEGORY_TRANSLATIONS = {
        "Bread": "ब्रेड",
        "Burger": "बर्गर",
        "Chinese Food": "चाइनीज फ़ूड",
        "Colo Drinks": "कोल्ड ड्रिंक्स",
        "Cold Drinks": "कोल्ड ड्रिंक्स",
        "Desserts": "डेज़र्ट्स",
        "Hot Cold Coffee": "हॉट / कोल्ड कॉफ़ी",
        "Coffee": "कॉफ़ी",
        "Mojito": "मोजितो",
        "Momos": "मोमोज़",
        "Noodles": "नूडल्स",
        "Pasta": "पास्ता",
        "Pizza": "पिज़्ज़ा",
        "Rice": "राइस",
        "Salad": "सलाद",
        "Sandwich": "सैंडविच",
        "Shake": "शेक",
        "Side Orders": "साइड ऑर्डर्स",
        "Spring Rolls": "स्प्रिंग रोल्स",
        "Wrap": "रैप"
    };

    // Complete Dish Names Devanagari Hindi Mapping
    const MENU_ITEM_TRANSLATIONS = {
        // Spring Rolls & Kathi Rolls
        "Chilly Paneer Kathi Roll": "चिली पनीर काठी रोल",
        "Chilli Paneer Kathi Roll": "चिली पनीर काठी रोल",
        "Crispy Spring Roll": "क्रिसपी स्प्रिंग रोल",
        "Paneer Kathi Roll": "पनीर काठी रोल",
        "Spring Roll": "स्प्रिंग रोल",
        "Veg Kathi Roll": "वेज काठी रोल",

        // Mojito & Coolers
        "Fresh Lime Soda": "फ़्रेश लाइम सोडा",
        "Green Apple Mojito": "ग्रीन एप्पल मोजितो",
        "Mineral Water Soft Drink": "मिनरल वाटर सॉफ्ट ड्रिंक",
        "Mint Mojito": "मिंट मोजितो",
        "Strawberry Mojito": "स्ट्रॉबेरी मोजितो",
        "Virgin Mojito": "वर्जिन मोजितो",

        // Cold Drinks & Beverages
        "Coke (300ml)": "कोक (300ml)",
        "Coke With Ice Cream": "कोक विद आइसक्रीम",
        "Milky Cola": "मिल्की कोला",
        "Milky Mango": "मिल्की मैंगो",

        // Side Orders & Fries
        "French Fries": "फ़्रेंच फ़्राइज़",
        "Masala Fries": "मसाला फ़्राइज़",
        "Paneer Parcel": "पनीर पार्सल",
        "Peri Peri Fries": "पेरी पेरी फ़्राइज़",
        "Saucy Fries": "सॉसी फ़्राइज़",
        "Taco": "टैको",
        "Zingy Parcel": "ज़िंगी पार्सल",

        // Salads
        "Green Salad": "ग्रीन सलाद",
        "Perfetto Special Salad": "पर्फेटो स्पेशल सलाद",
        "Russian Salad": "रशियन सलाद",

        // Desserts
        "Ice Cream Vanilla": "वैनिला आइसक्रीम",
        "Lava Cake With Ice Cream": "लावा केक विद आइसक्रीम",
        "Lava Cake": "लावा केक",

        // Noodles
        "Butter Paneer Noodles": "बटर पनीर नूडल्स",
        "Chilly Garlic Noodles": "चिली गार्लिक नूडल्स",
        "Chilli Garlic Noodles": "चिली गार्लिक नूडल्स",
        "Haka Noodles": "हक्का नूडल्स",
        "Hakka Noodles": "हक्का नूडल्स",
        "Paneer Noodles": "पनीर नूडल्स",
        "Singapuri Noodles": "सिंगापुरी नूडल्स",
        "Veg Noodles": "वेज नूडल्स",

        // Coffee
        "Cold Coffee": "कोल्ड कॉफ़ी",
        "Hot Coffee": "हॉट कॉफ़ी",

        // Momos
        "Chilly Paneer Momos": "चिली पनीर मोमोज़",
        "Chilli Paneer Momos": "चिली पनीर मोमोज़",
        "Chilly Veg Momos": "चिली वेज मोमोज़",
        "Chilli Veg Momos": "चिली वेज मोमोज़",
        "Crispy Paneer Momos": "क्रिसपी पनीर मोमोज़",
        "Crispy Veg Momos": "क्रिसपी वेज मोमोज़",
        "Pan Fried Paneer Momos": "पैन फ्राइड पनीर मोमोज़",
        "Pan Fried Veg Momo": "पैन फ्राइड वेज मोमो",
        "Pan Fried Veg Momos": "पैन फ्राइड वेज मोमोज़",
        "Paneer Momos": "पनीर मोमोज़",
        "Special Paneer Momos": "स्पेशल पनीर मोमोज़",
        "Tandoori Paneer Momos": "तंदूरी पनीर मोमोज़",
        "Tandoori Veg Momos": "तंदूरी वेज मोमोज़",
        "Veg Momos": "वेज मोमोज़",

        // Sandwiches
        "Double Decker Sandwich": "डबल डेकर सैंडविच",
        "Grilled Sandwich": "ग्रिल्ड सैंडविच",
        "Paneer Sandwich": "पनीर सैंडविच",
        "Spicy Sandwich": "स्पाइसी सैंडविच",
        "Cheesy Sandwich": "चीज़ी सैंडविच",

        // Burgers
        "Acharri Burger": "अचारी बर्गर",
        "Achari Burger": "अचारी बर्गर",
        "Aloo Patty Burger": "आलू पैटी बर्गर",
        "Cheese Spicy": "चीज़ स्पाइसी बर्गर",
        "Cheese Spicy Burger": "चीज़ स्पाइसी बर्गर",
        "Cheesy Burger": "चीज़ी बर्गर",
        "Crispy Paneer": "क्रिसपी पनीर बर्गर",
        "Crispy Paneer Burger": "क्रिसपी पनीर बर्गर",
        "Peri Peri Burger": "पेरी पेरी बर्गर",
        "Special Burger": "स्पेशल बर्गर",
        "Tandoori Burger": "तंदूरी बर्गर",
        "Veggie Burger": "वेजी बर्गर",

        // Wraps
        "Tandoori Wrap": "तंदूरी रैप",
        "Aloo Patty Wrap": "आलू पैटी रैप",
        "Cheesy Saucy Wrap": "चीज़ी सॉसी रैप",
        "Cheesy Wrap": "चीज़ी रैप",
        "Crispy Paneer Wrap": "क्रिसपी पनीर रैप",
        "Spicy Wrap": "स्पाइसी रैप",

        // Breads
        "Cheese Corn Bread": "चीज़ कॉर्न ब्रेड",
        "Garlic Bread": "गार्लिक ब्रेड",
        "Perfetto Stuffed Bread": "पर्फेटो स्टफ्ड ब्रेड",
        "Stuffed Bread": "स्टफ्ड ब्रेड",

        // Chinese Food
        "Honey Chilly Cauliflower": "हनी चिली कॉलीफ्लावर",
        "Honey Chilli Cauliflower": "हनी चिली कॉलीफ्लावर",
        "Honey Chilly Potato": "हनी चिली पोटैटो",
        "Honey Chilli Potato": "हनी चिली पोटैटो",
        "Chilly Cauliflower": "चिली कॉलीफ्लावर",
        "Chilli Cauliflower": "चिली कॉलीफ्लावर",
        "Chilly Potato": "चिली पोटैटो",
        "Chilli Potato": "चिली पोटैटो",
        "Chilly Paneer": "चिली पनीर",
        "Chilli Paneer": "चिली पनीर",
        "Veg Manchurian": "वेज मंचूरियन",

        // Pizzas
        "Double Cheese Margherita": "डबल चीज़ मार्गेरीटा",
        "Green Veggie": "ग्रीन वेजी पिज़्ज़ा",
        "Harissa Pizza": "हरीसा पिज़्ज़ा",
        "Hot Country": "हॉट कंट्री पिज़्ज़ा",
        "Indian Veggie": "इंडियन वेजी पिज़्ज़ा",
        "Lovers Pizza": "लवर्स पिज़्ज़ा",
        "Lover's Pizza": "लवर्स पिज़्ज़ा",
        "Makhani Pizza": "मखनी पिज़्ज़ा",
        "Paradize Pizza": "पैराडाइज पिज़्ज़ा",
        "Paradise Pizza": "पैराडाइज पिज़्ज़ा",
        "Perfetto Special Pizza": "पर्फेटो स्पेशल पिज़्ज़ा",
        "Perfetto Special": "पर्फेटो स्पेशल पिज़्ज़ा",
        "Spicy Pizza": "स्पाइसी पिज़्ज़ा",
        "Supreme Pizza": "सुप्रीम पिज़्ज़ा",
        "Tandoori Pizza": "तंदूरी पिज़्ज़ा",
        "Achari Pizza": "अचारी पिज़्ज़ा",
        "Acharri Pizza": "अचारी पिज़्ज़ा",
        "Cheese 'n Corn": "चीज़ कॉर्न पिज़्ज़ा",
        "Cheese n Corn": "चीज़ कॉर्न पिज़्ज़ा",
        "Cheese 'n Mushroom": "चीज़ मशरूम पिज़्ज़ा",
        "Cheese n Mushroom": "चीज़ मशरूम पिज़्ज़ा",
        "Chipotle Pizza": "चिपोटले पिज़्ज़ा",
        "Delight Pizza": "डिलाइट पिज़्ज़ा",
        "Deluxe Pizza": "डीलक्स पिज़्ज़ा",
        "Farm House": "फार्म हाउस पिज़्ज़ा",
        "Farmhouse": "फार्म हाउस पिज़्ज़ा",

        // Shakes
        "Black Currant Shake": "ब्लैक करंट शेक",
        "Butter Scotch Shake": "बटर स्कॉच शेक",
        "Chocolate Shake": "चॉकलेट शेक",
        "Kit Kat Crunchy Shake": "किट कैट क्रंची शेक",
        "KitKat Crunchy Shake": "किट कैट क्रंची शेक",
        "Oreo Feast Shake": "ओरियो फीस्ट शेक",
        "Pineapple Shake": "पाइनएप्पल शेक",
        "Rasmalai Shake": "रसमलाई शेक",
        "Strawberry Shake": "स्ट्रॉबेरी शेक",
        "Vanilla Shake": "वैनिला शेक",

        // Rice
        "Veg Fried Rice": "वेज फ्राइड राइस",
        "Singapuri Rice": "सिंगापुरी राइस",
        "Chilly Garlic Rice": "चिली गार्लिक राइस",
        "Chilli Garlic Rice": "चिली गार्लिक राइस",
        "Haka Rice": "हक्का राइस",
        "Hakka Rice": "हक्का राइस",

        // Pasta
        "Baked Mix Pasta": "बेक्ड मिक्स पास्ता",
        "Baked Red Pasta": "बेक्ड रेड पास्ता",
        "Baked Sweet & Spicy Pasta": "बेक्ड स्वीट एंड स्पाइसी पास्ता",
        "Baked Sweet and Spicy Pasta": "बेक्ड स्वीट एंड स्पाइसी पास्ता",
        "Baked Tandoori Pasta": "बेक्ड तंदूरी पास्ता",
        "Baked White Pasta": "बेक्ड व्हाइट पास्ता",
        "Baked Makhani Pasta": "बेक्ड मखनी पास्ता",
        "Creamy Pasta": "क्रीमी पास्ता",
        "Red Pasta": "रेड पास्ता",
        "Supreme Pasta": "सुप्रीम पास्ता",
        "Tandoori Pasta": "तंदूरी पास्ता",
        "Red Sauce Pasta": "रेड सॉस पास्ता",
        "White Sauce Pasta": "व्हाइट सॉस पास्ता",
        "Mix Sauce Pasta": "मिक्स सॉस पास्ता"
    };

    // Dynamic word-level translation dictionary for custom dish names & tokens
    const WORD_TRANSLATIONS = {
        "Honey": "हनी",
        "Cauliflower": "कॉलीफ्लावर",
        "Potato": "पोटैटो",
        "Manchurian": "मंचूरियन",
        "Stuffed": "स्टफ्ड",
        "Baked": "बेक्ड",
        "Creamy": "क्रीमी",
        "Sauce": "सॉस",
        "Saucy": "सॉसी",
        "Mix": "मिक्स",
        "Mixed": "मिक्स",
        "Sweet": "स्वीट",
        "Spicy": "स्पाइसी",
        "White": "व्हाइट",
        "Red": "रेड",
        "Makhani": "मखनी",
        "Supreme": "सुप्रीम",
        "Deluxe": "डीलक्स",
        "Delight": "डिलाइट",
        "Farm": "फार्म",
        "House": "हाउस",
        "Country": "कंट्री",
        "Harissa": "हरीसा",
        "Chipotle": "चिपोटले",
        "Margherita": "मार्गेरीटा",
        "Currant": "करंट",
        "Black": "ब्लैक",
        "Scotch": "स्कॉच",
        "Pineapple": "पाइनएप्पल",
        "Rasmalai": "रसमलाई",
        "Lime": "लाइम",
        "Soda": "सोडा",
        "Apple": "एप्पल",
        "Mint": "मिंट",
        "Virgin": "वर्जिन",
        "Mineral": "मिनरल",
        "Water": "वाटर",
        "Soft": "सॉफ्ट",
        "Drink": "ड्रिंक",
        "Drinks": "ड्रिंक्स",
        "Coke": "कोक",
        "Cola": "कोला",
        "Milky": "मिल्की",
        "Mango": "मैंगो",
        "Parcel": "पार्सल",
        "Zingy": "ज़िंगी",
        "Taco": "टैको",
        "French": "फ़्रेंच",
        "Russian": "रशियन",
        "Gravy": "ग्रेवी",
        "Dry": "ड्राई",
        "Pizza": "पिज़्ज़ा",
        "Burger": "बर्गर",
        "Wrap": "रैप",
        "Bread": "ब्रेड",
        "Sandwich": "सैंडविच",
        "Momos": "मोमोज़",
        "Momo": "मोमो",
        "Noodles": "नूडल्स",
        "Pasta": "पास्ता",
        "Rice": "राइस",
        "Shake": "शेक",
        "Salad": "सलाद",
        "Roll": "रोल",
        "Rolls": "रोल्स",
        "Fries": "फ़्राइज़",
        "Coffee": "कॉफ़ी",
        "Mojito": "मोजितो",
        "Paneer": "पनीर",
        "Cheese": "चीज़",
        "Cheesy": "चीज़ी",
        "Crispy": "क्रिसपी",
        "Tandoori": "तंदूरी",
        "Butter": "बटर",
        "Acharri": "अचारी",
        "Achari": "अचारी",
        "Aloo": "आलू",
        "Patty": "पैटी",
        "Special": "स्पेशल",
        "Fried": "फ्राइड",
        "Veg": "वेज",
        "Veggie": "वेजी",
        "Green": "ग्रीन",
        "Chilly": "चिली",
        "Chilli": "चिली",
        "Garlic": "गार्लिक",
        "Corn": "कॉर्न",
        "Mushroom": "मशरूम",
        "Masala": "मसाला",
        "Hot": "हॉट",
        "Cold": "कोल्ड",
        "Ice Cream": "आइसक्रीम",
        "Icecream": "आइसक्रीम",
        "Chocolate": "चॉकलेट",
        "Vanilla": "वैनिला",
        "Strawberry": "स्ट्रॉबेरी",
        "Oreo": "ओरियो",
        "Kit Kat": "किट कैट",
        "KitKat": "किट कैट",
        "Kathi": "काठी",
        "Double": "डबल",
        "Decker": "डेकर",
        "Grilled": "ग्रिल्ड",
        "Lava": "लावा",
        "Cake": "केक",
        "Feast": "फीस्ट",
        "Crunchy": "क्रंची",
        "Singapuri": "सिंगापुरी",
        "Haka": "हक्का",
        "Hakka": "हक्का",
        "Onion": "प्याज",
        "Capsicum": "शिमला मिर्च",
        "Tomato": "टमाटर",
        "Olives": "ऑलिव्स",
        "Olive": "ऑलिव",
        "Jalapeno": "हैलापीनो",
        "Jalapenos": "हैलापीनो",
        "Paprika": "पेप्रिका",
        "Bellpeper": "शिमला मिर्च",
        "Extra": "एक्स्ट्रा",
        "Mayo": "मेयो",
        "Free": "मुफ़्त",
        "With": "विद",
        "And": "एंड"
    };

    // State
    const STORAGE_KEY = 'app_language';
    let currentLanguage = (function () {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'hi' || saved === 'en') return saved;
        } catch (e) { }
        return 'en';
    })();

    function getAppLanguage() {
        return currentLanguage;
    }

    function setAppLanguage(lang) {
        if (lang !== 'en' && lang !== 'hi') return;
        currentLanguage = lang;
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) { }
        applyAppLanguage(lang);
    }

    function t(key, params, fallback = '') {
        if (typeof params === 'string' && !fallback) {
            fallback = params;
            params = null;
        }

        // Dynamic regex for expires_in_X_days
        if (typeof key === 'string') {
            const expMatch = key.match(/^expires_in_(\d+)_days?$/i);
            if (expMatch) {
                const days = expMatch[1];
                return currentLanguage === 'hi'
                    ? (days === '1' ? '1 दिन में समाप्त' : `${days} दिनों में समाप्त`)
                    : (days === '1' ? 'Expires in 1 day' : `Expires in ${days} days`);
            }
        }

        const langPack = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
        let str = '';
        if (langPack && langPack[key] !== undefined) {
            str = langPack[key];
        } else if (TRANSLATIONS.en && TRANSLATIONS.en[key] !== undefined) {
            str = TRANSLATIONS.en[key];
        } else {
            str = fallback || key;
        }

        if (params && typeof params === 'object' && typeof str === 'string') {
            for (const [k, v] of Object.entries(params)) {
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
            }
        }

        return str;
    }

    function tItem(itemName) {
        if (!itemName) return '';
        if (currentLanguage === 'en') return itemName;

        let clean = String(itemName).trim();

        // Separate size suffix like " (S)", " (M)", " (L)" or quantity/unit
        let suffix = '';
        const sizeMatch = clean.match(/\s*(\([SML]\))$/i);
        if (sizeMatch) {
            suffix = ' ' + sizeMatch[1].toUpperCase();
            clean = clean.slice(0, sizeMatch.index).trim();
        }

        // 1. Check exact match in dictionary
        if (MENU_ITEM_TRANSLATIONS[clean]) {
            return MENU_ITEM_TRANSLATIONS[clean] + suffix;
        }

        // 2. Check case-insensitive & quote-normalized match
        const normalizeKey = s => s.toLowerCase().replace(/['"’]/g, "'").replace(/\s+/g, ' ').trim();
        const normClean = normalizeKey(clean);
        for (const [key, val] of Object.entries(MENU_ITEM_TRANSLATIONS)) {
            if (normalizeKey(key) === normClean) {
                return val + suffix;
            }
        }

        // 3. Fallback: Token-level replacement using comprehensive WORD_TRANSLATIONS
        let translated = clean;
        translated = translated.replace(/\s*&\s*/g, ' and ');
        translated = translated.replace(/\s+'n\s+/gi, ' and ');

        const sortedWords = Object.keys(WORD_TRANSLATIONS).sort((a, b) => b.length - a.length);
        for (const word of sortedWords) {
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
            translated = translated.replace(regex, WORD_TRANSLATIONS[word]);
        }

        return translated + suffix;
    }

    function tCategory(catName) {
        if (!catName) return '';
        if (currentLanguage === 'en') return catName;
        if (CATEGORY_TRANSLATIONS[catName]) return CATEGORY_TRANSLATIONS[catName];
        return catName;
    }

    function tAddon(addonName) {
        if (!addonName) return '';
        if (currentLanguage === 'en') return addonName;
        const lower = addonName.toLowerCase();
        if (lower.includes('cheese')) return t('addon_extra_cheese');
        if (lower.includes('spicy')) return t('addon_extra_spicy');
        if (lower.includes('mayo')) return t('addon_extra_mayo');
        if (lower.includes('ice cream') || lower.includes('icecream')) return t('addon_with_ice_cream');
        if (lower.includes('free')) return t('addon_free');
        return addonName;
    }

    function applyAppLanguage(lang) {
        if (!lang) lang = currentLanguage;
        currentLanguage = lang;

        // Update html lang attribute
        document.documentElement.setAttribute('lang', lang);

        // Update language toggle buttons & profile inline pills
        document.querySelectorAll('.lang-btn, .profile-lang-pill').forEach(btn => {
            if (btn.getAttribute('data-lang') === lang || btn.id === `profile-pill-${lang}` || btn.id === `lang-btn-${lang}`) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Translate all data-i18n elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = t(key);
            if (translation) {
                // If element has text only (no nested child tags)
                if (el.children.length === 0) {
                    el.textContent = translation;
                } else {
                    // Look for child text node or designated label span
                    const labelSpan = el.querySelector('.nav-label, .btn-text, .i18n-text');
                    if (labelSpan) {
                        labelSpan.textContent = translation;
                    } else {
                        // Replace only the first non-empty text node
                        for (let node of el.childNodes) {
                            if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 0) {
                                node.nodeValue = translation;
                                break;
                            }
                        }
                    }
                }
            }
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = t(key);
            if (translation) el.placeholder = translation;
        });

        // Translate titles / aria-labels
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = t(key);
            if (translation) {
                el.title = translation;
                el.setAttribute('aria-label', translation);
            }
        });

        // Call global application re-render hook if app.js is ready
        if (window.onAppLanguageChanged && typeof window.onAppLanguageChanged === 'function') {
            try {
                window.onAppLanguageChanged(lang);
            } catch (err) {
                console.warn('Language change hook error:', err);
            }
        }
    }

    /**
     * Check local storage on application startup for a saved language preference key.
     * If no language key is found (first visit or fresh device session),
     * trigger initial selection modal before user interacts with the app.
     */
    function initFirstVisitLanguageModal() {
        let savedLang = null;
        try {
            savedLang = localStorage.getItem(STORAGE_KEY);
        } catch (e) { }

        if (!savedLang || (savedLang !== 'en' && savedLang !== 'hi')) {
            showFirstVisitLanguageModal();
        }
    }

    let pendingModalLanguage = 'en';

    function showFirstVisitLanguageModal() {
        const modal = document.getElementById('first-visit-lang-modal');
        if (!modal) return;

        pendingModalLanguage = currentLanguage || 'en';

        // Highlight current selection with radio check mark
        const optEn = document.getElementById('lang-opt-en');
        const optHi = document.getElementById('lang-opt-hi');
        if (optEn) optEn.classList.toggle('selected', pendingModalLanguage === 'en');
        if (optHi) optHi.classList.toggle('selected', pendingModalLanguage === 'hi');

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('lang-modal-open');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                modal.classList.add('active');
            });
        });
    }

    function onLanguageOptionClick(lang) {
        if (lang !== 'en' && lang !== 'hi') lang = 'en';
        pendingModalLanguage = lang;

        // Selecting English or Hindi should only highlight the option with a radio check mark
        const optEn = document.getElementById('lang-opt-en');
        const optHi = document.getElementById('lang-opt-hi');
        if (optEn) optEn.classList.toggle('selected', lang === 'en');
        if (optHi) optHi.classList.toggle('selected', lang === 'hi');
    }
    window.onLanguageOptionClick = onLanguageOptionClick;

    function confirmLanguageSelection() {
        const lang = pendingModalLanguage || currentLanguage || 'en';

        // 1. Save chosen value to local storage (permanent for this device)
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (e) {
            console.warn('Unable to write language to localStorage:', e);
        }

        // 2. Apply selected language translations immediately across active screen
        setAppLanguage(lang);

        // 3. Dismiss modal with smooth exit animation
        const modal = document.getElementById('first-visit-lang-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('lang-modal-open');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.setAttribute('aria-hidden', 'true');
            }, 320);
        }
    }
    window.confirmLanguageSelection = confirmLanguageSelection;

    function selectFirstVisitLanguage(lang) {
        onLanguageOptionClick(lang);
    }

    // Expose API globally
    window.TRANSLATIONS = TRANSLATIONS;
    window.CATEGORY_TRANSLATIONS = CATEGORY_TRANSLATIONS;
    window.MENU_ITEM_TRANSLATIONS = MENU_ITEM_TRANSLATIONS;
    window.WORD_TRANSLATIONS = WORD_TRANSLATIONS;
    window.getAppLanguage = getAppLanguage;
    window.setAppLanguage = setAppLanguage;
    window.t = t;
    window.tItem = tItem;
    window.tCategory = tCategory;
    window.tAddon = tAddon;
    window.perfettoTranslate = t;
    window.perfettoTranslateItem = tItem;
    window.perfettoTranslateCategory = tCategory;
    window.perfettoTranslateAddon = tAddon;
    window.applyAppLanguage = applyAppLanguage;
    window.initFirstVisitLanguageModal = initFirstVisitLanguageModal;
    window.showFirstVisitLanguageModal = showFirstVisitLanguageModal;
    window.openLanguageSelectionModal = showFirstVisitLanguageModal;
    window.selectFirstVisitLanguage = onLanguageOptionClick;
    window.onLanguageOptionClick = onLanguageOptionClick;
    window.confirmLanguageSelection = confirmLanguageSelection;

    // Auto initialize on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyAppLanguage(currentLanguage);
            initFirstVisitLanguageModal();
        });
    } else {
        applyAppLanguage(currentLanguage);
        initFirstVisitLanguageModal();
    }
})();
