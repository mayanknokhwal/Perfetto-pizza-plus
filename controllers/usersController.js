/**
 * Perfetto Pizza - Users Controller
 * Powered by Firebase Firestore ('users' & 'orders' collections)
 * Handles customer profile lookup, home delivery address sync,
 * and cross-device data persistence via Phone Number and Firebase UID.
 */

const { getFirestoreDoc, setFirestoreDoc } = require('../lib/firestore');

/**
 * Main Users Request Handler (/api/users)
 */
async function handleUsersRequest(req, res) {
    try {
        let body = req.body || {};
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) { body = {}; }
        }

        // 1. GET: Lookup user profile from Firestore
        if (req.method === 'GET') {
            const { email, phone, firebaseUid } = req.query || {};

            if (!email && !phone && !firebaseUid) {
                return res.status(400).json({ success: false, message: 'Please provide phone, email, or firebaseUid' });
            }

            const cleanEmail = email ? email.toLowerCase().trim() : '';
            const cleanPhone = phone ? phone.replace(/[^0-9]/g, '').slice(-10) : '';
            const cleanUid = firebaseUid ? firebaseUid.trim() : '';

            let user = null;

            // Check Firestore doc directly by phone or key
            if (cleanPhone) {
                user = await getFirestoreDoc('users', `phone_${cleanPhone}`);
            }
            if (!user && cleanUid) {
                user = await getFirestoreDoc('users', `uid_${cleanUid}`);
            }
            if (!user && cleanEmail) {
                user = await getFirestoreDoc('users', cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'));
            }

            // Fallback search in memory cache
            if (!user) {
                user = global.__perfettoUsersList.find(u => {
                    if (cleanPhone && u.phone && u.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone) return true;
                    if (cleanUid && u.firebaseUid === cleanUid) return true;
                    if (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) return true;
                    return false;
                });
            }

            if (!user) {
                return res.status(404).json({ success: false, message: 'User profile not found' });
            }

            const lat = (user.gps && user.gps.lat !== undefined && user.gps.lat !== null) ? parseFloat(user.gps.lat) : ((user.gpsLat !== undefined && user.gpsLat !== null) ? parseFloat(user.gpsLat) : null);
            const lng = (user.gps && user.gps.lng !== undefined && user.gps.lng !== null) ? parseFloat(user.gps.lng) : ((user.gpsLng !== undefined && user.gpsLng !== null) ? parseFloat(user.gpsLng) : null);

            const normalizedUser = {
                ...user,
                gpsLat: lat,
                gpsLng: lng,
                gps: { lat, lng },
            };

            return res.status(200).json({
                success: true,
                user: normalizedUser
            });
        }

        // 2. POST: Upsert User Profile into Firestore
        if (req.method === 'POST') {
            if (!body || Object.keys(body).length === 0) {
                return res.status(400).json({ success: false, message: 'Missing or invalid user payload' });
            }

            const cleanPhone = body.phone ? body.phone.replace(/[^0-9]/g, '').slice(-10) : '';
            const cleanEmail = body.email ? body.email.toLowerCase().trim() : '';
            const cleanUid = body.firebaseUid || '';

            if (!cleanPhone && !cleanEmail && !cleanUid) {
                return res.status(400).json({ success: false, message: 'User must have phone number, email, or firebaseUid' });
            }

            const parsedLat = (body.gps && body.gps.lat !== undefined && body.gps.lat !== null) ? parseFloat(body.gps.lat) : ((body.gpsLat !== undefined && body.gpsLat !== null) ? parseFloat(body.gpsLat) : null);
            const parsedLng = (body.gps && body.gps.lng !== undefined && body.gps.lng !== null) ? parseFloat(body.gps.lng) : ((body.gpsLng !== undefined && body.gpsLng !== null) ? parseFloat(body.gpsLng) : null);

            const userProfile = {
                firebaseUid: cleanUid,
                fullName: body.fullName ? body.fullName.trim() : 'Customer',
                phone: cleanPhone,
                email: cleanEmail,
                photoURL: body.photoURL || '',
                address: typeof body.address === 'object' ? body.address : {
                    colonyName: body.colonyName || '',
                    nearBy: body.nearBy || '',
                    streetName: body.streetName || '',
                    wardNo: body.wardNo || '',
                },
                gpsLat: parsedLat,
                gpsLng: parsedLng,
                gps: { lat: parsedLat, lng: parsedLng },
                isPhoneVerified: body.isPhoneVerified !== undefined ? Boolean(body.isPhoneVerified) : true,
                cartState: Array.isArray(body.cartState) ? body.cartState : (body.cart || []),
                lastLoginAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // Update in-memory
            const existingIdx = global.__perfettoUsersList.findIndex(u => {
                if (cleanPhone && u.phone === cleanPhone) return true;
                if (cleanUid && u.firebaseUid === cleanUid) return true;
                if (cleanEmail && u.email === cleanEmail) return true;
                return false;
            });

            if (existingIdx >= 0) {
                global.__perfettoUsersList[existingIdx] = {
                    ...global.__perfettoUsersList[existingIdx],
                    ...userProfile,
                };
            } else {
                global.__perfettoUsersList.push(userProfile);
            }

            // Sync to Firestore under phone key
            if (cleanPhone) {
                try {
                    await setFirestoreDoc('users', `phone_${cleanPhone}`, userProfile);
                } catch (e) {
                    console.error('CRITICAL: Firestore user phone sync error:', e.message);
                }
            }
            if (cleanEmail) {
                try {
                    await setFirestoreDoc('users', cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'), userProfile);
                } catch (e) {
                    console.error('CRITICAL: Firestore user email sync error:', e.message);
                }
            }

            return res.status(200).json({
                success: true,
                message: 'User profile persisted to Firebase Firestore',
                user: userProfile,
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('Error in handleUsersRequest:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal Server Error',
        });
    }
}

module.exports = {
    handleUsersRequest
};
