import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/App.tsx';
let source = fs.readFileSync(file, 'utf8');

// The storefront patch may already have converted the cart to normal document
// flow. This script is intentionally idempotent: patch it when the old fixed
// positioning is present, otherwise leave the already-correct source alone.
const patterns = [
  /className=\"fixed bottom-20 left-1\/2 z-40 w-\[calc\(100%-24px\)\] max-w-2xl -translate-x-1\/2 rounded-2xl border border-\[hsl\(var\(--border\)\)\] bg-\[hsl\(var\(--card\)\)\]\/95 p-2 shadow-2xl backdrop-blur-xl sm:bottom-5\"/,
  /className=\"fixed bottom-20 left-1\/2 z-40 w-\[calc\(100%-24px\)\] max-w-2xl -translate-x-1\/2 rounded-2xl/,
  /className=\"fixed bottom-20[^\"]*max-w-2xl[^\"]*\"/,
];

const replacement = 'className="relative z-20 mx-auto mt-6 mb-24 w-full max-w-2xl rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 p-2 shadow-2xl backdrop-blur-xl"';

let changed = false;
for (const pattern of patterns) {
  if (pattern.test(source)) {
    source = source.replace(pattern, replacement);
    changed = true;
    break;
  }
}

if (changed) {
  fs.writeFileSync(file, source);
  console.log('Sales cart position fixed: converted to normal document flow above bottom navigation.');
} else {
  console.log('Sales cart position already uses normal document flow; no position patch needed.');
}
