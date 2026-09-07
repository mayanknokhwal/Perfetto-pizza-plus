/**
 * Deploy Firestore Security Rules via Google Firebase Rules API
 * Uses serviceAccountKey.json credentials
 */
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

async function deployFirestoreRules() {
  const rulesPath = path.resolve(__dirname, '..', 'firestore.rules');
  const serviceAccountPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');

  if (!fs.existsSync(rulesPath)) {
    throw new Error(`Rules file not found at ${rulesPath}`);
  }
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Service account key not found at ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  const projectId = serviceAccount.project_id || 'website-fa79c';
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  console.log(`[DEPLOY] Reading firestore.rules (${rulesContent.length} bytes)...`);
  console.log(`[DEPLOY] Authenticating for project ${projectId}...`);

  const auth = new GoogleAuth({
    keyFile: serviceAccountPath,
    scopes: ['https://www.googleapis.com/auth/firebase', 'https://www.googleapis.com/auth/cloud-platform']
  });

  const client = await auth.getClient();

  console.log('[DEPLOY] 1. Creating new compiled ruleset on firebaserules.googleapis.com...');
  const createRes = await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    method: 'POST',
    data: {
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: rulesContent
          }
        ]
      }
    }
  });

  const rulesetName = createRes.data.name;
  console.log(`[DEPLOY] Ruleset compiled successfully: ${rulesetName}`);

  console.log('[DEPLOY] 2. Releasing ruleset to cloud.firestore...');
  const releaseRes = await client.request({
    url: `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    method: 'PATCH',
    data: {
      release: {
        name: `projects/${projectId}/releases/cloud.firestore`,
        rulesetName: rulesetName
      }
    }
  });

  console.log('[DEPLOY] Release updated successfully!');
  console.log(`[DEPLOY] Active Ruleset: ${releaseRes.data.rulesetName}`);
  console.log(`[DEPLOY] Update Time: ${releaseRes.data.updateTime}`);
}

deployFirestoreRules().catch(err => {
  console.error('[DEPLOY ERROR]', err.message, err.response ? err.response.data : '');
  process.exit(1);
});
