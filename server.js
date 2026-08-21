/**
 * Perfetto Pizza - Local Development Server (Express)
 * Configured for seamless Localhost & Vercel parity with Firebase Auth & MongoDB Atlas support.
 */

try {
    require('dotenv').config();
} catch (e) {}

const path = require('path');
const express = require('express');
const app = require('./api/index');

const PORT = parseInt(process.env.PORT || '8080', 10);

// Clean URL rewrites for local development (matching vercel.json)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'staff.html')));

// Serve static HTML/CSS/JS/Assets from root
app.use(express.static(__dirname));

let serverInstance = null;

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
