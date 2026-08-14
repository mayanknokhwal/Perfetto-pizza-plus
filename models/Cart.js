// --------------------------------------------------------------------------
// PERFETTO PIZZA - CART MONGOOSE SCHEMA (LINKED TO CUSTOMER MOBILE NUMBER)
// --------------------------------------------------------------------------
const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, default: 'Pizza' },
    size: { type: String, default: 'Standard' },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, default: 1, min: 1 },
    img: { type: String, default: '' },
    notes: { type: String, default: '' }
}, { _id: false });

const CartSchema = new mongoose.Schema({
    // Direct link to customer phone number for cross-device cart persistence
    customerPhone: {
        type: String,
        required: [true, 'Customer phone number is required to link cart'],
        unique: true,
        trim: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    items: [CartItemSchema],
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
        default: 0
    }
}, {
    timestamps: true
});

// Auto-calculate totals prior to saving
CartSchema.pre('save', function(next) {
    if (this.items && this.items.length > 0) {
        this.subtotal = this.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
        this.tax = Math.round(this.subtotal * 0.05 * 100) / 100;
        this.deliveryFee = this.subtotal >= 500 ? 0 : 49;
        this.total = Math.round(this.subtotal + this.tax + this.deliveryFee);
    } else {
        this.subtotal = 0;
        this.tax = 0;
        this.deliveryFee = 0;
        this.total = 0;
    }
    next();
});

module.exports = mongoose.model('Cart', CartSchema);
