import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/lib/cloud-sync.ts';
let src = fs.readFileSync(file, 'utf8');

// Product rows are the only relational dataset still missing after account
// hydration. A schema-safe select(*) avoids failures caused by a stale/older
// products table missing one optional column such as image_url.
src = src.replace(
  "client.from('products').select('id,client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url,created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }),",
  "client.from('products').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),",
);
src = src.replace(
  "const rawProducts = productsRes.data ?? [];\n  const rawCustomers = customersRes.data ?? [];",
  "let rawProducts = productsRes.data ?? [];\n  const rawCustomers = customersRes.data ?? [];",
);

const anchor = "  const rawEmi = emiRes.data ?? [];\n";
const insertion = `  let snapshotProducts: any[] = [];\n  if (rawProducts.length === 0) {\n    try {\n      const { data: snapshotData } = await client.from('inventory_state')\n        .select('state')\n        .eq('owner_id', ownerId)\n        .eq('workspace_key', 'default')\n        .maybeSingle();\n      const candidate = snapshotData?.state?.['keystone-products'];\n      if (Array.isArray(candidate) && candidate.length > 0) {\n        snapshotProducts = candidate;\n        console.warn('[cloud] products relational query returned 0 rows; restoring products from tenant snapshot:', candidate.length);\n      }\n    } catch (error) {\n      console.warn('[cloud] product snapshot fallback failed:', error);\n    }\n  }\n`;
// fix-inventory-runtime.mjs may already provide snapshotProducts. Treat either
// declaration as the shared fallback rather than redeclaring the variable.
if (!src.includes('snapshotProducts')) {
  if (!src.includes(anchor)) throw new Error('Product hydration anchor not found.');
  src = src.replace(anchor, anchor + insertion);
}

const productWrite = "  localStorage.setItem('keystone-products',JSON.stringify(products));";
const replacement = `  if (products.length > 0) {\n    localStorage.setItem('keystone-products',JSON.stringify(products));\n  } else if (snapshotProducts.length > 0) {\n    // Snapshot is already in the browser/client shape. Keep the relational\n    // datasets below while restoring only the missing products.\n    localStorage.setItem('keystone-products',JSON.stringify(snapshotProducts));\n  } else {\n    localStorage.setItem('keystone-products',JSON.stringify([]));\n  }`;
if (src.includes(productWrite)) src = src.replace(productWrite, replacement);

fs.writeFileSync(file, src);
console.log('Product hydration fallback applied with schema-safe products query.');