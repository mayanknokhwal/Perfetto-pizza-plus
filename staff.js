// --------------------------------------------------------------------------
// PERFETTO PIZZA - MOBILE STAFF PORTAL LOGIC (CHEF ROLE ONLY)
// --------------------------------------------------------------------------

function resolveApiUrl(path) {
    if (!path) return '';
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    if (typeof window !== 'undefined' && (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')) {
        return `http://localhost:8080${cleanPath}`;
    }
    return cleanPath;
}

// 1. AUTHENTICATION & ACCESS GUARD
const STAFF_AUTH_SESSION_KEY = 'perfetto_staff_authenticated_email';
const STAFF_AUTH_USER_KEY = 'perfetto_staff_authenticated_user';
const AUTHORIZED_TEST_EMAIL = 'abc@gmail.com';

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
    authDomain: "website-fa79c.firebaseapp.com",
    projectId: "website-fa79c",
    storageBucket: "website-fa79c.appspot.com",
    messagingSenderId: "29523182317",
    appId: "1:29523182317:web:perfetto-pizza"
};

let staffFirebaseAuth = null;
let staffGoogleProvider = null;

function initStaffFirebaseAuth() {
    // 1. Check for incoming OAuth redirect callback in URL
    checkStaffOAuthCallbackParams();

    try {
        if (typeof firebase !== 'undefined' && firebase.apps) {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            staffFirebaseAuth = firebase.auth();
            staffGoogleProvider = new firebase.auth.GoogleAuthProvider();
            staffGoogleProvider.addScope('email');
            staffGoogleProvider.addScope('profile');
            staffGoogleProvider.setCustomParameters({ prompt: 'select_account' });
        }
    } catch (e) {
        console.warn('Staff Firebase init notice:', e.message);
    }
}

function checkStaffOAuthCallbackParams() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        if (authStatus === 'success') {
            const email = (urlParams.get('email') || '').trim().toLowerCase();
            const fullName = urlParams.get('name') || (email ? email.split('@')[0] : 'Staff Member');
            const photoURL = urlParams.get('photo') || '';
            const role = urlParams.get('role') || 'Chef';
            const status = urlParams.get('status') || 'active';

            if (status === 'active' && (role === 'Chef' || role === 'Delivery Boy')) {
                setAuthenticatedStaffUser({ email, fullName, photoURL, role, status });
                showStaffToast(`👨‍🍳 Welcome, ${fullName}! Signed in as ${role}.`);

                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                return;
            } else if (status === 'active' && (role === 'Master Admin' || role === 'Admin')) {
                sessionStorage.setItem('perfetto_admin_session_user', JSON.stringify({
                    email,
                    fullName,
                    photoURL,
                    role,
                    status
                }));
                showStaffToast(`Admin account detected! Redirecting to Admin Dashboard...`);
                setTimeout(() => {
                    window.location.href = 'admin.html' + window.location.search;
                }, 500);
                return;
            } else if (role === 'Customer') {
                showStaffToast(`Customer account detected (${email}). Redirecting to Customer App...`);
                setTimeout(() => {
                    window.location.href = 'index.html' + window.location.search;
                }, 600);
                return;
            } else if (status === 'pending') {
                showStaffToast(`⏳ Access Request Pending. Please wait for Master Admin approval.`);
                const errorMsg = document.getElementById('login-error-msg');
                const errorText = document.getElementById('login-error-text');
                if (errorMsg && errorText) {
                    errorText.textContent = `Access pending for ${email}. Master Admin approval required.`;
                    errorMsg.style.display = 'flex';
                }
            }
        }
    } catch (e) {
        console.warn('Staff OAuth param check error:', e);
    }
}

async function handleStaffGoogleSignIn() {
    showStaffToast('🔑 Connecting to Google Sign-In...');

    try {
        if (staffFirebaseAuth && staffGoogleProvider) {
            try {
                const result = await staffFirebaseAuth.signInWithPopup(staffGoogleProvider);
                if (result && result.user) {
                    await handleStaffAuthSuccess(result.user);
                    return;
                }
            } catch (popupErr) {
                console.warn('Staff Google popup notice:', popupErr.code, popupErr.message);
                if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
                    window.location.href = resolveApiUrl('/api/auth/google?target=staff');
                    return;
                } else if (popupErr.code === 'auth/popup-closed-by-user') {
                    showStaffToast('Sign-in cancelled by user.');
                    return;
                }
            }
        }
    } catch (err) {
        console.warn('Staff Firebase sign-in exception:', err.message);
    }

    // Direct Google OAuth redirect
    try {
        window.location.href = resolveApiUrl('/api/auth/google?target=staff');
        return;
    } catch (e) {}

    // Simulated fallback
    const entered = prompt('Enter staff email to sign in (Chef: abc@gmail.com):', AUTHORIZED_TEST_EMAIL);
    if (!entered || !entered.trim()) return;
    const email = entered.trim().toLowerCase();
    handleStaffAuthSuccess({ email, displayName: email === AUTHORIZED_TEST_EMAIL ? 'Kitchen Chef' : email.split('@')[0] });
}

async function handleStaffAuthSuccess(user) {
    const email = (user.email || '').trim().toLowerCase();
    const fullName = user.displayName || (email ? email.split('@')[0] : 'Staff Member');
    const photoURL = user.photoURL || '';

    try {
        const response = await fetch(resolveApiUrl('/api/admin-auth'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, fullName, photoURL, firebaseUid: user.uid || '' })
        });
        const data = await response.json();

        const role = data.role || (email === AUTHORIZED_TEST_EMAIL ? 'Chef' : 'Pending');
        const status = data.status || (email === AUTHORIZED_TEST_EMAIL ? 'active' : 'pending');

        if (status === 'active' && (role === 'Chef' || role === 'Delivery Boy')) {
            setAuthenticatedStaffUser({ email, fullName, photoURL, role, status });
            showStaffToast(`👨‍🍳 Welcome, ${fullName}! Signed in as ${role}.`);
            checkStaffAuth();
        } else if (status === 'active' && (role === 'Master Admin' || role === 'Admin')) {
            sessionStorage.setItem('perfetto_admin_session_user', JSON.stringify({
                email,
                fullName,
                photoURL,
                role,
                status
            }));
            showStaffToast(`🔑 Admin account detected! Redirecting to Admin Dashboard...`);
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 500);
        } else if (role === 'Customer') {
            showStaffToast(`Customer account detected (${email}). Redirecting to Customer App...`);
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 600);
        } else {
            const errorMsg = document.getElementById('login-error-msg');
            const errorText = document.getElementById('login-error-text');
            if (errorMsg && errorText) {
                errorText.textContent = `Access pending for ${email}. Master Admin approval required.`;
                errorMsg.style.display = 'flex';
            }
        }
    } catch (err) {
        console.warn('Staff auth verification notice:', err.message);
        if (email === AUTHORIZED_TEST_EMAIL) {
            setAuthenticatedStaffUser({ email, fullName: 'Kitchen Chef', role: 'Chef', status: 'active' });
            showStaffToast('👨‍🍳 Access Granted! Welcome to Chef Panel.');
            checkStaffAuth();
        }
    }
}

function getAuthenticatedStaffUser() {
    try {
        const stored = sessionStorage.getItem(STAFF_AUTH_USER_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
        const email = sessionStorage.getItem(STAFF_AUTH_SESSION_KEY);
        if (email) {
            return { email, role: 'Chef', fullName: email.split('@')[0] };
        }
    } catch (e) {}
    return null;
}

function getAuthenticatedStaffEmail() {
    const u = getAuthenticatedStaffUser();
    return u ? u.email : null;
}

function setAuthenticatedStaffUser(user) {
    try {
        sessionStorage.setItem(STAFF_AUTH_USER_KEY, JSON.stringify(user));
        sessionStorage.setItem(STAFF_AUTH_SESSION_KEY, user.email);
    } catch (e) {
        console.error('Error setting staff session:', e);
    }
}

function setAuthenticatedStaffEmail(email) {
    setAuthenticatedStaffUser({ email, role: 'Chef', fullName: email.split('@')[0], status: 'active' });
}

function clearStaffSession() {
    try {
        sessionStorage.removeItem(STAFF_AUTH_SESSION_KEY);
        sessionStorage.removeItem(STAFF_AUTH_USER_KEY);
        if (staffFirebaseAuth) {
            staffFirebaseAuth.signOut().catch(() => {});
        }
    } catch (e) {
        console.error('Error clearing staff session:', e);
    }
}

function checkStaffAuth() {
    const loginScreen = document.getElementById('staff-login-screen');
    const dashboardView = document.getElementById('staff-dashboard-view');
    const emailDisplay = document.getElementById('staff-email-display');
    const emailInput = document.getElementById('staff-email-input');
    const errorMsg = document.getElementById('login-error-msg');
    const roleLabel = document.getElementById('current-role-label');

    const authUser = getAuthenticatedStaffUser();

    if (authUser && authUser.email) {
        // Authenticated: Show Dashboard, Hide Login Screen
        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboardView) dashboardView.style.display = 'flex';
        if (emailDisplay) emailDisplay.textContent = authUser.email;
        if (roleLabel) roleLabel.textContent = `${authUser.role || 'Chef'} (Kitchen)`;

        // Load & render orders
        loadCustomerOrders();
        renderOrders();
    } else {
        // Unauthenticated: Show Login Screen, Hide Dashboard
        if (dashboardView) dashboardView.style.display = 'none';
        if (loginScreen) loginScreen.style.display = 'flex';

        if (errorMsg) errorMsg.style.display = 'none';
        if (emailInput) {
            emailInput.classList.remove('input-error');
        }
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
        const response = await fetch(resolveApiUrl('/api/orders'));
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

    const timeFormatted = createdDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

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
    // Initialize Firebase Google Auth for Staff
    initStaffFirebaseAuth();

    // Check initial auth state
    checkStaffAuth();

    // Attach Login Form Handler
    const loginForm = document.getElementById('staff-login-form');
    const emailInput = document.getElementById('staff-email-input');
    const errorMsg = document.getElementById('login-error-msg');
    const errorText = document.getElementById('login-error-text');

    if (loginForm && emailInput) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const enteredEmail = (emailInput.value || '').trim().toLowerCase();

            if (!enteredEmail) {
                if (errorMsg && errorText) {
                    errorText.textContent = 'Please enter your email to access Staff Portal.';
                    errorMsg.style.display = 'flex';
                }
                emailInput.classList.add('input-error');
                emailInput.focus();
                return;
            }

            // Check against authorized test email or query backend
            if (enteredEmail === AUTHORIZED_TEST_EMAIL) {
                if (errorMsg) errorMsg.style.display = 'none';
                emailInput.classList.remove('input-error');

                setAuthenticatedStaffUser({ email: enteredEmail, role: 'Chef', fullName: 'Kitchen Chef', status: 'active' });
                showStaffToast('👨‍🍳 Access Granted! Welcome to Chef Panel.');
                checkStaffAuth();
                return;
            }

            try {
                const res = await fetch(resolveApiUrl(`/api/admin-auth?email=${encodeURIComponent(enteredEmail)}`));
                const data = await res.json();

                if (data && data.success && data.status === 'active') {
                    if (data.role === 'Chef' || data.role === 'Delivery Boy') {
                        if (errorMsg) errorMsg.style.display = 'none';
                        emailInput.classList.remove('input-error');

                        setAuthenticatedStaffUser({ email: enteredEmail, role: data.role, fullName: data.user?.fullName || enteredEmail.split('@')[0], status: 'active' });
                        showStaffToast(`👨‍🍳 Access Granted! Welcome ${data.user?.fullName || enteredEmail}.`);
                        checkStaffAuth();
                        return;
                    } else if (data.role === 'Master Admin' || data.role === 'Admin') {
                        showStaffToast('Admin account detected! Redirecting to Admin Dashboard...');
                        setTimeout(() => {
                            window.location.href = 'admin.html';
                        }, 500);
                        return;
                    }
                }
            } catch (apiErr) {}

            // Deny access
            if (errorMsg && errorText) {
                errorText.textContent = 'Access Denied: Unrecognized or unapproved email. For testing, use abc@gmail.com';
                errorMsg.style.display = 'flex';
            }
            emailInput.classList.add('input-error');
            emailInput.focus();
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

    // Polling interval for live timers & order updates
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
        await fetch(resolveApiUrl('/api/orders'), {
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



