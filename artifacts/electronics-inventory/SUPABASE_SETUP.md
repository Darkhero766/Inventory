# Supabase + Google + relational inventory setup

The app uses Supabase Auth for real multi-device sessions and Supabase Postgres for relational inventory data. The browser only uses the public/publishable key. Never put a service-role/secret key in Vite environment variables.

## 1. Run the database migrations

In **Supabase → SQL Editor**, run these files in order:

1. `supabase/schema.sql`
2. `supabase/002_auth_and_workspace.sql`
3. `supabase/003_relational_sync.sql`

The third migration adds client IDs, relational reconciliation, authenticated-only cloud persistence, and the atomic `complete_sale` database function. Sales are protected against insufficient stock and server-side profit is calculated from purchase cost.

The legacy `inventory_state` table remains as a compatibility snapshot for history/purchases and as a fallback while a project is being migrated. Customers, products, sales, sale items and EMI records are now mirrored into their proper relational tables.

## 2. Render environment variables

Add these to the Render Static Site:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

The app still accepts the older `VITE_SUPABASE_ANON_KEY` name for compatibility, but new deployments should use the publishable key.

Redeploy after saving them.

## 3. Disable email verification

This private shop intentionally does **not** require email verification.

In Supabase go to:

**Authentication → Providers → Email**

Turn **Confirm Email** / **Email Confirmations** **OFF**.

When Confirm Email is disabled, Supabase can return a session immediately from `signUp()` instead of requiring the user to confirm the email first.

The app's Create Account flow is already written for immediate sign-in and no longer tells users to check their email.

> Security note: disabling email confirmation means an attacker can register an address they do not control. For a private shop, keep signup access limited to people who should have workspace access, and consider CAPTCHA or an invite-only flow if the app becomes public.

## 4. Enable Google login

In Supabase:

**Authentication → Providers → Google**

Enable Google and enter the Google OAuth Client ID and Client Secret from Google Cloud Console.

In Google Cloud Console, create an **OAuth 2.0 Web Client** and add the Supabase callback URL shown in the Supabase Google provider screen. It normally looks like:

```text
https://YOUR_PROJECT.supabase.co/auth/v1/callback
```

Do not put the Google Client Secret in the repository or frontend code.

## 5. Supabase URL configuration

In **Authentication → URL Configuration**:

- Set **Site URL** to the deployed Render origin.
- Add the deployed Render origin to **Redirect URLs**.
- The app sends `window.location.origin` as the OAuth redirect, so the same build works on the Render domain and installed/PWA browser contexts using that origin.

For local development also add your local origin, for example:

```text
http://localhost:5173
```

## 6. Admin restriction

Google sign-in is intentionally restricted to:

```text
nightowlclub72@gmail.com
```

A Google account with another email is signed out immediately and cannot enter the private workspace.

Email/password accounts created through **Create account** are staff accounts. The admin email remains reserved for the workspace owner.

## 7. Multi-device behavior

Supabase Auth persists the authenticated session, so the same account can sign in on a phone, laptop, tablet, or desktop. The app now requires an authenticated Supabase session for cloud sync; it no longer creates anonymous Supabase users.

The relational cloud sync mirrors:

- Customers
- Products
- Sales
- Sale items
- EMI plans
- EMI payments

The database has RLS enabled and all browser database operations are performed with the public/publishable key plus the signed-in user's session.

## 8. Important deployment checklist

Before using the live app:

- Run all three SQL files.
- Configure Render `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Disable **Confirm Email** in Supabase Email provider settings.
- Enable Google provider and configure the Google callback URL.
- Set Supabase Site URL and Redirect URLs to the live Render origin.
- Never add a service-role/secret key to GitHub, Render client environment variables, or the browser.
- Sign in once with the admin account before expecting cloud data to synchronize.
