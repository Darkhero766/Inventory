import fs from 'node:fs';

const file = 'artifacts/electronics-inventory/src/App.tsx';
let source = fs.readFileSync(file, 'utf8');

// The premium dashboard patch previously hard-coded the demo account name/avatar.
// Resolve the currently authenticated profile from the account profile cache instead.
const oldGreeting = "  const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';\n  const todayLabel=";
const newGreeting = `  const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';\n  const [accountName,setAccountName]=useState(()=>{try{const raw=localStorage.getItem('keystone-account-profile-v1');const p=raw?JSON.parse(raw):null;return String(p?.name||p?.email?.split('@')[0]||'').trim()||'there';}catch{return 'there';}});\n  useEffect(()=>{const refresh=()=>{try{const raw=localStorage.getItem('keystone-account-profile-v1');const p=raw?JSON.parse(raw):null;setAccountName(String(p?.name||p?.email?.split('@')[0]||'').trim()||'there');}catch{setAccountName('there');}};window.addEventListener('keystone-inventory-hydrated',refresh);return()=>window.removeEventListener('keystone-inventory-hydrated',refresh);},[]);\n  const initials=accountName.split(/\\s+/).filter(Boolean).slice(0,2).map((part:string)=>part[0]).join('').toUpperCase()||'?';\n  const todayLabel=`;
if (source.includes(oldGreeting) && !source.includes('const [accountName,setAccountName]')) {
  source = source.replace(oldGreeting, newGreeting);
}
source = source.replaceAll('{greeting}, Aarav', '{greeting}, {accountName}');
source = source.replaceAll('<span className="home-dashboard__avatar">AM</span>', '<span className="home-dashboard__avatar">{initials}</span>');

fs.writeFileSync(file, source);
console.log('Home account identity made dynamic.');
