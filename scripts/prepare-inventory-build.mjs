import fs from 'node:fs';
import path from 'node:path';

// Render runs this script before TypeScript. Keep it deliberately side-effect free:
// source files are already committed and should not be rewritten during a build.
// The previous version performed many brittle string replacements in App.tsx,
// which could leave the generated TypeScript with an unmatched brace.
const required = [
  'artifacts/electronics-inventory/src/App.tsx',
  'artifacts/electronics-inventory/src/auth.tsx',
  'artifacts/electronics-inventory/src/lib/cloud-sync.ts',
];
for (const file of required) {
  if (!fs.existsSync(path.resolve(file))) {
    throw new Error(`Required source file is missing: ${file}`);
  }
}

console.log('Inventory source check passed; no build-time source rewriting.');
