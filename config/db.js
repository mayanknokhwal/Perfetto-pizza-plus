// --------------------------------------------------------------------------
// PERFETTO PIZZA - MONGODB DATABASE CONNECTION CONFIGURATION
// --------------------------------------------------------------------------
const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Ensure Node resolves MongoDB Atlas SRV DNS queries reliably on Windows
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
    console.warn('DNS server configuration note:', e.message);
}

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables / .env');
        }

        console.log('⏳ Connecting to MongoDB Atlas...');
        
        const conn = await mongoose.connect(uri, {
            dbName: 'perfetto_pizza_db',
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        console.log(`====================================================`);
        console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
        console.log(`📦 Database: ${conn.connection.name}`);
        console.log(`====================================================`);
        return conn;
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
        return null;
    }
};

module.exports = connectDB;
