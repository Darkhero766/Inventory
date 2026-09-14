import fs from 'node:fs';

const appFile = 'artifacts/electronics-inventory/src/App.tsx';
let app = fs.readFileSync(appFile, 'utf8');

// InventoryProvider must refresh React state after Supabase hydration. The old
// listener alone was racy: AuthGate could finish hydration before this provider
// mounted, so the one-shot event was missed and every screen stayed at zero.
if (!app.includes("from '@/lib/cloud-sync'")) {
  app = app.replace(
    "import NotFound from '@/pages/not-found';",
    "import NotFound from '@/pages/not-found';\nimport { hydrateInventoryState } from '@/lib/cloud-sync';",
  );
}

const marker = "useEffect(() => writeStore('keystone-emi-payments', emiPayments), [emiPayments]);";
const oldMarker = "window.addEventListener('keystone-inventory-hydrated', reload);";

if (!app.includes(oldMarker)) {
  if (!app.includes(marker)) throw new Error('Inventory provider hydration anchor not found.');
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
    void hydrateInventoryState().then(() => reload()).catch(error => console.warn('[inventory] hydration refresh failed:', error));
    return () => {
      alive = false;
      window.removeEventListener('keystone-inventory-hydrated', onHydrated);
    };
  }, []);`;
  app = app.replace(marker, marker + hydrationEffect);
}

fs.writeFileSync(appFile, app);

// Relational tables are the preferred source, but older installations may have
// valid data in inventory_state while one or more relational tables are empty.
// Fill only missing relational datasets from the tenant snapshot and always
// restore history/purchases, which do not have relational tables yet.
const cloudFile = 'artifacts/electronics-inventory/src/lib/cloud-sync.ts';
let cloud = fs.readFileSync(cloudFile, 'utf8');

const snapshotAnchor = "  const rawEmi = emiRes.data ?? [];";
if (!cloud.includes("const snapshotRow = await client.from('inventory_state')")) {
  if (!cloud.includes(snapshotAnchor)) throw new Error('Cloud hydration snapshot anchor not found.');
  cloud = cloud.replace(snapshotAnchor, `${snapshotAnchor}
  const { data: snapshotRow } = await client.from('inventory_state').select('state,updated_at').eq('owner_id', ownerId).eq('workspace_key', 'default').maybeSingle();
  const snapshot = snapshotRow?.state ?? {};
  const snapshotProducts = Array.isArray(snapshot?.['keystone-products']) ? snapshot['keystone-products'] : [];
  const snapshotCustomers = Array.isArray(snapshot?.['keystone-customers']) ? snapshot['keystone-customers'] : [];
  const snapshotSales = Array.isArray(snapshot?.['keystone-sales']) ? snapshot['keystone-sales'] : [];
  const snapshotEmiPlans = Array.isArray(snapshot?.['keystone-emi-plans']) ? snapshot['keystone-emi-plans'] : [];
  const snapshotEmiPayments = Array.isArray(snapshot?.['keystone-emi-payments']) ? snapshot['keystone-emi-payments'] : [];
  const snapshotHistory = Array.isArray(snapshot?.['keystone-history']) ? snapshot['keystone-history'] : [];
  const snapshotPurchases = Array.isArray(snapshot?.['keystone-purchases']) ? snapshot['keystone-purchases'] : [];`);
}

const relationalWriteAnchor = "  localStorage.setItem('keystone-products',JSON.stringify(products));\n  localStorage.setItem('keystone-customers',JSON.stringify(customers));\n  localStorage.setItem('keystone-sales',JSON.stringify(sales));\n  localStorage.setItem('keystone-emi-plans',JSON.stringify(emiPlans));\n  localStorage.setItem('keystone-emi-payments',JSON.stringify(emiPayments));\n  return true;";
const relationalWriteReplacement = "  const finalProducts = products.length ? products : snapshotProducts;\n  const finalCustomers = customers.length ? customers : snapshotCustomers;\n  const finalSales = sales.length ? sales : snapshotSales;\n  const finalEmiPlans = emiPlans.length ? emiPlans : snapshotEmiPlans;\n  const finalEmiPayments = emiPayments.length ? emiPayments : snapshotEmiPayments;\n  localStorage.setItem('keystone-products',JSON.stringify(finalProducts));\n  localStorage.setItem('keystone-customers',JSON.stringify(finalCustomers));\n  localStorage.setItem('keystone-sales',JSON.stringify(finalSales));\n  localStorage.setItem('keystone-emi-plans',JSON.stringify(finalEmiPlans));\n  localStorage.setItem('keystone-emi-payments',JSON.stringify(finalEmiPayments));\n  localStorage.setItem('keystone-history',JSON.stringify(snapshotHistory));\n  localStorage.setItem('keystone-purchases',JSON.stringify(snapshotPurchases));\n  return true;";
if (!cloud.includes('const finalProducts = products.length')) {
  if (!cloud.includes(relationalWriteAnchor)) throw new Error('Cloud relational write anchor not found.');
  cloud = cloud.replace(relationalWriteAnchor, relationalWriteReplacement);
}

fs.writeFileSync(cloudFile, cloud);
console.log('Inventory startup hydration and snapshot fallback patches applied.');
