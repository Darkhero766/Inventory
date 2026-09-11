const DATA_KEYS=['keystone-products','keystone-history','keystone-purchases','keystone-sales','keystone-customers','keystone-emi-plans','keystone-emi-payments','keystone-sale-draft'] as const;
const ACTIVE='keystone-active-owner-id';

export function prepareTenant(userId:string){
  if(typeof window==='undefined')return;
  const current=localStorage.getItem(ACTIVE);
  if(current!==userId){
    for(const key of DATA_KEYS)localStorage.removeItem(key);
    localStorage.setItem(ACTIVE,userId);
  }
}

export function tenantOwnerId(){return typeof window==='undefined'?null:localStorage.getItem(ACTIVE);}
