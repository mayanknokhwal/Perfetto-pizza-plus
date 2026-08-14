// --------------------------------------------------------------------------
// PERFETTO PIZZA - ORDER MONGOOSE SCHEMA (LINKED TO CUSTOMER MOBILE NUMBER)
// --------------------------------------------------------------------------
const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    id: { type: String },
    name: { type: String, required: true },
    size: { type: String, default: 'Standard' },
    price: { type: Number },
    qty: { type: Number, default: 1 },
    notes: { type: String, default: '' }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    // Direct link to customer phone number
    customerPhone: {
        type: String,
        required: [true, 'Customer phone is required to link order history'],
        trim: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    customerName: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true
    },
    address: {
        type: String,
        required: [true, 'Delivery address is required']
    },
    deliveryDetails: {
        colonyName: { type: String, default: '' },
        nearBy: { type: String, default: '' },
        streetName: { type: String, default: '' },
        wardNo: { type: String, default: '' }
    },
    items: [OrderItemSchema],
    subtotal: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    deliveryFee: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        default: 'Cash on Delivery'
    },
    status: {
        type: String,
        enum: ['new', 'preparing', 'ready', 'delivery', 'completed', 'cancelled'],
        default: 'new',
        index: true
    },
    assignedStaff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        required: false
    },
    otpVerified: {
        type: Boolean,
        default: true
    },
    timeAgo: {
        type: String,
        default: 'Just Now'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Order', OrderSchema);
