/**
 * Perfetto Pizza - Admin & Staff Authentication & Role Management Controller
 * Powered by Firebase Firestore ('team' collection)
 * Exclusively uses Mobile Phone Numbers (10-digit) and Full Names (No Emails).
 */

const { getFirestoreDoc, setFirestoreDoc, deleteFirestoreDoc, listFirestoreCollection } = require('../lib/firestore');

const MASTER_ADMIN_PHONE = (process.env.MASTER_ADMIN_PHONE || '9414503886').replace(/[^0-9]/g, '').slice(-10);
const MAX_MASTER_ADMINS = 2;
const VALID_ROLES = ['Master Admin', 'Admin', 'Staff', 'Pending'];
const ASSIGNABLE_ROLES = ['Master Admin', 'Admin', 'Staff'];
const VALID_STATUSES = ['active', 'pending', 'rejected', 'blocked'];

function cleanPhone(rawPhone) {
    if (!rawPhone) return '';
    return String(rawPhone).replace(/[^0-9]/g, '').slice(-10);
}

function isMasterAdmin(identifier) {
    if (!identifier) return false;
    let phoneStr = '';
    if (typeof identifier === 'string') {
        phoneStr = cleanPhone(identifier);
    } else if (typeof identifier === 'object') {
        phoneStr = cleanPhone(identifier.phone || identifier.phoneNumber);
    }
    return phoneStr === MASTER_ADMIN_PHONE;
}

async function countActiveMasterAdmins(excludePhone = '') {
    const cleanExclude = cleanPhone(excludePhone);
    let masterAdminPhones = new Set();

    // Primary Master Admin is always an active Master Admin
    if (MASTER_ADMIN_PHONE !== cleanExclude) {
        masterAdminPhones.add(MASTER_ADMIN_PHONE);
    }

    // Check in-memory store
    for (const [phone, user] of global.__adminTeamStore.entries()) {
        const clean = cleanPhone(phone);
        if (clean !== cleanExclude && user.status === 'active' && user.role === 'Master Admin') {
            masterAdminPhones.add(clean);
        }
    }

    // Check Firestore
    try {
        const firestoreTeam = await listFirestoreCollection('team', 100);
        if (Array.isArray(firestoreTeam)) {
            firestoreTeam.forEach(u => {
                const clean = cleanPhone(u.phone || u.id);
                if (clean !== cleanExclude && u.status === 'active' && u.role === 'Master Admin') {
                    masterAdminPhones.add(clean);
                }
            });
        }
    } catch (e) { }

    return masterAdminPhones.size;
}

async function isAuthorizedAdmin(phone) {
    if (!phone) return false;
    const clean = cleanPhone(phone);
    if (clean === MASTER_ADMIN_PHONE) return true;
    const member = await getStaffMember(clean);
    return !!(member && member.status === 'active' && (member.role === 'Admin' || member.role === 'Master Admin'));
}

function extractRequesterPhone(req) {
    const q = req.query || {};
    let body = {};
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch (e) { }
    const h = req.headers || {};

    const raw = (
        q.requesterPhone ||
        q.adminPhone ||
        q.phone ||
        body.requesterPhone ||
        body.adminPhone ||
        body.phone ||
        h['x-admin-phone'] ||
        h['x-requester-phone'] ||
        h['x-user-phone'] ||
        ''
    );
    return cleanPhone(raw);
}

async function getStaffMember(phone) {
    const phoneKey = cleanPhone(phone);
    if (!phoneKey) return null;

    if (global.__adminTeamStore.has(phoneKey)) {
        return global.__adminTeamStore.get(phoneKey);
    }

    try {
        const doc = await getFirestoreDoc('team', phoneKey);
        if (doc) {
            global.__adminTeamStore.set(phoneKey, doc);
            return doc;
        }
    } catch (e) {
        console.warn('Firestore team read note:', e.message);
    }

    return null;
}

async function saveStaffMember(phone, memberData) {
    const phoneKey = cleanPhone(phone);
    if (!phoneKey) return;

    global.__adminTeamStore.set(phoneKey, memberData);

    try {
        await setFirestoreDoc('team', phoneKey, memberData);
    } catch (e) {
        console.warn('Firestore team save note:', e.message);
    }
}

/**
 * Main Admin Auth & Team Request Router (/api/admin-auth)
 */
async function handleAdminAuthRequest(req, res) {
    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        // 1. GET: Check single user role or list all team members from Firestore
        if (req.method === 'GET') {
            const listAll = req.query.list === 'all' || req.query.all === 'true';

            if (listAll) {
                const requesterPhone = extractRequesterPhone(req);
                const isAuth = await isAuthorizedAdmin(requesterPhone);
                if (!isAuth) {
                    return res.status(403).json({
                        success: false,
                        message: 'Forbidden: Only active Administrators or Master Admin can view the complete staff roster.'
                    });
                }

                // Fetch from Firestore and merge with in-memory store
                try {
                    const firestoreTeam = await listFirestoreCollection('team', 100);
                    if (Array.isArray(firestoreTeam)) {
                        firestoreTeam.forEach(m => {
                            const p = cleanPhone(m.phone || m.id);
                            if (p) global.__adminTeamStore.set(p, m);
                        });
                    }
                } catch (e) { }

                // Always ensure Master Admin is present in the list
                if (!global.__adminTeamStore.has(MASTER_ADMIN_PHONE)) {
                    global.__adminTeamStore.set(MASTER_ADMIN_PHONE, {
                        id: 'master_admin_' + MASTER_ADMIN_PHONE,
                        phone: MASTER_ADMIN_PHONE,
                        fullName: 'Master Admin',
                        role: 'Master Admin',
                        status: 'active',
                        photoURL: `https://ui-avatars.com/api/?name=Master+Admin&background=ff6b00&color=fff`,
                        createdAt: new Date().toISOString(),
                        lastLoginAt: new Date().toISOString(),
                    });
                }

                const teamList = Array.from(global.__adminTeamStore.values());
                const pending = teamList.filter(m => m.status === 'pending' || m.role === 'Pending');
                const team = teamList.filter(m => m.status === 'active' && m.role !== 'Pending');
                const blocked = teamList.filter(m => m.status === 'blocked' || m.status === 'rejected');
                const rejected = blocked;

                const masterAdmins = teamList.filter(m => m.status === 'active' && (m.role === 'Master Admin' || isMasterAdmin(m.phone)));

                return res.status(200).json({
                    success: true,
                    count: teamList.length,
                    members: teamList,
                    pending,
                    team,
                    blocked,
                    rejected,
                    masterAdminPhone: MASTER_ADMIN_PHONE,
                    maxMasterAdmins: MAX_MASTER_ADMINS,
                    activeMasterAdminsCount: masterAdmins.length
                });
            }

            // Check single user role by phone
            const phone = cleanPhone(req.query.phone || body.phone);
            if (!phone) {
                return res.status(400).json({ success: false, message: 'phone query parameter is required' });
            }

            if (isMasterAdmin(phone)) {
                const masterUser = {
                    id: 'master_admin_' + phone,
                    phone: phone,
                    fullName: 'Master Admin',
                    role: 'Master Admin',
                    status: 'active',
                    photoURL: `https://ui-avatars.com/api/?name=Master+Admin&background=ff6b00&color=fff`,
                    isApproved: true,
                    isMasterAdmin: true,
                };
                return res.status(200).json({
                    success: true,
                    role: 'Master Admin',
                    status: 'active',
                    isApproved: true,
                    isMasterAdmin: true,
                    phone: phone,
                    user: masterUser,
                });
            }

            const staffMember = await getStaffMember(phone);
            if (!staffMember) {
                return res.status(200).json({
                    success: true,
                    role: 'Pending',
                    status: 'pending',
                    isApproved: false,
                    isMasterAdmin: false,
                    isBlocked: false,
                    exists: false,
                    phone,
                });
            }

            const isBlocked = (staffMember.status === 'blocked' || staffMember.status === 'rejected');

            return res.status(200).json({
                success: true,
                role: staffMember.role,
                status: staffMember.status,
                isApproved: staffMember.status === 'active',
                isMasterAdmin: staffMember.role === 'Master Admin',
                isBlocked: isBlocked,
                phone: staffMember.phone,
                user: staffMember,
            });
        }

        // 2. POST: Process Login & Access Request Verification
        if (req.method === 'POST') {
            const phone = cleanPhone(body.phone || req.query.phone);
            const fullName = (body.fullName || body.name || '').trim();
            const portalOrigin = (body.portalOrigin || req.query.portalOrigin || 'admin').toLowerCase() === 'staff' ? 'staff' : 'admin';

            if (!phone || phone.length !== 10) {
                return res.status(400).json({ success: false, message: 'A valid 10-digit mobile number is required.' });
            }

            // A. Check if Master Admin (9414503886 directly logs in)
            if (isMasterAdmin(phone)) {
                const masterAdminUser = {
                    id: 'master_admin_' + phone,
                    phone: phone,
                    fullName: fullName || 'Master Admin',
                    role: 'Master Admin',
                    portalOrigin: 'admin',
                    status: 'active',
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'Master Admin')}&background=ff6b00&color=fff`,
                    isApproved: true,
                    isMasterAdmin: true,
                    lastLoginAt: new Date().toISOString()
                };
                await saveStaffMember(phone, masterAdminUser);
                return res.status(200).json({
                    success: true,
                    isApproved: true,
                    isMasterAdmin: true,
                    role: 'Master Admin',
                    status: 'active',
                    portalOrigin: 'admin',
                    user: masterAdminUser,
                    message: 'Welcome Master Admin!'
                });
            }

            // B. Check existing staff record
            let existing = await getStaffMember(phone);

            // If existing and active
            if (existing && existing.status === 'active') {
                existing.lastLoginAt = new Date().toISOString();
                if (fullName && existing.fullName !== fullName) {
                    existing.fullName = fullName;
                }
                if (!existing.portalOrigin) {
                    existing.portalOrigin = portalOrigin;
                }
                await saveStaffMember(phone, existing);
                return res.status(200).json({
                    success: true,
                    isApproved: true,
                    isMasterAdmin: existing.role === 'Master Admin',
                    role: existing.role || (existing.portalOrigin === 'staff' ? 'Staff' : 'Admin'),
                    portalOrigin: existing.portalOrigin || portalOrigin,
                    status: 'active',
                    user: existing,
                    message: `Welcome back, ${existing.fullName || 'User'}!`
                });
            }

            // If existing and blocked
            if (existing && (existing.status === 'blocked' || existing.status === 'rejected')) {
                return res.status(200).json({
                    success: true,
                    isApproved: false,
                    isMasterAdmin: false,
                    role: existing.role || 'Blocked',
                    portalOrigin: existing.portalOrigin || portalOrigin,
                    status: 'blocked',
                    user: existing,
                    message: 'Access Denied: Your account has been permanently blocked by the Master Admin.'
                });
            }

            // C. New user or Pending user: Save access request with portal-specific default role
            const requestedRole = portalOrigin === 'staff' ? 'Staff' : 'Admin';
            const accessRequestRecord = {
                id: (existing && existing.id) || ((portalOrigin === 'staff' ? 'staff_' : 'admin_') + phone),
                phone: phone,
                fullName: fullName || (existing && existing.fullName) || (portalOrigin === 'staff' ? 'Staff Applicant' : 'Admin Applicant'),
                role: (existing && existing.role && existing.role !== 'Pending') ? existing.role : requestedRole,
                portalOrigin: (existing && existing.portalOrigin) || portalOrigin,
                status: 'pending',
                photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'Applicant')}&background=${portalOrigin === 'staff' ? '10b981' : '3b82f6'}&color=fff`,
                requestedAt: (existing && existing.requestedAt) || new Date().toISOString(),
                createdAt: (existing && existing.createdAt) || new Date().toISOString(),
                lastLoginAt: new Date().toISOString(),
            };

            await saveStaffMember(phone, accessRequestRecord);

            return res.status(200).json({
                success: true,
                isApproved: false,
                isMasterAdmin: false,
                role: accessRequestRecord.role,
                portalOrigin: accessRequestRecord.portalOrigin,
                status: 'pending',
                user: accessRequestRecord,
                message: 'Your access request has been submitted and is pending review by the Master Admin.'
            });
        }

        // 3. PATCH: Update a staff member's role or status (Admins & Master Admin)
        if (req.method === 'PATCH') {
            const requesterPhone = extractRequesterPhone(req);
            const isAuth = await isAuthorizedAdmin(requesterPhone);
            if (!isAuth) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Only active Administrators or Master Admin can modify team roles and approvals.'
                });
            }

            const requesterMember = await getStaffMember(requesterPhone);
            const isRequesterPrimaryMaster = (requesterPhone === MASTER_ADMIN_PHONE);
            const isRequesterSecondaryMaster = (!isRequesterPrimaryMaster && requesterMember && requesterMember.status === 'active' && requesterMember.role === 'Master Admin');
            const isRequesterMasterAdmin = isRequesterPrimaryMaster || isRequesterSecondaryMaster;
            const isRequesterStandardAdmin = (!isRequesterMasterAdmin && requesterMember && requesterMember.status === 'active' && requesterMember.role === 'Admin');

            const targetPhone = cleanPhone(body.targetPhone || body.phone || req.query.targetPhone || req.query.phone);
            if (!targetPhone || targetPhone.length !== 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid 10-digit target phone number to update.'
                });
            }

            // A. Absolute Protection for Primary Master Admin (9414503886):
            // No other admin or secondary Master Admin can delete, downgrade, revoke, or modify 9414503886.
            if (targetPhone === MASTER_ADMIN_PHONE && !isRequesterPrimaryMaster) {
                return res.status(403).json({
                    success: false,
                    message: 'Security Hierarchy Violation: The Primary Master Admin (9414503886) is strictly protected. No other administrator or secondary Master Admin can delete, downgrade, revoke, or modify this account.'
                });
            }

            let member = await getStaffMember(targetPhone);
            const isTargetSecondaryMaster = (targetPhone !== MASTER_ADMIN_PHONE && member && member.status === 'active' && member.role === 'Master Admin');

            const newRole = body.role || body.newRole;
            const newStatus = body.status || body.newStatus;
            const notes = body.notes;

            if (newRole && !VALID_ROLES.includes(newRole)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid role "${newRole}". Valid roles are: ${VALID_ROLES.join(', ')}`
                });
            }

            if (newStatus && !VALID_STATUSES.includes(newStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status "${newStatus}". Valid statuses are: ${VALID_STATUSES.join(', ')}`
                });
            }

            // B. Role-Based Permissions & Standard Admin Restrictions:
            const targetPortalOrigin = (member && member.portalOrigin) || ((body.portalOrigin || '').toLowerCase() === 'staff' ? 'staff' : (member && member.role === 'Staff' ? 'staff' : 'admin'));
            const targetRole = (member && member.role) || body.role || (targetPortalOrigin === 'staff' ? 'Staff' : 'Admin');
            const isTargetAdminTier = (targetRole === 'Admin' || targetRole === 'Master Admin' || targetPortalOrigin === 'admin');

            if (isRequesterStandardAdmin) {
                // 1. Standard Admins are strictly FORBIDDEN from blocking Admin or Master Admin users / applicants:
                if ((newStatus === 'blocked' || newStatus === 'rejected') && isTargetAdminTier) {
                    return res.status(403).json({
                        success: false,
                        message: 'Permission Denied: Standard Admins are strictly forbidden from blocking Admin or Master Admin users. Only Master Admins have privileges to block administrators.'
                    });
                }

                // 2. Standard Admins CANNOT promote anyone to Master Admin:
                if (newRole === 'Master Admin') {
                    return res.status(403).json({
                        success: false,
                        message: 'Permission Denied: Standard Admins cannot promote users to the Master Admin role. Only Master Admins can assign this role.'
                    });
                }

                // 3. Standard Admins CANNOT modify/demote existing active Admin or Master Admin accounts:
                if (member && member.status === 'active' && (member.role === 'Admin' || member.role === 'Master Admin') && targetPhone !== requesterPhone) {
                    return res.status(403).json({
                        success: false,
                        message: 'Permission Denied: Standard Admins cannot modify or reassign existing Administrator accounts. Only Master Admins can manage administrators.'
                    });
                }
            }

            // C. Secondary Master Admin Demotion Rules:
            // Only Primary Master Admin OR the Secondary Master Admin themselves (voluntary step down) can demote or revoke a Secondary Master Admin.
            if (isTargetSecondaryMaster && ((newRole && newRole !== 'Master Admin') || (newStatus && newStatus !== 'active'))) {
                if (!isRequesterPrimaryMaster && requesterPhone !== targetPhone) {
                    return res.status(403).json({
                        success: false,
                        message: 'Permission Denied: Only the Primary Master Admin (9414503886) can demote or revoke a Secondary Master Admin (or the Secondary Master Admin may voluntarily step down).'
                    });
                }
            }

            if (isMasterAdmin(targetPhone) && (newRole && newRole !== 'Master Admin' || (newStatus && newStatus !== 'active'))) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot demote or revoke the Primary Master Admin account.'
                });
            }

            // D. Enforce Strict Limit of Maximum 2 Master Admins:
            if (newRole === 'Master Admin' && newStatus !== 'rejected' && newStatus !== 'blocked') {
                const currentMasterCount = await countActiveMasterAdmins(targetPhone);
                if (currentMasterCount >= MAX_MASTER_ADMINS) {
                    return res.status(400).json({
                        success: false,
                        message: `Master Admin Limit Reached: The system allows a maximum of ${MAX_MASTER_ADMINS} Master Admins in total (currently at capacity). Please demote or remove an existing secondary Master Admin before appointing another.`
                    });
                }
            }

            const userPortalOrigin = (member && member.portalOrigin) || (member && member.role === 'Staff' ? 'staff' : 'admin');

            // E. Enforce Strict Role Constraints by Portal Origin:
            // 1. Staff Portal Origin Lock: Role can ONLY ever be 'Staff'
            if (userPortalOrigin === 'staff' && newRole && newRole !== 'Staff') {
                return res.status(400).json({
                    success: false,
                    message: 'Role Lock Constraint: Users registered through the Staff Portal are permanently locked to the Staff role and cannot be changed to Admin or Master Admin.'
                });
            }

            // 2. Admin Portal Origin Restriction: Role can ONLY be 'Admin' or 'Master Admin' (Never 'Staff')
            if (userPortalOrigin === 'admin' && newRole === 'Staff') {
                return res.status(400).json({
                    success: false,
                    message: 'Role Restriction: Users registered through the Admin Panel cannot be assigned the Staff role. Staff members must register exclusively through the Staff Portal.'
                });
            }

            if (!member) {
                member = {
                    id: (userPortalOrigin === 'staff' ? 'staff_' : 'admin_') + targetPhone,
                    phone: targetPhone,
                    fullName: body.fullName || `User ${targetPhone}`,
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(body.fullName || 'User')}&background=3b82f6&color=fff`,
                    role: newRole || (userPortalOrigin === 'staff' ? 'Staff' : 'Admin'),
                    portalOrigin: userPortalOrigin,
                    status: newStatus || 'pending',
                    createdAt: new Date().toISOString(),
                };
            }

            if (newRole) member.role = newRole;
            if (newStatus === 'blocked' || newStatus === 'rejected') {
                member.status = 'blocked';
                member.blockedAt = new Date().toISOString();
            } else if (newStatus) {
                member.status = newStatus;
            }
            if (notes) member.notes = notes;
            member.updatedAt = new Date().toISOString();
            if (newStatus === 'active') member.approvedAt = new Date().toISOString();
            member.reviewedBy = requesterPhone || MASTER_ADMIN_PHONE;

            await saveStaffMember(targetPhone, member);

            return res.status(200).json({
                success: true,
                message: `Staff member ${member.fullName || targetPhone} updated to role "${member.role}" with status "${member.status}".`,
                user: member,
            });
        }

        // 4. DELETE: Unblock / Purge / Remove a user or staff record from database
        if (req.method === 'DELETE') {
            const requesterPhone = extractRequesterPhone(req);
            const isRequesterPrimaryMaster = (requesterPhone === MASTER_ADMIN_PHONE);
            const requesterMember = requesterPhone ? await getStaffMember(requesterPhone) : null;
            const isRequesterMasterAdmin = isRequesterPrimaryMaster || (requesterMember && requesterMember.status === 'active' && requesterMember.role === 'Master Admin');
            const isRequesterActiveAdmin = isRequesterMasterAdmin || (requesterMember && requesterMember.status === 'active' && requesterMember.role === 'Admin');

            if (!isRequesterActiveAdmin && !isRequesterMasterAdmin && !isRequesterPrimaryMaster) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: You must be an active administrator to unblock or delete user records.'
                });
            }

            const targetPhone = cleanPhone(req.query.targetPhone || req.query.phone || body.targetPhone || body.phone);
            if (!targetPhone || targetPhone.length !== 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid 10-digit target phone number to unblock/delete.'
                });
            }

            if (targetPhone === MASTER_ADMIN_PHONE) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete or unblock the Primary Master Admin account.'
                });
            }

            let member = await getStaffMember(targetPhone);
            const isTargetSecondaryMaster = (targetPhone !== MASTER_ADMIN_PHONE && member && member.status === 'active' && member.role === 'Master Admin');
            if (isTargetSecondaryMaster && !isRequesterPrimaryMaster && requesterPhone !== targetPhone) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission Denied: Only the Primary Master Admin (9414503886) can delete or revoke a Secondary Master Admin.'
                });
            }

            // Standard Admins cannot unblock or delete Admin or Master Admin records
            const isRequesterStandardAdmin = (!isRequesterMasterAdmin && requesterMember && requesterMember.status === 'active' && requesterMember.role === 'Admin');
            if (isRequesterStandardAdmin) {
                const targetPortalOrigin = (member && member.portalOrigin) || (member && member.role === 'Staff' ? 'staff' : 'admin');
                const isTargetAdminTier = member && (member.role === 'Admin' || member.role === 'Master Admin' || targetPortalOrigin === 'admin');
                if (isTargetAdminTier) {
                    return res.status(403).json({
                        success: false,
                        message: 'Permission Denied: Standard Admins cannot unblock or delete Administrator accounts. Only Master Admins can manage administrator records.'
                    });
                }
            }

            global.__adminTeamStore.delete(targetPhone);
            await deleteFirestoreDoc('team', targetPhone);

            return res.status(200).json({
                success: true,
                message: `User record for +91 ${targetPhone} has been unblocked and permanently purged from database.`
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
    isMasterAdmin,
    MASTER_ADMIN_PHONE,
    VALID_ROLES,
    ASSIGNABLE_ROLES
};
