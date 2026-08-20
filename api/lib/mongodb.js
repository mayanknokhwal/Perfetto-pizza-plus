/**
 * MongoDB Atlas Connection Utility with Mongoose
 * Optimized for Vercel Serverless Functions and Connection Pooling
 */

try {
    const dns = require('dns');
    if (dns.setServers) {
        dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    }
} catch (e) { }

if (!process.env.MONGODB_URI) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

const mongoose = require('mongoose');

// Cache database connection across serverless invocations
let cached = global.mongooseCached;

if (!cached) {
    cached = global.mongooseCached = { conn: null, promise: null };
}

async function connectToDatabase() {
    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.warn('MONGODB_URI environment variable is not defined; using local resilience fallback mode.');
        return null;
    }

    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 4000,
            socketTimeoutMS: 45000,
            dbName: 'perfetto-pizza',
        };

        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
            console.log('✅ Successfully connected to MongoDB Atlas (Database: perfetto-pizza)');
            return mongooseInstance;
        }).catch((err) => {
            console.warn('⚠️ MongoDB Atlas notice (local fallback active):', err.message);
            cached.promise = null;
            return null;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.warn('MongoDB Atlas connection attempt finished with fallback.');
        return null;
    }

    return cached.conn;
}

module.exports = { connectToDatabase, mongoose };


