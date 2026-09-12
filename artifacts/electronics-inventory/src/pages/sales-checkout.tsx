import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, CreditCard, IndianRupee, Minus, Plus, ReceiptText, Search, Trash2, UserRound, X, Percent } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Customer, Product, Sale, EmiPlan, EmiPayment, readStore, seedProducts, writeStore } from '@/lib/inventory';
import { hydrateInventoryState, resetCloudHydration } from '@/lib/cloud-sync';
import { ProductImage } from '@/components/product-card';

const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(v);
const input='h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.14)]';
const button='inline-flex items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50';

function emiCalc(principal:number,annualRate:number,months:number){
  const r=annualRate/1200;
  if(months<=0||principal<=0)return {emi:0,total:0,interest:0};
  const emi=r===0?principal/months:principal*r*Math.pow(1+r,months)/(Math.pow(1+r,months)-1);
  const total=emi*months;
  return {emi,total,interest:Math.max(0,total-principal)};
}

export default function SalesCheckoutPage(){
 const [,setLocation]=useLocation();
 const [products,setProducts]=useState<Product[]>(()=>readStore('keystone-products',seedProducts));
 const [customers,setCustomers]=useState<Customer[]>(()=>readStore('keystone-customers',[]));
 const [cart,setCart]=useState<{productId:string;quantity:number}[]>(()=>readStore('keystone-sale-draft',[]));
 const [search,setSearch]=useState('');
 const [customerId,setCustomerId]=useState(''); const [customerName,setCustomerName]=useState(''); const [customerPhone,setCustomerPhone]=useState('');
 const [discountType,setDiscountType]=useState<'fixed'|'percent'>('fixed'); const [discountValue,setDiscountValue]=useState('');
 const [payment,setPayment]=useState('Cash'); const [cash,setCash]=useState(''); const [upi,setUpi]=useState(''); const [card,setCard]=useState('');
 const [downPayment,setDownPayment]=useState(''); const [months,setMonths]=useState('6'); const [interestRate,setInterestRate]=useState('12'); const [firstDue,setFirstDue]=useState(new Date().toISOString().slice(0,10));
 const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [invoice,setInvoice]=useState<Sale|null>(null);
 useEffect(()=>{void hydrateInventoryState().then(()=>{setProducts(readStore('keystone-products',seedProducts));setCustomers(readStore('keystone-customers',[]));setCart(readStore('keystone-sale-draft',[]));});},[]);
 useEffect(()=>{writeStore('keystone-sale-draft',cart)},[cart]);
 const items=useMemo(()=>cart.map(i=>({...i,product:products.find(p=>p.id===i.productId)!})).filter(i=>i.product),[cart,products]);
 const subtotal=items.reduce((s,i)=>s+i.product.sellingPrice*i.quantity,0);
 const raw=discountType==='percent'?subtotal*Math.min(100,Math.max(0,Number(discountValue)||0))/100:Math.max(0,Number(discountValue)||0);
 const discount=Math.min(subtotal,raw); const total=Math.max(0,subtotal-discount);
 const cost=items.reduce((s,i)=>s+i.product.purchasePrice*i.quantity,0); const profit=total-cost;
 const principal=Math.max(0,total-Math.max(0,Number(downPayment)||0)); const calc=emiCalc(principal,Math.max(0,Number(interestRate)||0),Math.max(1,Math.floor(Number(months)||1)));
 const received=payment==='Mixed Payment'?Number(cash||0)+Number(upi||0)+Number(card||0):payment==='EMI'?Number(downPayment)||0:total;
 const results=products.filter(p=>p.quantity>0&&`${p.name} ${p.brand} ${p.sku} ${p.model}`.toLowerCase().includes(search.toLowerCase())).slice(0,10);
 const add=(p:Product)=>setCart(prev=>prev.some(i=>i.productId===p.id)?prev.map(i=>i.productId===p.id?{...i,quantity:Math.min(p.quantity,i.quantity+1)}:i):[...prev,{productId:p.id,quantity:1}]);
 const remove=(id:string)=>setCart(prev=>prev.filter(i=>i.productId!==id));
 const change=(id:string,d:number)=>setCart(prev=>prev.map(i=>{if(i.productId!==id)return i;const p=products.find(x=>x.id===id);return {...i,quantity:Math.max(1,Math.min(p?.quantity??1,i.quantity+d))}}));
 const selectCustomer=(c:Customer)=>{setCustomerId(c.id);setCustomerName(c.name);setCustomerPhone(c.phone)};
 const finish=async()=>{
  setError('');
  if(!items.length){setError('Add at least one product before completing the sale.');return}
  if(payment!=='EMI'&&received+0.001<total){setError(`Payment received must be at least ${money(total)}.`);return}
  const dp=Math.max(0,Number(downPayment)||0);
  if(payment==='EMI'&&(dp>total||Number(months)<1||Number(interestRate)<0)){setError('Check EMI down payment, tenure and interest rate.');return}
  if(payment==='EMI'&&!customerId&&!customerPhone.trim()){setError('EMI sales require a customer name and mobile number.');return}
  if(items.some(i=>i.quantity>i.product.quantity)){setError('Stock changed. Refresh the sale and try again.');return}
  setBusy(true);
  try{
   let cid=customerId;
   if(!cid&&customerName.trim()&&customerPhone.trim()){
    const existing=customers.find(c=>c.phone.trim()===customerPhone.trim());
    if(existing)cid=existing.id;
    else{cid=`cus-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;const c={id:cid,name:customerName.trim(),phone:customerPhone.trim(),createdAt:new Date().toISOString()} as Customer;const next=[c,...customers];setCustomers(next);writeStore('keystone-customers',next)}
   }
   const saleId=`sale-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; const date=new Date().toISOString(); const invoiceNo=`INV-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;
   const sale:Sale={id:saleId,date,invoice:invoiceNo,customerId:cid||undefined,customerName:customerName.trim()||customers.find(c=>c.id===cid)?.name,items:items.map(i=>({productId:i.productId,productName:i.product.name,quantity:i.quantity,price:i.product.sellingPrice,discount:discount*(i.product.sellingPrice*i.quantity/Math.max(subtotal,1)),serialNumber:i.product.serialNumber,imei:i.product.imei})),subtotal,discount,total,payment,purchaseCost:cost,profit,status:'COMPLETED',discountType,discountValue:Number(discountValue)||0};
   const nextProducts=products.map(p=>{const line=items.find(i=>i.productId===p.id);return line?{...p,quantity:p.quantity-line.quantity}:p});
   writeStore('keystone-sales',[sale,...readStore<Sale[]>('keystone-sales',[])]); writeStore('keystone-products',nextProducts); setProducts(nextProducts);
   if(payment==='EMI'&&cid){
    const n=Math.max(1,Math.floor(Number(months)||1)); const financed=principal; const emiAmount=Number(calc.emi.toFixed(2)); const planId=`emi-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; const start=new Date(`${firstDue}T00:00:00`); const payments:EmiPayment[]=[];
    for(let i=1;i<=n;i++){const due=new Date(start);due.setMonth(due.getMonth()+i-1);const amount=i===n?Number((calc.total-emiAmount*(n-1)).toFixed(2)):emiAmount;payments.push({id:`emip-${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`,emiPlanId:planId,installmentNumber:i,dueDate:due.toISOString(),amount,status:'UPCOMING'})}
    const end=payments[n-1]?.dueDate||start.toISOString();
    const plan={id:planId,saleId,customerId:cid,totalAmount:total,downPayment:dp,financedAmount:financed,emiAmount,installments:n,paidInstallments:0,outstandingAmount:calc.total,nextDueDate:payments[0]?.dueDate||null,startDate:firstDue,endDate:end,frequency:'MONTHLY',status:financed>0?'ACTIVE':'PAID',interestRate:Math.max(0,Number(interestRate)||0),totalInterest:calc.interest} as EmiPlan & {interestRate:number;totalInterest:number};
    writeStore('keystone-emi-plans',[plan,...readStore<EmiPlan[]>('keystone-emi-plans',[])]); writeStore('keystone-emi-payments',[...payments,...readStore<EmiPayment[]>('keystone-emi-payments',[])]);
   }
   setInvoice(sale);setCart([]);writeStore('keystone-sale-draft',[]);resetCloudHydration();
  }catch(e){setError(e instanceof Error?e.message:'Sale could not be completed.')}finally{setBusy(false)}
 };
 if(invoice)return <div className="mx-auto max-w-2xl py-8 fade-up"><div className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-xl"><div className="bg-[hsl(var(--primary))] p-7 text-[hsl(var(--primary-foreground))]"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Check/></div><p className="font-mono text-[10px] uppercase tracking-[.2em] opacity-60">Sale completed</p><h1 className="mt-2 text-3xl font-extrabold">{invoice.invoice}</h1><p className="mt-1 text-sm opacity-70">{invoice.customerName||'Walk-in customer'} · {money(invoice.total)}</p></div><div className="space-y-3 p-6">{invoice.items.map(i=><div key={i.productId} className="flex justify-between border-b border-[hsl(var(--border))] pb-3 text-sm"><span>{i.productName} × {i.quantity}</span><b>{money(i.price*i.quantity)}</b></div>)}<div className="flex justify-between pt-2 text-lg font-extrabold"><span>Total</span><span>{money(invoice.total)}</span></div><div className="grid grid-cols-2 gap-3 pt-3"><Link href="/sales" className={button}>New sale</Link><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-bold" onClick={()=>setLocation('/sales')}>Back to sales</button></div></div></div></div>;
 return <div className="mx-auto max-w-7xl pb-28 fade-up">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/sales" className="inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))]"><ArrowLeft className="h-4 w-4"/>Sales</Link><div className="flex items-center gap-2 rounded-full bg-[hsl(var(--accent))] px-3 py-1.5 text-[10px] font-bold">{items.reduce((s,i)=>s+i.quantity,0)} items · {money(total)}</div></div>
  <div className="mb-7"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">Point of sale · checkout</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em] md:text-4xl">Build the sale</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Add products first, review the cart, then complete payment and customer details.</p></div>
  <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
   <section className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm sm:p-6">
    <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">01 · Products</p><h2 className="mt-1 text-xl font-extrabold">Choose items</h2></div><span className="text-xs text-[hsl(var(--muted-foreground))]">{products.length} in inventory</span></div>
    <div className="relative mt-5"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]"/><input autoFocus className={`${input} pl-9`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product, brand, model or SKU…"/></div>
    {search&&<div className="mt-2 max-h-72 overflow-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-lg">{results.length?results.map(p=><button key={p.id} onClick={()=>{add(p);setSearch('')}} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[hsl(var(--muted))]"><ProductImage product={p} className="h-12 w-12 rounded-xl"/><span className="min-w-0 flex-1"><b className="block truncate text-sm">{p.name}</b><span className="text-[11px] text-[hsl(var(--muted-foreground))]">{p.brand} · {p.sku} · {p.quantity} available</span></span><span className="text-sm font-extrabold">{money(p.sellingPrice)}</span><Plus className="h-4 w-4"/></button>):<p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">No in-stock product found.</p>}</div>}
    <div className="mt-5 space-y-3">{items.length?items.map(i=><div key={i.productId} className="flex gap-3 rounded-2xl border border-[hsl(var(--border))] p-3"><ProductImage product={i.product} className="h-16 w-16 shrink-0 rounded-xl"/><div className="min-w-0 flex-1"><b className="block truncate text-sm">{i.product.name}</b><p className="text-[11px] text-[hsl(var(--muted-foreground))]">{i.product.brand} · {money(i.product.sellingPrice)} each</p><div className="mt-2 flex w-fit items-center gap-1 rounded-xl bg-[hsl(var(--muted))] p-1"><button onClick={()=>change(i.productId,-1)} className="rounded-lg p-1.5"><Minus className="h-3 w-3"/></button><span className="w-6 text-center text-xs font-bold">{i.quantity}</span><button onClick={()=>change(i.productId,1)} className="rounded-lg p-1.5"><Plus className="h-3 w-3"/></button></div></div><div className="flex flex-col items-end justify-between"><b>{money(i.product.sellingPrice*i.quantity)}</b><button onClick={()=>remove(i.productId)} className="text-[11px] font-bold text-red-500"><Trash2 className="inline h-3.5 w-3.5"/> Remove</button></div></div>):<div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center"><ReceiptText className="mb-3 h-8 w-8 text-[hsl(var(--muted-foreground))]"/><b>No products in this sale</b><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Search above to add your first product.</p></div>}</div>
   </section>
   <aside className="space-y-4">
    <section className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">02 · Customer</p><div className="mt-4 flex items-center gap-2"><UserRound className="h-4 w-4 text-[hsl(var(--muted-foreground))]"/><select className={`${input} flex-1`} value={customerId} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);if(c)selectCustomer(c);else setCustomerId('')}}><option value="">Walk-in / new customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></div>{!customerId&&<div className="mt-2 grid grid-cols-2 gap-2"><input className={input} value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Customer name"/><input className={input} value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} placeholder="Mobile number"/></div>}</section>
    <section className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">03 · Price</p><div className="mt-3 flex items-center gap-2"><button onClick={()=>setDiscountType('fixed')} className={`rounded-xl px-3 py-2 text-xs font-bold ${discountType==='fixed'?'bg-[hsl(var(--primary))] text-white':'bg-[hsl(var(--muted))]'}`}>₹</button><button onClick={()=>setDiscountType('percent')} className={`rounded-xl px-3 py-2 text-xs font-bold ${discountType==='percent'?'bg-[hsl(var(--primary))] text-white':'bg-[hsl(var(--muted))]'}`}><Percent className="inline h-3 w-3"/> %</button><input type="number" min="0" className={`${input} flex-1`} value={discountValue} onChange={e=>setDiscountValue(e.target.value)} placeholder="Discount"/></div><div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="flex justify-between"><span>Discount</span><b className="text-red-500">− {money(discount)}</b></div><div className="flex justify-between border-t border-[hsl(var(--border))] pt-3 text-lg font-extrabold"><span>Total</span><span>{money(total)}</span></div></div></section>
    <section className="rounded-3xl bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))] shadow-xl"><p className="text-[10px] font-bold uppercase tracking-wider opacity-60">04 · Payment</p><div className="mt-3 grid grid-cols-3 gap-2">{['Cash','UPI','Card','Bank Transfer','EMI','Mixed Payment'].map(m=><button key={m} onClick={()=>setPayment(m)} className={`rounded-xl px-2 py-2.5 text-[10px] font-extrabold ${payment===m?'bg-white text-[hsl(var(--primary))]':'bg-white/10'}`}><CreditCard className="mx-auto mb-1 h-3.5 w-3.5"/>{m}</button>)}</div>
     {payment==='Mixed Payment'&&<div className="mt-3 grid grid-cols-3 gap-2"><input type="number" className="h-9 rounded-lg bg-white/10 px-2 text-xs text-white outline-none placeholder:text-white/40" value={cash} onChange={e=>setCash(e.target.value)} placeholder="Cash"/><input type="number" className="h-9 rounded-lg bg-white/10 px-2 text-xs text-white outline-none placeholder:text-white/40" value={upi} onChange={e=>setUpi(e.target.value)} placeholder="UPI"/><input type="number" className="h-9 rounded-lg bg-white/10 px-2 text-xs text-white outline-none placeholder:text-white/40" value={card} onChange={e=>setCard(e.target.value)} placeholder="Card"/></div>}
     {payment==='EMI'&&<div className="mt-4 space-y-3 rounded-2xl bg-white/10 p-4"><div className="grid grid-cols-2 gap-2"><label className="text-[10px] opacity-60">Down payment<input type="number" min="0" max={total} className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white outline-none" value={downPayment} onChange={e=>setDownPayment(e.target.value)}/></label><label className="text-[10px] opacity-60">Tenure (months)<input type="number" min="1" className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white outline-none" value={months} onChange={e=>setMonths(e.target.value)}/></label></div><div className="grid grid-cols-2 gap-2"><label className="text-[10px] opacity-60">Interest / year %<input type="number" min="0" step="0.01" className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-sm text-white outline-none" value={interestRate} onChange={e=>setInterestRate(e.target.value)}/></label><label className="text-[10px] opacity-60">First due date<input type="date" className="mt-1 h-10 w-full rounded-xl bg-white/10 px-3 text-xs text-white outline-none" value={firstDue} onChange={e=>setFirstDue(e.target.value)}/></label></div><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-black/10 p-2"><p className="text-[9px] opacity-50">Financed</p><b className="text-sm">{money(principal)}</b></div><div className="rounded-xl bg-black/10 p-2"><p className="text-[9px] opacity-50">Monthly EMI</p><b className="text-sm">{money(calc.emi)}</b></div><div className="rounded-xl bg-black/10 p-2"><p className="text-[9px] opacity-50">Interest</p><b className="text-sm">{money(calc.interest)}</b></div></div><p className="text-[10px] opacity-55">Reducing-balance EMI · total repayment {money(calc.total)}</p></div>}
     {error&&<div className="mt-3 rounded-xl bg-red-500/20 px-3 py-2.5 text-xs font-bold text-red-100">{error}</div>}
     <button disabled={busy||!items.length} onClick={finish} className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-extrabold text-[hsl(var(--primary))] shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"><IndianRupee className="h-4 w-4"/>{busy?'Completing sale…':payment==='EMI'?`Create EMI sale · ${money(total)}`:`Complete sale · ${money(total)}`}<ChevronRight className="h-4 w-4"/></button>
    </section>
   </aside>
  </div>
 </div>
}
