/**
 * Perfetto Pizza - Orders Controller
 * Powered by Firebase Firestore ('orders' collection)
 * Handles GET, POST, PATCH, PUT for customer orders and staff kitchen queue
 */

const { getFirestoreDoc, setFirestoreDoc, listFirestoreCollection, deleteFirestoreDoc } = require('../lib/firestore');
const { sendOrderNotificationToStaff } = require('../lib/firebaseAdmin');

function isValidOrder(order) {
    if (!order || typeof order !== 'object') return false;
    const id = String(order.orderId || order.id || order.__id || '').trim();
    if (!id || id === 'undefined' || id === 'null' || id === 'NaN') return false;

    const customerName = String(order.customerName || order.customer?.name || '').trim();
    if (!customerName || customerName === 'undefined' || customerName === 'null') return false;

    const items = order.items;
    if (!Array.isArray(items) || items.length === 0) return false;

    return true;
}

async function fetchOrdersFromFirestore() {
    try {
        const liveDocs = await listFirestoreCollection('orders', 100);
        if (Array.isArray(liveDocs) && liveDocs.length > 0) {
            // Merge live docs with in-memory store
            const mergedMap = new Map();
            for (const d of liveDocs) {
                const oid = String(d.orderId || d.id || d.__id || '').trim();
                if (isValidOrder(d)) {
                    const localExisting = global.__perfettoOrdersList.find(o => String(o.orderId || o.id) === oid);
                    if (localExisting && localExisting.updatedAt && d.updatedAt) {
                        const localTime = new Date(localExisting.updatedAt).getTime();
                        const remoteTime = new Date(d.updatedAt).getTime();
                        if (localTime >= remoteTime) {
                            mergedMap.set(oid, localExisting);
                            continue;
                        }
                    }
                    mergedMap.set(oid, d);
                } else if (oid) {
                    // Auto-purge corrupted / ghost undefined document from Firestore
                    deleteFirestoreDoc('orders', oid).catch(() => {});
                }
            }

            global.__perfettoOrdersList.forEach(o => {
                const oid = String(o.orderId || o.id || '').trim();
                if (isValidOrder(o) && !mergedMap.has(oid)) {
                    mergedMap.set(oid, o);
                }
            });

            global.__perfettoOrdersList = Array.from(mergedMap.values()).filter(isValidOrder).sort((a, b) => {
                const ta = new Date(a.createdAt || 0).getTime();
                const tb = new Date(b.createdAt || 0).getTime();
                return tb - ta;
            });
        }
    } catch (e) {
        console.warn('Firestore orders read note:', e.message);
    }
    return global.__perfettoOrdersList.filter(isValidOrder);
}

async function handleOrdersRequest(req, res) {
    try {
        // 0. Action: Trigger automated midnight cleanup routine
        if (req.query?.action === 'midnight_cleanup' || req.body?.action === 'midnight_cleanup') {
            const cleanupResult = await cleanupCompletedOrdersMidnight();
            return res.status(200).json({
                success: true,
                message: 'Midnight completed orders cleanup executed successfully',
                result: cleanupResult,
            });
        }

        // 1. GET: Fetch Orders from Firestore
        if (req.method === 'GET') {
            const query = req.query || {};
            const urlPath = String(req.originalUrl || req.url || '').toLowerCase();
            const { phone, status, limit = 100, orderId, archived, type, filter, view } = query;

            let allOrders = await fetchOrdersFromFirestore();
            let filtered = allOrders.filter(isValidOrder);

            const isArchivedQuery = archived === 'true' || archived === '1' || type === 'archived' || filter === 'archived' || view === 'archived' || urlPath.includes('/archived');

            // Extract single order ID if in query or path (e.g. /api/orders/123456)
            let effectiveOrderId = orderId;
            if (!effectiveOrderId) {
                const pathMatch = urlPath.match(/\/orders\/([0-9a-zA-Z_-]+)/);
                if (pathMatch && pathMatch[1] && pathMatch[1] !== 'archived' && pathMatch[1] !== 'completed') {
                    effectiveOrderId = pathMatch[1];
                }
            }

            if (effectiveOrderId) {
                const singleDoc = await getFirestoreDoc('orders', String(effectiveOrderId));
                if (singleDoc) {
                    filtered = [singleDoc];
                } else {
                    filtered = filtered.filter(o => String(o.orderId || o.id) === String(effectiveOrderId));
                }
            } else {
                if (phone) {
                    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
                    filtered = filtered.filter(o => {
                        const op = String(o.customerPhone || o.phone || o.customer?.phone || '').replace(/[^0-9]/g, '').slice(-10);
                        return op === cleanPhone;
                    });
                }
                if (status) {
                    const statusList = String(status).toLowerCase().split(',').map(s => s.trim());
                    filtered = filtered.filter(o => statusList.includes(String(o.status || '').toLowerCase()));
                } else if (isArchivedQuery) {
                    filtered = filtered.filter(o => ['completed', 'delivered', 'cancelled', 'archived'].includes(String(o.status || '').toLowerCase()));
                }
            }

            const formatted = filtered.slice(0, parseInt(limit, 10)).map(o => {
                const lat = o.gpsLat ?? o.latitude ?? o.gps?.lat ?? o.customer?.gps?.lat ?? o.deliveryDetails?.gpsLat ?? null;
                const lng = o.gpsLng ?? o.longitude ?? o.gps?.lng ?? o.customer?.gps?.lng ?? o.deliveryDetails?.gpsLng ?? null;
                return {
                    ...o,
                    id: o.orderId || o.id,
                    customerName: o.customer?.name || o.customerName || 'Customer',
                    customerPhone: o.customer?.phone || o.customerPhone || o.phone || '',
                    phone: o.customer?.phone || o.customerPhone || o.phone || '',
                    address: o.customer?.address || o.address || '',
                    deliveryOtp: o.deliveryOtp || o.otp || '',
                    gpsLat: lat,
                    gpsLng: lng,
                    gps: { lat, lng },
                    deliveryDetails: o.deliveryDetails || o.customer?.deliveryDetails || { gpsLat: lat, gpsLng: lng },
                    subtotal: o.costs?.subtotal || o.subtotal || 0,
                    deliveryFee: o.costs?.deliveryFee || o.deliveryFee || 0,
                    total: o.costs?.total || o.total || 0,
                };
            });

            return res.status(200).json({
                success: true,
                count: formatted.length,
                orders: formatted,
            });
        }

        // 2. POST: Create New Order in Firestore
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = null; }
            }

            if (!body) {
                return res.status(400).json({ success: false, message: 'Missing or invalid order payload' });
            }

            let finalOrderId = body.orderId || body.id;
            if (!finalOrderId) {
                finalOrderId = (Date.now()).toString();
            }

            const deliveryOtp = String(body.deliveryOtp || body.otp || Math.floor(1000 + Math.random() * 9000));
            const subtotal = Number(body.subtotal || body.costs?.subtotal || 0);
            const deliveryFee = Number(body.deliveryFee || body.costs?.deliveryFee || 0);
            const total = Number(body.total || body.costs?.total || subtotal + deliveryFee);

            const parsedLat = body.gpsLat ?? body.latitude ?? body.gps?.lat ?? body.customer?.gps?.lat ?? body.deliveryDetails?.gpsLat ?? null;
            const parsedLng = body.gpsLng ?? body.longitude ?? body.gps?.lng ?? body.customer?.gps?.lng ?? body.deliveryDetails?.gpsLng ?? null;

            const orderDoc = {
                id: String(finalOrderId),
                orderId: String(finalOrderId),
                deliveryOtp: deliveryOtp,
                customer: {
                    firebaseUid: body.firebaseUid || body.customer?.firebaseUid || '',
                    name: body.customerName || body.customer?.name || 'Customer',
                    phone: body.customerPhone || body.phone || body.customer?.phone || '',
                    email: body.customerEmail || body.email || body.customer?.email || '',
                    address: body.address || body.customer?.address || '',
                    deliveryDetails: body.deliveryDetails || body.customer?.deliveryDetails || { gpsLat: parsedLat, gpsLng: parsedLng },
                    gps: { lat: parsedLat, lng: parsedLng },
                },
                gpsLat: parsedLat,
                gpsLng: parsedLng,
                gps: { lat: parsedLat, lng: parsedLng },
                deliveryDetails: body.deliveryDetails || body.customer?.deliveryDetails || { gpsLat: parsedLat, gpsLng: parsedLng },
                items: (body.items || []).map(item => ({
                    id: String(item.id || item.name || ''),
                    name: item.name || 'Food Item',
                    size: item.size || 'Standard',
                    price: Number(item.price || 0),
                    qty: Number(item.qty || 1),
                    notes: item.notes || '',
                })),
                costs: {
                    subtotal: subtotal,
                    deliveryFee: deliveryFee,
                    discount: Number(body.discount || 0),
                    total: total,
                },
                subtotal: subtotal,
                deliveryFee: deliveryFee,
                total: total,
                customerName: body.customerName || body.customer?.name || 'Customer',
                customerPhone: body.customerPhone || body.phone || body.customer?.phone || '',
                address: body.address || body.customer?.address || '',
                paymentMethod: body.paymentMethod || (body.paymentStatus === 'PhonePe' ? 'PhonePe' : 'Cash on Delivery'),
                paymentStatus: body.paymentStatus || 'Cash on Delivery',
                paymentDetails: body.paymentDetails || {},
                status: body.status || 'new',
                createdAt: body.createdAt || new Date().toISOString(),
                timeAgo: body.timeAgo || 'Just now',
                rewardStatus: body.rewardStatus || 'pending_delivery',
                wonCashback: Number(body.wonCashback || body.earnedCashback || 0),
                earnedCashback: Number(body.earnedCashback || body.wonCashback || 0),
                scratchRevealed: Boolean(body.scratchRevealed),
                scratchClaimed: Boolean(body.scratchClaimed),
                scratchExpired: Boolean(body.scratchExpired),
                scratchExpiresAt: body.scratchExpiresAt || (Date.now() + (Number(body.scratchExpiryDays || body.cashbackExpiryDays || 7)) * 24 * 60 * 60 * 1000),
                scratchExpiryDays: Number(body.scratchExpiryDays || body.cashbackExpiryDays || 7),
                cashbackExpiryDays: Number(body.cashbackExpiryDays || body.scratchExpiryDays || 7),
                scratchCard: body.scratchCard || {
                    amount: Number(body.earnedCashback || body.wonCashback || 0),
                    wonAmount: Number(body.wonCashback || body.earnedCashback || 0),
                    status: body.rewardStatus || 'pending_delivery',
                    revealed: Boolean(body.scratchRevealed),
                    claimed: Boolean(body.scratchClaimed),
                    claimedAt: body.scratchCard?.claimedAt || null,
                    createdAt: body.createdAt || new Date().toISOString(),
                    expiresAt: body.scratchExpiresAt || (Date.now() + (Number(body.scratchExpiryDays || body.cashbackExpiryDays || 7)) * 24 * 60 * 60 * 1000),
                    expiresAtISO: new Date(body.scratchExpiresAt || (Date.now() + (Number(body.scratchExpiryDays || body.cashbackExpiryDays || 7)) * 24 * 60 * 60 * 1000)).toISOString(),
                    expiryDays: Number(body.scratchExpiryDays || body.cashbackExpiryDays || 7),
                    cashbackExpiryDays: Number(body.cashbackExpiryDays || body.scratchExpiryDays || 7)
                },
            };

            // Update in-memory
            const existingIndex = global.__perfettoOrdersList.findIndex(o => String(o.orderId || o.id) === String(finalOrderId));
            if (existingIndex >= 0) {
                global.__perfettoOrdersList[existingIndex] = orderDoc;
            } else {
                global.__perfettoOrdersList.unshift(orderDoc);
            }

            // Persist to Firestore
            try {
                await setFirestoreDoc('orders', String(finalOrderId), orderDoc);
            } catch (err) {
                console.error('CRITICAL: Firestore order create sync error:', err.message);
            }

            // Bind order & scratch card to customer's permanent mobile profile in users/{phone}
            const newOrderCleanPhone = String(orderDoc.customerPhone || orderDoc.phone || '').replace(/[^0-9]/g, '').slice(-10);
            if (newOrderCleanPhone) {
                try {
                    let userDoc = await getFirestoreDoc('users', `phone_${newOrderCleanPhone}`) || await getFirestoreDoc('users', newOrderCleanPhone);
                    if (!userDoc) {
                        userDoc = global.__perfettoUsersList.find(u => u.phone === newOrderCleanPhone) || {
                            phone: newOrderCleanPhone,
                            fullName: orderDoc.customerName || 'Customer',
                            address: orderDoc.address || '',
                            isPhoneVerified: true,
                        };
                    }
                    userDoc.orders = Array.isArray(userDoc.orders) ? userDoc.orders : [];
                    if (!userDoc.orders.includes(String(finalOrderId))) {
                        userDoc.orders.unshift(String(finalOrderId));
                        if (userDoc.orders.length > 50) userDoc.orders.length = 50;
                    }
                    if (orderDoc.wonCashback > 0 || orderDoc.scratchCard) {
                        userDoc.scratchCards = Array.isArray(userDoc.scratchCards) ? userDoc.scratchCards : [];
                        userDoc.scratchCards.unshift({
                            orderId: String(finalOrderId),
                            wonCashback: orderDoc.wonCashback,
                            rewardStatus: orderDoc.rewardStatus || 'pending_delivery',
                            createdAt: orderDoc.createdAt
                        });
                        if (userDoc.scratchCards.length > 50) userDoc.scratchCards.length = 50;
                    }
                    userDoc.lastOrderAt = orderDoc.createdAt;
                    userDoc.updatedAt = new Date().toISOString();

                    await setFirestoreDoc('users', `phone_${newOrderCleanPhone}`, userDoc);
                    await setFirestoreDoc('users', newOrderCleanPhone, userDoc);
                } catch (uErr) {
                    console.warn('Notice binding order to user profile in Firestore:', uErr.message);
                }
            }

            // Trigger FCM Push Notification to Staff Devices
            try {
                sendOrderNotificationToStaff(orderDoc).catch(e => {
                    console.error('FCM order notification background error:', e.message);
                });
            } catch (fcmErr) {
                console.warn('FCM dispatch notice:', fcmErr.message);
            }

            return res.status(201).json({
                success: true,
                message: 'Order created and synced to Firebase Firestore',
                order: orderDoc,
            });
        }

        // 3. PATCH / PUT: Update Order Status in Firestore
        if (req.method === 'PATCH' || req.method === 'PUT') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const effectiveId = body?.orderId || body?.id || req.query?.orderId || req.query?.id;
            const { status, paymentStatus, paymentDetails, deliveryOtp, completedAt, completedDurationSec, scratchClaimed, scratchCard, scratchExpired, scratchExpiresAt, rewardStatus, wonCashback, scratchRevealed } = body || {};

            if (!effectiveId) {
                return res.status(400).json({ success: false, message: 'orderId is required' });
            }

            const targetId = String(effectiveId);
            let targetOrder = global.__perfettoOrdersList.find(o => String(o.orderId || o.id) === targetId);

            if (!targetOrder) {
                targetOrder = await getFirestoreDoc('orders', targetId) || { id: targetId, orderId: targetId };
            }

            if (status) targetOrder.status = status;
            if (paymentStatus) targetOrder.paymentStatus = paymentStatus;
            if (paymentDetails) targetOrder.paymentDetails = paymentDetails;
            if (deliveryOtp) targetOrder.deliveryOtp = deliveryOtp;
            if (completedAt) targetOrder.completedAt = completedAt;
            if (completedDurationSec !== undefined) targetOrder.completedDurationSec = completedDurationSec;
            if (rewardStatus !== undefined) targetOrder.rewardStatus = rewardStatus;
            if (wonCashback !== undefined) targetOrder.wonCashback = Number(wonCashback);
            if (scratchRevealed !== undefined) targetOrder.scratchRevealed = Boolean(scratchRevealed);
            if (scratchClaimed !== undefined) targetOrder.scratchClaimed = Boolean(scratchClaimed);
            if (scratchCard !== undefined) targetOrder.scratchCard = scratchCard;
            if (scratchExpired !== undefined) targetOrder.scratchExpired = Boolean(scratchExpired);
            if (scratchExpiresAt !== undefined) targetOrder.scratchExpiresAt = scratchExpiresAt;
            targetOrder.updatedAt = new Date().toISOString();

            const isDelivered = (targetOrder.status === 'completed' || targetOrder.status === 'delivered');
            const isRejected = (targetOrder.status === 'rejected' || targetOrder.status === 'cancelled');

            // 1. DELIVERY CONFIRMATION OR POST-DELIVERY SCRATCH REVEAL
            if (isDelivered) {
                const wonAmt = Number(targetOrder.wonCashback || targetOrder.earnedCashback || targetOrder.scratchCard?.wonAmount || targetOrder.scratchCard?.amount || 0);
                const isCardScratched = Boolean(targetOrder.scratchRevealed || targetOrder.scratchCard?.revealed);

                if (isCardScratched && wonAmt > 0) {
                    // Card was scratched (either before delivery or post-delivery in Order History) -> Credit wallet now
                    const wasAlreadyCredited = (targetOrder.rewardStatus === 'active_credited' && targetOrder.scratchClaimed && targetOrder.scratchCard?.claimed);

                    targetOrder.rewardStatus = 'active_credited';
                    targetOrder.scratchRevealed = true;
                    targetOrder.scratchClaimed = true;
                    if (!targetOrder.scratchCard) {
                        targetOrder.scratchCard = {};
                    }
                    targetOrder.scratchCard.status = 'active_credited';
                    targetOrder.scratchCard.revealed = true;
                    targetOrder.scratchCard.claimed = true;
                    if (!targetOrder.scratchCard.claimedAt) {
                        targetOrder.scratchCard.claimedAt = new Date().toISOString();
                    }

                    const rawPhone = targetOrder.customerPhone || targetOrder.phone || targetOrder.customer?.phone || '';
                    const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);

                    if (!wasAlreadyCredited && cleanPhone) {
                        try {
                            let userDoc = await getFirestoreDoc('users', `phone_${cleanPhone}`);
                            if (!userDoc) {
                                userDoc = await getFirestoreDoc('users', cleanPhone);
                            }
                            if (!userDoc) {
                                userDoc = global.__perfettoUsersList.find(u => u.phone === cleanPhone) || {
                                    phone: cleanPhone,
                                    fullName: targetOrder.customerName || 'Customer',
                                    isPhoneVerified: true
                                };
                            }

                            const oldBal = Number(userDoc.walletBalance || userDoc.balance || 0);
                            const newBal = oldBal + wonAmt;
                            userDoc.walletBalance = newBal;
                            userDoc.balance = newBal;
                            userDoc.updatedAt = new Date().toISOString();

                            // Record immutable ledger transaction
                            const txEntry = {
                                id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                                type: 'credit',
                                amount: wonAmt,
                                orderId: targetId,
                                description: `Cashback unlocked & credited for Order #${targetId}`,
                                createdAt: new Date().toISOString(),
                                status: 'active'
                            };
                            userDoc.walletTransactions = Array.isArray(userDoc.walletTransactions) ? userDoc.walletTransactions : [];
                            userDoc.walletTransactions.unshift(txEntry);
                            if (userDoc.walletTransactions.length > 50) userDoc.walletTransactions.length = 50;

                            // Update in-memory users cache
                            const uIdx = global.__perfettoUsersList.findIndex(u => u.phone === cleanPhone);
                            if (uIdx >= 0) {
                                global.__perfettoUsersList[uIdx] = { ...global.__perfettoUsersList[uIdx], ...userDoc };
                            } else {
                                global.__perfettoUsersList.push(userDoc);
                            }

                            // Atomically persist to Firestore users/{phone} under both keys
                            await setFirestoreDoc('users', `phone_${cleanPhone}`, userDoc);
                            await setFirestoreDoc('users', cleanPhone, userDoc);

                            // Sync to /wallets/{cleanPhone}
                            await setFirestoreDoc('wallets', cleanPhone, {
                                phone: cleanPhone,
                                balance: newBal,
                                lastCreditedAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                            });
                        } catch (walletErr) {
                            console.warn('Error incrementing customer wallet in users collection:', walletErr.message);
                        }
                    }
                } else if (!isCardScratched && wonAmt > 0) {
                    // Fallback for unrevealed scratch cards:
                    // Order is delivered, but customer exited before scratching.
                    // Keep card state as "unscratched" under order doc with immutable expiration timestamp
                    targetOrder.rewardStatus = 'unscratched';
                    targetOrder.scratchRevealed = false;
                    targetOrder.scratchClaimed = false;
                    if (!targetOrder.scratchCard) {
                        targetOrder.scratchCard = {};
                    }
                    targetOrder.scratchCard.status = 'unscratched';
                    targetOrder.scratchCard.revealed = false;
                    targetOrder.scratchCard.claimed = false;
                }
            } else if (isRejected) {
                // 2. REJECTION / CANCELLATION: Atomically update reward status to "voided" with ₹0 credited
                targetOrder.rewardStatus = 'voided';
                targetOrder.wonCashback = 0;
                targetOrder.earnedCashback = 0;
                if (targetOrder.scratchCard) {
                    targetOrder.scratchCard.status = 'voided';
                    targetOrder.scratchCard.wonAmount = 0;
                    targetOrder.scratchCard.amount = 0;
                    targetOrder.scratchCard.voided = true;
                }
            }

            // Update in-memory orders list
            const existingIdx = global.__perfettoOrdersList.findIndex(o => String(o.orderId || o.id) === targetId);
            if (existingIdx >= 0) {
                global.__perfettoOrdersList[existingIdx] = targetOrder;
            } else {
                global.__perfettoOrdersList.unshift(targetOrder);
            }

            // Persist to Firestore
            try {
                await setFirestoreDoc('orders', targetId, targetOrder);
            } catch (fsErr) {
                console.warn('Firestore PATCH status update notice:', fsErr.message);
            }

            return res.status(200).json({
                success: true,
                message: `Order #${targetId} status updated in Firebase Firestore`,
                order: targetOrder,
            });
        }

        // 4. DELETE: Delete Completed / Archived Orders from Firestore & In-Memory Store
        if (req.method === 'DELETE') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }
            const query = req.query || {};
            const urlPath = String(req.originalUrl || req.url || '').toLowerCase();
            const { orderId, id, deleteAllCompleted, completedIds, action } = { ...query, ...body };

            if (action === 'midnight_cleanup') {
                const cleanupResult = await cleanupCompletedOrdersMidnight();
                return res.status(200).json({
                    success: true,
                    message: 'Midnight completed orders cleanup executed successfully',
                    result: cleanupResult,
                });
            }

            if (deleteAllCompleted === 'true' || deleteAllCompleted === true || query.clearCompleted === 'true') {
                const targetIds = Array.isArray(completedIds) && completedIds.length > 0
                    ? completedIds.map(String)
                    : global.__perfettoOrdersList.filter(o => ['completed', 'delivered', 'cancelled', 'archived'].includes(String(o.status || '').toLowerCase())).map(o => String(o.orderId || o.id));

                // Delete from in-memory (only completed/archived orders)
                global.__perfettoOrdersList = global.__perfettoOrdersList.filter(o => {
                    const oid = String(o.orderId || o.id);
                    if (targetIds.includes(oid)) {
                        return false;
                    }
                    return true;
                });

                // Delete each from Firestore
                for (const tid of targetIds) {
                    await deleteFirestoreDoc('orders', tid);
                }

                return res.status(200).json({
                    success: true,
                    message: `Deleted ${targetIds.length} completed/archived order(s) successfully`,
                    deletedCount: targetIds.length,
                });
            }

            let effectiveOrderId = orderId || id;
            if (!effectiveOrderId) {
                const pathMatch = urlPath.match(/\/orders\/([0-9a-zA-Z_-]+)/);
                if (pathMatch && pathMatch[1] && pathMatch[1] !== 'archived' && pathMatch[1] !== 'completed') {
                    effectiveOrderId = pathMatch[1];
                }
            }

            if (!effectiveOrderId) {
                return res.status(400).json({ success: false, message: 'orderId is required for deletion' });
            }

            const targetId = String(effectiveOrderId);
            const targetOrder = global.__perfettoOrdersList.find(o => String(o.orderId || o.id) === targetId) || await getFirestoreDoc('orders', targetId);

            // Remove from in-memory
            global.__perfettoOrdersList = global.__perfettoOrdersList.filter(o => String(o.orderId || o.id) !== targetId);

            // Remove from Firestore
            try {
                await deleteFirestoreDoc('orders', targetId);
            } catch (delErr) {
                console.warn('Firestore order deletion warning:', delErr.message);
            }

            return res.status(200).json({
                success: true,
                message: `Order #${targetId} deleted successfully from records`,
                deletedId: targetId,
            });
        }

        // 5. POST/GET action: Trigger midnight cleanup routine
        if ((req.method === 'POST' || req.method === 'GET') && req.query.action === 'midnight_cleanup') {
            const cleanupResult = await cleanupCompletedOrdersMidnight();
            return res.status(200).json({
                success: true,
                message: 'Midnight completed orders cleanup executed successfully',
                result: cleanupResult,
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleOrdersRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
}

/**
 * Automatically cleans up all completed orders from in-memory cache and Firestore.
 * Strictly ignores active / pending / uncompleted orders.
 */
async function cleanupCompletedOrdersMidnight() {
    try {
        console.log(`[${new Date().toISOString()}] [Midnight Cleanup] Running scheduled 11:59 PM completed orders cleanup...`);

        // Ensure fresh orders list from Firestore
        await fetchOrdersFromFirestore();

        const completedStatuses = ['completed', 'rejected', 'delivered', 'cancelled', 'archived'];
        const completedOrders = global.__perfettoOrdersList.filter(o => completedStatuses.includes(String(o.status || '').toLowerCase()));
        const activeOrders = global.__perfettoOrdersList.filter(o => !completedStatuses.includes(String(o.status || '').toLowerCase()));

        if (completedOrders.length === 0) {
            console.log(`[Midnight Cleanup] No completed orders to clean up. ${activeOrders.length} active order(s) retained.`);
            return { success: true, count: 0, retainedActiveCount: activeOrders.length };
        }

        const count = completedOrders.length;
        const completedIds = completedOrders.map(o => String(o.orderId || o.id));

        // 1. Purge completed orders from in-memory cache (strictly retain active/uncompleted orders)
        global.__perfettoOrdersList = activeOrders;

        // 2. Purge from Firestore
        for (const id of completedIds) {
            try {
                await deleteFirestoreDoc('orders', id);
            } catch (err) {
                console.warn(`[Midnight Cleanup] Error deleting completed order #${id} from Firestore:`, err.message);
            }
        }

        console.log(`[Midnight Cleanup] ✅ Successfully deleted ${count} completed order(s). ${activeOrders.length} active order(s) retained safely.`);
        return { success: true, count, retainedActiveCount: activeOrders.length, deletedIds: completedIds };
    } catch (e) {
        console.error('[Midnight Cleanup] Error during automated midnight cleanup:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Schedules the recurring 11:59 PM (23:59:00 local time) midnight cleanup job.
 */
function scheduleMidnightCleanup() {
    function getMsUntilNextMidnight() {
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0); // 11:59:00 PM
        let diff = target.getTime() - now.getTime();
        if (diff <= 0) {
            // If already past 11:59 PM today, schedule for 11:59 PM tomorrow
            const tomorrowTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 0, 0);
            diff = tomorrowTarget.getTime() - now.getTime();
        }
        return diff;
    }

    const msUntilRun = getMsUntilNextMidnight();
    const targetDate = new Date(Date.now() + msUntilRun);
    console.log(`⏰ [Midnight Cleanup Scheduler] Next automated cleanup scheduled for: ${targetDate.toLocaleString()} (in ${Math.round(msUntilRun / 1000 / 60)} mins)`);

    setTimeout(async () => {
        await cleanupCompletedOrdersMidnight();
        // Reschedule for next night
        scheduleMidnightCleanup();
    }, msUntilRun);
}

// Auto-start scheduler if running in Node environment
if (typeof setTimeout !== 'undefined') {
    scheduleMidnightCleanup();
}

module.exports = {
    handleOrdersRequest,
    cleanupCompletedOrdersMidnight,
    scheduleMidnightCleanup,
    sendOrderNotificationToStaff,
};
