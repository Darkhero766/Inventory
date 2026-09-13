import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/App.tsx';
let source = fs.readFileSync(file, 'utf8');

const start = source.indexOf('function HomePage(){');
const end = source.indexOf('\nfunction CustomersPage(){', start);
if (start < 0 || end < 0) throw new Error('HomePage replacement anchors not found.');

const home = String.raw`function HomePage(){
  const {products,sales,emiPlans}=useInventory();
  const [,setLocation]=useLocation();
  const [search,setSearch]=useState('');
  const low=products.filter(p=>statusOf(p)==='LOW STOCK');
  const out=products.filter(p=>statusOf(p)==='OUT OF STOCK');
  const recent=[...products].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  const filtered=search?products.filter(p=>
    `${p.name} ${p.brand} ${p.sku}`.toLowerCase().includes(search.toLowerCase())
  ):[];
  const stockValue=products.reduce((s,p)=>s+p.quantity*p.purchasePrice,0);
  const totalSales=sales.reduce((s,x)=>s+x.total,0);
  const totalProfit=sales.reduce((s,x)=>s+(x.profit??0),0);
  const outstanding=emiPlans.reduce((s,e)=>s+e.outstandingAmount,0);
  const todayKey=new Date().toISOString().slice(0,10);
  const todaySales=sales.filter(s=>s.date.slice(0,10)===todayKey);
  const todayRevenue=todaySales.reduce((s,x)=>s+x.total,0);
  const todayProfit=todaySales.reduce((s,x)=>s+(x.profit??0),0);
  const overdue=emiPlans.filter(e=>e.outstandingAmount>0&&(e.status==='OVERDUE'||(e.nextDueDate&&new Date(e.nextDueDate)<new Date()))).length;
  const compact=(v:number)=>v>=100000?`₹${(v/100000).toFixed(1)}L`:v>=1000?`₹${(v/1000).toFixed(1)}K`:moneyValue(v);
  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const todayLabel=new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'short'}).format(new Date());
  return <div className="mobile-page home-dashboard fade-up mx-auto">
    <div className="home-dashboard__top mb-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="home-dashboard__live-dot"/>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{todayLabel}</p>
        </div>
        <h1 className="mt-1.5 text-[27px] font-extrabold tracking-[-.06em]">{greeting}, Aarav</h1>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Your store, at a glance.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={()=>setLocation('/customers?filter=overdue')} className="home-dashboard__icon-button relative" aria-label="Open EMI alerts">
          <CircleAlert className="h-[17px] w-[17px]"/>
          {overdue>0&&<span className="home-dashboard__alert-badge">{overdue>9?'9+':overdue}</span>}
        </button>
        <span className="home-dashboard__avatar">AM</span>
      </div>
    </div>

    <div className="relative mb-4">
      <SearchField value={search} onChange={setSearch} placeholder="Search products, brands or SKU..."/>
      {search&&<div className="absolute top-14 z-30 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-2xl">
        {filtered.length?filtered.slice(0,6).map(p=><button key={p.id} onClick={()=>setLocation('/product/'+p.id)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[hsl(var(--muted))]">
          <ProductImage product={p} className="h-11 w-11 rounded-lg"/>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{p.name}</strong><small className="text-xs text-[hsl(var(--muted-foreground))]">{p.brand} · {p.sku}</small></span>
          <ArrowRight className="h-4 w-4"/>
        </button>):<p className="p-3 text-sm text-[hsl(var(--muted-foreground))]">No products found.</p>}
      </div>}
    </div>

    <section className="home-dashboard__hero mb-4 overflow-hidden rounded-[26px] p-5 text-white sm:p-6">
      <div className="home-dashboard__hero-glow"/>
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-white/55">Business overview</p>
            <p className="mt-1 text-xs text-white/65">All completed sales</p>
          </div>
          <Link href="/sales" className="home-dashboard__hero-link">Open sales <ArrowRight className="h-3.5 w-3.5"/></Link>
        </div>
        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[36px] font-extrabold leading-none tracking-[-.065em]">{compact(totalSales)}</p>
            <p className="mt-2 text-[11px] text-white/55">{sales.length} completed sale{sales.length===1?'':'s'}</p>
          </div>
          <div className="home-dashboard__today-chip">
            <span className="block text-[9px] uppercase tracking-[.14em] text-white/50">Today</span>
            <strong className="mt-0.5 block text-sm">{compact(todayRevenue)}</strong>
            <span className="mt-0.5 block text-[9px] text-white/45">{todaySales.length} sale{todaySales.length===1?'':'s'}</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <div className="home-dashboard__hero-stat"><span>Profit today</span><strong>{compact(todayProfit)}</strong></div>
          <div className="home-dashboard__hero-stat"><span>Inventory units</span><strong>{products.reduce((s,p)=>s+p.quantity,0).toLocaleString('en-IN')}</strong></div>
        </div>
      </div>
    </section>

    <section className="mb-5">
      <div className="mb-2.5 flex items-end justify-between">
        <div><p className={pageKicker}>Key numbers</p><h2 className="mt-1 text-[18px] font-extrabold tracking-[-.045em]">Store health</h2></div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={()=>setLocation('/inventory')} className="home-dashboard__metric text-left"><span>Stock value</span><strong>{compact(stockValue)}</strong><small>at purchase cost <ArrowRight className="inline h-3 w-3"/></small></button>
        <button onClick={()=>setLocation('/customers?filter=active')} className="home-dashboard__metric text-left"><span>EMI outstanding</span><strong>{compact(outstanding)}</strong><small>{emiPlans.length} active plan{emiPlans.length===1?'':'s'} <ArrowRight className="inline h-3 w-3"/></small></button>
        <button onClick={()=>setLocation('/inventory')} className="home-dashboard__metric text-left"><span>Catalog</span><strong>{products.length}</strong><small>products listed <ArrowRight className="inline h-3 w-3"/></small></button>
        <button onClick={()=>setLocation('/inventory')} className="home-dashboard__metric text-left"><span>Units in stock</span><strong>{products.reduce((s,p)=>s+p.quantity,0).toLocaleString('en-IN')}</strong><small>across catalog <ArrowRight className="inline h-3 w-3"/></small></button>
      </div>
    </section>

    <section className="mb-5">
      <div className="mb-2.5 flex items-end justify-between"><div><p className={pageKicker}>Shortcuts</p><h2 className="mt-1 text-[18px] font-extrabold tracking-[-.045em]">Quick actions</h2></div></div>
      <div className="grid grid-cols-3 gap-2.5">
        <Link href="/sales" className="home-dashboard__action"><span className="home-dashboard__action-icon"><ShoppingCart className="h-4 w-4"/></span><strong>New sale</strong><small>Checkout</small></Link>
        <Link href="/inventory" className="home-dashboard__action"><span className="home-dashboard__action-icon"><PackagePlus className="h-4 w-4"/></span><strong>Inventory</strong><small>Manage stock</small></Link>
        <Link href="/customers/new" className="home-dashboard__action"><span className="home-dashboard__action-icon"><Users className="h-4 w-4"/></span><strong>Customer</strong><small>Add customer</small></Link>
      </div>
    </section>

    {(low.length>0||out.length>0||overdue>0)&&<section className="mb-5">
      <div className="home-dashboard__attention rounded-[22px] p-4">
        <div className="flex items-start gap-3">
          <span className="home-dashboard__attention-icon"><CircleAlert className="h-4 w-4"/></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">Needs attention</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              {[
                out.length>0?`${out.length} out of stock`:null,
                low.length>0?`${low.length} low stock`:null,
                overdue>0?`${overdue} overdue EMI`:null,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={()=>setLocation(overdue>0?'/customers?filter=overdue':'/inventory')} className="home-dashboard__attention-link">Review</button>
        </div>
      </div>
    </section>}

    <section>
      <div className="mb-2.5 flex items-end justify-between">
        <div><p className={pageKicker}>Shelf activity</p><h2 className="mt-1 text-[18px] font-extrabold tracking-[-.045em]">Recent products</h2></div>
        <Link href="/inventory" className="text-[11px] font-bold">View all</Link>
      </div>
      <div className="space-y-2">{recent.map(product=><Link href={'/product/'+product.id} key={product.id} className="home-dashboard__product">
        <ProductImage product={product} className="h-[54px] w-[54px] shrink-0 rounded-[14px]"/>
        <span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{product.name}</strong><span className="mt-1 block truncate text-[10px] text-[hsl(var(--muted-foreground))]">{product.brand} · {product.sku}</span><span className="mt-1.5 block text-[10px] font-semibold">{product.quantity} in stock</span></span>
        <div className="flex shrink-0 items-center gap-2"><StatusPill product={product}/><ArrowRight className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]"/></div>
      </Link>)}</div>
    </section>
  </div>;
}`;

source = source.slice(0,start) + home + source.slice(end);
fs.writeFileSync(file, source);
console.log('Premium home dashboard applied.');
