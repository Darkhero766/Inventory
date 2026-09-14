import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/App.tsx';
let source = fs.readFileSync(file, 'utf8');

// InventoryProvider must refresh React state after Supabase hydration. The old
// listener alone was racy: AuthGate could finish hydration before this provider
// mounted, so the one-shot event was missed and every screen stayed at zero.
if (!source.includes("from '@/lib/cloud-sync'")) {
  source = source.replace(
    "import NotFound from '@/pages/not-found';",
    "import NotFound from '@/pages/not-found';\nimport { hydrateInventoryState } from '@/lib/cloud-sync';",
  );
}

const marker = "useEffect(() => writeStore('keystone-emi-payments', emiPayments), [emiPayments]);";
const oldMarker = "window.addEventListener('keystone-inventory-hydrated', reload);";

if (!source.includes(oldMarker)) {
  if (!source.includes(marker)) throw new Error('Inventory provider hydration anchor not found.');
  const hydrationEffect = `
  useEffect(() => {
    let alive = true;
    const reload = () => {
      if (!alive) return;
      setProducts(readStore('keystone-products', seedProducts));
      setHistory(readStore('keystone-history', []));
      setPurchases(readStore('keystone-purchases', []));
      setSales(readStore('keystone-sales', []));
      setCustomers(readStore('keystone-customers', []));
      setEmiPlans(readStore('keystone-emi-plans', []));
      setEmiPayments(readStore('keystone-emi-payments', []));
    };
    const onHydrated = () => reload();
    window.addEventListener('keystone-inventory-hydrated', onHydrated);
    // AuthGate normally hydrates before App mounts. Call hydrate again here so
    // this provider always reads the cloud-backed state, even when the event
    // happened before the listener was attached.
    void hydrateInventoryState().then(() => reload()).catch(error => console.warn('[inventory] hydration refresh failed:', error));
    return () => {
      alive = false;
      window.removeEventListener('keystone-inventory-hydrated', onHydrated);
    };
  }, []);`;
  source = source.replace(marker, marker + hydrationEffect);
}

fs.writeFileSync(file, source);
console.log('Inventory startup hydration race patch applied.');
