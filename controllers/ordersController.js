/**
 * Perfetto Pizza - Orders Controller
 * Powered by Firebase Firestore ('orders' collection)
 * Handles GET, POST, PATCH, PUT for customer orders and staff kitchen queue
 */

const { getFirestoreDoc, setFirestoreDoc, listFirestoreCollection, deleteFirestoreDoc } = require('../lib/firestore');
const { sendOrderNotificationToStaff } = require('../lib/firebaseAdmin');
const { DEFAULT_WALLET_CONFIG } = require('../lib/globalStores');

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

const THREE_HOURS_EXPIRATION_MS = 3 * 60 * 60 * 1000; // 3 hours = 10,800,000 ms

function getOrderCreationTimeMs(order) {
    if (!order) return 0;
    const raw = order.createdAt || order.created_at || order.timestamp || order.date || order.prepStartedAt;
    if (raw) {
        if (typeof raw === 'number') {
            return raw < 1e11 ? raw * 1000 : raw;
        }
        if (typeof raw === 'object') {
            if (typeof raw.toMillis === 'function') return raw.toMillis();
            if (typeof raw.toDate === 'function') return raw.toDate().getTime();
            if (raw.seconds) return raw.seconds * 1000;
            if (raw._seconds) return raw._seconds * 1000;
        }
        const parsed = new Date(raw).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const idStr = String(order.orderId || order.id || '');
    const match = idStr.match(/(\d{10,13})/);
    if (match) {
        const num = parseInt(match[1], 10);
        if (num > 1500000000 && num < 2500000000000) {
            return num < 1e11 ? num * 1000 : num;
        }
    }
    return 0;
}

function isOrderThreeHoursExpired(order) {
    if (!order) return false;
    const st = String(order.status || '').toLowerCase().trim();
    const terminalStatuses = ['completed', 'delivered', 'rejected', 'cancelled', 'archived', 'declined'];
    if (terminalStatuses.includes(st)) return false;
    if (order.autoExpired === true || order.isAutoExpired === true) return false;
    const createdMs = getOrderCreationTimeMs(order);
    if (!createdMs) return false;
    return (Date.now() - createdMs) >= THREE_HOURS_EXPIRATION_MS;
}

async function autoRejectExpiredOrderBackend(order) {
    if (!order) return;
    const orderId = String(order.orderId || order.id || '').trim();
    if (!orderId) return;

    order.status = 'rejected';
    order.rejectionReason = 'Order auto-rejected due to 3-hour fulfillment timeout';
    order.autoExpired = true;
    order.rejectedAt = new Date().toISOString();
    order.rewardStatus = 'voided';
    order.cashbackStatus = 'VOID';
    order.wonCashback = 0;
    order.earnedCashback = 0;
    if (order.scratchCard) {
        order.scratchCard.status = 'CANCELLED';
        order.scratchCard.voided = true;
        order.scratchCard.wonAmount = 0;
        order.scratchCard.amount = 0;
    }

    const refundAmount = Math.round(Number(
        order.walletDeductedAmount ||
        order.walletUsed ||
        order.walletDiscount ||
        order.usedWalletCash ||
        order.appliedWalletDiscount ||
        order.usedWallet ||
        0
    ));

    const rawPhone = order.customerPhone || order.phone || order.customer?.phone || '';
    const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);

    if (refundAmount > 0 && cleanPhone && !order.walletRefunded) {
        order.walletRefunded = true;
        order.walletRefundAmount = refundAmount;
        order.walletRefundedAt = new Date().toISOString();

        try {
            let userDoc = await getFirestoreDoc('users', `phone_${cleanPhone}`) || await getFirestoreDoc('users', cleanPhone);
            if (!userDoc) {
                userDoc = { phone: cleanPhone, balance: 0, walletBalance: 0, walletTransactions: [] };
            }
            const curBal = Number(userDoc.walletBalance ?? userDoc.balance ?? 0);
            const newBal = curBal + refundAmount;
            userDoc.walletBalance = newBal;
            userDoc.balance = newBal;
            userDoc.updatedAt = new Date().toISOString();

            const refundTx = {
                id: `tx_refund_${orderId}`,
                orderId: String(orderId),
                amount: refundAmount,
                type: 'REFUND',
                title: `Refund for Auto-Expired Order #${orderId}`,
                description: `Auto-refund ₹${refundAmount} for expired order #${orderId}`,
                timestamp: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };

            if (!Array.isArray(userDoc.walletTransactions)) userDoc.walletTransactions = [];
            const alreadyLogged = userDoc.walletTransactions.some(tx => tx && (tx.id === refundTx.id || (tx.type === 'REFUND' && String(tx.orderId) === String(orderId))));
            if (!alreadyLogged) {
                userDoc.walletTransactions.unshift(refundTx);
            }

            await setFirestoreDoc('users', `phone_${cleanPhone}`, userDoc);
            await setFirestoreDoc('users', cleanPhone, userDoc);
            await setFirestoreDoc('wallets', cleanPhone, {
                phone: cleanPhone,
                balance: newBal,
                updatedAt: new Date().toISOString()
            });
            console.log(`✅ [BACKEND SWEEP REFUND] Refunded ₹${refundAmount} to user ${cleanPhone} for expired Order #${orderId}`);
        } catch (refErr) {
            console.warn('Notice processing sweeper backend wallet refund:', refErr.message);
        }
    }

    order.updatedAt = new Date().toISOString();
    
    // Update in-memory orders store
    if (Array.isArray(global.__perfettoOrdersList)) {
        const memIdx = global.__perfettoOrdersList.findIndex(o => String(o.orderId || o.id) === String(orderId));
        if (memIdx >= 0) {
            global.__perfettoOrdersList[memIdx] = { ...global.__perfettoOrdersList[memIdx], ...order };
        }
    }

    try {
        await setFirestoreDoc('orders', orderId, order);
    } catch (e) {
        console.warn(`Error persisting auto-expired order #${orderId}:`, e.message);
    }
}

async function sweepExpiredOrdersBackend(ordersList) {
    if (!Array.isArray(ordersList) || ordersList.length === 0) return;
    const expired = ordersList.filter(isOrderThreeHoursExpired);
    if (expired.length === 0) return;
    console.log(`[BACKEND SWEEPER] Found ${expired.length} auto-expired unfulfilled order(s). Processing rejections...`);
    for (const order of expired) {
        try {
            await autoRejectExpiredOrderBackend(order);
        } catch (e) {
            console.error(`[BACKEND SWEEPER] Error auto-rejecting order #${order.id || order.orderId}:`, e.message);
        }
    }
}

async function fetchOrdersFromFirestore(forceFresh = false) {
    const now = Date.now();
    if (!forceFresh && global.__perfettoOrdersList && global.__perfettoOrdersList.length > 0 && (now - (global.__lastOrdersFetchTime || 0) < 60000)) {
        await sweepExpiredOrdersBackend(global.__perfettoOrdersList);
        return global.__perfettoOrdersList.filter(isValidOrder);
    }

    try {
        const liveDocs = await listFirestoreCollection('orders', 100, forceFresh);
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
            global.__lastOrdersFetchTime = Date.now();

            // Run backend sweep for unfulfilled orders exceeding 3 hours
            await sweepExpiredOrdersBackend(global.__perfettoOrdersList);
        }
    } catch (e) {
        console.warn('Firestore orders read note:', e.message);
    }
    return global.__perfettoOrdersList.filter(isValidOrder);
}

async function handleOrdersRequest(req, res) {
    try {
        // 0. Action: Trigger automated midnight cleanup routine or manual sweeper
        if (req.query?.action === 'midnight_cleanup' || req.body?.action === 'midnight_cleanup') {
            const cleanupResult = await cleanupCompletedOrdersMidnight();
            return res.status(200).json({
                success: true,
                message: 'Midnight completed orders cleanup executed successfully',
                result: cleanupResult,
            });
        }
        if (req.query?.action === 'expire_sweep' || req.body?.action === 'expire_sweep') {
            const allOrders = await fetchOrdersFromFirestore(true);
            await sweepExpiredOrdersBackend(allOrders);
            return res.status(200).json({
                success: true,
                message: '3-hour order expiration sweep executed successfully',
                ordersCount: allOrders.length
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
                let singleDoc = await getFirestoreDoc('orders', String(effectiveOrderId));
                if (singleDoc) {
                    if (isOrderThreeHoursExpired(singleDoc)) {
                        await autoRejectExpiredOrderBackend(singleDoc);
                    }
                    filtered = [singleDoc];
                } else {
                    filtered = filtered.filter(o => String(o.orderId || o.id) === String(effectiveOrderId));
                    for (const o of filtered) {
                        if (isOrderThreeHoursExpired(o)) {
                            await autoRejectExpiredOrderBackend(o);
                        }
                    }
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
            const rawSubtotal = Number(body.subtotal || body.costs?.subtotal || 0);
            let verifiedSubtotal = rawSubtotal;
            if (Array.isArray(body.items) && body.items.length > 0) {
                const itemsSum = body.items.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 1)), 0);
                if (itemsSum > 0) {
                    verifiedSubtotal = Math.round(itemsSum);
                }
            }
            const subtotal = verifiedSubtotal;
            const deliveryFee = Number(body.deliveryFee || body.costs?.deliveryFee || 0);
            const usedWallet = Number(body.walletDiscount || body.usedWalletCash || 0);
            const total = Math.max(0, Math.round(subtotal + deliveryFee - usedWallet));


            // Dynamically read the minimum qualification amount for Slab 1 from global.__perfettoWalletConfig
            if (!global.__walletConfigLoadedFromFirestore) {
                try {
                    const walletDoc = await getFirestoreDoc('settings', 'wallet_config') || await getFirestoreDoc('settings', 'rewards') || await getFirestoreDoc('settings', 'store_config');
                    if (walletDoc) {
                        global.__perfettoWalletConfig = { ...DEFAULT_WALLET_CONFIG, ...(walletDoc.wallet_config || walletDoc) };
                        global.__walletConfigLoadedFromFirestore = true;
                    }
                } catch (e) { }
            }

            const rawSlabs = (Array.isArray(global.__perfettoWalletConfig?.slabs) && global.__perfettoWalletConfig.slabs.length > 0)
                ? global.__perfettoWalletConfig.slabs
                : (DEFAULT_WALLET_CONFIG?.slabs || []);
            const sortedSlabs = [...rawSlabs].map(s => ({
                minOrder: Number(s.minOrder !== undefined ? s.minOrder : (s.min !== undefined ? s.min : (s.minAmount !== undefined ? s.minAmount : s.threshold))) || 0,
                cashback: Number(s.cashback !== undefined ? s.cashback : (s.reward !== undefined ? s.reward : (s.amount !== undefined ? s.amount : s.wonAmount))) || 0
            })).filter(s => s.minOrder > 0).sort((a, b) => a.minOrder - b.minOrder);

            const activeSlab1Amount = (rawSlabs[0] && (rawSlabs[0].minAmount !== undefined ? rawSlabs[0].minAmount : (rawSlabs[0].minOrder !== undefined ? rawSlabs[0].minOrder : rawSlabs[0].min)))
                ? Number(rawSlabs[0].minAmount !== undefined ? rawSlabs[0].minAmount : (rawSlabs[0].minOrder !== undefined ? rawSlabs[0].minOrder : rawSlabs[0].min))
                : Number(DEFAULT_WALLET_CONFIG?.slabs?.[0]?.minOrder || 0);
            const slab1Threshold = activeSlab1Amount;

            const isSystemEnabled = global.__perfettoWalletConfig?.enabled !== false;
            const isSlab1Qualified = Boolean(isSystemEnabled && subtotal >= slab1Threshold && subtotal > 0);

            const clientWonAmt = Number(body.wonCashback || body.earnedCashback || body.scratchCard?.wonAmount || body.scratchCard?.amount || 0);
            let verifiedCashback = 0;
            let rewardTitle = '';

            if (isSystemEnabled && isSlab1Qualified) {
                if (usedWallet > 0) {
                    // SCENARIO B: Qualifying order (Slab 1+) with Wallet Cash Applied -> Guaranteed flat ₹10 Thank You reward
                    verifiedCashback = 10;
                    rewardTitle = 'Thank You Cashback Reward';
                } else {
                    // SCENARIO A: Qualifying order (Slab 1+) with Wallet Cash Unchecked -> Dynamic tier reward matching reached milestone
                    let qIndex = -1;
                    for (let i = 0; i < sortedSlabs.length; i++) {
                        if (subtotal >= sortedSlabs[i].minOrder) {
                            qIndex = i;
                        }
                    }

                    if (qIndex >= 0) {
                        const currentSlab = sortedSlabs[qIndex];
                        let minBound = 1;
                        let maxBound = Number(currentSlab.cashback) || 1;

                        if (qIndex > 0) {
                            const prevMax = Number(sortedSlabs[qIndex - 1].cashback) || 1;
                            const currMax = Number(currentSlab.cashback) || prevMax;
                            minBound = Math.min(prevMax, currMax);
                            maxBound = Math.max(prevMax, currMax);
                        }

                        // Accept client uniform random choice if strictly within fair [minBound, maxBound]; otherwise generate fair random integer
                        if (clientWonAmt >= minBound && clientWonAmt <= maxBound) {
                            verifiedCashback = Math.round(clientWonAmt);
                        } else {
                            verifiedCashback = Math.floor(Math.random() * (maxBound - minBound + 1)) + minBound;
                        }
                        rewardTitle = body.rewardTitle || (body.scratchCard?.title) || 'Cashback Reward';
                    }
                }
            } else {
                // Cart Subtotal < Slab 1 Threshold or System Disabled: No scratch card issued
                verifiedCashback = 0;
                rewardTitle = '';
            }

            const hasScratchReward = Boolean(verifiedCashback > 0);
            const activeOrderDays = hasScratchReward
                ? Number(body.scratchExpiryDays || body.cashbackExpiryDays || global.__perfettoWalletConfig?.expiryDays || 15)
                : 0;
            const scratchExpiryTimestamp = hasScratchReward
                ? (body.scratchExpiresAt || (Date.now() + activeOrderDays * 24 * 60 * 60 * 1000))
                : null;

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
                    walletDiscount: usedWallet,
                    usedWalletCash: usedWallet,
                    usedWallet: usedWallet,
                    total: total,
                },
                subtotal: subtotal,
                deliveryFee: deliveryFee,
                walletDiscount: usedWallet,
                usedWalletCash: usedWallet,
                usedWallet: usedWallet,
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
                rewardStatus: hasScratchReward ? (body.rewardStatus || 'pending_delivery') : 'none',
                rewardTitle: rewardTitle,
                wonCashback: verifiedCashback,
                earnedCashback: verifiedCashback,
                scratchRevealed: hasScratchReward ? Boolean(body.scratchRevealed) : false,
                scratchClaimed: hasScratchReward ? Boolean(body.scratchClaimed) : false,
                scratchExpired: hasScratchReward ? Boolean(body.scratchExpired) : false,
                scratchExpiresAt: scratchExpiryTimestamp,
                scratchExpiryDays: activeOrderDays,
                cashbackExpiryDays: activeOrderDays,
                scratchCard: hasScratchReward ? {
                    ...(body.scratchCard || {}),
                    title: rewardTitle,
                    isThankYouReward: (rewardTitle === 'Thank You Cashback Reward'),
                    amount: verifiedCashback,
                    wonAmount: verifiedCashback,
                    status: body.rewardStatus || 'pending_delivery',
                    revealed: Boolean(body.scratchRevealed),
                    claimed: Boolean(body.scratchClaimed),
                    claimedAt: body.scratchCard?.claimedAt || null,
                    createdAt: body.createdAt || new Date().toISOString(),
                    expiresAt: scratchExpiryTimestamp,
                    expiresAtISO: scratchExpiryTimestamp ? new Date(scratchExpiryTimestamp).toISOString() : null,
                    expiryDays: activeOrderDays,
                    cashbackExpiryDays: activeOrderDays
                } : null,
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
                global.__lastOrdersFetchTime = 0;
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

                    // Settle wallet redemption debit on order creation if wallet cash was used
                    if (usedWallet > 0) {
                        userDoc.walletTransactions = Array.isArray(userDoc.walletTransactions) ? userDoc.walletTransactions : [];
                        if (!userDoc.walletTransactions.some(tx => tx && tx.type === 'debit' && String(tx.orderId) === String(finalOrderId))) {
                            userDoc.walletTransactions.unshift({
                                id: `tx_debit_${finalOrderId}`,
                                type: 'debit',
                                amount: usedWallet,
                                orderId: String(finalOrderId),
                                description: `Redeemed on Order #${finalOrderId}`,
                                createdAt: orderDoc.createdAt,
                                status: 'completed'
                            });
                        }

                        // FIFO deduction across active credits
                        const nowMs = Date.now();
                        const credits = userDoc.walletTransactions
                            .filter(tx => tx && tx.type === 'credit')
                            .map(tx => {
                                const initial = Number(tx.initialAmount !== undefined ? tx.initialAmount : (tx.originalAmount !== undefined ? tx.originalAmount : tx.amount)) || 0;
                                tx.initialAmount = initial;
                                tx.originalAmount = initial;
                                tx.remainingAmount = Math.max(0, Number(tx.remainingAmount !== undefined ? tx.remainingAmount : initial));
                                const expMs = tx.expiresAt ? new Date(tx.expiresAt).getTime() : Infinity;
                                return { tx, expiresAtMs: isNaN(expMs) ? Infinity : expMs };
                            });

                        let needed = usedWallet;
                        const eligible = credits
                            .filter(c => c.tx.remainingAmount > 0 && c.expiresAtMs > nowMs)
                            .sort((a, b) => a.expiresAtMs - b.expiresAtMs);

                        for (const c of eligible) {
                            if (needed <= 0) break;
                            const avail = c.tx.remainingAmount;
                            if (avail <= 0) continue;
                            if (avail <= needed) {
                                needed -= avail;
                                c.tx.remainingAmount = 0;
                                c.tx.status = 'redeemed';
                            } else {
                                c.tx.remainingAmount = avail - needed;
                                needed = 0;
                                c.tx.status = 'partially_used';
                            }
                        }

                        // Compute remaining unexpired balance
                        let activeSum = 0;
                        credits.forEach(c => {
                            if (c.expiresAtMs <= nowMs) {
                                c.tx.remainingAmount = 0;
                                c.tx.status = 'expired';
                            } else if (c.tx.remainingAmount > 0) {
                                activeSum += c.tx.remainingAmount;
                            }
                        });

                        const newBal = Math.max(0, activeSum);
                        userDoc.walletBalance = newBal;
                        userDoc.balance = newBal;
                        if (userDoc.walletTransactions.length > 50) userDoc.walletTransactions.length = 50;

                        await setFirestoreDoc('wallets', newOrderCleanPhone, {
                            phone: newOrderCleanPhone,
                            balance: newBal,
                            transactions: userDoc.walletTransactions,
                            updatedAt: new Date().toISOString()
                        });
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
            const { status, paymentStatus, paymentDetails, deliveryOtp, completedAt, completedDurationSec, scratchClaimed, scratchCard, scratchExpired, scratchExpiresAt, rewardStatus, wonCashback, scratchRevealed, rejectionReason } = body || {};

            if (!effectiveId) {
                return res.status(400).json({ success: false, message: 'orderId is required' });
            }

            const targetId = String(effectiveId);
            let targetOrder = global.__perfettoOrdersList.find(o => String(o.orderId || o.id) === targetId);

            if (!targetOrder) {
                targetOrder = await getFirestoreDoc('orders', targetId) || { id: targetId, orderId: targetId };
            }

            if (status === 'rejected' || status === 'cancelled') {
                const isAutoExpired = Boolean(body?.autoExpired || isOrderThreeHoursExpired(targetOrder));
                if (!isAutoExpired) {
                    const liveSettings = await getFirestoreDoc('settings', 'storeSettings') || await getFirestoreDoc('settings', 'store_config');
                    const validMasterOtp = String(liveSettings?.masterDeliveryOtp || global.__perfettoStoreSettings?.masterDeliveryOtp || '9999').replace(/[^0-9]/g, '').slice(0, 4);
                    const providedOtp = String(body?.masterOtp || req.headers['x-master-otp'] || '').replace(/[^0-9]/g, '').slice(0, 4);

                    const isMasterAdminAuth = req.staffUser && (req.staffUser.isMasterAdmin || req.staffUser.role === 'Master Admin');
                    if (!isMasterAdminAuth && (!providedOtp || providedOtp !== validMasterOtp)) {
                        return res.status(403).json({
                            success: false,
                            message: 'Invalid Admin Master Cancellation OTP. Order cancellation unauthorized.'
                        });
                    }
                }
            }

            if (status) targetOrder.status = status;
            if (rejectionReason !== undefined) targetOrder.rejectionReason = String(rejectionReason).trim();
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
                const isCardScratched = Boolean(targetOrder.scratchRevealed || targetOrder.scratchCard?.revealed || targetOrder.rewardStatus === 'pending_delivery');
                const wasAlreadyCredited = Boolean(targetOrder.scratchClaimed || targetOrder.rewardStatus === 'active_credited' || targetOrder.rewardStatus === 'credited' || targetOrder.scratchCard?.claimed);
                const usedWallet = Number(targetOrder.walletDiscount || targetOrder.usedWalletCash || targetOrder.usedWallet || 0);

                const rawPhone = targetOrder.customerPhone || targetOrder.phone || targetOrder.customer?.phone || '';
                const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);

                if (cleanPhone) {
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

                        userDoc.walletTransactions = Array.isArray(userDoc.walletTransactions) ? userDoc.walletTransactions : [];

                        // 1A. Settle wallet redemption debit on delivery if not already recorded
                        if (usedWallet > 0) {
                            const debitAlreadyLogged = userDoc.walletTransactions.some(tx => tx && tx.type === 'debit' && String(tx.orderId) === String(targetId));
                            if (!debitAlreadyLogged) {
                                const currentBal = Number(userDoc.walletBalance || userDoc.balance || 0);
                                const newBalAfterDebit = Math.max(0, currentBal - usedWallet);
                                userDoc.walletBalance = newBalAfterDebit;
                                userDoc.balance = newBalAfterDebit;
                                userDoc.walletTransactions.unshift({
                                    id: `tx_debit_${targetId}`,
                                    type: 'debit',
                                    amount: usedWallet,
                                    orderId: String(targetId),
                                    description: `Redeemed on Order #${targetId}`,
                                    createdAt: new Date().toISOString(),
                                    status: 'completed'
                                });
                            }
                        }

                        // 1B. Credit cashback reward strictly once (idempotent)
                        const isWalletSystemEnabled = global.__perfettoWalletConfig?.enabled !== false;
                        const creditAlreadyLogged = userDoc.walletTransactions.some(tx => tx && tx.type === 'credit' && String(tx.orderId) === String(targetId));

                        if (isWalletSystemEnabled && wonAmt > 0 && !creditAlreadyLogged) {
                            const claimTime = Date.now();
                            const activeExpiryDays = Math.min(30, Math.max(1, Number(targetOrder.scratchExpiryDays || targetOrder.cashbackExpiryDays || global.__perfettoWalletConfig?.expiryDays || 15)));
                            const expiresAt = new Date(claimTime + activeExpiryDays * 24 * 60 * 60 * 1000).toISOString();

                            const currentBal = Number(userDoc.walletBalance || userDoc.balance || 0);
                            const newBal = currentBal + wonAmt;
                            userDoc.walletBalance = newBal;
                            userDoc.balance = newBal;

                            const txEntry = {
                                id: `tx_credit_${targetId}`,
                                type: 'credit',
                                amount: wonAmt,
                                initialAmount: wonAmt,
                                originalAmount: wonAmt,
                                remainingAmount: wonAmt,
                                orderId: String(targetId),
                                description: `Cashback unlocked & credited for Order #${targetId}`,
                                createdAt: new Date(claimTime).toISOString(),
                                claimedAt: new Date(claimTime).toISOString(),
                                expiresAt: expiresAt,
                                expiryDays: activeExpiryDays,
                                cashbackExpiryDays: activeExpiryDays,
                                status: 'active'
                            };
                            userDoc.walletTransactions.unshift(txEntry);

                            targetOrder.rewardStatus = 'active_credited';
                            targetOrder.scratchRevealed = true;
                            targetOrder.scratchClaimed = true;
                            if (!targetOrder.scratchCard) {
                                targetOrder.scratchCard = {};
                            }
                            targetOrder.scratchCard.status = 'active_credited';
                            targetOrder.scratchCard.revealed = true;
                            targetOrder.scratchCard.claimed = true;
                            targetOrder.scratchCard.claimedAt = new Date().toISOString();
                        } else if (isWalletSystemEnabled && (creditAlreadyLogged || wasAlreadyCredited)) {
                            // Ensure order status reflects credited state without modifying balance again
                            targetOrder.rewardStatus = 'active_credited';
                            targetOrder.scratchRevealed = true;
                            targetOrder.scratchClaimed = true;
                            if (!targetOrder.scratchCard) {
                                targetOrder.scratchCard = {};
                            }
                            targetOrder.scratchCard.status = 'active_credited';
                            targetOrder.scratchCard.claimed = true;
                        } else if (isWalletSystemEnabled && !isCardScratched && wonAmt > 0) {
                            // Unrevealed fallback: keep card state as "unscratched" until customer reveals it
                            targetOrder.rewardStatus = 'unscratched';
                            targetOrder.scratchRevealed = false;
                            targetOrder.scratchClaimed = false;
                            if (!targetOrder.scratchCard) {
                                targetOrder.scratchCard = {};
                            }
                            targetOrder.scratchCard.status = 'unscratched';
                            targetOrder.scratchCard.revealed = false;
                            targetOrder.scratchCard.claimed = false;
                        } else if (!isWalletSystemEnabled) {
                            targetOrder.rewardStatus = 'none';
                            targetOrder.wonCashback = 0;
                            targetOrder.earnedCashback = 0;
                            if (targetOrder.scratchCard) {
                                targetOrder.scratchCard.status = 'none';
                            }
                        }

                        if (userDoc.walletTransactions.length > 50) userDoc.walletTransactions.length = 50;
                        userDoc.updatedAt = new Date().toISOString();

                        // Update in-memory users cache
                        const uIdx = global.__perfettoUsersList.findIndex(u => u.phone === cleanPhone);
                        if (uIdx >= 0) {
                            global.__perfettoUsersList[uIdx] = { ...global.__perfettoUsersList[uIdx], ...userDoc };
                        } else {
                            global.__perfettoUsersList.push(userDoc);
                        }

                        // Atomically persist to Firestore users/{phone} and /wallets/{cleanPhone}
                        await setFirestoreDoc('users', `phone_${cleanPhone}`, userDoc);
                        await setFirestoreDoc('users', cleanPhone, userDoc);

                        await setFirestoreDoc('wallets', cleanPhone, {
                            phone: cleanPhone,
                            balance: userDoc.walletBalance,
                            transactions: userDoc.walletTransactions,
                            updatedAt: new Date().toISOString()
                        });
                    } catch (walletErr) {
                        console.warn('Error synchronizing customer wallet on order delivery:', walletErr.message);
                    }
                }
            } else if (isRejected) {
                // 2. REJECTION / CANCELLATION: Atomically update reward status to "voided" with ₹0 credited
                targetOrder.rewardStatus = 'voided';
                targetOrder.cashbackStatus = 'VOID';
                targetOrder.wonCashback = 0;
                targetOrder.earnedCashback = 0;
                if (targetOrder.scratchCard) {
                    targetOrder.scratchCard.status = 'CANCELLED';
                    targetOrder.scratchCard.wonAmount = 0;
                    targetOrder.scratchCard.amount = 0;
                    targetOrder.scratchCard.voided = true;
                }

                // Automatic wallet deduction refund for expired or rejected orders
                const refundAmount = Math.round(Number(
                    targetOrder.walletDeductedAmount ||
                    targetOrder.walletUsed ||
                    targetOrder.walletDiscount ||
                    targetOrder.usedWalletCash ||
                    targetOrder.appliedWalletDiscount ||
                    targetOrder.usedWallet ||
                    0
                ));

                const rawPhone = targetOrder.customerPhone || targetOrder.phone || targetOrder.customer?.phone || '';
                const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '').slice(-10);

                if (refundAmount > 0 && cleanPhone && !targetOrder.walletRefunded) {
                    targetOrder.walletRefunded = true;
                    targetOrder.walletRefundAmount = refundAmount;
                    targetOrder.walletRefundedAt = new Date().toISOString();

                    try {
                        let userDoc = await getFirestoreDoc('users', `phone_${cleanPhone}`) || await getFirestoreDoc('users', cleanPhone);
                        if (!userDoc) {
                            userDoc = { phone: cleanPhone, balance: 0, walletBalance: 0, walletTransactions: [] };
                        }
                        const curBal = Number(userDoc.walletBalance ?? userDoc.balance ?? 0);
                        const newBal = curBal + refundAmount;
                        userDoc.walletBalance = newBal;
                        userDoc.balance = newBal;
                        userDoc.updatedAt = new Date().toISOString();

                        const refundTx = {
                            id: `tx_refund_${targetId}`,
                            orderId: String(targetId),
                            amount: refundAmount,
                            type: 'REFUND',
                            title: `Refund for Auto-Expired Order #${targetId}`,
                            description: `Refund ₹${refundAmount} for Auto-Expired Order #${targetId}`,
                            timestamp: new Date().toISOString(),
                            createdAt: new Date().toISOString()
                        };

                        if (!Array.isArray(userDoc.walletTransactions)) userDoc.walletTransactions = [];
                        const alreadyLogged = userDoc.walletTransactions.some(tx => tx && (tx.id === refundTx.id || (tx.type === 'REFUND' && String(tx.orderId) === String(targetId))));
                        if (!alreadyLogged) {
                            userDoc.walletTransactions.unshift(refundTx);
                        }

                        await setFirestoreDoc('users', `phone_${cleanPhone}`, userDoc);
                        await setFirestoreDoc('users', cleanPhone, userDoc);
                        await setFirestoreDoc('wallets', cleanPhone, {
                            phone: cleanPhone,
                            balance: newBal,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`✅ [BACKEND REFUND] Successfully refunded ₹${refundAmount} to user ${cleanPhone} for Order #${targetId}`);
                    } catch (refErr) {
                        console.warn('Notice processing backend wallet refund:', refErr.message);
                    }
                }

                // Also atomically sync voided status to customer profile in users/{phone}
                if (cleanPhone) {
                    try {
                        let userDoc = await getFirestoreDoc('users', `phone_${cleanPhone}`) || await getFirestoreDoc('users', cleanPhone);
                        if (userDoc && Array.isArray(userDoc.scratchCards)) {
                            userDoc.scratchCards = userDoc.scratchCards.map(sc => {
                                if (String(sc.orderId) === targetId) {
                                    return { ...sc, rewardStatus: 'voided', wonCashback: 0, voided: true };
                                }
                                return sc;
                            });
                            await setFirestoreDoc('users', `phone_${cleanPhone}`, userDoc);
                            await setFirestoreDoc('users', cleanPhone, userDoc);
                        }
                    } catch (uVoidErr) {
                        console.warn('Notice voiding scratch card in user profile:', uVoidErr.message);
                    }
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
                global.__lastOrdersFetchTime = 0;
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
                global.__lastOrdersFetchTime = 0;
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
