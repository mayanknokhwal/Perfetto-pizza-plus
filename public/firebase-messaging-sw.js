/**
 * Perfetto Pizza - Firebase Cloud Messaging Service Worker
 * Production-grade background push notification & haptic alert engine.
 */

// Guard against non-Worker or SSR evaluation
if (typeof importScripts === 'function') {
    try {
        importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
        importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
    } catch (err) {
        console.warn('[firebase-messaging-sw.js] Failed to importScripts:', err);
    }
}

// Initialize Firebase App in Service Worker context safely
if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
            authDomain: "website-fa79c.firebaseapp.com",
            projectId: "website-fa79c",
            storageBucket: "website-fa79c.firebasestorage.app",
            messagingSenderId: "1070276115284",
            appId: "1:1070276115284:web:ebcb37d56f3af2a2d326c1",
            measurementId: "G-DT7MRXDMZ0"
        };

        if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        if (typeof firebase.messaging === 'function') {
            const messaging = firebase.messaging();

            // Background push notification listener
            if (typeof messaging.onBackgroundMessage === 'function') {
                messaging.onBackgroundMessage((payload) => {
                    console.log('[firebase-messaging-sw.js] Received background message:', payload);

                    const data = (payload && (payload.data || payload.notification)) || {};
                    const orderNumber = data.orderNumber || data.orderId || data.id || 'New';
                    const customerName = data.customerName || data.customer || 'Customer';
                    const items = data.items || data.itemsSummary || 'Pizza Order';
                    const total = data.total || data.totalAmount || '';

                    const title = data.title || `🍕 New Order Alert! (#${orderNumber})`;
                    const body = data.body || (total ? `${customerName} • ${items} • ₹${total}` : `${customerName} • ${items}`);
                    const icon = data.icon || 'https://i.ibb.co/wNBDySCg/perfetto-Black.webp';
                    const badge = data.badge || 'https://i.ibb.co/wNBDySCg/perfetto-Black.webp';

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

                    if (typeof self !== 'undefined' && self.registration && typeof self.registration.showNotification === 'function') {
                        return self.registration.showNotification(title, notificationOptions);
                    }
                });
            }
        }
    } catch (err) {
        console.warn('[firebase-messaging-sw.js] Initialization notice:', err.message);
    }
}

// Handle notification click to focus or launch Staff Portal
if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
    self.addEventListener('notificationclick', (event) => {
        if (event && event.notification && typeof event.notification.close === 'function') {
            event.notification.close();
        }

        const targetPath = (event && event.notification && event.notification.data && event.notification.data.url) || '/staff';

        if (typeof clients !== 'undefined' && typeof clients.matchAll === 'function') {
            event.waitUntil(
                clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
                    for (let client of windowClients) {
                        const url = (client.url || '').toLowerCase();
                        if (url.includes('/staff') || url.includes('/kitchen') || url.includes('staff.html')) {
                            if ('focus' in client && typeof client.focus === 'function') {
                                return client.focus();
                            }
                        }
                    }
                    if (clients.openWindow) {
                        return clients.openWindow(targetPath);
                    }
                })
            );
        }
    });
}
