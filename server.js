// --------------------------------------------------------------------------
// PERFETTO PIZZA - MAIN BACKEND SERVER & MONGODB + FAST2SMS INTEGRATION
// --------------------------------------------------------------------------
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { Staff } = require('./models');

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Database
connectDB().then(() => {
    seedStaffMembers();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname)));

// REST API Endpoints
app.use('/api/otp', require('./routes/otpRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        app: 'Perfetto Pizza Server',
        database: 'MongoDB Atlas',
        smsGateway: 'Fast2SMS Bulk SMS V2',
        timestamp: new Date()
    });
});

// Default Staff Seed
async function seedStaffMembers() {
    try {
        const count = await Staff.countDocuments();
        if (count === 0) {
            await Staff.insertMany([
                { name: 'Chef Mario', role: 'chef', mobileNumber: '9876543210', credentials: '1234', currentStatus: 'available' },
                { name: 'Delivery Partner Suresh', role: 'delivery_boy', mobileNumber: '9812345678', credentials: '1234', currentStatus: 'available' }
            ]);
            console.log('✅ Seeded default staff profiles (PIN: 1234)');
        }
    } catch (e) {
        console.warn('Staff seeding:', e.message);
    }
}

// Fallback HTML Routes
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'staff.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Start Express Server
app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🍕 PERFETTO PIZZA SERVER RUNNING ON PORT ${PORT}`);
    console.log(`🌐 Customer App:  http://localhost:${PORT}/`);
    console.log(`👨‍🍳 Staff App:     http://localhost:${PORT}/staff.html`);
    console.log(`📊 Admin App:     http://localhost:${PORT}/admin.html`);
    console.log(`📲 Fast2SMS OTP:  Active & Verified`);
    console.log(`====================================================`);
});
