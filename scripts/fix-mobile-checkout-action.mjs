import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-checkout.tsx';
let source = fs.readFileSync(file, 'utf8');

// Keep the checkout action reachable on mobile without covering the fixed
// bottom navigation. The normal desktop button remains in the payment card;
// mobile gets a single fixed action bar directly above the navigation.
const marker = "<IndianRupee className=\"h-4 w-4\"/>{busy?'Completing sale…':payment==='EMI'?`Create EMI sale · ${money(total)}`:`Complete sale · ${money(total)}`}<ChevronRight className=\"h-4 w-4\"/>";
const oldButton = `<button disabled={busy||!items.length} onClick={finish} className=\"mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-extrabold text-[hsl(var(--primary))] shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50\">${marker}</button>`;
const desktopButton = `<button disabled={busy||!items.length} onClick={finish} className=\"mt-4 hidden h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-extrabold text-[hsl(var(--primary))] shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50 sm:flex\">${marker}</button>`;

if (source.includes(oldButton)) source = source.replace(oldButton, desktopButton);

if (!source.includes('data-testid="mobile-checkout-action"')) {
  const footer = `<div data-testid="mobile-checkout-action" className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom)+8px)] z-20 sm:hidden"><div className="rounded-2xl border border-white/10 bg-[hsl(var(--primary))] p-2 shadow-2xl shadow-black/25 backdrop-blur-xl"><button disabled={busy||!items.length} onClick={finish} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-[hsl(var(--primary))] shadow-lg disabled:opacity-50">${marker}</button></div></div>`;
  const anchor = " </div>\n </div>\n}`;
  if (source.includes(anchor)) {
    source = source.replace(anchor, ` ${footer}\n </div>\n </div>\n}`);
  } else {
    const compactAnchor = "  </div>\n </div>\n}";
    if (!source.includes(compactAnchor)) throw new Error('Checkout page footer anchor not found; refusing to modify unrelated code.');
    source = source.replace(compactAnchor, `  ${footer}\n </div>\n}`);
  }
}

fs.writeFileSync(file, source);
console.log('Mobile checkout action fixed above bottom navigation.');
