import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, LogIn, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';

const ADMIN_EMAIL = 'nightowlclub72@gmail.com';
const USERS_KEY = 'keystone-auth-users-v1';
const ADMIN_KEY = 'keystone-auth-admin-v1';
const SESSION_KEY = 'keystone-auth-session-v1';

type Role = 'admin' | 'staff';
type Account = { id: string; username: string; passwordHash: string; role: Role; createdAt: string };
type Session = { username: string; role: Role };

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function PasswordField({ label, value, onChange, placeholder, autoComplete }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500"><span>{label}</span>{value.length > 0 && <span className={value.length >= 8 ? 'text-emerald-600' : 'text-amber-600'}>{value.length >= 8 ? 'Strong enough' : `${value.length}/8`}</span>}</span>
      <span className="relative block">
        <input required type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-sm font-semibold outline-none transition placeholder:text-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
        <button type="button" onClick={() => setVisible(v => !v)} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  return <label className="block space-y-2"><span className="px-1 text-[11px] font-bold text-slate-500">{label}</span><input required type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition placeholder:text-slate-300 focus:border-violet-400 focus:ring-4 focus:ring-violet-100" /></label>;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const hasAdmin = Boolean(localStorage.getItem(ADMIN_KEY));
  const [mode, setMode] = useState<'login' | 'setup'>(hasAdmin ? 'login' : 'setup');
  const [identifier, setIdentifier] = useState(hasAdmin ? '' : ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const normalized = identifier.trim().toLowerCase();
      const suppliedHash = await hash(password);
      if (mode === 'setup') {
        if (normalized !== ADMIN_EMAIL) throw new Error('Only the authorized admin email can activate this workspace.');
        if (password.length < 8) throw new Error('Use at least 8 characters for the admin password.');
        if (password !== confirm) throw new Error('Passwords do not match.');
        write(ADMIN_KEY, { email: ADMIN_EMAIL, passwordHash: suppliedHash });
        const session = { username: ADMIN_EMAIL, role: 'admin' as const };
        write(SESSION_KEY, session); onLogin(session); return;
      }
      const admin = read<{ email: string; passwordHash: string } | null>(ADMIN_KEY, null);
      if (normalized === ADMIN_EMAIL && admin?.passwordHash === suppliedHash) {
        const session = { username: ADMIN_EMAIL, role: 'admin' as const };
        write(SESSION_KEY, session); onLogin(session); return;
      }
      const account = read<Account[]>(USERS_KEY, []).find(a => a.username.toLowerCase() === normalized && a.passwordHash === suppliedHash);
      if (!account) throw new Error('Incorrect username/email or password.');
      const session = { username: account.username, role: account.role };
      write(SESSION_KEY, session); onLogin(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally { setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f7fb] px-4 py-5 text-slate-950 sm:px-8">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-indigo-200/25 blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-[1040px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_35px_100px_rgba(15,23,42,.12)] md:grid-cols-[.9fr_1.1fr]">
          <div className="relative hidden min-h-[620px] overflow-hidden bg-[#11101f] p-9 text-white md:flex md:flex-col md:justify-between">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 25% 20%, rgba(167,139,250,.45), transparent 32%), radial-gradient(circle at 80% 80%, rgba(99,102,241,.28), transparent 34%)' }} />
            <div className="relative">
              <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><ShieldCheck className="h-6 w-6" /></div>
              <p className="text-[10px] font-black uppercase tracking-[.25em] text-violet-200/70">Private workspace</p>
              <h1 className="mt-3 max-w-sm text-5xl font-black leading-[.95] tracking-[-.065em]">Your stock.<br />Under control.</h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">A focused inventory workspace for products, purchases and sales — with admin-issued staff access.</p>
            </div>
            <div className="relative space-y-2 text-[11px] text-white/45"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Private workspace access</div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" />Admin-controlled credentials</div></div>
          </div>

          <div className="p-6 sm:p-9 md:p-12">
            <div className="mb-8 flex items-center justify-between">
              <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-500">Keystone Inventory</p><h2 className="mt-2 text-3xl font-black tracking-[-.055em]">{mode === 'setup' ? 'Secure the workspace.' : 'Welcome back.'}</h2></div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><KeyRound className="h-5 w-5" /></div>
            </div>
            <p className="mb-7 max-w-md text-sm leading-6 text-slate-500">{mode === 'setup' ? 'Activate the authorized admin account once, then use it to issue staff credentials.' : 'Sign in with the admin account or credentials issued from the admin console.'}</p>

            <form onSubmit={submit} className="space-y-4">
              <Field label={mode === 'setup' ? 'Authorized admin email' : 'Username or admin email'} type={mode === 'setup' ? 'email' : 'text'} value={identifier} onChange={setIdentifier} placeholder={ADMIN_EMAIL} autoComplete="username" />
              {mode === 'setup' ? <><PasswordField label="Create admin password" value={password} onChange={setPassword} placeholder="Minimum 8 characters" autoComplete="new-password" /><PasswordField label="Confirm admin password" value={confirm} onChange={setConfirm} placeholder="Repeat password" autoComplete="new-password" /></> : <PasswordField label="Password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" />}
              {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700">{error}</div>}
              <button disabled={busy} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#11101f] text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50">{mode === 'setup' ? <ShieldCheck className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}{busy ? 'Checking…' : mode === 'setup' ? 'Activate admin access' : 'Sign in'}</button>
            </form>

            {mode === 'login' && <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-400">Staff accounts are created only by the signed-in admin. If you are the workspace owner and this browser has lost its admin setup, use the same browser/profile where the admin account was activated.</div>}
            {mode === 'setup' && <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[11px] font-semibold leading-5 text-amber-800">First-run setup is intentionally limited to <span className="font-black">{ADMIN_EMAIL}</span>.</div>}
          </div>
        </div>
      </div>
    </div>
  );
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

  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-4 backdrop-blur-sm"><div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-[30px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-500">Admin only</p><h2 className="mt-1 text-xl font-black tracking-tight">Credential manager</h2><p className="mt-1 text-[11px] text-slate-400">Issue or revoke staff access.</p></div><button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div><div className="grid gap-5 p-6 md:grid-cols-[1fr_1.2fr]">
    <form onSubmit={createAccount} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="mb-4 flex items-center gap-2"><UserPlus className="h-4 w-4" /><span className="text-sm font-black">Issue staff login</span></div><div className="space-y-3"><Field label="Username" value={username} onChange={setUsername} placeholder="store-manager" autoComplete="off" /><label className="block space-y-2"><span className="px-1 text-[11px] font-bold text-slate-500">Temporary password</span><input required type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="8+ characters" autoComplete="off" className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" /></label>{error && <p className="text-xs font-bold text-red-600">{error}</p>}<button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-700"><KeyRound className="h-4 w-4" />Create credentials</button></div></form>
    <div><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Users className="h-4 w-4" /><span className="text-sm font-black">Active staff</span></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{accounts.length}</span></div>{created && <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 text-emerald-600" /><div className="min-w-0 flex-1"><p className="text-xs font-black text-emerald-800">Credentials created</p><p className="mt-1 break-all text-xs font-bold text-emerald-700">{created.username} · {created.password}</p></div><button type="button" onClick={copyCredentials} className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-black text-emerald-700 shadow-sm">{copied ? 'Copied' : 'Copy'}</button></div></div>}{accounts.length ? <div className="space-y-2">{accounts.map(a => <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Users className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{a.username}</p><p className="text-[10px] text-slate-400">Staff · created {new Date(a.createdAt).toLocaleDateString('en-IN')}</p></div><button type="button" onClick={() => remove(a.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Revoke ${a.username}`}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">No staff credentials yet.</div>}</div>
  </div><div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-[10px] leading-5 text-slate-400">Admin account: {ADMIN_EMAIL}. Staff accounts are stored in this browser's local storage. This is a browser access layer, not a server-side security boundary; a true multi-device login system needs a backend database and server-side sessions.</div></div></div>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => read<Session | null>(SESSION_KEY, null));
  const [adminOpen, setAdminOpen] = useState(false);
  const isAdmin = session?.role === 'admin';
  const sessionLabel = useMemo(() => session?.username ?? '', [session]);
  if (!session) return <LoginScreen onLogin={setSession} />;
  return <div className="relative"><div className="fixed right-3 top-3 z-[90] flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 p-1.5 shadow-lg backdrop-blur"><span className="hidden max-w-[180px] truncate px-2 text-[10px] font-black text-slate-500 sm:block">{sessionLabel}</span>{isAdmin && <button onClick={() => setAdminOpen(true)} className="rounded-full bg-violet-600 px-3 py-2 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-violet-700">Admin</button>}<button onClick={() => { localStorage.removeItem(SESSION_KEY); setSession(null); }} className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-600 transition hover:bg-slate-200">Log out</button></div>{children}{adminOpen && <AdminConsole onClose={() => setAdminOpen(false)} />}</div>;
}
