/**
 * Perfetto Pizza - Serverless Orders Route Handler
 * Dispatches to controllers/ordersController.js
 */

try {
    require('../lib/firebaseAdmin');
} catch (e) { }

const { handleOrdersRequest } = require('../controllers/ordersController');

module.exports = async (req, res) => {
    return handleOrdersRequest(req, res);
};
