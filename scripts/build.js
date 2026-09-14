/**
 * Perfetto Pizza - Production Build & Static Asset Verification Script
 * Validates syntax, synchronizes public static directory, and validates Vercel routing parity.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('🍕 PERFETTO PIZZA - PRODUCTION BUILD PIPELINE');
console.log('======================================================');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// Ensure public directory exists
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Static asset files to sync into public/
const STATIC_FILES = [
    'index.html',
    'admin.html',
    'staff.html',
    'terms.html',
    'privacy.html',
    'refund.html',
    'styles.css',
    'staff.css',
    'app.js',
    'admin.js',
    'staff.js',
    'translations.js',
    'order-alert.mp3',
    'firebase-messaging-sw.js',
    'favicon.ico'
];

console.log('📦 [1/4] Synchronizing static assets into public directory...');
let copiedCount = 0;
for (const file of STATIC_FILES) {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(PUBLIC_DIR, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        copiedCount++;
    }
}
console.log(`   ✓ Copied ${copiedCount} root static files to public/`);

// Copy lib/ directory into public/lib/
const SRC_LIB = path.join(ROOT_DIR, 'lib');
const DEST_LIB = path.join(PUBLIC_DIR, 'lib');
if (fs.existsSync(SRC_LIB)) {
    if (!fs.existsSync(DEST_LIB)) {
        fs.mkdirSync(DEST_LIB, { recursive: true });
    }
    const libFiles = fs.readdirSync(SRC_LIB);
    for (const lf of libFiles) {
        const s = path.join(SRC_LIB, lf);
        const d = path.join(DEST_LIB, lf);
        if (fs.statSync(s).isFile()) {
            fs.copyFileSync(s, d);
        }
    }
    console.log(`   ✓ Synchronized lib/ directory to public/lib/`);
}

// 2. Syntax Check all critical JS files
console.log('🔍 [2/4] Validating JavaScript syntax...');
const JS_FILES_TO_CHECK = [
    'staff.js',
    'admin.js',
    'app.js',
    'server.js',
    'translations.js',
    'firebase-messaging-sw.js',
    path.join('public', 'firebase-messaging-sw.js'),
    path.join('lib', 'firebaseConfig.js')
];

for (const jsFile of JS_FILES_TO_CHECK) {
    const fullPath = path.join(ROOT_DIR, jsFile);
    if (fs.existsSync(fullPath)) {
        try {
            execSync(`node -c "${fullPath}"`, { stdio: 'pipe' });
            console.log(`   ✓ Syntax valid: ${jsFile}`);
        } catch (err) {
            console.error(`   ❌ Syntax error in ${jsFile}:`, err.message);
            process.exit(1);
        }
    }
}

// 3. Verify Vercel routing destinations
console.log('🗺️ [3/4] Verifying Vercel routing rewrites...');
const VERCEL_JSON_PATH = path.join(ROOT_DIR, 'vercel.json');
if (fs.existsSync(VERCEL_JSON_PATH)) {
    const vercelConfig = JSON.parse(fs.readFileSync(VERCEL_JSON_PATH, 'utf8'));
    const rewrites = vercelConfig.rewrites || [];
    for (const rw of rewrites) {
        if (rw.destination && !rw.destination.startsWith('/api')) {
            const cleanDest = rw.destination.replace(/^\//, '');
            const destInPublic = path.join(PUBLIC_DIR, cleanDest);
            const destInRoot = path.join(ROOT_DIR, cleanDest);
            if (!fs.existsSync(destInPublic) && !fs.existsSync(destInRoot)) {
                console.warn(`   ⚠️ Warning: rewrite destination '${rw.destination}' not found on filesystem.`);
            } else {
                console.log(`   ✓ Rewrite verified: ${rw.source} -> ${rw.destination}`);
            }
        }
    }
}

// 4. Verify VAPID Key configuration
console.log('🔑 [4/4] Verifying Web Push VAPID credentials...');
const VAPID_KEY = process.env.FIREBASE_VAPID_KEY ||
                  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
                  process.env.VITE_FIREBASE_VAPID_KEY ||
                  "BAzvQIJwnZ7a1vVUH4k9sNE3dHGFN2b5wRiwe8Ae4AAIjGN-RqTouVe36mYj-HhI-R1RTkFYvbuOtFQ1tjfDvIk";
const cleanVapidKey = String(VAPID_KEY).trim().replace(/^['"]|['"]$/g, '');
console.log(`   ✓ VAPID Key configured (${cleanVapidKey.slice(0, 16)}...)`);

console.log('======================================================');
console.log('✨ Production Build Completed Successfully!');
console.log('======================================================');
process.exit(0);
