import { supabase } from './supabase';

const KEYS = ['keystone-products','keystone-history','keystone-purchases','keystone-sales','keystone-customers','keystone-emi-plans','keystone-emi-payments'] as const;
const OWNER_KEY = 'keystone-active-owner-id-v1';
let hydrating=false;
let timer:ReturnType<typeof setTimeout>|undefined;
let bootPromise:Promise<boolean>|null=null;
let syncInstalled=false;
const snapshot=()=>Object.fromEntries(KEYS.map(key=>{try{return [key,JSON.parse(localStorage.getItem(key)||'null')];}catch{return [key,null];}}));
const clearLocalInventoryCache=()=>{for(const key of KEYS)localStorage.removeItem(key);};
const notifyHydrated=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event('keystone-inventory-hydrated'));};
async function currentUserId(){const client=supabase;if(!client)return null;const {data}=await client.auth.getUser();return data.user?.id??null;}
async function ensureSession(){const client=supabase;if(!client)return false;const {data}=await client.auth.getSession();return Boolean(data.session);}
async function hydrateRelational(){const client=supabase;if(!client||!(await ensureSession()))return false;const ownerId=await currentUserId();if(!ownerId)return false;
 const [productsRes,customersRes,salesRes,itemsRes,emiRes,paymentsRes]=await Promise.all([
  client.from('products').select('id,client_id,name,brand,category,model,sku,serial_number,imei,purchase_price,selling_price,mrp,stock,min_stock,warranty,image_url,created_at').eq('owner_id',ownerId).order('created_at',{ascending:false}),
  client.from('customers').select('id,client_id,name,phone,alternate_phone,email,address,created_at').eq('owner_id',ownerId).order('created_at',{ascending:false}),
  client.from('sales').select('id,client_id,invoice_number,customer_id,sale_date,subtotal,discount_type,discount_value,discount_amount,final_amount,purchase_cost,profit,payment_method,status,customers(client_id,name)').eq('owner_id',ownerId).order('sale_date',{ascending:false}),
  client.from('sale_items').select('client_id,sale_id,product_id,quantity,unit_price,discount,final_price,products(client_id,name,serial_number,imei)').eq('owner_id',ownerId),
  client.from('emi_plans').select('id,client_id,sale_id,customer_id,total_amount,down_payment,financed_amount,emi_amount,installments,paid_installments,outstanding_amount,start_date,next_due_date,end_date,frequency,status').eq('owner_id',ownerId),
  client.from('emi_payments').select('client_id,emi_plan_id,installment_number,due_date,amount,paid_date,status').eq('owner_id',ownerId).order('due_date',{ascending:true})
 ]);
 if([productsRes,customersRes,salesRes,itemsRes,emiRes,paymentsRes].some(r=>r.error))return false;
 const rawProducts=productsRes.data??[],rawCustomers=customersRes.data??[],rawSales=salesRes.data??[],rawEmi=emiRes.data??[];
 const hasRelational=rawProducts.length||rawCustomers.length||rawSales.length||rawEmi.length;
 const products=rawProducts.map((p:any)=>({id:p.client_id,name:p.name,brand:p.brand,category:p.category,model:p.model,sku:p.sku,purchasePrice:Number(p.purchase_price),sellingPrice:Number(p.selling_price),mrp:Number(p.mrp),quantity:Number(p.stock),minStock:Number(p.min_stock),warranty:p.warranty??'',image:p.image_url??'',createdAt:p.created_at,serialNumber:p.serial_number??undefined,imei:p.imei??undefined}));
 const customers=rawCustomers.map((c:any)=>({id:c.client_id,name:c.name,phone:c.phone,alternatePhone:c.alternate_phone??undefined,email:c.email??undefined,address:c.address??undefined,createdAt:c.created_at}));
 const itemsBySale=new Map<string,Array<Record<string,unknown>>>();
 for(const row of itemsRes.data??[]){const list=itemsBySale.get(row.sale_id)??[];list.push({productId:(row as any).products?.client_id??row.product_id,productName:(row as any).products?.name??'Product',quantity:Number(row.quantity),price:Number(row.unit_price),discount:Number(row.discount??0),serialNumber:(row as any).products?.serial_number??undefined,imei:(row as any).products?.imei??undefined});itemsBySale.set(row.sale_id,list);}
 const sales=rawSales.map((s:any)=>({id:s.client_id,date:s.sale_date,invoice:s.invoice_number,customerId:s.customers?.client_id,customerName:s.customers?.name,items:(itemsBySale.get(s.id)??[]) as Array<Record<string,unknown>>,subtotal:Number(s.subtotal),discount:Number(s.discount_amount),total:Number(s.final_amount),payment:s.payment_method,purchaseCost:Number(s.purchase_cost),profit:Number(s.profit),discountType:s.discount_type??undefined,discountValue:Number(s.discount_value??0),status:s.status}));
 const saleByDbId=new Map(rawSales.map((s:any)=>[s.id,s]));
 const emiDbToClient=new Map((rawEmi as any[]).map((e:any)=>[e.id,e.client_id]));
 const emiPlans=rawEmi.map((e:any)=>({id:e.client_id,saleId:saleByDbId.get(e.sale_id)?.client_id??e.sale_id,customerId:rawCustomers.find((c:any)=>c.id===e.customer_id)?.client_id??e.customer_id,totalAmount:Number(e.total_amount),downPayment:Number(e.down_payment),financedAmount:Number(e.financed_amount),emiAmount:Number(e.emi_amount),installments:Number(e.installments),paidInstallments:Number(e.paid_installments),outstandingAmount:Number(e.outstanding_amount),startDate:e.start_date,nextDueDate:e.next_due_date,endDate:e.end_date,frequency:e.frequency,status:e.status}));
 const emiPayments=(paymentsRes.data??[]).map((p:any)=>({id:p.client_id,emiPlanId:emiDbToClient.get(p.emi_plan_id)??p.emi_plan_id,installmentNumber:Number(p.installment_number),dueDate:p.due_date,amount:Number(p.amount),paidDate:p.paid_date??undefined,status:p.status}));
 if(hasRelational){localStorage.setItem('keystone-products',JSON.stringify(products));localStorage.setItem('keystone-customers',JSON.stringify(customers));localStorage.setItem('keystone-sales',JSON.stringify(sales));localStorage.setItem('keystone-emi-plans',JSON.stringify(emiPlans));localStorage.setItem('keystone-emi-payments',JSON.stringify(emiPayments));return true;}
 return false;
}
export async function hydrateInventoryState(){const client=supabase;if(!client||typeof window==='undefined')return false;if(bootPromise)return bootPromise;bootPromise=(async()=>{if(!(await ensureSession()))return false;hydrating=true;try{const ownerId=await currentUserId();if(!ownerId)return false;const cachedOwner=localStorage.getItem(OWNER_KEY);if(cachedOwner!==ownerId)clearLocalInventoryCache();localStorage.setItem(OWNER_KEY,ownerId);
  const {data:stateRow,error:stateError}=await client.from('inventory_state').select('state').eq('owner_id',ownerId).eq('workspace_key','default').maybeSingle();
  if(!stateError&&stateRow?.state){const state=stateRow.state as Record<string,unknown>;for(const key of KEYS)if(state[key]!==undefined&&state[key]!==null)localStorage.setItem(key,JSON.stringify(state[key]));}
  await hydrateRelational();
  notifyHydrated();
  return Boolean(stateRow?.state)||true;
 }finally{hydrating=false;}})();return bootPromise;}
export function resetCloudHydration(){bootPromise=null;}
export function clearTenantCache(){clearLocalInventoryCache();localStorage.removeItem(OWNER_KEY);resetCloudHydration();}
export function syncInventoryState(){const client=supabase;if(!client||typeof window==='undefined'||hydrating)return;if(timer)clearTimeout(timer);timer=setTimeout(async()=>{if(!(await ensureSession()))return;const ownerId=await currentUserId();if(!ownerId)return;localStorage.setItem(OWNER_KEY,ownerId);const state=snapshot();const {error}=await client.rpc('sync_inventory_snapshot',{p_state:state});if(error)console.warn('[cloud] sync failed:',error.message);const {error:snapshotError}=await client.from('inventory_state').upsert({owner_id:ownerId,workspace_key:'default',state,updated_at:new Date().toISOString()},{onConflict:'owner_id,workspace_key'});if(snapshotError)console.warn('[cloud] snapshot failed:',snapshotError.message);},350);}
function installLocalStorageSync(){if(syncInstalled||typeof window==='undefined')return;syncInstalled=true;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key:string,value:string){original.call(this,key,value);if(this===window.localStorage&&(KEYS as readonly string[]).includes(key))syncInventoryState();};}
installLocalStorageSync();export const cloudSyncConfigured=()=>Boolean(supabase);
