/**
 * Perfetto Pizza - Centralized Client & Server Firebase Configuration
 * Universal configuration supporting Browser Window Globals, ES Modules, and CommonJS
 */

export const firebaseConfig = {
    apiKey: "AIzaSyBa17IqOPUOgmWPZ8wJeyzTiVdeX1lGVNg",
    authDomain: "website-fa79c.firebaseapp.com",
    projectId: "website-fa79c",
    storageBucket: "website-fa79c.firebasestorage.app",
    messagingSenderId: "1070276115284",
    appId: "1:1070276115284:web:ebcb37d56f3af2a2d326c1",
    measurementId: "G-DT7MRXDMZ0"
};

// Global browser window attachment for compatibility across classic and modular scripts
if (typeof window !== 'undefined') {
    window.FIREBASE_CONFIG = firebaseConfig;
    window.firebaseConfig = firebaseConfig;
}

export default firebaseConfig;
