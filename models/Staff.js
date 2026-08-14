// --------------------------------------------------------------------------
// PERFETTO PIZZA - STAFF / CHEF / DELIVERY BOY MONGOOSE SCHEMA
// --------------------------------------------------------------------------
const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Staff member name is required'],
        trim: true
    },
    role: {
        type: String,
        enum: ['chef', 'delivery_boy', 'admin', 'manager'],
        required: [true, 'Staff role is required'],
        default: 'chef'
    },
    mobileNumber: {
        type: String,
        required: [true, 'Staff mobile number is required'],
        unique: true,
        trim: true,
        index: true
    },
    credentials: {
        type: String,
        required: [true, 'Staff credentials/PIN is required'],
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    currentStatus: {
        type: String,
        enum: ['available', 'busy', 'offline'],
        default: 'available'
    },
    assignedOrdersCount: {
        type: Number,
        default: 0
    },
    lastLogin: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Staff', StaffSchema);
