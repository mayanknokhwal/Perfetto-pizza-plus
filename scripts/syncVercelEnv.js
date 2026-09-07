/**
 * Perfetto Pizza - Vercel Environment Variables Synchronization Utility
 *
 * Usage:
 *   node scripts/syncVercelEnv.js --push               # Push all .env variables to Vercel
 *   node scripts/syncVercelEnv.js --pull               # Pull environment variables from Vercel
 *   node scripts/syncVercelEnv.js --push --dry-run     # Preview variables to sync without pushing
 *   node scripts/syncVercelEnv.js --only KEY_NAME      # Push only a specific variable
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILE_PATH = path.join(ROOT_DIR, '.env');

// Determine vercel CLI binary
const VERCEL_BIN = process.platform === 'win32'
  ? (fs.existsSync(path.join(ROOT_DIR, 'node_modules', '.bin', 'vercel.cmd'))
      ? path.join(ROOT_DIR, 'node_modules', '.bin', 'vercel.cmd')
      : 'vercel.cmd')
  : (fs.existsSync(path.join(ROOT_DIR, 'node_modules', '.bin', 'vercel'))
      ? path.join(ROOT_DIR, 'node_modules', '.bin', 'vercel')
      : 'vercel');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    action: 'push',
    dryRun: false,
    only: null,
    environments: 'production,preview,development',
    type: 'config',
    file: ENV_FILE_PATH
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--pull') {
      options.action = 'pull';
    } else if (arg === '--push') {
      options.action = 'push';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--only' && args[i + 1]) {
      options.only = args[++i];
    } else if (arg === '--environments' && args[i + 1]) {
      options.environments = args[++i];
    } else if (arg === '--type' && args[i + 1]) {
      options.type = args[++i];
    } else if (arg === '--file' && args[i + 1]) {
      options.file = path.resolve(ROOT_DIR, args[++i]);
    }
  }

  return options;
}

function runPull(options) {
  console.log('📥 Pulling latest environment variables from Vercel...');
  const cmd = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : VERCEL_BIN;
  const pullArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', VERCEL_BIN, 'env', 'pull', '.env.vercel']
    : ['env', 'pull', '.env.vercel'];

  const result = spawnSync(cmd, pullArgs, {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  if (result.status === 0) {
    console.log('✅ Successfully pulled variables into .env.vercel');
  } else {
    console.error('❌ Failed to pull variables from Vercel (exit code: ' + result.status + ')');
    process.exit(result.status || 1);
  }
}

function runPush(options) {
  if (!fs.existsSync(options.file)) {
    console.error(`❌ Error: Environment file not found at ${options.file}`);
    process.exit(1);
  }

  const rawEnv = fs.readFileSync(options.file, 'utf8');
  const parsed = dotenv.parse(rawEnv);
  const keys = Object.keys(parsed);

  if (keys.length === 0) {
    console.log(`⚠️ No variables found in ${options.file}.`);
    return;
  }

  const targetKeys = options.only
    ? keys.filter(k => k.toUpperCase() === options.only.toUpperCase())
    : keys;

  if (options.only && targetKeys.length === 0) {
    console.error(`❌ Variable '${options.only}' not found in ${options.file}`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`🚀 PERFETTO PIZZA - VERCEL ENV SYNCHRONIZATION`);
  console.log(`======================================================`);
  console.log(`Source File : ${path.relative(ROOT_DIR, options.file)}`);
  console.log(`Targets     : ${options.environments}`);
  console.log(`Variables   : ${targetKeys.length} to synchronize`);
  console.log(`Dry Run     : ${options.dryRun ? 'YES (No changes will be applied)' : 'NO'}`);
  console.log(`======================================================\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targetKeys.length; i++) {
    const key = targetKeys[i];
    const value = parsed[key];
    const progress = `[${i + 1}/${targetKeys.length}]`;

    // Determine type: Service account or private keys can default to secret, others config
    const varType = (key.includes('PRIVATE_KEY') || key.includes('SERVICE_ACCOUNT'))
      ? 'secret'
      : options.type;

    if (options.dryRun) {
      console.log(`${progress} [DRY-RUN] Would sync: ${key} (type: ${varType}, len: ${value ? value.length : 0})`);
      successCount++;
      continue;
    }

    process.stdout.write(`${progress} Syncing ${key}... `);

    // Call vercel env add with --force and --yes
    const args = [
      'env',
      'add',
      key,
      options.environments,
      '--value',
      value,
      '--type',
      varType,
      '--force',
      '--yes'
    ];

    const cmd = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : VERCEL_BIN;
    const spawnArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', VERCEL_BIN, ...args]
      : args;

    const result = spawnSync(cmd, spawnArgs, {
      cwd: ROOT_DIR,
      encoding: 'utf8'
    });

    if (result.status === 0) {
      process.stdout.write('✓ Synced\n');
      successCount++;
    } else {
      process.stdout.write('❌ FAILED\n');
      console.error(`   Error details: ${result.stderr || result.stdout || 'Unknown error'}`);
      failCount++;
    }
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`✨ Synchronization Finished: ${successCount} succeeded, ${failCount} failed.`);
  console.log(`------------------------------------------------------\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

function main() {
  const options = parseArgs();
  if (options.action === 'pull') {
    runPull(options);
  } else {
    runPush(options);
  }
}

main();
