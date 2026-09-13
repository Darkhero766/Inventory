import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-checkout.tsx';
let source = fs.readFileSync(file, 'utf8');

// Keep the desktop payment action inside the payment card and expose a
// mobile action without relying on brittle multiline string anchors.
const marker = '<IndianRupee className="h-4 w-4"/>{busy?\'Completing sale…\':payment===\'EMI\'?`Create EMI sale · ${money(total)}`:`Complete sale · ${money(total)}`}<ChevronRight className="h-4 w-4"/>';

const oldButton = `<button disabled={busy||!items.length} onClick={finish} className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-extrabold text-[hsl(var(--primary))] shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50">${marker}</button>`;
const desktopButton = `<button disabled={busy||!items.length} onClick={finish} className="mt-4 hidden h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-extrabold text-[hsl(var(--primary))] shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 sm:flex">${marker}</button>`;

if (source.includes(oldButton)) {
  source = source.replace(oldButton, desktopButton);
}

if (!source.includes('data-testid="mobile-checkout-action"')) {
  const mobileAction = `<div data-testid="mobile-checkout-action" className="mt-4 sm:hidden"><button disabled={busy||!items.length} onClick={finish} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-extrabold text-[hsl(var(--primary))] shadow-lg disabled:opacity-50">${marker}</button></div>`;

  // Prefer inserting immediately after the desktop payment action. This keeps
  // the mobile action in normal document flow so it scrolls with the checkout
  // page instead of becoming a second fixed footer over bottom navigation.
  if (source.includes(desktopButton)) {
    source = source.replace(desktopButton, `${desktopButton}${mobileAction}`);
  }
}

fs.writeFileSync(file, source);
console.log('Mobile checkout action script repaired and made idempotent.');
