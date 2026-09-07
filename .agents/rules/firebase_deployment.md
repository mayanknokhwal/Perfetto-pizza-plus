# Firebase Automated Deployment Workflow Rules

Whenever changes are made to any Firebase-related configuration or files in this project, automatically build, validate, and deploy them to Firebase (`website-fa79c`) without waiting for manual confirmation:

1. **`firestore.rules` (Firestore Security Rules)**
   - Automatically run: `npx.cmd firebase deploy --only firestore:rules`

2. **`firestore.indexes.json` (Firestore Indexes)**
   - Automatically run: `npx.cmd firebase deploy --only firestore:indexes`

3. **`storage.rules` (Firebase Storage Rules)**
   - Automatically run: `npx.cmd firebase deploy --only storage`

4. **`firebase.json` / `.firebaserc` (Firebase Configuration)**
   - Automatically run: `npx.cmd firebase deploy` (or targeted component deploy)

5. **Cloud Functions**
   - Automatically run: `npx.cmd firebase deploy --only functions` whenever backend functions are modified.

6. **Firebase Hosting**
   - Automatically run: `npx.cmd firebase deploy --only hosting` whenever web client/assets are updated if hosted on Firebase.

Always verify successful deployment completion and report the status.
