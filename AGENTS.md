# Workspace Guidelines & Automated Deployment Workflows

## Firebase Automated Deployment Policy
Whenever changes are made to any Firebase-related configuration or files in this project, automatically build, validate, and deploy them to the active Firebase project (`website-fa79c`) without waiting for manual confirmation.

### Triggers and Commands

1. **Firestore Security Rules (`firestore.rules`)**
   - **Trigger:** Any update or modification to `firestore.rules`.
   - **Command:** `npx.cmd firebase deploy --only firestore:rules`
   - **Action:** Compile and release rules to Cloud Firestore.

2. **Firestore Indexes (`firestore.indexes.json`)**
   - **Trigger:** Any update or modification to `firestore.indexes.json`.
   - **Command:** `npx.cmd firebase deploy --only firestore:indexes`
   - **Action:** Deploy composite indexes and field overrides to Cloud Firestore.

3. **Firebase Storage Rules (`storage.rules`)**
   - **Trigger:** Any update or modification to `storage.rules`.
   - **Command:** `npx.cmd firebase deploy --only storage`
   - **Action:** Deploy and release storage rules to Firebase Cloud Storage *(Note: ensure the default Storage bucket has been initialized in the Firebase Console)*.

4. **Firebase Configuration (`firebase.json` / `.firebaserc`)**
   - **Trigger:** Any update or modification to `firebase.json` or `.firebaserc`.
   - **Command:** `npx.cmd firebase deploy` (or targeted `--only <component>` based on updated sections).
   - **Action:** Synchronize all configured project components.

5. **Cloud Functions (Backend Functions)**
   - **Trigger:** Any creation or modification of Cloud Functions in the backend (e.g. `functions/` directory or functions configured in `firebase.json`).
   - **Command:** `npx.cmd firebase deploy --only functions`
   - **Action:** Package, build, and deploy serverless functions to Firebase.

6. **Firebase Hosting (Web Client / Assets)**
   - **Trigger:** Any update to frontend web client assets when hosted on Firebase (or updates to `hosting` in `firebase.json`).
   - **Command:** `npx.cmd firebase deploy --only hosting`
   - **Action:** Build/bundle (if applicable) and deploy static files to Firebase Hosting.

### Execution Standard
- Always execute with non-blocking or direct command execution (`npx.cmd firebase ...`).
- Verify the CLI reports `Deploy complete!` and check for any compilation or validation errors.

---

## Vercel Automated Deployment & Environment Sync Policy
Whenever changes are made to environment variables (`.env`), frontend client assets, backend API routes, or Vercel configurations (`vercel.json`), automatically synchronize and deploy them to the active Vercel project (`perfetto-pizza-plus`) without waiting for manual confirmation.

### Triggers and Commands

1. **Environment Variables (`.env`)**
   - **Trigger:** Any update, addition, or modification to `.env`.
   - **Command:** `npm.cmd run env:push` (or `node scripts/syncVercelEnv.js --push`)
   - **Action:** Synchronize all environment variables across all target environments (`production,preview,development`) directly to Vercel.
   - **Selective/Pull Alternatives:**
     - Push a single specific variable: `node scripts/syncVercelEnv.js --only <KEY_NAME>`
     - Pull latest variables from Vercel: `npm.cmd run env:pull` (or `npx.cmd vercel env pull .env`)

2. **Vercel Configuration & Full-Stack Deployment (`vercel.json`, `api/`, Frontend Client)**
   - **Trigger:** Any update to `vercel.json`, serverless endpoints in `api/`, or frontend client releases intended for Vercel production hosting.
   - **Command:** `npx.cmd vercel --prod` (or `npm.cmd run deploy:vercel`)
   - **Action:** Build/validate and trigger a production deployment to Vercel.

### Execution Standard
- Always execute with non-blocking or direct command execution (`npm.cmd run ...` or `npx.cmd vercel ...`).
- Verify output reports completion (`✓ Synced`, `Aliased: ...`) and check for any syntax or configuration errors.

