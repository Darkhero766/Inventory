import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, LogIn, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';

const ADMIN_EMAIL = 'nightowlclub72@gmail.com';
const USERS_KEY = 'keystone-auth-users-v1';
const ADMIN_KEY = 'keystone-auth-admin-v1';
const SESSION_KEY = 'keystone-auth-session-v1';

type Role = 'admin' | 'staff';
type Account = { id: string; username: string; passwordHash: string; role: Role; createdAt: string };
type Session = { username: string; role: Role };

const read = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  return <label className="block space-y-1.5"><span className="text-[11px] font-semibold text-slate-500">{label}</span><input required type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100" /></label>;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'setup'>(() => localStorage.getItem(ADMIN_KEY) ? 'login' : 'setup');
  const [identifier, setIdentifier] = useState(() => localStorage.getItem(ADMIN_KEY) ? '' : ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'setup') {
        if (identifier.trim().toLowerCase() !== ADMIN_EMAIL) throw new Error('Admin email does not match the authorized account.');
        if (password.length < 8) throw new Error('Use at least 8 characters for the admin password.');
        if (password !== confirm) throw new Error('Passwords do not match.');
        write(ADMIN_KEY, { email: ADMIN_EMAIL, passwordHash: await hash(password) });
        write(SESSION_KEY, { username: ADMIN_EMAIL, role: 'admin' });
        onLogin({ username: ADMIN_EMAIL, role: 'admin' });
        return;
      }
      const normalized = identifier.trim().toLowerCase();
      const suppliedHash = await hash(password);
      const admin = read<{ email: string; passwordHash: string } | null>(ADMIN_KEY, null);
      if (normalized === ADMIN_EMAIL && admin?.passwordHash === suppliedHash) {
        write(SESSION_KEY, { username: ADMIN_EMAIL, role: 'admin' });
        onLogin({ username: ADMIN_EMAIL, role: 'admin' });
        return;
      }
      const account = read<Account[]>(USERS_KEY, []).find(a => a.username.toLowerCase() === normalized && a.passwordHash === suppliedHash);
      if (!account) throw new Error('Incorrect username/email or password.');
      write(SESSION_KEY, { username: account.username, role: account.role });
      onLogin({ username: account.username, role: account.role });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  };

  return <div className="min-h-screen bg-[#f7f7fb] px-5 py-8 text-slate-950 sm:px-8"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center"><div className="w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,.10)]"><div className="bg-[#11101f] px-7 pb-8 pt-9 text-white"><div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><ShieldCheck className="h-6 w-6" /></div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-white/50">Keystone Inventory</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.055em]">{mode === 'setup' ? 'Secure your workspace.' : 'Welcome back.'}</h1><p className="mt-2 text-sm leading-6 text-white/60">{mode === 'setup' ? 'Activate the authorized admin account before issuing staff credentials.' : 'Sign in with credentials issued by your inventory administrator.'}</p></div><form onSubmit={submit} className="space-y-5 p-7"><Field label={mode === 'setup' ? 'Authorized admin email' : 'Username or admin email'} type={mode === 'setup' ? 'email' : 'text'} value={identifier} onChange={setIdentifier} placeholder={ADMIN_EMAIL} autoComplete="username" />{mode === 'setup' ? <><Field label="Create admin password" type="password" value={password} onChange={setPassword} placeholder="Minimum 8 characters" autoComplete="new-password" /><Field label="Confirm admin password" type="password" value={confirm} onChange={setConfirm} placeholder="Repeat password" autoComplete="new-password" /></> : <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />}{error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{error}</div>}<button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#11101f] text-sm font-bold text-white transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50">{mode === 'setup' ? <ShieldCheck className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{busy ? 'Working…' : mode === 'setup' ? 'Activate admin access' : 'Sign in'}</button>{mode === 'login' && <p className="text-center text-[11px] text-slate-400">Staff access is created only from the admin console.</p>}</form></div></div></div>;
}

function AdminConsole({ onClose }: { onClose: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>(() => read<Account[]>(USERS_KEY, []));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState('');

  const createAccount = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setCopied(false);
    const clean = username.trim();
    if (clean.length < 3) return setError('Username must be at least 3 characters.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (clean.toLowerCase() === ADMIN_EMAIL || accounts.some(a => a.username.toLowerCase() === clean.toLowerCase())) return setError('That username is already in use.');
    const account: Account = { id: crypto.randomUUID(), username: clean, passwordHash: await hash(password), role: 'staff', createdAt: new Date().toISOString() };
    const next = [account, ...accounts]; setAccounts(next); write(USERS_KEY, next); setCreated({ username: clean, password }); setUsername(''); setPassword('');
  };
  const remove = (id: string) => { const next = accounts.filter(a => a.id !== id); setAccounts(next); write(USERS_KEY, next); };
  const copyCredentials = async () => { if (!created) return; await navigator.clipboard?.writeText(`Username: ${created.username}\nPassword: ${created.password}`); setCopied(true); };

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-4 backdrop-blur-sm"><div className="mx-auto mt-8 max-w-2xl overflow-hidden rounded-[30px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-500">Admin only</p><h2 className="mt-1 text-xl font-extrabold tracking-tight">Credential manager</h2></div><button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="grid gap-5 p-6 md:grid-cols-[1fr_1.2fr]"><form onSubmit={createAccount} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-4 flex items-center gap-2"><UserPlus className="h-4 w-4" /><span className="text-sm font-bold">Issue staff login</span></div><div className="space-y-3"><Field label="Username" value={username} onChange={setUsername} placeholder="store-manager" autoComplete="off" /><Field label="Temporary password" type="text" value={password} onChange={setPassword} placeholder="8+ characters" autoComplete="off" />{error && <p className="text-xs font-semibold text-red-600">{error}</p>}<button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white hover:bg-violet-700"><KeyRound className="h-4 w-4" />Create credentials</button></div></form><div><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="text-sm font-bold">Active staff</span></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{accounts.length}</span></div>{created && <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-emerald-800">Credentials created</p><p className="mt-1 text-xs text-emerald-700">{created.username} · {created.password}</p></div><button onClick={copyCredentials} className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">{copied ? 'Copied' : 'Copy'}</button></div></div>}{accounts.length ? <div className="space-y-2">{accounts.map(a => <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Users className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{a.username}</p><p className="text-[10px] text-slate-400">Staff · created {new Date(a.createdAt).toLocaleDateString('en-IN')}</p></div><button onClick={() => remove(a.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Revoke ${a.username}`}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">No staff credentials yet.</div>}</div></div><div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-[10px] leading-5 text-slate-400">Admin account: {ADMIN_EMAIL}. Accounts are stored in this browser's local storage. This is a private-workspace access layer, not a server-side security boundary; cross-device authentication needs a backend database.</div></div></div>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => read<Session | null>(SESSION_KEY, null));
  const [adminOpen, setAdminOpen] = useState(false);
  useEffect(() => { if (session) write(SESSION_KEY, session); }, [session]);
  const isAdmin = session?.role === 'admin';
  const sessionLabel = useMemo(() => session?.username ?? '', [session]);
  if (!session) return <LoginScreen onLogin={setSession} />;
  return <div className="relative"><div className="fixed right-3 top-3 z-[90] flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 p-1.5 shadow-lg backdrop-blur"><span className="hidden max-w-[180px] truncate px-2 text-[10px] font-bold text-slate-500 sm:block">{sessionLabel}</span>{isAdmin && <button onClick={() => setAdminOpen(true)} className="rounded-full bg-violet-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-violet-700">Admin</button>}<button onClick={() => { localStorage.removeItem(SESSION_KEY); setSession(null); }} className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-200">Log out</button></div>{children}{adminOpen && <AdminConsole onClose={() => setAdminOpen(false)} />}</div>;
}
