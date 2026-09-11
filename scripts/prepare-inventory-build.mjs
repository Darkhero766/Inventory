import fs from 'node:fs';
import path from 'node:path';

const appPath=path.resolve('artifacts/electronics-inventory/src/App.tsx');
let src=fs.readFileSync(appPath,'utf8');
const original=src;

if(!src.includes("./pages/admin-page")) src=src.replace("import NotFound from '@/pages/not-found';", "import NotFound from '@/pages/not-found';\nimport AdminPage from './pages/admin-page';\nimport SalesCheckoutPage from './pages/sales-checkout';");

src=src.replace(
"function makeInventory() {\n  const [products, setProducts] = useState<Product[]>(() => readStore('keystone-products', seedProducts));",
"function makeInventory() {\n  const initialProducts = (() => { try { const s=JSON.parse(localStorage.getItem('keystone-auth-session-v1')||'null'); return s?.role==='admin' ? seedProducts : []; } catch { return []; } })();\n  const [products, setProducts] = useState<Product[]>(() => readStore('keystone-products', initialProducts));")

src=src.replace(
"  const addSale = (sale: Omit<Sale, 'id'|'date'>) => {\n    if (sale.items.some(item => (products.find(p => p.id === item.productId)?.quantity ?? 0) < item.quantity)) return false;\n    const purchaseCost = sale.items.reduce((sum, item) => sum + (products.find(p => p.id === item.productId)?.purchasePrice ?? 0) * item.quantity, 0);\n    const profit = sale.total - purchaseCost;\n    setSales(prev => [{ ...sale, id:`sale-${Date.now()}`, date:new Date().toISOString(), purchaseCost, profit, status:'COMPLETED' }, ...prev]);\n    sale.items.forEach(item => adjustStock(item.productId, -item.quantity, 'SALE', `POS sale · ${sale.payment}`));\n    return true;\n  };",
"  const addSale = (sale: Omit<Sale, 'id'|'date'>) => {\n    if (sale.items.some(item => (products.find(p => p.id === item.productId)?.quantity ?? 0) < item.quantity)) return false;\n    const purchaseCost = sale.items.reduce((sum, item) => sum + (products.find(p => p.id === item.productId)?.purchasePrice ?? 0) * item.quantity, 0);\n    const profit = sale.total - purchaseCost;\n    const created:Sale = { ...sale, id:`sale-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, date:new Date().toISOString(), purchaseCost, profit, status:'COMPLETED' };\n    setSales(prev => [created, ...prev]);\n    sale.items.forEach(item => adjustStock(item.productId, -item.quantity, 'SALE', `POS sale · ${sale.payment}`));\n    return created;\n  };")

src=src.replace(
"const created:Sale={...sale,id:`sale-${Date.now()}`,date:new Date().toISOString(),purchaseCost,profit,status:'COMPLETED'};if(payment==='EMI'&&cid){",
"if(payment==='EMI'&&cid){")

src=src.replace(
"function SalesPage(){const {products,customers,upsertCustomer,addSale,createEmiPlan}=useInventory();const [search,setSearch]",
"function SalesPage(){const {products,customers,upsertCustomer,addSale,createEmiPlan}=useInventory();const [,setLocation]=useLocation();const [search,setSearch]")

src=src.replace(
"const add=(p:Product)=>setCart(prev=>prev.some(i=>i.productId===p.id)?prev.map(i=>i.productId===p.id?{...i,quantity:Math.min(p.quantity,i.quantity+1)}:i):[...prev,{productId:p.id,quantity:1}]);",
"const add=(p:Product)=>{const next=cart.some(i=>i.productId===p.id)?cart.map(i=>i.productId===p.id?{...i,quantity:Math.min(p.quantity,i.quantity+1)}:i):[...cart,{productId:p.id,quantity:1}];setCart(next);localStorage.setItem('keystone-sale-draft',JSON.stringify(next));setLocation('/sales/checkout');};")

src=src.replace(
"const hour=new Date().getHours();const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';return <div className=\"mobile-page fade-up mx-auto\">",
"const hour=new Date().getHours();const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';const sessionName=(()=>{try{const s=JSON.parse(localStorage.getItem('keystone-auth-session-v1')||'null');return s?.name||s?.email?.split('@')[0]||'there';}catch{return 'there';}})();return <div className=\"mobile-page fade-up mx-auto\">")
src=src.replace("{greeting}, Aarav","{greeting}, {sessionName}")

src=src.replace(
"<Route path=\"/sales\" component={SalesPage}/>",
"<Route path=\"/sales\" component={SalesPage}/><Route path=\"/sales/checkout\" component={SalesCheckoutPage}/><Route path=\"/admin\" component={AdminPage}/>")

if(src===original) throw new Error('prepare-inventory-build.mjs made no App.tsx changes; source markers may have drifted.');
fs.writeFileSync(appPath,src);

const shellPath=path.resolve('artifacts/electronics-inventory/src/components/inventory-shell.tsx');
let shell=fs.readFileSync(shellPath,'utf8');
if(!shell.includes('Admin console')){
  shell=shell.replace("BarChart3, Boxes, ClipboardList, Home, LogOut, Menu, ShoppingCart, Sparkles, Users, X", "BarChart3, Boxes, ClipboardList, Home, LogOut, Menu, ShoppingCart, ShieldCheck, Sparkles, Users, X");
  shell=shell.replace(
    "<div className=\"mt-8\"><p className=\"mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]\">Manage</p>",
    "<div className=\"mt-8\"><p className=\"mb-3 px-3 font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]\">Manage</p>{session?.role==='admin'&&<Link href=\"/admin\" onClick={()=>setOpen(false)} className={`mb-1 flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-sm transition-all ${active('/admin')?'bg-[hsl(var(--sidebar-accent))] font-bold text-[hsl(var(--sidebar-accent-foreground))]':'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}><ShieldCheck className=\"h-[17px] w-[17px]\"/>Admin console</Link>}")
  shell=shell.replace(
    "<button onClick={logout} className=\"mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50\">",
    "{session?.role==='admin'&&<Link href=\"/admin\" onClick={()=>setAccountOpen(false)} className=\"mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-violet-700 hover:bg-violet-50\"><ShieldCheck className=\"h-4 w-4\"/>Admin console</Link>}<button onClick={logout} className=\"mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-600 hover:bg-red-50\">");
  fs.writeFileSync(shellPath,shell);
}

const authPath=path.resolve('artifacts/electronics-inventory/src/auth.tsx');
let auth=fs.readFileSync(authPath,'utf8');
auth=auth.replace("import { hydrateInventoryState } from './lib/cloud-sync';", "import { hydrateInventoryState, resetCloudHydration } from './lib/cloud-sync';");
auth=auth.replace("const user=userData.user;const metadata=", "const user=userData.user;if(!user?.id)throw new Error('Authenticated user is missing an ID.');prepareTenant(user.id);resetCloudHydration();const metadata=");
auth=auth.replace("import { hydrateInventoryState, resetCloudHydration } from './lib/cloud-sync';", "import { hydrateInventoryState, resetCloudHydration } from './lib/cloud-sync';\nimport { prepareTenant } from './lib/tenant';");
fs.writeFileSync(authPath,auth);
console.log('Prepared existing app for tenant-isolated local state, dedicated checkout, correct EMI sale IDs, dynamic account names, and admin console.');
