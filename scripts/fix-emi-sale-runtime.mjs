import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/pages/sales-checkout.tsx';
let source = fs.readFileSync(file, 'utf8');

const importAnchor = "import { ProductImage } from '@/components/product-card';";
const cloudImport = "import { cloudAdjustStock, cloudCreateEmiPlan, cloudCreateSale, cloudUpsertCustomer } from '@/lib/cloud-crud';";
if (!source.includes(cloudImport)) {
  if (!source.includes(importAnchor)) throw new Error('EMI sale import anchor not found.');
  source = source.replace(importAnchor, `${importAnchor}\n${cloudImport}`);
}

// Always use browser-safe UUIDs for records that may be persisted to Supabase.
source = source.replace(
  /cid=`cus-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,7\)\}`/,
  'cid=crypto.randomUUID()'
);
source = source.replace(
  /const saleId=`sale-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,7\)\}`;/,
  'const saleId=crypto.randomUUID();'
);
source = source.replace(
  /const planId=`emi-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,7\)\}`;/,
  'const planId=crypto.randomUUID();'
);
source = source.replace(
  /id:`emip-\$\{Date\.now\(\)\}-\$\{i\}-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,5\)\}`/,
  'id:crypto.randomUUID()'
);

// Persist a newly-created customer when checkout created one locally.
if (!source.includes('await cloudUpsertCustomer(c)')) {
  const customerPattern = "const next=[c,...customerList];setCustomers(next);writeStore('keystone-customers',next)}";
  if (source.includes(customerPattern)) {
    source = source.replace(customerPattern, "const next=[c,...customerList];setCustomers(next);writeStore('keystone-customers',next);await cloudUpsertCustomer(c)}");
  }
}

// Persist the sale and stock changes from checkout. This is intentionally
// idempotent so the build script can safely run on every deployment.
if (!source.includes('await cloudCreateSale(sale,cost,profit)')) {
  const saleAnchor = "const nextProducts=products.map(p=>{const line=items.find(i=>i.productId===p.id);return line?{...p,quantity:p.quantity-line.quantity}:p});";
  if (!source.includes(saleAnchor)) throw new Error('EMI sale persistence anchor not found.');
  source = source.replace(
    saleAnchor,
    `${saleAnchor}\n   await cloudCreateSale(sale,cost,profit);\n   for(const i of items) await cloudAdjustStock(i.productId,-i.quantity);`
  );
}

// The checkout source has changed shape over time. Do not depend on one exact
// generated line for the EMI plan. Find the plan declaration and inject the
// cloud persistence call immediately after it.
if (!source.includes('await cloudCreateEmiPlan(plan,payments)')) {
  const exactPlan = "const plan={id:planId,saleId,customerId:cid!,totalAmount:total,downPayment:dp,financedAmount:financed,emiAmount,installments:n,paidInstallments:0,outstandingAmount:calc.total,nextDueDate:payments[0]?.dueDate||null,startDate:firstDue,endDate:end,frequency:'MONTHLY',status:financed>0?'ACTIVE':'PAID',interestRate:rate,totalInterest:calc.interest} as EmiPlan & {interestRate:number;totalInterest:number};";
  const previousPlan = "const plan={id:planId,saleId,customerId:cid,totalAmount:total,downPayment:dp,financedAmount:financed,emiAmount,installments:n,paidInstallments:0,outstandingAmount:calc.total,nextDueDate:payments[0]?.dueDate||null,startDate:firstDue,endDate:end,frequency:'MONTHLY',status:financed>0?'ACTIVE':'PAID',interestRate:Math.max(0,Number(interestRate)||0),totalInterest:calc.interest} as EmiPlan & {interestRate:number;totalInterest:number};";
  if (source.includes(exactPlan)) {
    source = source.replace(exactPlan, `${exactPlan}\n    await cloudCreateEmiPlan(plan,payments);`);
  } else if (source.includes(previousPlan)) {
    source = source.replace(previousPlan, `${previousPlan}\n    await cloudCreateEmiPlan(plan,payments);`);
  } else {
    const planStart = source.indexOf('const plan={id:planId');
    if (planStart < 0) throw new Error('EMI plan declaration not found.');
    const planEnd = source.indexOf('\n', planStart);
    if (planEnd < 0) throw new Error('EMI plan declaration end not found.');
    source = source.slice(0, planEnd + 1) + '    await cloudCreateEmiPlan(plan,payments);\n' + source.slice(planEnd + 1);
  }
}

source = source.replace(
  "}catch(e){setError(e instanceof Error?e.message:'Sale could not be completed.')}",
  "}catch(e){console.error('[sales] checkout failed',e);setError(e instanceof Error?e.message:'Sale could not be completed.') }"
);

// Keep compatibility with already-provisioned databases that use lowercase
// sales status values. cloud-crud.ts also retries this value at runtime.
const crudFile = 'artifacts/electronics-inventory/src/lib/cloud-crud.ts';
let crud = fs.readFileSync(crudFile, 'utf8');
crud = crud.replace("payment_method, status: 'COMPLETED'", "payment_method, status: 'completed'");
fs.writeFileSync(crudFile, crud);

fs.writeFileSync(file, source);
console.log('EMI checkout persistence and build-compatible runtime patches applied.');
