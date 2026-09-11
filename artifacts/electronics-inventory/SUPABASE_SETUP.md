# Supabase + Google + multi-tenant inventory setup

The app uses Supabase Auth for real multi-device sessions and Supabase Postgres for relational inventory data. The browser only uses the public/publishable key. Never put a service-role/secret key in Vite environment variables.

## 1. Run the database migrations

In **Supabase → SQL Editor**, run these files in order:

1. `supabase/schema.sql`
2. `supabase/002_auth_and_workspace.sql`
3. `supabase/003_complete_backend.sql`
4. `supabase/003_relational_sync.sql`
5. `supabase/004_disable_email_confirmation.sql` (checklist only)
6. `supabase/005_customer_sales_rls.sql`
7. `supabase/006_multitenant_admin.sql`
8. `supabase/007_conflict_indexes.sql`

The ownership migrations make every shop's customers, products, sales, sale items and EMI records tenant-scoped by the authenticated Supabase user ID. SKU, invoice and client IDs are also scoped per owner. The database keeps RLS enabled and the sale/EMI functions validate ownership server-side.

## 2. Render environment variables

Add these to the Render Static Site:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

The app still accepts the older `VITE_SUPABASE_ANON_KEY` name for compatibility, but new deployments should use the publishable key.

Redeploy after saving them.

## 3. Disable email verification

The app is designed for immediate account creation, but **Supabase Auth's Confirm Email setting is a project-level Auth setting and cannot be disabled by frontend SQL**.

In Supabase go to:

**Authentication → Providers → Email**

Turn **Confirm Email** / **Email Confirmations** **OFF**.

After that, Create Account can immediately sign in without sending a confirmation link.

> Security note: disabling email confirmation means an attacker can register an address they do not control. If this platform becomes public, use invite-only onboarding, CAPTCHA, or another access-control layer.

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
- The app sends `window.location.origin` as the OAuth redirect.

For local development also add your local origin, for example:

```text
http://localhost:5173
```

## 6. Admin restriction

Google sign-in is intentionally restricted to:

```text
nightowlclub72@gmail.com
```

The platform admin dashboard is available at `/admin` only to that email. Its database RPC also checks the authenticated JWT email, so changing the frontend role flag cannot grant admin access.

The dashboard shows shop-owner counts and aggregate per-owner products, customers, sales, revenue and outstanding EMI. It never exposes passwords, OAuth secrets or service-role credentials.

## 7. Multi-tenant behavior

Every authenticated shop owner gets an isolated workspace:

- Local browser inventory state is cleared when switching to a different Supabase user.
- New staff accounts start with an empty inventory instead of inheriting the previous shop's products.
- Existing owner data is hydrated back from Supabase on that owner's next login/device.
- RLS uses `owner_id = auth.uid()`.
- The snapshot sync RPC writes the caller's `owner_id` rather than trusting a browser-supplied owner ID.
- SKU, invoice number and client IDs can safely repeat across different shops.

## 8. Dedicated sales checkout

The Sales tab now uses a two-step flow: select products, then move to `/sales/checkout`. The checkout page handles customer selection/creation, discounts, mixed payments and EMI schedule creation. EMI plans use the same sale ID as the completed sale, fixing the previous broken relationship.

The existing inventory, customer and sale pages remain intact.

## 9. Multi-device behavior

Supabase Auth persists the authenticated session, so the same account can sign in on a phone, laptop, tablet, or desktop. The same owner's cloud records are restored on each device.

## 10. Important deployment checklist

- Run all eight SQL files in order.
- Configure Render `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Disable **Confirm Email** in Supabase Email provider settings.
- Enable Google provider and configure the Google callback URL.
- Set Supabase Site URL and Redirect URLs to the live Render origin.
- Never add a service-role/secret key to GitHub, Render client environment variables, or the browser.
- Sign in once with the admin account and open `/admin` to verify the owner dashboard.
- Create a second test account and confirm it starts with its own empty customers/products/sales, then sign back into the admin account to confirm the data remains separate.
