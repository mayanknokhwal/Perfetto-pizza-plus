# Firestore Security Rules Deployment Rule

Whenever `firestore.rules` is modified or updated, automatically execute:
```bash
npx.cmd firebase deploy --only firestore:rules
```
Ensure the deployment completes successfully and report the deployment status.
Refer to `firebase_deployment.md` for the complete Firebase deployment workflows.
