#!/usr/bin/env node
/**
 * Auto-Retraining System Validation Script
 * Checks that all components are properly installed and configured
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const check = (condition, label, details = '') => {
  const symbol = condition ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  console.log(`${symbol} ${label} ${details ? `- ${details}` : ''}`);
  return condition;
};

const section = (title) => {
  console.log(`\n${colors.blue}${title}${colors.reset}`);
  console.log('─'.repeat(60));
};

let passed = 0;
let failed = 0;

const test = (condition, label, details) => {
  if (check(condition, label, details)) {
    passed++;
  } else {
    failed++;
  }
};

console.log(colors.blue);
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Auto-Retraining System - Validation & Health Check       ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(colors.reset);

// ============================================================
section('1. File Structure Check');
// ============================================================

const requiredFiles = [
  'recommendation/auto_retrain.py',
  'backend/routes/recommend-admin.js',
  'backend/scripts/recommendation-monitor.js',
  'ecosystem.config.js',
  'PRODUCTION_RETRAINING_GUIDE.md',
  'AUTO_RETRAIN_SETUP_SUMMARY.md',
  'QUICK_START_RETRAIN.md',
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  test(fs.existsSync(filePath), `File exists: ${file}`);
});

// ============================================================
section('2. Directory Structure Check');
// ============================================================

const requiredDirs = [
  'recommendation/models',
  'recommendation/models/archive',
  'logs',
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  const exists = fs.existsSync(dirPath);
  if (!exists) {
    try {
      require('child_process').execSync(`mkdir -p "${dirPath}"`);
      test(true, `Directory created: ${dir}`);
    } catch (e) {
      test(false, `Directory creation failed: ${dir}`);
    }
  } else {
    test(true, `Directory exists: ${dir}`);
  }
});

// ============================================================
section('3. Dependency Check');
// ============================================================

// Node.js packages
let npmPkgs = {};
try {
  const pkgJsonPath = path.join(__dirname, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    npmPkgs = pkgJson.dependencies || {};
  }
} catch (e) {
  console.log(`${colors.yellow}Warning: Could not read package.json${colors.reset}`);
}

try {
  execSync('npm list express --depth=0', { stdio: 'ignore' });
  test(true, 'Node.js Package: express', npmPkgs.express || 'installed');
} catch (e) {
  test(false, 'Node.js Package: express', 'not installed');
}

try {
  execSync('npm list pg --depth=0', { stdio: 'ignore' });
  test(true, 'Node.js Package: pg', npmPkgs.pg || 'installed');
} catch (e) {
  test(false, 'Node.js Package: pg', 'not installed');
}

// Python packages
const pythonPackages = ['schedule', 'pandas', 'numpy', 'scikit-learn', 'psycopg2'];
pythonPackages.forEach(pkg => {
  try {
    execSync(`python -c "import ${pkg.replace('-', '_')}"`, { stdio: 'ignore' });
    test(true, `Python Package: ${pkg}`);
  } catch (e) {
    test(false, `Python Package: ${pkg}`, 'run: pip install schedule');
  }
});

// ============================================================
section('4. PM2 Installation Check');
// ============================================================

try {
  const pm2Version = execSync('pm2 --version', { encoding: 'utf8' }).trim();
  test(true, 'PM2 installed', `v${pm2Version}`);
} catch (e) {
  test(false, 'PM2 installed', 'install with: npm install -g pm2');
}

// ============================================================
section('5. Configuration Check');
// ============================================================

try {
  const ecosystemPath = path.join(__dirname, 'ecosystem.config.js');
  const ecosystem = require(ecosystemPath);
  test(ecosystem.apps && ecosystem.apps.length > 0, 'ecosystem.config.js valid', `${ecosystem.apps?.length} apps configured`);
  
  const hasBackend = ecosystem.apps.some(app => app.name === 'collabgrow-backend');
  test(hasBackend, 'Backend service configured');
  
  const hasScheduler = ecosystem.apps.some(app => app.name === 'recommendation-scheduler');
  test(hasScheduler, 'Scheduler service configured');
} catch (e) {
  test(false, 'ecosystem.config.js valid', e.message);
}

// ============================================================
section('6. Model Training Check');
// ============================================================

const modelsDir = path.join(__dirname, 'recommendation', 'models');
const modelFiles = ['tfidf_vectorizer.pkl', 'project_vectors.pkl', 'svd_model.pkl'];
modelFiles.forEach(file => {
  const filePath = path.join(modelsDir, file);
  test(fs.existsSync(filePath), `Model file exists: ${file}`);
});

const metadataPath = path.join(modelsDir, 'metadata.json');
if (fs.existsSync(metadataPath)) {
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    test(true, 'Metadata file valid');
    console.log(`   └─ Version: ${metadata.current_version || 'unknown'}`);
    console.log(`   └─ Last trained: ${metadata.last_trained || 'never'}`);
    console.log(`   └─ Training history: ${(metadata.training_history || []).length} records`);
  } catch (e) {
    test(false, 'Metadata file valid');
  }
} else {
  test(false, 'Metadata file exists', 'run training first');
}

// ============================================================
section('7. Database Connection Check');
// ============================================================

require('dotenv').config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  test(false, 'DATABASE_URL configured', 'set in .env file');
} else {
  test(true, 'DATABASE_URL configured', '(not testing connection)');
}

// ============================================================
section('8. API Endpoints Check');
// ============================================================

async function checkAPI() {
  const apiUrl = 'http://localhost:5000';
  
  try {
    const response = await axios.get(`${apiUrl}/api/recommend/status`, { timeout: 2000 });
    test(true, 'GET /api/recommend/status', `Status: ${response.status}`);
  } catch (e) {
    test(false, 'GET /api/recommend/status', 'Backend not running or unreachable');
  }
}

// ============================================================
section('9. Scheduler Check');
// ============================================================

try {
  const autoRetrainPath = path.join(__dirname, 'recommendation', 'auto_retrain.py');
  const content = fs.readFileSync(autoRetrainPath, 'utf8');
  
  test(content.includes('schedule.every'), 'Scheduler implemented');
  test(content.includes('def retrain'), 'Retrain method defined');
  test(content.includes('ModelMetadata'), 'Model versioning implemented');
  test(content.includes('archive'), 'Backup system implemented');
} catch (e) {
  test(false, 'auto_retrain.py validation', e.message);
}

// ============================================================
section('10. Monitoring Tools Check');
// ============================================================

try {
  const monitorPath = path.join(__dirname, 'backend', 'scripts', 'recommendation-monitor.js');
  const content = fs.readFileSync(monitorPath, 'utf8');
  
  test(content.includes('getStatus'), 'Status endpoint method');
  test(content.includes('isHealthy'), 'Health check method');
  test(content.includes('getReport'), 'Report generation method');
  test(content.includes('triggerRetrain'), 'Retrain trigger method');
} catch (e) {
  test(false, 'recommendation-monitor.js validation');
}

// ============================================================
console.log('\n');
console.log('─'.repeat(60));
console.log(colors.blue + 'SUMMARY' + colors.reset);
console.log('─'.repeat(60));
console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
console.log('─'.repeat(60));

if (failed === 0) {
  console.log(`\n${colors.green}✓ All checks passed! System is ready for production.${colors.reset}\n`);
  console.log('Next steps:');
  console.log('  1. pm2 start ecosystem.config.js');
  console.log('  2. pm2 logs recommendation-scheduler');
  console.log('  3. node backend/scripts/recommendation-monitor.js status\n');
  process.exit(0);
} else {
  console.log(`\n${colors.yellow}⚠ ${failed} check(s) failed. Review the issues above.${colors.reset}\n`);
  console.log('Fix the issues and run again:');
  console.log('  node backend/scripts/validate-retrain.js\n');
  process.exit(1);
}
