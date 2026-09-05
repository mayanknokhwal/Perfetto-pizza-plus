/**
 * Perfetto Pizza - Firebase Firestore Backend Service Utility
 * Provides lightweight REST API operations and caching for Firestore collections:
 * 'menu', 'orders', 'users', 'settings', 'team'
 */

if (!process.env.FIREBASE_PROJECT_ID) {
    try {
        require('dotenv').config();
    } catch (e) { }
}

require('./globalStores');

const FIREBASE_CONFIG = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
};

if (!FIREBASE_CONFIG.projectId) {
    console.error('❌ FIREBASE_PROJECT_ID is not set. Firestore operations will fail.');
}
if (!FIREBASE_CONFIG.apiKey) {
    console.error('❌ FIREBASE_API_KEY is not set. Firestore REST API calls will be rejected.');
}

const FIRESTORE_BASE_URL = FIREBASE_CONFIG.projectId
    ? `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`
    : '';

/**
 * Converts a standard JavaScript value to a Firestore REST typed value
 */
function jsValueToFirestore(val) {
    if (val === null || val === undefined) {
        return { nullValue: null };
    }
    if (typeof val === 'boolean') {
        return { booleanValue: val };
    }
    if (typeof val === 'number') {
        if (Number.isInteger(val)) {
            return { integerValue: String(val) };
        }
        return { doubleValue: val };
    }
    if (typeof val === 'string') {
        return { stringValue: val };
    }
    if (Array.isArray(val)) {
        return {
            arrayValue: {
                values: val.map(jsValueToFirestore)
            }
        };
    }
    if (typeof val === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(val)) {
            if (v !== undefined) {
                fields[k] = jsValueToFirestore(v);
            }
        }
        return {
            mapValue: {
                fields: fields
            }
        };
    }
    return { stringValue: String(val) };
}

/**
 * Converts a Firestore REST typed value back into a standard JavaScript value
 */
function firestoreValueToJs(val) {
    if (!val || typeof val !== 'object') return val;

    if ('nullValue' in val) return null;
    if ('booleanValue' in val) return Boolean(val.booleanValue);
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('stringValue' in val) return String(val.stringValue);
    if ('timestampValue' in val) return val.timestampValue;
    if ('arrayValue' in val) {
        const arr = val.arrayValue?.values || [];
        return arr.map(firestoreValueToJs);
    }
    if ('mapValue' in val) {
        const fields = val.mapValue?.fields || {};
        const result = {};
        for (const [k, v] of Object.entries(fields)) {
            result[k] = firestoreValueToJs(v);
        }
        return result;
    }
    return val;
}

/**
 * Converts a complete JavaScript object into a Firestore document structure
 */
function jsObjectToFirestoreDoc(obj) {
    const fields = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (v !== undefined) {
            fields[k] = jsValueToFirestore(v);
        }
    }
    return { fields };
}

/**
 * Converts a Firestore document structure back into a standard JavaScript object
 */
function firestoreDocToJsObject(doc) {
    if (!doc || !doc.fields) return null;
    const result = {};
    for (const [k, v] of Object.entries(doc.fields)) {
        result[k] = firestoreValueToJs(v);
    }
    // Extract document ID from name if available
    if (doc.name) {
        const parts = doc.name.split('/');
        result.__id = parts[parts.length - 1];
    }
    return result;
}

// Global TTL Cache Stores (20s TTL to prevent runaway Firestore REST read bills)
const FIRESTORE_READ_CACHE_TTL_MS = 20000;
if (!global.__firestoreDocCacheTimestamps) {
    global.__firestoreDocCacheTimestamps = new Map();
}
if (!global.__firestoreCollectionCache) {
    global.__firestoreCollectionCache = new Map();
}
if (!global.__firestoreCollectionCacheTimestamps) {
    global.__firestoreCollectionCacheTimestamps = new Map();
}

/**
 * Fetches a single document from Firestore or in-memory fallback (with 20s TTL caching)
 */
async function getFirestoreDoc(collection, docId, forceFresh = false) {
    const cacheKey = `${collection}/${docId}`;
    const now = Date.now();
    const cachedTime = global.__firestoreDocCacheTimestamps.get(cacheKey) || 0;

    // Return fresh cached document if within TTL
    if (!forceFresh && global.__firestoreMemoryCache.has(cacheKey) && (now - cachedTime < FIRESTORE_READ_CACHE_TTL_MS)) {
        return global.__firestoreMemoryCache.get(cacheKey);
    }

    if (!FIRESTORE_BASE_URL || !FIREBASE_CONFIG.apiKey) {
        return global.__firestoreMemoryCache.get(cacheKey) || null;
    }
    const url = `${FIRESTORE_BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${FIREBASE_CONFIG.apiKey}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
            const rawDoc = await response.json();
            const jsData = firestoreDocToJsObject(rawDoc);
            if (jsData) {
                global.__firestoreMemoryCache.set(cacheKey, jsData);
                global.__firestoreDocCacheTimestamps.set(cacheKey, Date.now());
                return jsData;
            }
        }
    } catch (err) {
        console.warn(`Firestore REST get [${cacheKey}] note:`, err.message);
    }

    return global.__firestoreMemoryCache.get(cacheKey) || null;
}

/**
 * Creates or overwrites a document in Firestore and updates in-memory cache
 */
async function setFirestoreDoc(collection, docId, data, merge = true) {
    const cacheKey = `${collection}/${docId}`;
    let mergedData = data;

    if (merge) {
        const existing = global.__firestoreMemoryCache.get(cacheKey) || {};
        mergedData = { ...existing, ...data };
    }

    global.__firestoreMemoryCache.set(cacheKey, mergedData);
    global.__firestoreDocCacheTimestamps.set(cacheKey, Date.now());

    // Invalidate collection-level cache on any document write
    global.__firestoreCollectionCache.delete(collection);
    global.__firestoreCollectionCacheTimestamps.delete(collection);

    if (!FIRESTORE_BASE_URL || !FIREBASE_CONFIG.apiKey) {
        return mergedData;
    }

    const docPayload = jsObjectToFirestoreDoc(mergedData);
    const url = `${FIRESTORE_BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${FIREBASE_CONFIG.apiKey}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(docPayload),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
            const resultDoc = await response.json();
            const jsObj = firestoreDocToJsObject(resultDoc) || mergedData;
            global.__firestoreMemoryCache.set(cacheKey, jsObj);
            global.__firestoreDocCacheTimestamps.set(cacheKey, Date.now());
            return jsObj;
        }
    } catch (err) {
        console.warn(`Firestore REST set [${cacheKey}] note:`, err.message);
    }

    return mergedData;
}

/**
 * Lists all documents in a collection from Firestore or in-memory fallback (with 20s TTL caching)
 */
async function listFirestoreCollection(collection, limit = 100, forceFresh = false) {
    const now = Date.now();
    const cachedCollTime = global.__firestoreCollectionCacheTimestamps.get(collection) || 0;

    // Return fresh collection list if within TTL
    if (!forceFresh && global.__firestoreCollectionCache.has(collection) && (now - cachedCollTime < FIRESTORE_READ_CACHE_TTL_MS)) {
        return global.__firestoreCollectionCache.get(collection);
    }

    if (!FIRESTORE_BASE_URL || !FIREBASE_CONFIG.apiKey) {
        const fallbackList = [];
        const prefix = `${collection}/`;
        for (const [key, value] of global.__firestoreMemoryCache.entries()) {
            if (key.startsWith(prefix)) {
                fallbackList.push(value);
            }
        }
        return fallbackList;
    }

    const url = `${FIRESTORE_BASE_URL}/${collection}?pageSize=${limit}&key=${FIREBASE_CONFIG.apiKey}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json();
            if (data.documents && Array.isArray(data.documents)) {
                const list = data.documents.map(d => {
                    const js = firestoreDocToJsObject(d);
                    if (js && js.__id) {
                        const key = `${collection}/${js.__id}`;
                        global.__firestoreMemoryCache.set(key, js);
                        global.__firestoreDocCacheTimestamps.set(key, Date.now());
                    }
                    return js;
                });
                global.__firestoreCollectionCache.set(collection, list);
                global.__firestoreCollectionCacheTimestamps.set(collection, Date.now());
                return list;
            }
        }
    } catch (err) {
        console.warn(`Firestore REST list [${collection}] note:`, err.message);
    }

    // Fallback: Return all cached documents for this collection prefix
    const fallbackList = [];
    const prefix = `${collection}/`;
    for (const [key, value] of global.__firestoreMemoryCache.entries()) {
        if (key.startsWith(prefix)) {
            fallbackList.push(value);
        }
    }
    return fallbackList;
}

/**
 * Deletes a document from Firestore and removes from in-memory cache
 */
async function deleteFirestoreDoc(collection, docId) {
    const cacheKey = `${collection}/${docId}`;
    global.__firestoreMemoryCache.delete(cacheKey);
    global.__firestoreDocCacheTimestamps.delete(cacheKey);

    // Invalidate collection-level cache
    global.__firestoreCollectionCache.delete(collection);
    global.__firestoreCollectionCacheTimestamps.delete(collection);

    if (!FIRESTORE_BASE_URL || !FIREBASE_CONFIG.apiKey) {
        return true;
    }

    const url = `${FIRESTORE_BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${FIREBASE_CONFIG.apiKey}`;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(url, {
            method: 'DELETE',
            signal: controller.signal
        });
        clearTimeout(timeout);

        return response.ok;
    } catch (err) {
        console.warn(`Firestore REST delete [${cacheKey}] note:`, err.message);
        return true;
    }
}

module.exports = {
    FIREBASE_CONFIG,
    FIRESTORE_BASE_URL,
    getFirestoreDoc,
    setFirestoreDoc,
    listFirestoreCollection,
    deleteFirestoreDoc,
    jsObjectToFirestoreDoc,
    firestoreDocToJsObject,
    jsValueToFirestore,
    firestoreValueToJs,
};
