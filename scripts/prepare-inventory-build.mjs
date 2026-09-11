import fs from 'node:fs';
import path from 'node:path';

const appPath=path.resolve('artifacts/electronics-inventory/src/App.tsx');
let src=fs.readFileSync(appPath,'utf8');
const original=src;

if(!src.includes("./pages/admin-page")) src=src.replace("import NotFound from '@/pages/not-found';", "import NotFound from '@/pages/not-found';\nimport AdminPage from './pages/admin-page';\nimport SalesCheckoutPage from './pages/sales-checkout';");

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

if(src===original) throw new Error('prepare-inventory-build.mjs made no changes; source markers may have drifted.');
fs.writeFileSync(appPath,src);
console.log('Prepared existing App.tsx for dedicated checkout, tenant-safe sale IDs, dynamic account name, and admin route.');
