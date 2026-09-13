import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-checkout.tsx';
let source = fs.readFileSync(file, 'utf8');

const importAnchor = "import { ProductImage } from '@/components/product-card';";
const cloudImport = "import { cloudAdjustStock, cloudCreateEmiPlan, cloudCreateSale, cloudUpsertCustomer } from '@/lib/cloud-crud';";
if (!source.includes(cloudImport)) {
  if (!source.includes(importAnchor)) throw new Error('EMI sale import anchor not found.');
  source = source.replace(importAnchor, `${importAnchor}\n${cloudImport}`);
}

source = source.replace(
  "cid=`cus-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const c=",
  "cid=crypto.randomUUID();const c="
);
source = source.replace(
  "const saleId=`sale-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;",
  "const saleId=crypto.randomUUID();"
);
source = source.replace(
  "const planId=`emi-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;",
  "const planId=crypto.randomUUID();"
);
source = source.replace(
  "id:`emip-${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`",
  "id:crypto.randomUUID()"
);

const customerOld = "const next=[c,...customers];setCustomers(next);writeStore('keystone-customers',next)}";
const customerNew = "const next=[c,...customers];setCustomers(next);writeStore('keystone-customers',next);await cloudUpsertCustomer(c)}";
if (source.includes(customerOld)) source = source.replace(customerOld, customerNew);

const saleAnchor = "const nextProducts=products.map(p=>{const line=items.find(i=>i.productId===p.id);return line?{...p,quantity:p.quantity-line.quantity}:p});";
const cloudSale = `${saleAnchor}\n   // Persist the sale in Supabase from this checkout path. The previous storefront\n   // implementation only wrote localStorage, so EMI sales could appear successful\n   // locally while never creating the relational sale/EMI records.\n   await cloudCreateSale(sale,cost,profit);\n   for(const i of items) await cloudAdjustStock(i.productId,-i.quantity);`;
if (!source.includes('await cloudCreateSale(sale,cost,profit)')) {
  if (!source.includes(saleAnchor)) throw new Error('EMI sale persistence anchor not found.');
  source = source.replace(saleAnchor, cloudSale);
}

const planAnchor = "const plan={id:planId,saleId,customerId:cid,totalAmount:total,downPayment:dp,financedAmount:financed,emiAmount,installments:n,paidInstallments:0,outstandingAmount:calc.total,nextDueDate:payments[0]?.dueDate||null,startDate:firstDue,endDate:end,frequency:'MONTHLY',status:financed>0?'ACTIVE':'PAID',interestRate:Math.max(0,Number(interestRate)||0),totalInterest:calc.interest} as EmiPlan & {interestRate:number;totalInterest:number};";
if (!source.includes('await cloudCreateEmiPlan(plan,payments)')) {
  if (!source.includes(planAnchor)) throw new Error('EMI plan persistence anchor not found.');
  source = source.replace(planAnchor, `${planAnchor}\n    await cloudCreateEmiPlan(plan,payments);`);
}

source = source.replace(
  "}catch(e){setError(e instanceof Error?e.message:'Sale could not be completed.')}",
  "}catch(e){console.error('[sales] checkout failed',e);setError(e instanceof Error?e.message:'Sale could not be completed.') }"
);

// Some existing Supabase databases still have the legacy lowercase sales status
// constraint. The migration supports both spellings, but using the legacy spelling
// first also keeps checkout working before the migration has been applied.
const crudFile = 'artifacts/electronics-inventory/src/lib/cloud-crud.ts';
let crud = fs.readFileSync(crudFile, 'utf8');
crud = crud.replace("payment_method, status: 'COMPLETED'", "payment_method, status: 'completed'");
fs.writeFileSync(crudFile, crud);

fs.writeFileSync(file, source);
console.log('EMI checkout persistence, UUID generation, and legacy sales-status compatibility patched.');
