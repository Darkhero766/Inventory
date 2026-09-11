# Supabase + Google Login setup

The app now supports Supabase Auth with Google for the workspace admin and keeps the existing username/password staff login.

## 1. Supabase project

In Supabase, open **SQL Editor** and run these files in order:

1. `supabase/schema.sql`
2. `supabase/002_auth_and_workspace.sql`

The browser uses only the public/publishable Supabase key. Never put a service-role key in Vite environment variables.

## 2. Render environment variables

Add these environment variables to the Render Static Site:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Redeploy after saving them.

## 3. Enable Google login

In Supabase:

**Authentication → Providers → Google**

Enable Google and enter the Google OAuth Client ID and Client Secret from Google Cloud Console.

In Google Cloud Console, create an OAuth 2.0 Web Client and add the Supabase callback URL shown in the Supabase Google provider screen. It normally looks like:

```text
https://YOUR_PROJECT.supabase.co/auth/v1/callback
```

Do not put the Google Client Secret in the repository or frontend code.

## 4. Supabase URL configuration

In **Authentication → URL Configuration**:

- Set **Site URL** to the deployed Render origin.
- Add the deployed Render origin to **Redirect URLs**.
- The app sends `window.location.origin` as the OAuth redirect, so the same build works on the Render domain and when the domain changes.

For local development also add your local origin, for example:

```text
http://localhost:5173
```

## 5. Admin restriction

Google sign-in is intentionally restricted to:

```text
nightowlclub72@gmail.com
```

A Google account with another email is signed out immediately and cannot enter the private workspace.

The existing admin username/password setup and admin-issued staff credentials remain available.

## 6. Multi-device behavior

Supabase Auth persists the Google admin session, so the admin can sign in from a phone, laptop, or another browser after Google OAuth is configured. Inventory cloud sync continues through Supabase.

The current staff username/password credentials remain a browser access layer. For true multi-device staff accounts, migrate staff credentials to Supabase Auth as a later step rather than storing password hashes in localStorage.
