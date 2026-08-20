/**
 * Mongoose Order Schema
 * Stores order ID, customer reference & details, items, costs, payment status, and order tracking status
 */

const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    id: { type: String },
    name: { type: String, required: true },
    size: { type: String, default: 'Standard' },
    price: { type: Number, required: true, default: 0 },
    qty: { type: Number, required: true, default: 1 },
    notes: { type: String, default: '' },
});

const OrderSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
        },
        customer: {
            firebaseUid: { type: String, default: '' },
            name: { type: String, required: true, default: 'Customer' },
            phone: { type: String, required: true },
            email: { type: String, default: '' },
            address: { type: String, required: true },
            deliveryDetails: {
                colonyName: { type: String, default: '' },
                nearBy: { type: String, default: '' },
                streetName: { type: String, default: '' },
                wardNo: { type: String, default: '' },
                distanceKm: { type: Number, default: 0 },
                zone: { type: Number, default: null },
                zoneLabel: { type: String, default: '' },
            },
            gps: {
                lat: { type: Number, default: null },
                lng: { type: Number, default: null },
            },
        },
        items: [OrderItemSchema],
        costs: {
            subtotal: { type: Number, required: true, default: 0 },
            deliveryFee: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
            total: { type: Number, required: true, default: 0 },
        },
        // Direct shortcuts for compatibility with existing UI
        subtotal: { type: Number, default: 0 },
        deliveryFee: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        customerName: { type: String, default: '' },
        customerPhone: { type: String, default: '' },
        address: { type: String, default: '' },
        
        paymentMethod: {
            type: String,
            default: 'Cash on Delivery',
            enum: ['Cash on Delivery', 'PhonePe', 'Online Payment', 'UPI', 'Card', 'Net Banking'],
        },
        paymentStatus: {
            type: String,
            default: 'Cash on Delivery',
            enum: ['Cash on Delivery', 'Paid', 'Pending', 'Failed', 'Refunded'],
        },
        paymentDetails: {
            merchantTransactionId: { type: String, default: '' },
            transactionId: { type: String, default: '' },
            providerReferenceId: { type: String, default: '' },
            amount: { type: Number, default: 0 },
            status: { type: String, default: '' },
            rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
        },
        status: {
            type: String,
            default: 'new',
            enum: ['new', 'preparing', 'ready', 'delivery', 'completed', 'cancelled'],
            index: true,
        },
        timeAgo: {
            type: String,
            default: 'Just now',
        },
    },
    {
        timestamps: true,
    }
);

// Prevent model recompilation in serverless environments
module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
