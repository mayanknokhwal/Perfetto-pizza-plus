/**
 * Perfetto Pizza - Centralized API Configuration & Client
 * Provides dynamic URL resolution, custom domain support, and unified network requests.
 */

// 0. Detect Capacitor / native mobile environment
const isNativeEnvironment = typeof window !== 'undefined' && (
    (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
    (window.location && (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
);

// 1. Determine API Base URL from environment, window global, or relative /api
export const API_BASE_URL = 
    (typeof window !== 'undefined' && (window.PERFETTO_API_BASE_URL || window.API_BASE_URL)) ||
    (typeof process !== 'undefined' && process.env && process.env.API_BASE_URL) ||
    (isNativeEnvironment ? 'https://perfetto-pizza-plus.vercel.app/api' : '/api');

/**
 * Resolves an endpoint path to an absolute or normalized API URL.
 * Handles local dev, Vercel deployments, custom domains, and absolute URLs.
 * 
 * @param {string} endpoint - Endpoint path (e.g. '/menu', '/api/orders', '/settings')
 * @returns {string} Fully qualified or normalized URL
 */
export function resolveApiUrl(endpoint) {
    if (!endpoint) return API_BASE_URL;
    
    // Return absolute URLs directly
    if (/^https?:\/\//i.test(endpoint)) {
        return endpoint;
    }

    const isNative = typeof window !== 'undefined' && (
        (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
        (window.location && (window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
    );

    const prodApiRoot = 'https://perfetto-pizza-plus.vercel.app/api';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

    if (isNative) {
        if (cleanEndpoint.startsWith('/api/')) {
            return `https://perfetto-pizza-plus.vercel.app${cleanEndpoint}`;
        }
        return `${prodApiRoot}${cleanEndpoint}`;
    }

    // Web / Origin environment
    if (cleanEndpoint.startsWith('/api')) {
        if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && window.location.protocol !== 'file:') {
            return `${window.location.origin}${cleanEndpoint}`;
        }
        return cleanEndpoint;
    }

    const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    if (typeof window !== 'undefined' && window.location && window.location.origin && base.startsWith('/')) {
        return `${window.location.origin}${base}${cleanEndpoint}`;
    }
    return `${base}${cleanEndpoint}`;
}

/**
 * Unified API Request Client
 * 
 * @param {string} endpoint - Target endpoint (e.g. '/orders', '/api/menu')
 * @param {RequestInit} [options={}] - Fetch configuration options
 * @returns {Promise<Response>}
 */
export async function apiCall(endpoint, options = {}) {
    const url = resolveApiUrl(endpoint);
    const headers = {
        'Accept': 'application/json',
        ...(options.headers || {})
    };

    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    return fetch(url, {
        ...options,
        headers
    });
}

// Global browser window attachment for compatibility
if (typeof window !== 'undefined') {
    window.API_BASE_URL = API_BASE_URL;
    window.resolveApiUrl = resolveApiUrl;
    window.apiCall = apiCall;
}

export default {
    API_BASE_URL,
    resolveApiUrl,
    apiCall
};
