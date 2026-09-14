import fs from 'node:fs';

const path = 'artifacts/electronics-inventory/src/auth.tsx';
let source = fs.readFileSync(path, 'utf8');

const oldGetSession = "supabase.auth.getSession().then(({data})=>{void sync(data.session?.user??null);}).catch(error=>{console.warn('[auth] getSession failed:',error);if(alive)setAuthReady(true);});";
const newGetSession = `const restoreSession = async () => {
     for(let attempt=0; attempt<4; attempt++){
       try{
         const {data}=await supabase!.auth.getSession();
         if(data.session?.user){await sync(data.session.user);return;}
         if(attempt<3)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
       }catch(error){
         console.warn('[auth] getSession failed:',error);
         if(attempt<3)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
       }
     }
     if(alive){
       clearTenantCache();
       localStorage.removeItem(SESSION_KEY);
       localStorage.removeItem(PROFILE_KEY);
       setSession(null);
       setAuthReady(true);
     }
   };
   void restoreSession();`;
if(source.includes(oldGetSession)) source=source.replace(oldGetSession,newGetSession);
else if(!source.includes('const restoreSession = async () =>')) throw new Error('Auth getSession anchor not found.');

fs.writeFileSync(path, source);
console.log('Supabase session restoration retry patch applied.');
