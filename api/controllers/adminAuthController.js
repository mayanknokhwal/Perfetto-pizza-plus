/**
 * Perfetto Pizza - Admin Authentication & Role Management Controller
 * Handles check role, team member listing, role approvals, status changes, and staff deletion
 */

const { connectToDatabase } = require('../../lib/mongodb');
const AdminUser = require('../../models/AdminUser');

const MASTER_ADMIN_EMAIL = '44website.com44@gmail.com';
const VALID_ROLES = ['Master Admin', 'Admin', 'Chef', 'Delivery Boy', 'Pending'];
const ASSIGNABLE_ROLES = ['Admin', 'Chef', 'Delivery Boy', 'Pending'];
const VALID_STATUSES = ['active', 'pending', 'rejected'];

function isMasterAdmin(email) {
    if (!email || typeof email !== 'string') return false;
    return email.trim().toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
}

function extractRequesterEmail(req) {
    const q = req.query || {};
    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch (e) {}
    const h = req.headers || {};

    const raw = (
        q.requesterEmail ||
        q.adminEmail ||
        body.requesterEmail ||
        body.adminEmail ||
        h['x-admin-email'] ||
        h['x-requester-email'] ||
        h['x-user-email'] ||
        q.email ||
        ''
    );
    return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

async function handleAdminAuthRequest(req, res) {
    try {
        const db = await connectToDatabase();

        // 1. GET: Check user role/status OR list team members
        if (req.method === 'GET') {
            const { email, list } = req.query || {};

            // A. LIST ALL TEAM MEMBERS & PENDING REQUESTS
            if (list === 'all' || list === 'team' || list === 'true') {
                const requesterEmail = extractRequesterEmail(req);

                if (!isMasterAdmin(requesterEmail)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Forbidden: Access restricted to Master Admin only.'
                    });
                }

                if (!db) {
                    const fallbackMaster = {
                        email: MASTER_ADMIN_EMAIL,
                        fullName: 'Master Admin',
                        role: 'Master Admin',
                        status: 'active',
                        photoURL: '',
                        firebaseUid: '',
                        createdAt: new Date(),
                    };
                    return res.status(200).json({
                        success: true,
                        isFallback: true,
                        users: [fallbackMaster],
                        team: [fallbackMaster],
                        pending: [],
                        rejected: [],
                        counts: { total: 1, active: 1, pending: 0, rejected: 0 }
                    });
                }

                const users = await AdminUser.find({}).sort({ createdAt: -1 }).lean();
                const hasMaster = users.some((u) => isMasterAdmin(u.email));
                let allUsers = users;

                if (!hasMaster) {
                    allUsers = [
                        {
                            email: MASTER_ADMIN_EMAIL,
                            fullName: 'Master Admin',
                            role: 'Master Admin',
                            status: 'active',
                            photoURL: '',
                            firebaseUid: '',
                            createdAt: new Date(),
                        },
                        ...users,
                    ];
                } else {
                    allUsers = allUsers.map((u) =>
                        isMasterAdmin(u.email)
                            ? { ...u, role: 'Master Admin', status: 'active' }
                            : u
                    );
                }

                const activeMembers = allUsers.filter((u) => u.status === 'active');
                const pendingRequests = allUsers.filter((u) => u.status === 'pending');
                const rejectedRequests = allUsers.filter((u) => u.status === 'rejected');

                return res.status(200).json({
                    success: true,
                    users: allUsers,
                    team: activeMembers,
                    pending: pendingRequests,
                    rejected: rejectedRequests,
                    counts: {
                        total: allUsers.length,
                        active: activeMembers.length,
                        pending: pendingRequests.length,
                        rejected: rejectedRequests.length,
                    },
                });
            }

            // B. CHECK SINGLE USER ROLE & STATUS
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide an email query parameter or specify list=all'
                });
            }

            const normalizedEmail = email.trim().toLowerCase();

            if (isMasterAdmin(normalizedEmail)) {
                let masterRecord = null;
                if (db) {
                    try {
                        masterRecord = await AdminUser.findOne({ email: MASTER_ADMIN_EMAIL.toLowerCase() }).lean();
                    } catch (e) {}
                }

                return res.status(200).json({
                    success: true,
                    email: MASTER_ADMIN_EMAIL,
                    role: 'Master Admin',
                    status: 'active',
                    isMasterAdmin: true,
                    user: masterRecord || {
                        email: MASTER_ADMIN_EMAIL,
                        fullName: 'Master Admin',
                        role: 'Master Admin',
                        status: 'active',
                        photoURL: '',
                        firebaseUid: '',
                        lastLoginAt: new Date(),
                    },
                });
            }

            if (normalizedEmail === 'abc@gmail.com') {
                let chefRecord = null;
                if (db) {
                    try {
                        chefRecord = await AdminUser.findOne({ email: 'abc@gmail.com' }).lean();
                    } catch (e) {}
                }
                return res.status(200).json({
                    success: true,
                    email: 'abc@gmail.com',
                    role: chefRecord?.role || 'Chef',
                    status: chefRecord?.status || 'active',
                    user: chefRecord || {
                        email: 'abc@gmail.com',
                        fullName: 'Kitchen Chef',
                        role: 'Chef',
                        status: 'active',
                        photoURL: '',
                        firebaseUid: '',
                        lastLoginAt: new Date(),
                    },
                });
            }

            if (!db) {
                return res.status(200).json({
                    success: false,
                    isFallback: true,
                    message: 'MongoDB URI not configured. Offline mode.',
                    role: 'Pending',
                    status: 'pending',
                });
            }

            const user = await AdminUser.findOne({ email: normalizedEmail }).lean();
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'No account found for this email',
                    role: 'Pending',
                    status: 'pending',
                });
            }

            return res.status(200).json({
                success: true,
                email: user.email,
                role: user.role,
                status: user.status,
                user,
            });
        }

        // 2. POST: Upsert Login Attempt with Google Profile Details
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            if (!body || !body.email) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing email in request body.'
                });
            }

            const email = body.email.trim().toLowerCase();
            const photoURL = body.photoURL || '';
            const firebaseUid = (body.firebaseUid || '').trim();

            if (isMasterAdmin(email)) {
                const fullName = (body.fullName || '').trim() || 'Master Admin';

                if (!db) {
                    return res.status(200).json({
                        success: true,
                        isFallback: true,
                        message: 'Master Admin authenticated (offline mode)',
                        role: 'Master Admin',
                        status: 'active',
                        user: {
                            email: MASTER_ADMIN_EMAIL,
                            fullName,
                            photoURL,
                            firebaseUid,
                            role: 'Master Admin',
                            status: 'active',
                            lastLoginAt: new Date(),
                        },
                    });
                }

                const user = await AdminUser.findOneAndUpdate(
                    { email: MASTER_ADMIN_EMAIL.toLowerCase() },
                    {
                        $set: {
                            email: MASTER_ADMIN_EMAIL.toLowerCase(),
                            fullName,
                            photoURL,
                            firebaseUid,
                            role: 'Master Admin',
                            status: 'active',
                            lastLoginAt: new Date(),
                        },
                        $setOnInsert: {
                            requestedAt: new Date(),
                            approvedAt: new Date(),
                        },
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                return res.status(200).json({
                    success: true,
                    message: 'Master Admin authenticated successfully',
                    role: 'Master Admin',
                    status: 'active',
                    user,
                });
            }

            const fullName = (body.fullName || '').trim() || 'Google User';

            if (!db) {
                return res.status(200).json({
                    success: true,
                    isFallback: true,
                    message: 'Login attempt recorded (offline mode)',
                    role: 'Pending',
                    status: 'pending',
                    user: {
                        email,
                        fullName,
                        photoURL,
                        firebaseUid,
                        role: 'Pending',
                        status: 'pending',
                        lastLoginAt: new Date(),
                    },
                });
            }

            const existingUser = await AdminUser.findOne({ email });
            const defaultRole = email === 'abc@gmail.com' ? 'Chef' : 'Pending';
            const defaultStatus = email === 'abc@gmail.com' ? 'active' : 'pending';
            const assignedRole = existingUser ? existingUser.role : defaultRole;
            const assignedStatus = existingUser ? existingUser.status : defaultStatus;

            const updateDoc = {
                email,
                fullName: fullName || existingUser?.fullName || 'Google User',
                photoURL: photoURL || existingUser?.photoURL || '',
                firebaseUid: firebaseUid || existingUser?.firebaseUid || '',
                role: assignedRole,
                status: assignedStatus,
                lastLoginAt: new Date(),
            };

            const user = await AdminUser.findOneAndUpdate(
                { email },
                {
                    $set: updateDoc,
                    $setOnInsert: {
                        requestedAt: new Date(),
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            return res.status(200).json({
                success: true,
                message: user.status === 'active'
                    ? `Welcome back! Signed in as ${user.role}`
                    : (user.status === 'rejected'
                        ? 'Your access request has been rejected by Master Admin'
                        : 'Sign-in attempt recorded. Access request pending Master Admin approval.'),
                role: user.role,
                status: user.status,
                user,
            });
        }

        // 3. PATCH: Approve or Reject Pending Requests
        if (req.method === 'PATCH') {
            let body = req.body;
            if (typeof body === 'string') {
                try { body = JSON.parse(body); } catch (e) { body = {}; }
            }

            const requesterEmail = extractRequesterEmail(req);
            if (!isMasterAdmin(requesterEmail)) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Only Master Admin can modify roles and access permissions.'
                });
            }

            const targetEmail = (body.targetEmail || body.email || '').trim().toLowerCase();
            const targetId = body.userId || body.id || body._id;

            if (!targetEmail && !targetId) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide targetEmail or userId in request body.'
                });
            }

            if (targetEmail && isMasterAdmin(targetEmail)) {
                return res.status(400).json({
                    success: false,
                    message: 'Master Admin privileges cannot be modified.'
                });
            }

            if (!db) {
                return res.status(200).json({
                    success: false,
                    isFallback: true,
                    message: 'MongoDB not connected. Changes cannot be saved.',
                });
            }

            const filter = targetId ? { _id: targetId } : { email: targetEmail };
            const existingTarget = await AdminUser.findOne(filter);

            if (!existingTarget) {
                return res.status(404).json({
                    success: false,
                    message: 'Target user record not found.'
                });
            }

            if (isMasterAdmin(existingTarget.email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Master Admin privileges cannot be modified.'
                });
            }

            const update = {
                reviewedBy: requesterEmail || MASTER_ADMIN_EMAIL,
            };

            const action = (body.action || '').trim().toLowerCase();

            if (action === 'approve') {
                update.status = 'active';
                const role = body.role || 'Chef';
                if (!ASSIGNABLE_ROLES.includes(role)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid role specified. Allowed roles: ${ASSIGNABLE_ROLES.join(', ')}`
                    });
                }
                update.role = role;
                update.approvedAt = new Date();
            } else if (action === 'reject') {
                update.status = 'rejected';
                update.approvedAt = null;
            } else {
                if (body.status) {
                    if (!VALID_STATUSES.includes(body.status)) {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid status. Allowed statuses: ${VALID_STATUSES.join(', ')}`
                        });
                    }
                    update.status = body.status;
                    if (body.status === 'active') {
                        update.approvedAt = new Date();
                    }
                }

                if (body.role) {
                    if (!ASSIGNABLE_ROLES.includes(body.role)) {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid role specified. Allowed roles: ${ASSIGNABLE_ROLES.join(', ')}`
                        });
                    }
                    update.role = body.role;
                }
            }

            if (body.notes !== undefined) {
                update.notes = body.notes;
            }

            const updatedUser = await AdminUser.findOneAndUpdate(
                filter,
                { $set: update },
                { new: true }
            );

            return res.status(200).json({
                success: true,
                message: `Staff member ${updatedUser.email} updated to role "${updatedUser.role}" with status "${updatedUser.status}".`,
                user: updatedUser,
            });
        }

        // 4. DELETE: Remove a staff record
        if (req.method === 'DELETE') {
            const requesterEmail = extractRequesterEmail(req);
            if (!isMasterAdmin(requesterEmail)) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Only Master Admin can delete staff records.'
                });
            }

            let body = {};
            try {
                body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
            } catch (e) {}

            const targetEmail = (req.query.targetEmail || req.query.email || body.targetEmail || body.email || '').trim().toLowerCase();
            const targetId = req.query.userId || req.query.id || body.userId || body.id;

            if (!targetEmail && !targetId) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide targetEmail or userId to delete.'
                });
            }

            if (targetEmail && isMasterAdmin(targetEmail)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete the Primary Master Admin account.'
                });
            }

            if (!db) {
                return res.status(200).json({
                    success: false,
                    isFallback: true,
                    message: 'MongoDB not connected.',
                });
            }

            const filter = targetId ? { _id: targetId } : { email: targetEmail };
            const existing = await AdminUser.findOne(filter);

            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff member record not found.'
                });
            }

            if (isMasterAdmin(existing.email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete the Primary Master Admin account.'
                });
            }

            await AdminUser.deleteOne(filter);

            return res.status(200).json({
                success: true,
                message: `Staff member record for ${existing.email} deleted successfully.`
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleAdminAuthRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error'
        });
    }
}

module.exports = {
    handleAdminAuthRequest,
    isMasterAdmin
};
