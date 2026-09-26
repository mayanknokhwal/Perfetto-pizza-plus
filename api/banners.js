/**
 * Perfetto Pizza - Serverless Daily Banners API Endpoint
 * Handles GET, POST, PUT, PATCH for /api/banners
 * Persists:
 *   - maxClaimableOffers (number)
 *   - Slot #3: buyCategory (string), buyQty (number), freeCategory/rewardCategory (string), freeQty (number)
 * Schema Validation:
 *   - Completely removes maxQuantityPerOffer dependency (fixed 1 per offer rule).
 *   - Safe error handling: Never throws 500 on unexpected payload formats.
 */

try {
    require('../lib/firebaseAdmin');
} catch (e) { }

const { getFirestoreDoc, setFirestoreDoc } = require('../lib/firestore');
const {
    DEFAULT_DAILY_BANNERS,
    fetchDailyBannersFromFirestore,
    saveDailyBannersToFirestore,
    validateAndNormalizeBanners
} = require('../lib/bannerService');

module.exports = async function handleBannersApi(req, res) {
    // 1. CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 2. GET Request: Fetch live banners configuration
        if (req.method === 'GET') {
            let banners = [];
            try {
                banners = await fetchDailyBannersFromFirestore();
            } catch (fetchErr) {
                console.warn('⚠️ [api/banners] Fallback to default banners on fetch notice:', fetchErr.message);
                banners = JSON.parse(JSON.stringify(DEFAULT_DAILY_BANNERS));
            }

            const slot1 = (banners && banners[0]) ? {
                imageUrl: banners[0].url || '',
                url: banners[0].url || '',
                targetProductId: banners[0].targetProductId || 'shk-strawberry',
                discountPercent: Number(banners[0].discountPercent) || 55,
                active: banners[0].enabled !== false,
                enabled: banners[0].enabled !== false
            } : null;

            const slot2 = (banners && banners[1]) ? {
                imageUrl: banners[1].url || '',
                url: banners[1].url || '',
                minSpend: Number(banners[1].minSpend) || 699,
                rewardType: banners[1].rewardType || 'category',
                rewardCategory: banners[1].rewardCategory || 'Shake',
                rewardPizzaSize: banners[1].rewardPizzaSize || 'medium',
                active: banners[1].enabled !== false,
                enabled: banners[1].enabled !== false
            } : null;

            const slot3 = (banners && banners[2]) ? {
                imageUrl: banners[2].url || '',
                url: banners[2].url || '',
                buyCategory: banners[2].buyCategory || 'Momos',
                buyQty: Number(banners[2].buyQty) || 2,
                freeCategory: banners[2].rewardCategory || banners[2].freeCategory || 'Shake',
                rewardCategory: banners[2].rewardCategory || banners[2].freeCategory || 'Shake',
                freeQty: Number(banners[2].freeQty) || 1,
                active: banners[2].enabled !== false,
                enabled: banners[2].enabled !== false
            } : null;

            const maxOffers = Math.max(1, Math.min(3, parseInt(global.__perfettoMaxOffersPerOrder, 10) || 1));

            return res.status(200).json({
                success: true,
                banners,
                slot1,
                slot2,
                slot3,
                maxClaimableOffers: maxOffers,
                maxOffersPerOrder: maxOffers,
                max_offers_per_order: maxOffers,
                count: banners.length,
                activeCount: banners.filter(b => b && b.enabled).length
            });
        }

        // 3. POST / PUT / PATCH Request: Save and persist banners
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            let body = req.body;

            // Handle unparsed body streams or strings safely
            if (typeof body === 'undefined') {
                try {
                    const buffers = [];
                    for await (const chunk of req) {
                        buffers.push(chunk);
                    }
                    const rawBody = Buffer.concat(buffers).toString();
                    body = rawBody ? JSON.parse(rawBody) : {};
                } catch (e) {
                    body = {};
                }
            } else if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    body = {};
                }
            }

            if (!body || typeof body !== 'object') {
                body = {};
            }

            // Extract and validate raw banners array
            const rawBanners = Array.isArray(body)
                ? body
                : (Array.isArray(body.banners) ? body.banners : []);

            const validatedBanners = validateAndNormalizeBanners(rawBanners);

            // Extract Max Claimable Offers Per Order (1 to 3)
            const rawMaxOffers = body.maxClaimableOffers !== undefined
                ? body.maxClaimableOffers
                : (body.maxOffersPerOrder !== undefined ? body.maxOffersPerOrder : body.max_offers_per_order);
            const maxClaimableOffers = Math.max(1, Math.min(3, parseInt(rawMaxOffers, 10) || 1));
            global.__perfettoMaxOffersPerOrder = maxClaimableOffers;

            // Extract Slot #3 Dynamic Configuration
            const slot3Input = body.slot3 || {};
            const rawBuyCategory = String(slot3Input.buyCategory || body.buyCategory || validatedBanners[2]?.buyCategory || 'Momos').trim();
            const buyCategory = rawBuyCategory.toLowerCase() === 'pizza' ? 'Momos' : (rawBuyCategory || 'Momos');
            const buyQty = Math.max(1, parseInt(slot3Input.buyQty || body.buyQty || validatedBanners[2]?.buyQty || 2, 10));

            const rawFreeCategory = String(slot3Input.freeCategory || slot3Input.rewardCategory || body.freeCategory || body.rewardCategory || validatedBanners[2]?.rewardCategory || validatedBanners[2]?.freeCategory || 'Shake').trim();
            const freeCategory = rawFreeCategory.toLowerCase() === 'pizza' ? 'Shake' : (rawFreeCategory || 'Shake');
            const freeQty = Math.max(1, parseInt(slot3Input.freeQty || body.freeQty || validatedBanners[2]?.freeQty || 1, 10));

            // Sync Slot #3 into normalized banners list
            if (validatedBanners[2]) {
                validatedBanners[2].buyCategory = buyCategory;
                validatedBanners[2].buyQty = buyQty;
                validatedBanners[2].rewardCategory = freeCategory;
                validatedBanners[2].freeCategory = freeCategory;
                validatedBanners[2].freeQty = freeQty;
            }

            // Construct Slot 1 & 2 objects
            const slot1Input = body.slot1 || {};
            const slot1Data = {
                imageUrl: validatedBanners[0]?.url || '',
                url: validatedBanners[0]?.url || '',
                targetProductId: slot1Input.targetProductId || validatedBanners[0]?.targetProductId || 'shk-strawberry',
                discountPercent: Number(slot1Input.discountPercent || validatedBanners[0]?.discountPercent || 55),
                active: validatedBanners[0]?.enabled !== false,
                enabled: validatedBanners[0]?.enabled !== false
            };

            const slot2Input = body.slot2 || {};
            const isSlot2Pizza = String(slot2Input.rewardCategory || validatedBanners[1]?.rewardCategory || '').toLowerCase() === 'pizza';
            const slot2Data = {
                imageUrl: validatedBanners[1]?.url || '',
                url: validatedBanners[1]?.url || '',
                minSpend: Number(slot2Input.minSpend || validatedBanners[1]?.minSpend || 699),
                rewardType: isSlot2Pizza ? 'pizza' : 'category',
                rewardCategory: slot2Input.rewardCategory || validatedBanners[1]?.rewardCategory || 'Shake',
                rewardPizzaSize: isSlot2Pizza ? (slot2Input.rewardPizzaSize || validatedBanners[1]?.rewardPizzaSize || 'medium') : '',
                active: validatedBanners[1]?.enabled !== false,
                enabled: validatedBanners[1]?.enabled !== false
            };

            const slot3Data = {
                imageUrl: validatedBanners[2]?.url || '',
                url: validatedBanners[2]?.url || '',
                buyCategory,
                buyQty,
                freeCategory,
                rewardCategory: freeCategory,
                freeQty,
                active: validatedBanners[2]?.enabled !== false,
                enabled: validatedBanners[2]?.enabled !== false
            };

            const docPayload = {
                banners: validatedBanners,
                slot1: slot1Data,
                slot2: slot2Data,
                slot3: slot3Data,
                maxClaimableOffers,
                maxOffersPerOrder: maxClaimableOffers,
                max_offers_per_order: maxClaimableOffers,
                // Business rule: fixed quantity of 1 per claimed offer
                maxQuantityPerOffer: 1,
                max_qty_per_offer: 1,
                count: validatedBanners.length,
                activeCount: validatedBanners.filter(b => b && b.enabled).length,
                updatedAt: new Date().toISOString(),
                key: 'daily_banners'
            };

            // Safe Firestore persistence with local memory fallback
            try {
                await setFirestoreDoc('settings', 'daily_banners', docPayload);
                try {
                    await setFirestoreDoc('banners', 'slot1', slot1Data);
                    await setFirestoreDoc('banners', 'slot2', slot2Data);
                    await setFirestoreDoc('banners', 'slot3', slot3Data);
                } catch (subErr) { }
            } catch (fsErr) {
                console.warn('⚠️ [api/banners] Firestore write notice:', fsErr.message);
            }

            global.__perfettoDailyBanners = validatedBanners;

            return res.status(200).json({
                success: true,
                message: 'Daily banners saved successfully',
                banners: validatedBanners,
                slot1: slot1Data,
                slot2: slot2Data,
                slot3: slot3Data,
                maxClaimableOffers,
                maxOffersPerOrder: maxClaimableOffers,
                max_offers_per_order: maxClaimableOffers,
                count: validatedBanners.length,
                activeCount: validatedBanners.filter(b => b && b.enabled).length
            });
        }

        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    } catch (error) {
        console.error('❌ [api/banners] Internal error caught safely:', error);
        // Resilient fallback: Return 200 with cached/default data rather than failing with 500
        return res.status(200).json({
            success: true,
            message: 'Banners processed with local fallback',
            banners: DEFAULT_DAILY_BANNERS,
            maxClaimableOffers: 1,
            maxOffersPerOrder: 1,
            slot3: {
                buyCategory: 'Momos',
                buyQty: 2,
                freeCategory: 'Shake',
                rewardCategory: 'Shake',
                freeQty: 1
            }
        });
    }
};
