/**
 * Comprehensive Verification Suite for Admin Store Settings State Persistence & Atomic Toggles
 * Tests that toggling Shop Status or Auto-Schedule Mode:
 * 1. Uses atomic document updates ({ merge: true }) updating ONLY 'isOpen', 'isStoreOpen', 'shopStatus', 'autoSchedule'
 * 2. Never overwrites configured settings with default fallback objects (80, 500, 9414503886, etc.)
 * 3. Keeps zone delivery charges, contact info, thresholds, and operational hours 100% intact in-memory
 * 4. Ensures Firestore REST setFirestoreDoc properly builds updateMask query parameters
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 VERIFY ADMIN STORE SETTINGS TOGGLES & STATE PERSISTENCE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(testName, fn) {
    totalTests++;
    try {
        await fn();
        passedTests++;
        console.log(`✅ PASS: [${totalTests}] ${testName}`);
    } catch (err) {
        console.error(`❌ FAIL: [${totalTests}] ${testName}`);
        console.error(`   ${err.message}`);
    }
}

// Dynamic import of admin.js module
(async function runAll() {
    const adminModule = await import('../admin.js');
    const {
        DEFAULT_STORE_SETTINGS,
        adminStoreSettingsState,
        getAdminStoreSettings,
        setAdminStoreSettings,
        applyAdminStoreSettings,
        updateShopStatus,
        toggleShopStatus,
        updateAutoScheduleMode,
        toggleAutoSchedule
    } = adminModule;

    // Test 1: Baseline non-default state initialization
    await runTest('Preload custom configured store settings and verify state', async () => {
        const customSettings = {
            minOrderValue: 250,
            freeDeliveryThreshold: 1200,
            freeDeliveryLimit: 1200,
            customerCarePhone: '9876543210',
            customerCareEnabled: false,
            deliveryRadius: 8.5,
            deliveryRadiusKm: 8.5,
            inStoreThreshold: 0.12,
            in_store_threshold: 0.12,
            operatingHours: {
                openingTime: '09:30',
                closingTime: '23:30'
            },
            openingTime: '09:30',
            closingTime: '23:30',
            storeCoordinates: {
                latitude: 28.123456,
                longitude: 75.654321
            },
            flexibleZones: {
                zone1: 15, zone2: 25, zone3: 35, zone4: 45, zone5: 55,
                zone6: 65, zone7: 75, zone8: 85, zone9: 95, zone10: 105
            },
            zoneCharges: {
                zone1: 15, zone2: 25, zone3: 35, zone4: 45, zone5: 55,
                zone6: 65, zone7: 75, zone8: 85, zone9: 95, zone10: 105
            },
            isOpen: true,
            isStoreOpen: true,
            shopStatus: 'open',
            autoSchedule: false,
            autoScheduleMode: false,
            autoScheduleEnabled: false
        };

        setAdminStoreSettings(customSettings, false);
        const state = getAdminStoreSettings();

        assert.strictEqual(state.minOrderValue, 250);
        assert.strictEqual(state.freeDeliveryThreshold, 1200);
        assert.strictEqual(state.customerCarePhone, '9876543210');
        assert.strictEqual(state.flexibleZones.zone1, 15);
        assert.strictEqual(state.flexibleZones.zone10, 105);
        assert.strictEqual(state.inStoreThreshold, 0.12);
        assert.strictEqual(state.operatingHours.openingTime, '09:30');
    });

    // Test 2: Toggle Shop Status from Open to Closed
    await runTest('updateShopStatus("closed") executes atomic merge without overwriting config values', async () => {
        let capturedWrites = [];
        const mockDb = {
            collection: (col) => ({
                doc: (docId) => ({
                    set: async (payload, opts) => {
                        capturedWrites.push({ col, docId, payload, opts });
                    }
                })
            })
        };

        let backendSyncedPayload = null;
        const mockBackendSync = async (payload) => {
            backendSyncedPayload = payload;
        };

        const res = await updateShopStatus('closed', {
            db: mockDb,
            syncToBackend: mockBackendSync,
            manualCloseDate: '2026-09-16'
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.updatedFields.isOpen, false);
        assert.strictEqual(res.updatedFields.isStoreOpen, false);
        assert.strictEqual(res.updatedFields.shopStatus, 'closed');
        assert.strictEqual(res.updatedFields.manualCloseDate, '2026-09-16');

        // Verify payload does NOT contain any default constants
        assert.strictEqual(res.updatedFields.minOrderValue, undefined);
        assert.strictEqual(res.updatedFields.freeDeliveryThreshold, undefined);
        assert.strictEqual(res.updatedFields.customerCarePhone, undefined);
        assert.strictEqual(res.updatedFields.flexibleZones, undefined);

        // Verify mock Firestore writes were executed with merge: true across storeSettings and store_config
        assert.strictEqual(capturedWrites.length, 2);
        assert.strictEqual(capturedWrites[0].docId, 'storeSettings');
        assert.strictEqual(capturedWrites[0].opts.merge, true);
        assert.strictEqual(capturedWrites[0].payload.isOpen, false);
        assert.strictEqual(capturedWrites[0].payload.isStoreOpen, false);
        assert.strictEqual(capturedWrites[0].payload.shopStatus, 'closed');
        assert.strictEqual(capturedWrites[0].payload.minOrderValue, undefined);

        assert.strictEqual(capturedWrites[1].docId, 'store_config');
        assert.strictEqual(capturedWrites[1].opts.merge, true);

        // Verify backend sync received ONLY atomic fields
        assert.deepStrictEqual(backendSyncedPayload, res.updatedFields);

        // CRITICAL: Verify in-memory state retained ALL configured values!
        const state = getAdminStoreSettings();
        assert.strictEqual(state.isOpen, false);
        assert.strictEqual(state.isStoreOpen, false);
        assert.strictEqual(state.shopStatus, 'closed');
        assert.strictEqual(state.minOrderValue, 250, 'minOrderValue must not reset to 80!');
        assert.strictEqual(state.freeDeliveryThreshold, 1200, 'freeDeliveryThreshold must not reset to 500!');
        assert.strictEqual(state.customerCarePhone, '9876543210', 'customerCarePhone must not reset to 9414503886!');
        assert.strictEqual(state.flexibleZones.zone1, 15, 'zone1 charge must not reset to 0!');
        assert.strictEqual(state.flexibleZones.zone10, 105, 'zone10 charge must not reset to 0!');
        assert.strictEqual(state.inStoreThreshold, 0.12, 'inStoreThreshold must not reset to 0.05!');
        assert.strictEqual(state.storeCoordinates.latitude, 28.123456, 'latitude must not reset!');
        assert.strictEqual(state.operatingHours.openingTime, '09:30', 'openingTime must not reset to 11:00!');
        assert.strictEqual(state.operatingHours.closingTime, '23:30', 'closingTime must not reset to 23:00!');
    });

    // Test 3: Toggle Shop Status back from Closed to Open
    await runTest('toggleShopStatus() toggles back to Open and clears manualCloseDate while retaining values', async () => {
        let capturedWrites = [];
        const mockDb = {
            collection: (col) => ({
                doc: (docId) => ({
                    set: async (payload, opts) => {
                        capturedWrites.push({ col, docId, payload, opts });
                    }
                })
            })
        };

        const res = await toggleShopStatus({ db: mockDb });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.updatedFields.isOpen, true);
        assert.strictEqual(res.updatedFields.isStoreOpen, true);
        assert.strictEqual(res.updatedFields.shopStatus, 'open');
        assert.strictEqual(res.updatedFields.manualCloseDate, null);

        // In-memory state check
        const state = getAdminStoreSettings();
        assert.strictEqual(state.isOpen, true);
        assert.strictEqual(state.isStoreOpen, true);
        assert.strictEqual(state.shopStatus, 'open');
        assert.strictEqual(state.minOrderValue, 250);
        assert.strictEqual(state.freeDeliveryThreshold, 1200);
        assert.strictEqual(state.customerCarePhone, '9876543210');
        assert.strictEqual(state.flexibleZones.zone1, 15);
        assert.strictEqual(state.inStoreThreshold, 0.12);
    });

    // Test 4: Update Auto-Schedule Mode
    await runTest('updateAutoScheduleMode(true) updates ONLY autoSchedule fields with merge: true', async () => {
        let capturedWrites = [];
        const mockDb = {
            collection: (col) => ({
                doc: (docId) => ({
                    set: async (payload, opts) => {
                        capturedWrites.push({ col, docId, payload, opts });
                    }
                })
            })
        };

        let backendSyncedPayload = null;
        const mockBackendSync = async (payload) => {
            backendSyncedPayload = payload;
        };

        const res = await updateAutoScheduleMode(true, {
            db: mockDb,
            syncToBackend: mockBackendSync
        });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.updatedFields.autoSchedule, true);
        assert.strictEqual(res.updatedFields.autoScheduleMode, true);
        assert.strictEqual(res.updatedFields.autoScheduleEnabled, true);

        // Verify payload does NOT contain any store settings constants
        assert.strictEqual(res.updatedFields.minOrderValue, undefined);
        assert.strictEqual(res.updatedFields.freeDeliveryThreshold, undefined);
        assert.strictEqual(res.updatedFields.customerCarePhone, undefined);

        // Verify writes to storeSettings and store_config
        assert.strictEqual(capturedWrites.length, 2);
        assert.strictEqual(capturedWrites[0].docId, 'storeSettings');
        assert.strictEqual(capturedWrites[0].opts.merge, true);
        assert.strictEqual(capturedWrites[0].payload.autoSchedule, true);
        assert.strictEqual(capturedWrites[1].docId, 'store_config');
        assert.strictEqual(capturedWrites[1].opts.merge, true);

        assert.deepStrictEqual(backendSyncedPayload, res.updatedFields);

        // In-memory state verification
        const state = getAdminStoreSettings();
        assert.strictEqual(state.autoSchedule, true);
        assert.strictEqual(state.autoScheduleMode, true);
        assert.strictEqual(state.autoScheduleEnabled, true);
        assert.strictEqual(state.minOrderValue, 250);
        assert.strictEqual(state.freeDeliveryThreshold, 1200);
        assert.strictEqual(state.customerCarePhone, '9876543210');
        assert.strictEqual(state.flexibleZones.zone1, 15);
        assert.strictEqual(state.operatingHours.openingTime, '09:30');
    });

    // Test 5: Toggle Auto-Schedule Mode back to false
    await runTest('toggleAutoSchedule() toggles back to Disabled while keeping all configured settings', async () => {
        let capturedWrites = [];
        const mockDb = {
            collection: (col) => ({
                doc: (docId) => ({
                    set: async (payload, opts) => {
                        capturedWrites.push({ col, docId, payload, opts });
                    }
                })
            })
        };

        const res = await toggleAutoSchedule({ db: mockDb });

        assert.strictEqual(res.success, true);
        assert.strictEqual(res.updatedFields.autoSchedule, false);
        assert.strictEqual(res.updatedFields.autoScheduleMode, false);
        assert.strictEqual(res.updatedFields.autoScheduleEnabled, false);

        const state = getAdminStoreSettings();
        assert.strictEqual(state.autoSchedule, false);
        assert.strictEqual(state.minOrderValue, 250);
        assert.strictEqual(state.freeDeliveryThreshold, 1200);
        assert.strictEqual(state.customerCarePhone, '9876543210');
        assert.strictEqual(state.flexibleZones.zone5, 55);
    });

    // Test 6: Non-destructive Ingestion of Partial Snapshots
    await runTest('applyAdminStoreSettings preserves existing configured fields on partial snapshot', async () => {
        // Suppose a remote client toggles shopStatus to closed, sending only { shopStatus: "closed", isOpen: false }
        const partialRemoteSnapshot = {
            isOpen: false,
            isStoreOpen: false,
            shopStatus: 'closed'
        };

        applyAdminStoreSettings(partialRemoteSnapshot);
        const state = getAdminStoreSettings();

        assert.strictEqual(state.isOpen, false);
        assert.strictEqual(state.shopStatus, 'closed');
        assert.strictEqual(state.minOrderValue, 250, 'minOrderValue must not be wiped by partial snapshot!');
        assert.strictEqual(state.freeDeliveryThreshold, 1200, 'freeDeliveryThreshold must not be wiped by partial snapshot!');
        assert.strictEqual(state.customerCarePhone, '9876543210', 'customerCarePhone must not be wiped by partial snapshot!');
        assert.strictEqual(state.flexibleZones.zone1, 15);
        assert.strictEqual(state.inStoreThreshold, 0.12);
        assert.strictEqual(state.operatingHours.openingTime, '09:30');
    });

    // Test 7: Firestore REST updateMask.fieldPaths query generation
    await runTest('Firestore REST setFirestoreDoc properly builds updateMask query parameters for atomic merges', async () => {
        const firestoreContent = fs.readFileSync(path.resolve(__dirname, '../lib/firestore.js'), 'utf8');
        assert.ok(
            firestoreContent.includes('updateMask.fieldPaths='),
            'lib/firestore.js must construct updateMask.fieldPaths query params for merge: true'
        );
        assert.ok(
            firestoreContent.includes('maskParams'),
            'lib/firestore.js must map keys to updateMask.fieldPaths parameters'
        );
    });

    // Test 8: Backend Settings Controller atomic update logic
    await runTest('settingsController.js PUT/PATCH supports isOpen and persists updateFields only with merge', async () => {
        const controllerContent = fs.readFileSync(path.resolve(__dirname, '../controllers/settingsController.js'), 'utf8');
        assert.ok(
            controllerContent.includes('updateFields.isOpen'),
            'settingsController.js must support body.isOpen'
        );
        assert.ok(
            controllerContent.includes('updateFields.isStoreOpen'),
            'settingsController.js must support body.isStoreOpen'
        );
        assert.ok(
            controllerContent.includes("setFirestoreDoc('settings', 'storeSettings', updateFields, true)"),
            'settingsController.js must persist ONLY updateFields to storeSettings with merge: true'
        );
        assert.ok(
            controllerContent.includes("setFirestoreDoc('settings', 'store_config', updateFields, true)"),
            'settingsController.js must persist ONLY updateFields to store_config with merge: true'
        );
    });

    // Test 9: admin.html and public/admin.html toggleShopStatus atomic implementation
    await runTest('admin.html toggleShopStatus synchronizes atomically across both documents with merge: true', async () => {
        const adminHtml = fs.readFileSync(path.resolve(__dirname, '../admin.html'), 'utf8');
        assert.ok(
            adminHtml.includes("doc('storeSettings').set(statusPayload, { merge: true })"),
            'admin.html toggleShopStatus must set storeSettings with merge: true'
        );
        assert.ok(
            adminHtml.includes("doc('store_config').set(statusPayload, { merge: true })"),
            'admin.html toggleShopStatus must set store_config with merge: true'
        );
        assert.ok(
            adminHtml.includes('isOpen: isOpenBool'),
            'admin.html toggleShopStatus must pass isOpen'
        );
        assert.ok(
            adminHtml.includes('isStoreOpen: isOpenBool'),
            'admin.html toggleShopStatus must pass isStoreOpen'
        );
    });

    // Test 10: admin.html and public/admin.html onScheduleInputChange atomic implementation
    await runTest('admin.html onScheduleInputChange synchronizes autoSchedule atomically with merge: true', async () => {
        const adminHtml = fs.readFileSync(path.resolve(__dirname, '../admin.html'), 'utf8');
        assert.ok(
            adminHtml.includes("doc('storeSettings').set(schedulePayload, { merge: true })"),
            'admin.html onScheduleInputChange must set storeSettings with merge: true'
        );
        assert.ok(
            adminHtml.includes("doc('store_config').set(schedulePayload, { merge: true })"),
            'admin.html onScheduleInputChange must set store_config with merge: true'
        );
        assert.ok(
            adminHtml.includes('autoSchedule: isAutoOn'),
            'admin.html onScheduleInputChange must pass autoSchedule'
        );
        assert.ok(
            adminHtml.includes('autoScheduleMode: isAutoOn'),
            'admin.html onScheduleInputChange must pass autoScheduleMode'
        );
    });

    // Test 11: Parity between root and public directories
    await runTest('Root and public files are in strict parity', async () => {
        const adminJsRoot = fs.readFileSync(path.resolve(__dirname, '../admin.js'), 'utf8');
        const adminJsPublic = fs.readFileSync(path.resolve(__dirname, '../public/admin.js'), 'utf8');
        assert.strictEqual(adminJsRoot, adminJsPublic, 'admin.js and public/admin.js must be byte-for-byte identical');

        const adminHtmlRoot = fs.readFileSync(path.resolve(__dirname, '../admin.html'), 'utf8');
        const adminHtmlPublic = fs.readFileSync(path.resolve(__dirname, '../public/admin.html'), 'utf8');
        assert.strictEqual(adminHtmlRoot, adminHtmlPublic, 'admin.html and public/admin.html must be byte-for-byte identical');
    });

    console.log('\n================================================================');
    console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
    console.log('================================================================');

    if (passedTests !== totalTests) {
        process.exit(1);
    }
})();
