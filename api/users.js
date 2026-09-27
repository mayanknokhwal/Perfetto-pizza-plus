/**
 * Perfetto Pizza - Serverless Users Route Handler (/api/users)
 * Dispatches to controllers/usersController.js
 */

try {
    require('../lib/firebaseAdmin');
} catch (e) { }

const { handleUsersRequest } = require('../controllers/usersController');

module.exports = async (req, res) => {
    return handleUsersRequest(req, res);
};
