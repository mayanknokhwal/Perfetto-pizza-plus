/**
 * Perfetto Pizza - Customer App Script Loader
 * Forwards to app.js for full customer ordering, Leaflet GPS location picker, and checkout flow.
 */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = require('./app');
}
