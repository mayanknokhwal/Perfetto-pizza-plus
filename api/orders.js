/**
 * Vercel Serverless Function: Orders API (GET, POST, PATCH, PUT)
 * Route: /api/orders
 */

const { connectToDatabase } = require('./lib/mongodb');
const Order = require('./models/Order');

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const db = await connectToDatabase();

        // 1. GET: Fetch Orders
        if (req.method === 'GET') {
            if (!db) {
                return res.status(200).json({
                    success: false,
                    isFallback: true,
                    message: 'MongoDB URI not configured. Use LocalStorage mode.',
                    orders: []
                });
            }

            const { phone, status, limit = 50, orderId } = req.query || {};
            const filter = {};

            if (orderId) filter.orderId = orderId;
            if (phone) filter['customer.phone'] = phone;
            if (status) filter.status = status;

            const orders = await Order.find(filter)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit, 10))
                .lean();

            // Format for frontend compatibility
            const formatted = orders.map((o) => ({
                ...o,
                id: o.orderId,
                customerName: o.customer?.name || o.customerName,
                customerPhone: o.customer?.phone || o.customerPhone,
                phone: o.customer?.phone || o.phone,
                address: o.customer?.address || o.address,
                subtotal: o.costs?.subtotal || o.subtotal,
                deliveryFee: o.costs?.deliveryFee || o.deliveryFee,
                total: o.costs?.total || o.total,
            }));

            return res.status(200).json({
                success: true,
                count: formatted.length,
                orders: formatted,
            });
        }

        // 2. POST: Create New Order
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

            if (!body) {
                return res.status(400).json({ success: false, message: 'Missing order payload' });
            }

            if (!db) {
                // If MongoDB is not yet connected (e.g. env var pending), acknowledge gracefully
                return res.status(200).json({
                    success: true,
                    isFallback: true,
                    message: 'Order received (Saved to LocalStorage fallback)',
                    order: body
                });
            }

            // Generate orderId if not provided
            let finalOrderId = body.orderId || body.id;
            if (!finalOrderId) {
                const count = await Order.countDocuments();
                finalOrderId = (count + 1).toString();
            }

            const subtotal = Number(body.subtotal || body.costs?.subtotal || 0);
            const deliveryFee = Number(body.deliveryFee || body.costs?.deliveryFee || 0);
            const total = Number(body.total || body.costs?.total || subtotal + deliveryFee);

            const orderDoc = {
                orderId: String(finalOrderId),
                customer: {
                    firebaseUid: body.firebaseUid || body.customer?.firebaseUid || '',
                    name: body.customerName || body.customer?.name || 'Customer',
                    phone: body.customerPhone || body.phone || body.customer?.phone || '',
                    email: body.customerEmail || body.email || body.customer?.email || '',
                    address: body.address || body.customer?.address || '',
                    deliveryDetails: body.deliveryDetails || body.customer?.deliveryDetails || {},
                    gps: body.gps || body.customer?.gps || { lat: null, lng: null },
                },
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
                timeAgo: body.timeAgo || 'Just now',
            };

            const savedOrder = await Order.findOneAndUpdate(
                { orderId: orderDoc.orderId },
                { $set: orderDoc },
                { upsert: true, new: true }
            );

            return res.status(201).json({
                success: true,
                message: 'Order saved successfully to MongoDB Atlas',
                order: {
                    ...savedOrder.toObject(),
                    id: savedOrder.orderId
                }
            });
        }

        // 3. PATCH / PUT: Update Order Status (Chef Kitchen Actions)
        if (req.method === 'PATCH' || req.method === 'PUT') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const { orderId, status, paymentStatus, paymentDetails } = body || {};

            if (!orderId) {
                return res.status(400).json({ success: false, message: 'orderId is required' });
            }

            if (!db) {
                return res.status(200).json({
                    success: true,
                    isFallback: true,
                    message: 'Status update acknowledged (LocalStorage mode)',
                    orderId,
                    status
                });
            }

            const updateFields = {};
            if (status) updateFields.status = status;
            if (paymentStatus) updateFields.paymentStatus = paymentStatus;
            if (paymentDetails) updateFields.paymentDetails = paymentDetails;

            const updated = await Order.findOneAndUpdate(
                { orderId: String(orderId) },
                { $set: updateFields },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            return res.status(200).json({
                success: true,
                message: `Order #${orderId} updated to ${status || paymentStatus}`,
                order: {
                    ...updated.toObject(),
                    id: updated.orderId
                }
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in /api/orders handler:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error'
        });
    }
};
