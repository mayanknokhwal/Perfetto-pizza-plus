/**
 * Mongoose MenuItem Schema
 * Stores menu items, availability status, size-variant or single pricing, categories, descriptions, and images
 */

const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        isMultiSize: {
            type: Boolean,
            default: false,
        },
        price: {
            type: Number,
            default: 0,
        },
        prices: {
            S: { type: Number, default: 0 },
            M: { type: Number, default: 0 },
            L: { type: Number, default: 0 },
        },
        available: {
            type: Boolean,
            default: true,
            index: true,
        },
        img: {
            type: String,
            default: '',
        },
        desc: {
            type: String,
            default: '',
        },
        tag: {
            type: String,
            default: '',
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Prevent model recompilation in serverless environments
module.exports = mongoose.models.MenuItem || mongoose.model('MenuItem', MenuItemSchema);
