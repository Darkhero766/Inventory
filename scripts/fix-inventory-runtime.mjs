import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/App.tsx';
let source = fs.readFileSync(file, 'utf8');

// The inventory provider used to read localStorage only once. Auth/cloud hydration
// happens after that first render, so every page stayed on the empty in-memory state
// even though Supabase had the tenant data. Reload all stores when cloud hydration
// completes so every page (home, inventory, sales, customers, EMI) gets the current
// authenticated tenant's data.
const marker = "useEffect(() => writeStore('keystone-emi-payments', emiPayments), [emiPayments]);";
const hydrationEffect = `\n  useEffect(() => {\n    const reload = () => {\n      setProducts(readStore('keystone-products', seedProducts));\n      setHistory(readStore('keystone-history', []));\n      setPurchases(readStore('keystone-purchases', []));\n      setSales(readStore('keystone-sales', []));\n      setCustomers(readStore('keystone-customers', []));\n      setEmiPlans(readStore('keystone-emi-plans', []));\n      setEmiPayments(readStore('keystone-emi-payments', []));\n    };\n    window.addEventListener('keystone-inventory-hydrated', reload);\n    return () => window.removeEventListener('keystone-inventory-hydrated', reload);\n  }, []);`;

if (!source.includes("window.addEventListener('keystone-inventory-hydrated', reload)")) {
  if (!source.includes(marker)) throw new Error('Inventory provider hydration anchor not found.');
  source = source.replace(marker, marker + hydrationEffect);
}

fs.writeFileSync(file, source);
console.log('Inventory runtime hydration listener applied.');
