// Contract Checker for Vehicle Rental Management System
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

if (!vm.SourceTextModule) {
  const { spawnSync } = await import('child_process');
  const res = spawnSync(process.execPath, ['--experimental-vm-modules', __filename, ...process.argv.slice(2)], {
    stdio: 'inherit'
  });
  process.exit(res.status ?? 0);
}

const jsFiles = [
  'js/admin.js',
  'js/app.js',
  'js/auth.js',
  'js/booking.js',
  'js/config.js',
  'js/customer.js',
  'js/realtime.js',
  'js/rental-extension.js',
  'js/state.js',
  'js/utils.js',
  'js/vehicles.js'
];

let totalErrors = 0;

console.log('--- CONTRACT CHECKER: V8 AST SYNTAX & CRITICAL HANDLERS ---');

for (const file of jsFiles) {
  const filePath = path.join(rootDir, file);
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    new vm.SourceTextModule(code, { identifier: file });
    console.log(`[OK] ${file}`);
  } catch (err) {
    console.error(`CONTRACT BROKEN in ${file}: V8 Syntax Error -> ${err.message}`);
    totalErrors++;
  }
}

// Check CSS files
const cssFiles = [
  'css/variables.css',
  'css/base.css',
  'css/components.css',
  'css/portal.css',
  'css/booking.css',
  'css/admin.css',
  'css/responsive.css',
  'css/style.css'
];

for (const file of cssFiles) {
  const filePath = path.join(rootDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      console.error(`CONTRACT BROKEN in ${file}: Unbalanced braces (${openBraces} open vs ${closeBraces} close)`);
      totalErrors++;
    } else {
      console.log(`[OK] ${file}`);
    }
  } catch (err) {
    console.error(`CONTRACT BROKEN: Cannot read ${file}: ${err.message}`);
    totalErrors++;
  }
}

// Scan for emojis
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;
for (const file of [...jsFiles, ...cssFiles, 'index.html']) {
  const filePath = path.join(rootDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (emojiRegex.test(content)) {
      console.error(`CONTRACT BROKEN in ${file}: Emoji detected`);
      totalErrors++;
    }
  } catch (e) {}
}

if (totalErrors === 0) {
  console.log('\n--- CONTRACT CHECK: ALL OK (0 Errors) ---');
  process.exit(0);
} else {
  console.error(`\n--- CONTRACT CHECK: FAILED (${totalErrors} Errors) ---`);
  process.exit(1);
}
