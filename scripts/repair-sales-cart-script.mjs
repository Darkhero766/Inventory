import fs from 'node:fs';

const file = 'scripts/redesign-sales-cart.mjs';
let source = fs.readFileSync(file, 'utf8');

// The sales redesign is itself a JavaScript template literal. Any ${inputClass}
// inside it is evaluated by Node while loading the build script, causing the
// deployment to crash before the generated React source can be written.
// Replace those template-time references with a literal Tailwind class string.
const literal = 'border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]';
const before = source;
source = source.replaceAll('${inputClass}', literal);
if (source !== before) {
  fs.writeFileSync(file, source);
  console.log('Sales cart build script repaired: inputClass template interpolation removed.');
} else {
  console.log('Sales cart build script already repaired.');
}
