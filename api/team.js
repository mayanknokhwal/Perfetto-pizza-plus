/**
 * Vercel Serverless Function: Team & Role Management API
 * Route: /api/team
 * Handles Google Sign-In Authentication verification, First-User Master Admin assignment,
 * and Full Team Member CRUD operations with MongoDB Atlas persistence and fallback resilience.
 */

const { connectToDatabase } = require('./lib/mongodb');
const TeamMember = require('./models/TeamMember');

// Global in-memory fallback state for offline / local network multi-device syncing
if (!global.__perfettoTeamState) {
    global.__perfettoTeamState = [];
}

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const db = await connectToDatabase();

        // --------------------------------------------------------------------------
        // 1. GET: Retrieve All Team Members
        // --------------------------------------------------------------------------
        if (req.method === 'GET') {
            if (!db) {
                return res.status(200).json({
                    success: true,
                    isFallback: true,
                    members: global.__perfettoTeamState,
                    count: global.__perfettoTeamState.length
                });
            }

            const members = await TeamMember.find({}).sort({ isMasterAdmin: -1, createdAt: 1 }).lean();
            global.__perfettoTeamState = members;

            return res.status(200).json({
                success: true,
                isFallback: false,
                members,
                count: members.length
            });
        }

        // --------------------------------------------------------------------------
        // 2. POST: Google Auth Verification OR Add Team Member
        // --------------------------------------------------------------------------
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            if (!body) {
                return res.status(400).json({ success: false, message: 'Missing request payload' });
            }

            const { action, email, fullName, photoURL, firebaseUid, portal, role, status, addedBy } = body;

            // ----------------------------------------------------------------------
            // 2A. GOOGLE AUTHENTICATION VERIFICATION
            // ----------------------------------------------------------------------
            if (action === 'auth') {
                if (!email) {
                    return res.status(400).json({ success: false, message: 'Google email is required for verification' });
                }

                const cleanEmail = email.toLowerCase().trim();

                if (!db) {
                    // Fallback in-memory / local storage mode
                    if (!global.__perfettoTeamState || global.__perfettoTeamState.length === 0) {
                        const firstMaster = {
                            _id: 'mem_' + Date.now(),
                            id: 'mem_' + Date.now(),
                            email: cleanEmail,
                            fullName: fullName || 'Master Admin',
                            photoURL: photoURL || '',
                            firebaseUid: firebaseUid || '',
                            role: 'Master Admin',
                            status: 'Active',
                            isMasterAdmin: true,
                            addedBy: 'system',
                            lastLoginAt: new Date(),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };
                        global.__perfettoTeamState = [firstMaster];
                        return res.status(200).json({
                            success: true,
                            authorized: true,
                            isFirstUser: true,
                            isMasterAdmin: true,
                            user: firstMaster,
                            message: '🎉 Welcome Master Admin! You are the primary administrator.'
                        });
                    }

                    const existing = global.__perfettoTeamState.find(m => m.email.toLowerCase() === cleanEmail);
                    if (!existing) {
                        return res.status(200).json({
                            success: false,
                            authorized: false,
                            isUnregistered: true,
                            message: `Access Denied: ${cleanEmail} is not registered as a team member. Please ask Master Admin to add you.`
                        });
                    }

                    if (existing.status !== 'Active') {
                        return res.status(200).json({
                            success: false,
                            authorized: false,
                            message: 'Your account has been deactivated. Please contact the Master Admin.'
                        });
                    }

                    // Check portal access
                    if (portal === 'admin' && existing.role !== 'Master Admin' && existing.role !== 'Admin') {
                        return res.status(200).json({
                            success: false,
                            authorized: false,
                            message: `Access Denied: Your assigned role (${existing.role}) does not have access to the Admin Dashboard.`
                        });
                    }

                    existing.fullName = fullName || existing.fullName;
                    existing.photoURL = photoURL || existing.photoURL;
                    existing.firebaseUid = firebaseUid || existing.firebaseUid;
                    existing.lastLoginAt = new Date();

                    return res.status(200).json({
                        success: true,
                        authorized: true,
                        isMasterAdmin: !!existing.isMasterAdmin,
                        user: existing
                    });
                }

                // Database Mode: Count total existing team members
                const totalMembersCount = await TeamMember.countDocuments();
                const masterAdminCount = await TeamMember.countDocuments({ isMasterAdmin: true });

                // FIRST-USER LOGIC: If database has 0 members or 0 Master Admins, assign Master Admin
                if (totalMembersCount === 0 || masterAdminCount === 0) {
                    let masterUser = await TeamMember.findOne({ email: cleanEmail });
                    if (!masterUser) {
                        masterUser = new TeamMember({
                            email: cleanEmail,
                            fullName: fullName || 'Master Admin',
                            photoURL: photoURL || '',
                            firebaseUid: firebaseUid || '',
                            role: 'Master Admin',
                            status: 'Active',
                            isMasterAdmin: true,
                            addedBy: 'system',
                            lastLoginAt: new Date()
                        });
                        await masterUser.save();
                    } else {
                        masterUser.role = 'Master Admin';
                        masterUser.isMasterAdmin = true;
                        masterUser.status = 'Active';
                        masterUser.fullName = fullName || masterUser.fullName;
                        masterUser.photoURL = photoURL || masterUser.photoURL;
                        masterUser.firebaseUid = firebaseUid || masterUser.firebaseUid;
                        masterUser.lastLoginAt = new Date();
                        await masterUser.save();
                    }

                    // Update memory state
                    const allMembers = await TeamMember.find({}).sort({ isMasterAdmin: -1, createdAt: 1 }).lean();
                    global.__perfettoTeamState = allMembers;

                    return res.status(200).json({
                        success: true,
                        authorized: true,
                        isFirstUser: true,
                        isMasterAdmin: true,
                        user: masterUser,
                        message: '🎉 Welcome Master Admin! You are registered as the primary administrator.'
                    });
                }

                // Subsequent Users: Check team registration
                const existingUser = await TeamMember.findOne({ email: cleanEmail });

                if (!existingUser) {
                    return res.status(200).json({
                        success: false,
                        authorized: false,
                        isUnregistered: true,
                        message: `Access Denied: ${cleanEmail} is not registered in the Team. Please ask the Master Admin to invite you.`
                    });
                }

                if (existingUser.status !== 'Active') {
                    return res.status(200).json({
                        success: false,
                        authorized: false,
                        message: 'Your account is deactivated. Please contact the Master Admin.'
                    });
                }

                // Check portal-specific permission
                if (portal === 'admin' && existingUser.role !== 'Master Admin' && existingUser.role !== 'Admin') {
                    return res.status(200).json({
                        success: false,
                        authorized: false,
                        message: `Access Denied: Your assigned role (${existingUser.role}) does not have access to the Admin Management Dashboard.`
                    });
                }

                // Update latest Google profile info
                existingUser.fullName = fullName || existingUser.fullName;
                existingUser.photoURL = photoURL || existingUser.photoURL;
                if (firebaseUid) existingUser.firebaseUid = firebaseUid;
                existingUser.lastLoginAt = new Date();
                await existingUser.save();

                return res.status(200).json({
                    success: true,
                    authorized: true,
                    isMasterAdmin: !!existingUser.isMasterAdmin,
                    user: existingUser
                });
            }

            // ----------------------------------------------------------------------
            // 2B. ADD NEW TEAM MEMBER
            // ----------------------------------------------------------------------
            if (!email) {
                return res.status(400).json({ success: false, message: 'Staff email is required' });
            }

            const cleanEmail = email.toLowerCase().trim();
            const assignedRole = role || 'Chef';
            const memberStatus = status || 'Active';
            const isMaster = assignedRole === 'Master Admin';

            if (!db) {
                const existing = global.__perfettoTeamState.find(m => m.email.toLowerCase() === cleanEmail);
                if (existing) {
                    return res.status(400).json({ success: false, message: 'A team member with this email already exists' });
                }

                const newMem = {
                    _id: 'mem_' + Date.now(),
                    id: 'mem_' + Date.now(),
                    email: cleanEmail,
                    fullName: fullName || cleanEmail.split('@')[0],
                    photoURL: photoURL || '',
                    role: assignedRole,
                    status: memberStatus,
                    isMasterAdmin: isMaster,
                    addedBy: addedBy || 'Admin',
                    lastLoginAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                global.__perfettoTeamState.push(newMem);
                return res.status(201).json({ success: true, message: 'Team member added successfully', member: newMem });
            }

            const alreadyExists = await TeamMember.findOne({ email: cleanEmail });
            if (alreadyExists) {
                return res.status(400).json({ success: false, message: 'A team member with this email already exists' });
            }

            const newMember = new TeamMember({
                email: cleanEmail,
                fullName: fullName || cleanEmail.split('@')[0],
                photoURL: photoURL || '',
                role: assignedRole,
                status: memberStatus,
                isMasterAdmin: isMaster,
                addedBy: addedBy || 'Admin',
            });

            await newMember.save();

            const allMembers = await TeamMember.find({}).sort({ isMasterAdmin: -1, createdAt: 1 }).lean();
            global.__perfettoTeamState = allMembers;

            return res.status(201).json({
                success: true,
                message: 'Team member added successfully',
                member: newMember
            });
        }

        // --------------------------------------------------------------------------
        // 3. PATCH: Update Member Role, Status, or Profile
        // --------------------------------------------------------------------------
        if (req.method === 'PATCH') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            if (!body || (!body.id && !body.email)) {
                return res.status(400).json({ success: false, message: 'Member id or email is required' });
            }

            const cleanEmail = body.email ? body.email.toLowerCase().trim() : null;

            if (!db) {
                const index = global.__perfettoTeamState.findIndex(m =>
                    (body.id && (m._id === body.id || m.id === body.id)) ||
                    (cleanEmail && m.email.toLowerCase() === cleanEmail)
                );

                if (index === -1) {
                    return res.status(404).json({ success: false, message: 'Team member not found' });
                }

                if (global.__perfettoTeamState[index].isMasterAdmin && body.status === 'Inactive') {
                    return res.status(400).json({ success: false, message: 'Master Admin cannot be deactivated' });
                }

                if (body.role) {
                    global.__perfettoTeamState[index].role = body.role;
                    global.__perfettoTeamState[index].isMasterAdmin = (body.role === 'Master Admin');
                }
                if (body.status) global.__perfettoTeamState[index].status = body.status;
                if (body.fullName) global.__perfettoTeamState[index].fullName = body.fullName;
                global.__perfettoTeamState[index].updatedAt = new Date();

                return res.status(200).json({
                    success: true,
                    message: 'Team member updated successfully',
                    member: global.__perfettoTeamState[index]
                });
            }

            const filter = body.id ? { _id: body.id } : { email: cleanEmail };
            const existing = await TeamMember.findOne(filter);

            if (!existing) {
                return res.status(404).json({ success: false, message: 'Team member not found' });
            }

            if (existing.isMasterAdmin && body.status === 'Inactive') {
                return res.status(400).json({ success: false, message: 'Master Admin cannot be deactivated' });
            }

            if (body.role) {
                existing.role = body.role;
                existing.isMasterAdmin = (body.role === 'Master Admin');
            }
            if (body.status) existing.status = body.status;
            if (body.fullName) existing.fullName = body.fullName;

            await existing.save();

            const allMembers = await TeamMember.find({}).sort({ isMasterAdmin: -1, createdAt: 1 }).lean();
            global.__perfettoTeamState = allMembers;

            return res.status(200).json({
                success: true,
                message: 'Team member updated successfully',
                member: existing
            });
        }

        // --------------------------------------------------------------------------
        // 4. DELETE: Remove Team Member
        // --------------------------------------------------------------------------
        if (req.method === 'DELETE') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            const targetId = (body && body.id) || req.query.id;
            const targetEmail = (body && body.email) || req.query.email;

            if (!targetId && !targetEmail) {
                return res.status(400).json({ success: false, message: 'Member id or email is required' });
            }

            const cleanEmail = targetEmail ? targetEmail.toLowerCase().trim() : null;

            if (!db) {
                const member = global.__perfettoTeamState.find(m =>
                    (targetId && (m._id === targetId || m.id === targetId)) ||
                    (cleanEmail && m.email.toLowerCase() === cleanEmail)
                );

                if (!member) {
                    return res.status(404).json({ success: false, message: 'Team member not found' });
                }

                if (member.isMasterAdmin) {
                    return res.status(400).json({ success: false, message: 'Master Admin cannot be removed' });
                }

                global.__perfettoTeamState = global.__perfettoTeamState.filter(m => m !== member);
                return res.status(200).json({ success: true, message: 'Team member deleted successfully' });
            }

            const filter = targetId ? { _id: targetId } : { email: cleanEmail };
            const member = await TeamMember.findOne(filter);

            if (!member) {
                return res.status(404).json({ success: false, message: 'Team member not found' });
            }

            if (member.isMasterAdmin) {
                return res.status(400).json({ success: false, message: 'Master Admin cannot be removed' });
            }

            await TeamMember.deleteOne(filter);

            const allMembers = await TeamMember.find({}).sort({ isMasterAdmin: -1, createdAt: 1 }).lean();
            global.__perfettoTeamState = allMembers;

            return res.status(200).json({ success: true, message: 'Team member removed successfully' });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in /api/team handler:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error'
        });
    }
};
