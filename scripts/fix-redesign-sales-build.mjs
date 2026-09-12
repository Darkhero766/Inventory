import fs from 'node:fs';

// The sales redesign script generates JSX through a template literal. These two
// class-name constants must exist in the build script itself so ${inputClass}
// and ${pageKicker} can be expanded safely while generating App.tsx.
const file = 'scripts/redesign-sales-flow.mjs';
let source = fs.readFileSync(file, 'utf8');

const marker = "const replacement = `";
const definitions = `const inputClass = 'h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3.5 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.14)]';\nconst pageKicker = 'font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]';\n\n`;

if (!source.includes(definitions)) {
  const index = source.indexOf(marker);
  if (index >= 0) {
    source = source.slice(0, index) + definitions + source.slice(index);
    fs.writeFileSync(file, source, 'utf8');
    console.log('Sales redesign build-script constants repaired.');
  } else {
    throw new Error('Sales redesign replacement marker not found.');
  }
} else {
  console.log('Sales redesign build-script constants already present; skipping.');
}
