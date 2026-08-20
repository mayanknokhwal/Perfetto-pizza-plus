// --------------------------------------------------------------------------
// PERFETTO PIZZA - MOBILE STAFF PORTAL (GOOGLE AUTH & ORDERS CONTROLLER)
// --------------------------------------------------------------------------

// 1. FIREBASE GOOGLE AUTHENTICATION & ACCESS GUARD
let staffFirebaseAuth = null;
let staffGoogleProvider = null;
let currentStaffUser = null;

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
    authDomain: "website-fa79c.firebaseapp.com",
    projectId: "website-fa79c",
    storageBucket: "website-fa79c.appspot.com",
    messagingSenderId: "29523182317",
    appId: "1:29523182317:web:perfetto-pizza"
};

function initStaffFirebaseGoogleAuth() {
    try {
        if (typeof firebase !== 'undefined' && firebase.apps) {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            staffFirebaseAuth = firebase.auth();

            if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
                staffFirebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
                    console.warn('Firebase persistence warning:', err.message);
                });
            }

            staffGoogleProvider = new firebase.auth.GoogleAuthProvider();
            staffGoogleProvider.addScope('email');
            staffGoogleProvider.addScope('profile');
            staffGoogleProvider.setCustomParameters({ prompt: 'select_account' });

            staffFirebaseAuth.getRedirectResult().then(result => {
                if (result && result.user) {
                    verifyStaffWithBackend(result.user);
                }
            }).catch(err => {
                console.warn('Redirect auth result notice:', err);
            });

            staffFirebaseAuth.onAuthStateChanged(user => {
                if (user) {
                    verifyStaffWithBackend(user);
                } else {
                    renderStaffUnauthenticatedState();
                }
            });
        } else {
            console.warn('Firebase SDK not loaded, checking session');
            checkStoredStaffSession();
        }
    } catch (e) {
        console.error('Error initializing staff auth:', e);
    }
}

async function verifyStaffWithBackend(firebaseUser) {
    const errorMsg = document.getElementById('login-error-msg');
    const errorText = document.getElementById('login-error-text');
    const loginScreen = document.getElementById('staff-login-screen');
    const dashboardView = document.getElementById('staff-dashboard-view');

    if (errorMsg) errorMsg.style.display = 'none';

    try {
        const payload = {
            action: 'auth',
            portal: 'staff',
            email: firebaseUser.email,
            fullName: firebaseUser.displayName || 'Staff Member',
            photoURL: firebaseUser.photoURL || '',
            firebaseUid: firebaseUser.uid
        };

        const res = await fetch('/api/team', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data && data.success && data.authorized) {
            currentStaffUser = data.user;
            localStorage.setItem('perfetto_staff_user', JSON.stringify(currentStaffUser));

            // Show dashboard
            if (loginScreen) loginScreen.style.display = 'none';
            if (dashboardView) dashboardView.style.display = 'flex';

            renderStaffRoleBar(currentStaffUser);

            if (data.isFirstUser) {
                showStaffToast('👑 Welcome Master Admin! Staff access granted.');
            }

            // Load and render orders
            loadCustomerOrders();
            renderOrders();
        } else {
            // Access Denied
            if (loginScreen) loginScreen.style.display = 'flex';
            if (dashboardView) dashboardView.style.display = 'none';

            if (errorMsg && errorText) {
                errorText.textContent = data.message || 'Access Denied: You are not authorized to access the Staff Portal.';
                errorMsg.style.display = 'flex';
            }

            if (staffFirebaseAuth) {
                staffFirebaseAuth.signOut();
            }
            localStorage.removeItem('perfetto_staff_user');
        }
    } catch (err) {
        console.error('Staff verification error:', err);
        const stored = localStorage.getItem('perfetto_staff_user');
        if (stored) {
            try {
                currentStaffUser = JSON.parse(stored);
                if (loginScreen) loginScreen.style.display = 'none';
                if (dashboardView) dashboardView.style.display = 'flex';
                renderStaffRoleBar(currentStaffUser);
                loadCustomerOrders();
                renderOrders();
                return;
            } catch (e) {}
        }
        if (errorMsg && errorText) {
            errorText.textContent = 'Server connection error. Please try again.';
            errorMsg.style.display = 'flex';
        }
    }
}

async function handleStaffGoogleLogin() {
    const errorMsg = document.getElementById('login-error-msg');
    const errorText = document.getElementById('login-error-text');
    if (errorMsg) errorMsg.style.display = 'none';

    try {
        if (staffFirebaseAuth && staffGoogleProvider) {
            const result = await staffFirebaseAuth.signInWithPopup(staffGoogleProvider);
            if (result && result.user) {
                verifyStaffWithBackend(result.user);
            }
        } else {
            throw new Error('Firebase Auth is not ready. Please refresh.');
        }
    } catch (err) {
        console.warn('Google sign-in popup notice:', err.message);
        if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
            try {
                await staffFirebaseAuth.signInWithRedirect(staffGoogleProvider);
            } catch (redirErr) {
                if (errorMsg && errorText) {
                    errorText.textContent = redirErr.message || 'Sign in failed. Please try again.';
                    errorMsg.style.display = 'flex';
                }
            }
        } else if (err.code !== 'auth/popup-closed-by-user') {
            if (errorMsg && errorText) {
                errorText.textContent = err.message || 'Google sign-in failed. Please try again.';
                errorMsg.style.display = 'flex';
            }
        }
    }
}

function renderStaffRoleBar(user) {
    if (!user) return;
    const roleLabel = document.getElementById('current-role-label');
    const emailDisplay = document.getElementById('staff-email-display');
    const roleIcon = document.getElementById('role-icon');
    const avatarWrap = document.getElementById('logged-in-user-email');

    if (roleLabel) {
        if (user.role === 'Master Admin') {
            roleLabel.textContent = 'Master Admin';
            if (roleIcon) roleIcon.className = 'fa-solid fa-crown';
        } else if (user.role === 'Admin') {
            roleLabel.textContent = 'Admin (Manager)';
            if (roleIcon) roleIcon.className = 'fa-solid fa-user-tie';
        } else if (user.role === 'Delivery Boy') {
            roleLabel.textContent = 'Delivery Boy';
            if (roleIcon) roleIcon.className = 'fa-solid fa-motorcycle';
        } else {
            roleLabel.textContent = 'Chef (Kitchen)';
            if (roleIcon) roleIcon.className = 'fa-solid fa-fire-burner';
        }
    }

    if (emailDisplay) {
        emailDisplay.textContent = user.fullName || user.email;
    }

    if (avatarWrap && user.photoURL) {
        avatarWrap.innerHTML = `
            <img src="${user.photoURL}" alt="${user.fullName}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover; margin-right: 6px;">
            <span id="staff-email-display">${user.fullName || user.email}</span>
        `;
    }
}

function renderStaffUnauthenticatedState() {
    const loginScreen = document.getElementById('staff-login-screen');
    const dashboardView = document.getElementById('staff-dashboard-view');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (dashboardView) dashboardView.style.display = 'none';
    localStorage.removeItem('perfetto_staff_user');
    currentStaffUser = null;
}

function checkStoredStaffSession() {
    const stored = localStorage.getItem('perfetto_staff_user');
    const loginScreen = document.getElementById('staff-login-screen');
    const dashboardView = document.getElementById('staff-dashboard-view');
    if (stored) {
        try {
            currentStaffUser = JSON.parse(stored);
            if (currentStaffUser && currentStaffUser.email) {
                if (loginScreen) loginScreen.style.display = 'none';
                if (dashboardView) dashboardView.style.display = 'flex';
                renderStaffRoleBar(currentStaffUser);
                loadCustomerOrders();
                renderOrders();
                return;
            }
        } catch (e) {}
    }
    renderStaffUnauthenticatedState();
}

function handleStaffLogout() {
    if (confirm('Are you sure you want to log out of the Staff Portal?')) {
        localStorage.removeItem('perfetto_staff_user');
        currentStaffUser = null;
        if (staffFirebaseAuth) {
            staffFirebaseAuth.signOut();
        }
        renderStaffUnauthenticatedState();
        showStaffToast('Logged out successfully');
    }
}

// 2. INITIAL ORDERS DATASET & BACKEND SYNC
let staffOrders = [];

function loadCustomerOrders() {
    // 1. Instant load from LocalStorage
    try {
        const stored = localStorage.getItem('perfettoCustomerOrders');
        if (stored) {
            const customerOrders = JSON.parse(stored);
            if (Array.isArray(customerOrders)) {
                staffOrders = customerOrders;
            } else {
                staffOrders = [];
            }
        } else {
            staffOrders = [];
        }
    } catch (e) {
        console.error('Error loading customer orders from localStorage:', e);
        staffOrders = [];
    }

    // 2. Asynchronously sync with MongoDB Atlas backend
    fetchOrdersFromMongoDBBackend();
}

async function fetchOrdersFromMongoDBBackend() {
    try {
        const response = await fetch('/api/orders');
        const data = await response.json();

        if (data && data.success && Array.isArray(data.orders) && data.orders.length > 0) {
            const serverOrders = data.orders;
            const oldCount = staffOrders.length;

            // Merge server orders with local orders (avoiding duplicates by orderId)
            const mergedMap = new Map();
            
            // Server orders first (ground truth)
            serverOrders.forEach(o => {
                const id = String(o.orderId || o.id);
                mergedMap.set(id, o);
            });

            // Add any local-only pending orders that haven't synced yet
            staffOrders.forEach(o => {
                const id = String(o.orderId || o.id);
                if (!mergedMap.has(id)) {
                    mergedMap.set(id, o);
                }
            });

            const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });

            staffOrders = mergedList;

            // Update localStorage
            try {
                localStorage.setItem('perfettoCustomerOrders', JSON.stringify(staffOrders));
            } catch (e) {}

            if (staffOrders.length > oldCount && oldCount > 0) {
                showStaffToast('🔔 New Customer Order Received!');
            }

            renderOrders();
        }
    } catch (err) {
        // LocalStorage fallback already in place
        console.warn('MongoDB Atlas staff sync notice (local resilience active):', err.message);
    }
}

// --------------------------------------------------------------------------
// 3. TIMESTAMP & LIVE ELAPSED TIMER FORMATTER
// --------------------------------------------------------------------------
function formatOrderTime(createdAtIso, fallbackTimeAgo) {
    if (!createdAtIso) return fallbackTimeAgo || 'Just now';

    const createdDate = new Date(createdAtIso);
    if (isNaN(createdDate.getTime())) return fallbackTimeAgo || 'Just now';

    // Format exact creation time in AM/PM (e.g., "10:30 AM")
    const timeFormatted = createdDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    // Calculate live elapsed minutes
    const now = new Date();
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 1000));
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    let elapsedText = 'Just now';
    if (diffSeconds < 45) {
        elapsedText = 'Just now';
    } else if (diffMinutes === 1) {
        elapsedText = '1 min ago';
    } else if (diffMinutes < 60) {
        elapsedText = `${diffMinutes} mins ago`;
    } else if (diffHours === 1) {
        elapsedText = '1 hr ago';
    } else {
        elapsedText = `${diffHours} hrs ago`;
    }

    return `${timeFormatted} • ${elapsedText}`;
}

// --------------------------------------------------------------------------
// 4. DOM INITIALIZATION & EVENT LISTENERS
// --------------------------------------------------------------------------
function syncCustomerOrders() {
    if (!getAuthenticatedStaffEmail()) return;
    const oldCount = staffOrders.length;
    loadCustomerOrders();
    if (oldCount > 0 && staffOrders.length > oldCount) {
        showStaffToast('🔔 New Customer Order Received!');
    }
    renderOrders();
}

document.addEventListener('DOMContentLoaded', () => {
    // Check initial auth state
    checkStaffAuth();

    // Attach Login Form Handler
    const loginForm = document.getElementById('staff-login-form');
    const emailInput = document.getElementById('staff-email-input');
    const errorMsg = document.getElementById('login-error-msg');
    const errorText = document.getElementById('login-error-text');

    if (loginForm && emailInput) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const enteredEmail = (emailInput.value || '').trim();

            if (!enteredEmail) {
                if (errorMsg && errorText) {
                    errorText.textContent = 'Please enter your email to access Staff Portal.';
                    errorMsg.style.display = 'flex';
                }
                emailInput.classList.add('input-error');
                emailInput.focus();
                return;
            }

            // Verify email (case-insensitive) against authorized test email
            if (enteredEmail.toLowerCase() === AUTHORIZED_TEST_EMAIL) {
                if (errorMsg) errorMsg.style.display = 'none';
                emailInput.classList.remove('input-error');

                // Set session
                setAuthenticatedStaffEmail(enteredEmail.toLowerCase());
                showStaffToast('👨‍🍳 Access Granted! Welcome to Chef Panel.');
                checkStaffAuth();
            } else {
                // Deny access
                if (errorMsg && errorText) {
                    errorText.textContent = 'Access Denied: Unrecognized email. For testing, use abc@gmail.com';
                    errorMsg.style.display = 'flex';
                }
                emailInput.classList.add('input-error');
                emailInput.focus();
            }
        });

        // Clear error on input
        emailInput.addEventListener('input', () => {
            if (errorMsg) errorMsg.style.display = 'none';
            emailInput.classList.remove('input-error');
        });
    }

    // Attach Logout Button Handler
    const logoutBtn = document.getElementById('staff-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearStaffSession();
            showStaffToast('🔒 Logged out of Staff Portal.');
            checkStaffAuth();
        });
    }

    // Set lightweight polling interval to live-refresh elapsed timer and sync MongoDB Atlas orders every 5 seconds
    setInterval(() => {
        if (getAuthenticatedStaffEmail()) {
            if (staffOrders.length > 0) {
                updateLiveTimers();
            }
            fetchOrdersFromMongoDBBackend();
        }
    }, 5000);
});

function updateLiveTimers() {
    staffOrders.forEach(order => {
        const timeEl = document.getElementById(`order-time-${order.id}`);
        if (timeEl) {
            timeEl.textContent = formatOrderTime(order.createdAt, order.timeAgo);
        }
    });
}

window.addEventListener('storage', (e) => {
    if (!e.key || e.key === 'perfettoCustomerOrders') {
        syncCustomerOrders();
    }
});

// --------------------------------------------------------------------------
// 5. ORDER RENDERER (ALL ORDERS IN NATURAL CREATION SEQUENCE)
// --------------------------------------------------------------------------
function renderOrders() {
    const container = document.getElementById('orders-list-container');
    const emptyState = document.getElementById('empty-state');
    if (!container) return;

    if (staffOrders.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = staffOrders.map(order => buildOrderCardHTML(order)).join('');
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

    // Chef Action Buttons based on Order Status
    let actionButtonsHTML = '';

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
    } else if (order.status === 'delivery') {
        actionButtonsHTML = `
            <div class="action-btn-group">
                <button class="btn-touch btn-complete" onclick="updateOrderStatus('${order.id}', 'completed')">
                    <i class="fa-solid fa-house-circle-check"></i> Mark as Delivered
                </button>
            </div>
        `;
    } else {
        actionButtonsHTML = `
            <div class="action-btn-group">
                <span style="font-size: 0.82rem; color: var(--text-muted); text-align: center; width: 100%; padding: 6px 0; font-weight: 700;">
                    <i class="fa-solid fa-check-double" style="color: #22c55e;"></i> Delivered & Completed
                </span>
            </div>
        `;
    }

    // Build Items List
    const itemsHTML = (order.items || []).map(item => {
        let cleanName = (item.name || '').replace(/\s*\(\s*Standard\s*\)/gi, '').trim();
        return `
        <div class="item-row">
            <div>
                <span class="item-name">${cleanName}</span>
                ${item.notes ? `<div class="item-notes"><i class="fa-solid fa-note-sticky"></i> Note: ${item.notes}</div>` : ''}
            </div>
        </div>
    `}).join('');

    const formattedTime = formatOrderTime(order.createdAt, order.timeAgo);

    return `
        <article class="order-card" id="card-${order.id}">
            <div class="card-head">
                <div class="order-id-group">
                    <span class="order-id">#${order.id}</span>
                    <span class="order-time" id="order-time-${order.id}">${formattedTime}</span>
                </div>
                <span class="status-pill ${statusClass}">
                    <i class="fa-solid ${statusIcon}"></i> ${statusText}
                </span>
            </div>

            <div class="card-body">
                <div class="customer-info">
                    <div class="customer-name">
                        <i class="fa-solid fa-user" style="color: var(--primary-orange); font-size: 0.85rem;"></i>
                        ${order.customerName || 'Customer'}
                    </div>
                    <div class="customer-address">
                        <i class="fa-solid fa-location-dot" style="color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;"></i>
                        ${order.address || 'Address not specified'}
                    </div>
                </div>

                <div class="items-list">
                    ${itemsHTML}
                </div>

                <div class="card-summary-line">
                    <span class="payment-type">
                        <i class="fa-solid fa-credit-card"></i> ${order.paymentStatus || 'Cash on Delivery'}
                    </span>
                    <span class="total-amount">₹${order.total || 0}</span>
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

    // 1. Save updated staffOrders to localStorage
    try {
        localStorage.setItem('perfettoCustomerOrders', JSON.stringify(staffOrders));
    } catch (e) {
        console.error('Error saving updated order status:', e);
    }

    // 2. Sync updated status to MongoDB Atlas via Backend API
    syncOrderStatusToMongoDBBackend(orderId, newStatus);

    let msg = `Order #${orderId} updated to ${newStatus.toUpperCase()}`;
    if (newStatus === 'preparing') msg = `Order #${orderId} is now Preparing in Oven 🍕`;
    if (newStatus === 'ready') msg = `Order #${orderId} marked Ready for Pickup! ✅`;
    if (newStatus === 'delivery') msg = `Order #${orderId} is Out for Delivery 🛵`;
    if (newStatus === 'completed') msg = `Order #${orderId} Delivered successfully! 🎉`;

    showStaffToast(msg);
    renderOrders();
}

async function syncOrderStatusToMongoDBBackend(orderId, newStatus) {
    try {
        await fetch('/api/orders', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId: String(orderId),
                status: newStatus
            })
        });
    } catch (err) {
        console.warn('MongoDB Atlas status update notice (local resilience active):', err.message);
    }
}

// --------------------------------------------------------------------------
// 8. TOAST NOTIFICATION CONTROLLER
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

// --------------------------------------------------------------------------
// 9. INITIALIZATION ON DOM LOAD
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initStaffFirebaseGoogleAuth();

    // Background orders polling (every 3.5s for real-time kitchen feed)
    setInterval(() => {
        if (currentStaffUser) {
            fetchOrdersFromMongoDBBackend();
        }
    }, 3500);
});



