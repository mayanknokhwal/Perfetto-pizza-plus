/**
 * Perfetto Pizza - Firebase Cloud Messaging Service Worker
 * Production-grade background push notification & haptic alert engine.
 */

// Import Firebase 10.14.1 compat scripts
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Initialize Firebase App in Service Worker context
const firebaseConfig = {
    apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
    authDomain: "website-fa79c.firebaseapp.com",
    projectId: "website-fa79c",
    storageBucket: "website-fa79c.firebasestorage.app",
    messagingSenderId: "1070276115284",
    appId: "1:1070276115284:web:ebcb37d56f3af2a2d326c1",
    measurementId: "G-DT7MRXDMZ0"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background push notification listener
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const data = payload.data || payload.notification || {};
    const orderNumber = data.orderNumber || data.orderId || data.id || 'New';
    const customerName = data.customerName || data.customer || 'Customer';
    const items = data.items || data.itemsSummary || 'Pizza Order';
    const total = data.total || data.totalAmount || '';

    const title = data.title || `🍕 New Order Alert! (#${orderNumber})`;
    const body = data.body || (total ? `${customerName} • ${items} • ₹${total}` : `${customerName} • ${items}`);
    const icon = data.icon || 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';
    const badge = data.badge || 'https://i.ibb.co/HfRxNYQv/perfetto-Black.png';

    const notificationOptions = {
        body: body,
        icon: icon,
        badge: badge,
        tag: 'new-order-alert',
        requireInteraction: true,
        vibrate: [300, 150, 300, 150, 500],
        data: {
            url: '/staff',
            orderId: orderNumber,
            timestamp: Date.now()
        },
        actions: [
            { action: 'open_staff', title: 'Open Kitchen Portal' }
        ]
    };

    return self.registration.showNotification(title, notificationOptions);
});

// Handle notification click to focus or launch Staff Portal
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetPath = (event.notification.data && event.notification.data.url) || '/staff';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if Staff Portal or Kitchen tab is already open
            for (let client of windowClients) {
                const url = client.url.toLowerCase();
                if (url.includes('/staff') || url.includes('/kitchen') || url.includes('staff.html')) {
                    if ('focus' in client) {
                        return client.focus();
                    }
                }
            }
            // If not currently active, open new window/tab
            if (clients.openWindow) {
                return clients.openWindow(targetPath);
            }
        })
    );
});
