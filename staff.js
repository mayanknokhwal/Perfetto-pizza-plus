// --------------------------------------------------------------------------
// PERFETTO PIZZA - MOBILE STAFF PORTAL LOGIC (CHEF & DELIVERY)
// --------------------------------------------------------------------------

// 1. INITIAL MOCK ORDERS DATASET
let staffOrders = [
    {
        id: "1045",
        customerName: "Rahul Sharma",
        phone: "+91 98765 43210",
        address: "Flat 302, Green Park Heights, Sector 14, Gurugram",
        timeAgo: "2 mins ago",
        items: [
            { name: "1x Farm House Pizza (M)", notes: "Extra Cheese & Jalapenos" },
            { name: "1x Cheesy Garlic Bread", notes: "Extra Garlic Dip" }
        ],
        total: 488,
        paymentStatus: "Paid via UPI",
        status: "new" // options: new, preparing, ready, delivery, completed
    },
    {
        id: "1044",
        customerName: "Priya Patel",
        phone: "+91 98123 45678",
        address: "Tower B-401, DLF Phase 5, Golf Course Rd",
        timeAgo: "8 mins ago",
        items: [
            { name: "2x Peppy Paneer Pizza (L)", notes: "Thin Crust" },
            { name: "2x Coca-Cola (500ml)", notes: "Chilled" }
        ],
        total: 1120,
        paymentStatus: "Cash on Delivery",
        status: "preparing"
    },
    {
        id: "1043",
        customerName: "Ankit Verma",
        phone: "+91 99555 12345",
        address: "House #12, Sushant Lok Phase 1",
        timeAgo: "15 mins ago",
        items: [
            { name: "1x Veg Extravaganza (M)", notes: "No Mushrooms" },
            { name: "1x Choco Lava Cake", notes: "Warm" }
        ],
        total: 540,
        paymentStatus: "Paid via Cards",
        status: "ready"
    },
    {
        id: "1042",
        customerName: "Sneha Kapoor",
        phone: "+91 97111 88990",
        address: "Plot 88, Cyber City Block B",
        timeAgo: "22 mins ago",
        items: [
            { name: "1x Non-Veg Supreme (L)", notes: "Double Cheese Burst" },
            { name: "1x Pepsi (1.5L)", notes: "" }
        ],
        total: 890,
        paymentStatus: "Paid via UPI",
        status: "delivery"
    },
    {
        id: "1041",
        customerName: "Vikram Malhotra",
        phone: "+91 98990 11223",
        address: "Villa 14, Nirvana Country",
        timeAgo: "40 mins ago",
        items: [
            { name: "1x Margherita Pizza (Regular)", notes: "" },
            { name: "1x French Fries", notes: "Extra Crispy" }
        ],
        total: 310,
        paymentStatus: "Paid via UPI",
        status: "completed"
    }
];

// STATE CONTROLLERS
let currentRole = 'chef'; // 'chef' or 'delivery'
let currentFilter = 'all'; // 'all', 'kitchen', 'ready', 'delivery', 'completed'

function loadCustomerOrders() {
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const customerOrders = JSON.parse(stored);
            if (Array.isArray(customerOrders) && customerOrders.length > 0) {
                // Combine customer placed orders with mock fallback orders, avoiding duplicate IDs
                const existingIds = new Set(customerOrders.map(o => o.id));
                const uniqueMock = staffOrders.filter(o => !existingIds.has(o.id));
                staffOrders = [...customerOrders, ...uniqueMock];
            }
        }
    } catch (e) {
        console.error('Error loading customer orders:', e);
    }
}

// --------------------------------------------------------------------------
// 2. DOM INITIALIZATION & STORAGE SYNCHRONIZATION
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    loadCustomerOrders();
    renderOrders();
    updateCounts();
});

window.addEventListener('storage', (e) => {
    if (!e.key || e.key === 'perfettoCustomerOrders') {
        loadCustomerOrders();
        renderOrders();
        updateCounts();
    }
});

// --------------------------------------------------------------------------
// 3. ROLE SWITCHING CONTROLLER
// --------------------------------------------------------------------------
function switchRole(role) {
    currentRole = role;
    
    const chefBtn = document.getElementById('role-btn-chef');
    const deliveryBtn = document.getElementById('role-btn-delivery');
    const roleLabel = document.getElementById('current-role-label');

    if (role === 'chef') {
        chefBtn.classList.add('active');
        deliveryBtn.classList.remove('active');
        roleLabel.textContent = 'Chef (Kitchen)';
        showStaffToast('Switched to Chef (Kitchen) View');
    } else {
        deliveryBtn.classList.add('active');
        chefBtn.classList.remove('active');
        roleLabel.textContent = 'Delivery Boy (Logistics)';
        showStaffToast('Switched to Delivery Boy View');
    }

    renderOrders();
}

// --------------------------------------------------------------------------
// 4. FILTER CONTROLLER
// --------------------------------------------------------------------------
function filterOrders(filterKey, el) {
    currentFilter = filterKey;
    
    // Update active tab button style
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (el) el.classList.add('active');

    renderOrders();
}

// --------------------------------------------------------------------------
// 5. ORDER RENDERER
// --------------------------------------------------------------------------
function renderOrders() {
    const container = document.getElementById('orders-list-container');
    const emptyState = document.getElementById('empty-state');
    if (!container) return;

    // Filter orders based on active filter tab
    let filtered = staffOrders.filter(order => {
        if (currentFilter === 'kitchen') return order.status === 'new' || order.status === 'preparing';
        if (currentFilter === 'ready') return order.status === 'ready';
        if (currentFilter === 'delivery') return order.status === 'delivery';
        if (currentFilter === 'completed') return order.status === 'completed';
        return true; // 'all'
    });

    updateCounts();

    if (filtered.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = filtered.map(order => buildOrderCardHTML(order)).join('');
}

// --------------------------------------------------------------------------
// 6. BUILD ORDER CARD HTML
// --------------------------------------------------------------------------
function buildOrderCardHTML(order) {
    // Status Badge Helpers
    let statusClass = 'new';
    let statusText = 'New Order';
    let statusIcon = 'fa-fire';

    if (order.status === 'preparing') {
        statusClass = 'preparing';
        statusText = 'Preparing in Oven';
        statusIcon = 'fa-kitchen-set';
    } else if (order.status === 'ready') {
        statusClass = 'ready';
        statusText = 'Ready for Pickup';
        statusIcon = 'fa-circle-check';
    } else if (order.status === 'delivery') {
        statusClass = 'delivery';
        statusText = 'Out for Delivery';
        statusIcon = 'fa-motorcycle';
    } else if (order.status === 'completed') {
        statusClass = 'completed';
        statusText = 'Delivered';
        statusIcon = 'fa-box-archive';
    }

    // Dynamic Touch Buttons based on Current Role & Order Status
    let actionButtonsHTML = '';

    if (currentRole === 'chef') {
        if (order.status === 'new') {
            actionButtonsHTML = `
                <button class="btn-touch btn-accept" onclick="updateOrderStatus('${order.id}', 'preparing')">
                    <i class="fa-solid fa-fire"></i> Accept & Start Preparing
                </button>
            `;
        } else if (order.status === 'preparing') {
            actionButtonsHTML = `
                <button class="btn-touch btn-ready" onclick="updateOrderStatus('${order.id}', 'ready')">
                    <i class="fa-solid fa-circle-check"></i> Mark as Ready for Pickup
                </button>
            `;
        } else if (order.status === 'ready') {
            actionButtonsHTML = `
                <div class="action-btn-group">
                    <button class="btn-touch btn-dispatch" onclick="updateOrderStatus('${order.id}', 'delivery')">
                        <i class="fa-solid fa-motorcycle"></i> Assign to Delivery
                    </button>
                </div>
            `;
        } else {
            actionButtonsHTML = `
                <div class="action-btn-group">
                    <a href="tel:${order.phone}" class="btn-secondary-touch">
                        <i class="fa-solid fa-phone"></i> Call Customer
                    </a>
                </div>
            `;
        }
    } else {
        // Delivery Boy Mode
        if (order.status === 'ready') {
            actionButtonsHTML = `
                <button class="btn-touch btn-dispatch" onclick="updateOrderStatus('${order.id}', 'delivery')">
                    <i class="fa-solid fa-motorcycle"></i> Accept & Out for Delivery
                </button>
            `;
        } else if (order.status === 'delivery') {
            actionButtonsHTML = `
                <button class="btn-touch btn-complete" onclick="updateOrderStatus('${order.id}', 'completed')">
                    <i class="fa-solid fa-house-circle-check"></i> Mark Order as Delivered
                </button>
                <div class="action-btn-group" style="margin-top: 6px;">
                    <a href="tel:${order.phone}" class="btn-secondary-touch">
                        <i class="fa-solid fa-phone"></i> Call
                    </a>
                    <a href="https://maps.google.com/?q=${encodeURIComponent(order.address)}" target="_blank" class="btn-secondary-touch">
                        <i class="fa-solid fa-location-dot"></i> Maps
                    </a>
                </div>
            `;
        } else if (order.status === 'completed') {
            actionButtonsHTML = `
                <div class="action-btn-group">
                    <span style="font-size: 0.8rem; color: var(--text-muted); text-align: center; width: 100%; padding: 6px 0;">
                        <i class="fa-solid fa-check-double" style="color: #22c55e;"></i> Delivered & Closed
                    </span>
                </div>
            `;
        } else {
            actionButtonsHTML = `
                <div class="action-btn-group">
                    <span style="font-size: 0.8rem; color: var(--text-muted); text-align: center; width: 100%; padding: 6px 0;">
                        <i class="fa-solid fa-clock"></i> Waiting for Kitchen Prep
                    </span>
                </div>
            `;
        }
    }

    // Build Items List
    const itemsHTML = order.items.map(item => `
        <div class="item-row">
            <div>
                <span class="item-name">${item.name}</span>
                ${item.notes ? `<div class="item-notes"><i class="fa-solid fa-note-sticky"></i> Note: ${item.notes}</div>` : ''}
            </div>
        </div>
    `).join('');

    return `
        <article class="order-card" id="card-${order.id}">
            <div class="card-head">
                <div class="order-id-group">
                    <span class="order-id">#${order.id}</span>
                    <span class="order-time">${order.timeAgo}</span>
                </div>
                <span class="status-pill ${statusClass}">
                    <i class="fa-solid ${statusIcon}"></i> ${statusText}
                </span>
            </div>

            <div class="card-body">
                <div class="customer-info">
                    <div class="customer-name">
                        <i class="fa-solid fa-user" style="color: var(--primary-orange); font-size: 0.85rem;"></i>
                        ${order.customerName}
                    </div>
                    <div class="customer-address">
                        <i class="fa-solid fa-location-dot" style="color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;"></i>
                        ${order.address}
                    </div>
                </div>

                <div class="items-list">
                    ${itemsHTML}
                </div>

                <div class="card-summary-line">
                    <span class="payment-type">
                        <i class="fa-solid fa-credit-card"></i> ${order.paymentStatus}
                    </span>
                    <span class="total-amount">₹${order.total}</span>
                </div>
            </div>

            <div class="card-footer">
                ${actionButtonsHTML}
            </div>
        </article>
    `;
}

// --------------------------------------------------------------------------
// 7. INTERACTIVE STATUS UPDATER
// --------------------------------------------------------------------------
function updateOrderStatus(orderId, newStatus) {
    const order = staffOrders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;

    // Save updated staffOrders to localStorage
    try {
        localStorage.setItem('perfettoCustomerOrders', JSON.stringify(staffOrders));
    } catch (e) {
        console.error('Error saving updated order status:', e);
    }

    let msg = `Order #${orderId} updated to ${newStatus.toUpperCase()}`;
    if (newStatus === 'preparing') msg = `Order #${orderId} is now Preparing in Oven 🍕`;
    if (newStatus === 'ready') msg = `Order #${orderId} marked Ready for Pickup! ✅`;
    if (newStatus === 'delivery') msg = `Order #${orderId} is Out for Delivery 🛵`;
    if (newStatus === 'completed') msg = `Order #${orderId} Delivered successfully! 🎉`;

    showStaffToast(msg);
    renderOrders();
}

// --------------------------------------------------------------------------
// 8. DYNAMIC COUNTERS UPDATER
// --------------------------------------------------------------------------
function updateCounts() {
    const allCount = staffOrders.length;
    const kitchenCount = staffOrders.filter(o => o.status === 'new' || o.status === 'preparing').length;
    const readyCount = staffOrders.filter(o => o.status === 'ready').length;
    const deliveryCount = staffOrders.filter(o => o.status === 'delivery').length;
    const completedCount = staffOrders.filter(o => o.status === 'completed').length;

    const elAll = document.getElementById('count-all');
    const elKitchen = document.getElementById('count-kitchen');
    const elReady = document.getElementById('count-ready');
    const elDelivery = document.getElementById('count-delivery');
    const elCompleted = document.getElementById('count-completed');

    if (elAll) elAll.textContent = allCount;
    if (elKitchen) elKitchen.textContent = kitchenCount;
    if (elReady) elReady.textContent = readyCount;
    if (elDelivery) elDelivery.textContent = deliveryCount;
    if (elCompleted) elCompleted.textContent = completedCount;
}

// --------------------------------------------------------------------------
// 9. TOAST NOTIFICATION CONTROLLER
// --------------------------------------------------------------------------
function showStaffToast(msg) {
    const toast = document.getElementById('staff-toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}


