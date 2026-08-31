/**
 * Perfetto Pizza - Local Development Server (Express)
 * Configured for seamless Localhost & Vercel parity with Real-Time Firebase Sync & Email OTP support.
 */

try {
    require('dotenv').config();
} catch (e) {}

require('./lib/globalStores');
require('./lib/firebaseAdmin');

const path = require('path');
const express = require('express');
const apiApp = require('./api/index');

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Clean URL rewrites for local development (matching vercel.json)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'staff.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/refund', (req, res) => res.sendFile(path.join(__dirname, 'refund.html')));

// Serve static HTML/CSS/JS/Assets from root
app.use(express.static(__dirname));

// Mount Serverless API application
app.use(apiApp);

let serverInstance = null;

async function verifyFirestoreConnectivity() {
    const { FIREBASE_CONFIG, listFirestoreCollection } = require('./lib/firestore');
    const requiredCollections = ['menu', 'orders', 'users', 'settings', 'team'];

    if (!FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.apiKey) {
        console.log(`ℹ️ [Firestore Status] Running in in-memory fallback mode (Firebase keys not fully set).`);
        return;
    }

    console.log(`🔍 [Firestore Status] Checking collections for project: ${FIREBASE_CONFIG.projectId}...`);
    for (const col of requiredCollections) {
        try {
            const docs = await listFirestoreCollection(col, 1);
            console.log(`   • Collection '${col}': ✅ Active (${Array.isArray(docs) ? docs.length : 0} sample loaded)`);
        } catch (err) {
            console.warn(`   • Collection '${col}': ⚠️ Notice (${err.message})`);
        }
    }
}

if (require.main === module) {
    serverInstance = app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🍕 Perfetto Pizza Local Dev Server running on Localhost`);
        console.log(`-------------------------------------------------------`);
        console.log(` • Customer App:   http://localhost:${PORT}/index.html`);
        console.log(` • Staff Portal:   http://localhost:${PORT}/staff.html`);
        console.log(` • Admin Panel:    http://localhost:${PORT}/admin.html`);
        console.log(` • API Base:       http://localhost:${PORT}/api/`);
        console.log(`=======================================================`);
        verifyFirestoreConnectivity().catch(e => console.warn('Firestore verification notice:', e.message));
    });

    serverInstance.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Retrying on port ${PORT + 1}...`);
            app.listen(PORT + 1);
        } else {
            console.error('Server error:', e);
        }
    });
}

module.exports = app;
