# KASSIX POS

A simple point of sale for small businesses: products, inventory, a fast register, sales history
with receipts, and sales/profit reports. Windows 98 look, built with Next.js 16, Supabase
(Postgres + Auth), Tailwind CSS, Recharts, React Hook Form and Zod.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable
   (anon) key from **Project Settings → API Keys**.
3. Create the database objects: run each file in `supabase/migrations/` in order
   (`20260929000000_init.sql`, `20260929120000_free_trial.sql`, `20260930000000_kassix_pro.sql`) in the Supabase **SQL editor**,
   or run `npx supabase link --project-ref <ref>` then `npx supabase db push`.
4. In **Authentication → URL Configuration**, set the Site URL to where the app runs and add
   `http://localhost:3000/**` (plus your deployed domain) to Redirect URLs. While testing you can
   instead switch off **Confirm email** under Sign In / Providers → Email.
5. `npm run dev` and create an account at http://localhost:3000.

## Scripts

| Command         | What it does                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`   | Development server                                                                           |
| `npm run build` | Production build (type-checks)                                                               |
| `npm run lint`  | ESLint                                                                                       |
| `npm test`      | Runs the migration in an in-process Postgres (PGlite) and tests RLS, sales and stock logic, plus unit tests |

## Free trial

Every new business gets 60 days free, starting when its profile is created (first sign-in).
The sign-up form says so, and the taskbar and Settings show the days left. `profiles.trial_ends_at`
holds the end date; owners can't change it, but you can extend a trial in the Supabase dashboard.

## KASSIX Pro (PayMongo)

After the trial, KASSIX Pro costs ₱149 for 30 days or ₱1,490 for 365 days, paid through a PayMongo
hosted checkout (GCash, Maya, QR Ph, GrabPay, cards). Nothing renews automatically: each payment adds
its days after the account's current end date (`profiles.paid_until`), so paying early loses nothing.

- **Lock:** once the trial and paid time are over, every page sends the owner to `/billing`. The
  database enforces the same rule: RLS hides and protects all business data, and `complete_sale` /
  `adjust_stock` refuse to run. Data is kept and comes back as soon as the account pays.
- **Payments** are recorded only by the webhook `/api/paymongo/webhook`, which checks PayMongo's
  signature and calls `record_payment()` with the Supabase secret key. It's idempotent per checkout
  session, so PayMongo's retries never add time twice. Owners can read their payment history but
  can't write it.
- **Safety net:** when an owner comes back from checkout and the webhook hasn't landed yet, `/billing`
  asks PayMongo directly about their latest checkout (its id is kept in an httpOnly cookie) and records
  it if it's paid. A late or misconfigured webhook never leaves a paying owner stuck on "Confirming".

Setup:

1. Run `supabase/migrations/20260930000000_kassix_pro.sql`.
2. In PayMongo, enable the payment methods (Settings → Payment Methods) and create a webhook
   (Developers → Webhooks) to `https://<your-domain>/api/paymongo/webhook` for the
   `checkout_session.payment.paid` event.
3. Set `SUPABASE_SECRET_KEY`, `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` (see `.env.example`)
   in Vercel and redeploy. Test keys and a test webhook first; switch both to live when you go live.

To try the lock, set a test account's `trial_ends_at` to a past date in the Supabase table editor.

## Public site and welcome email

- **Home page** (`/`, signed-out visitors), **Terms** (`/terms`), **Privacy Policy** (`/privacy`) and
  **Return & Refund Policy** (`/refunds`) live in `app/(site)/`. PayMongo reviews these before
  going live, so they show pricing in pesos, the operator's registered address and contact details.
  The operator's details are in `lib/business.ts`.
- **User guide:** `public/user-guide.html` is the owner-made guide, served as-is at `/user-guide.html`.
  Replace the file to update it.
- **Welcome email:** a business's first sign-in (when its profile is created) sends one welcome email
  through Brevo, after the page has loaded, with the how-to video, the user guide and the trial end
  date. Set `BREVO_API_KEY` and `EMAIL_FROM` (a sender verified in Brevo, see `.env.example`); without
  them the email is skipped and signing up works as usual.

## Sign-up confirmation and password reset emails

Supabase Auth sends these. Its built-in mailer only delivers to your Supabase team's own addresses
and (on new free projects) can't use custom templates, so send them through Brevo instead:

1. **Authentication → Emails → SMTP Settings:** enable custom SMTP with host `smtp-relay.brevo.com`,
   port `587`, your Brevo SMTP login and an SMTP key (Brevo → SMTP & API → SMTP), sender
   `kassix@air-rally.com`, name `KASSIX`.
2. **Authentication → Emails → Templates:** paste `supabase/templates/confirm-signup.html` into
   "Confirm signup" (subject: *Confirm your email for KASSIX*) and
   `supabase/templates/reset-password.html` into "Reset password" (subject: *Reset your KASSIX
   password*). Their links carry a `token_hash` that `/auth/callback` verifies, so they work even when
   opened on another device.
3. **Authentication → URL Configuration:** Site URL `https://kassix-pos.vercel.app` (the templates build
   links from it), and `https://kassix-pos.vercel.app/**` under Redirect URLs.

With "Confirm email" on, an address can only have one account: signing up again with a confirmed
address shows "This email address already has a KASSIX account." Forgotten passwords: *Forgot
password?* on the sign-in form emails a link to `/reset-password`.

## Import and export

- **Export sales:** the Sales page downloads the sales matching the current filters (`/sales/export`),
  in the business's timezone: *Export sales* is one row per sale (products, totals, cost, profit as in
  Reports); *Export products sold* (`?rows=items`) is one row per product line with SKU, category,
  quantity, line total, cost and profit before discount (discounts apply to the whole sale).
- **Export products:** *Export CSV* on the Products page (`/products/export`, same filters as the list)
  uses the import template's columns plus Status and Stock value (stock × cost), so an exported list
  can be imported into another account. Re-importing into the same account only adds new products.
- **Import products:** *Import CSV* on the Products page reads a CSV (the downloadable template, or any
  sheet with Name and Price columns; common header names like "Selling Price" or "Qty" work too),
  previews what's ready and what to fix, and adds new products in one insert. Missing categories are
  created. Products already in KASSIX (same SKU, or same name without a SKU) are skipped, never
  overwritten, so stock still only changes through Inventory and importing a file twice is safe.

## Appearance

Settings → Appearance offers three looks per account: **The Original** (Windows 98, the default),
**White** and **Black** (iOS 26 style: glass sidebar and tab bar, opaque cards). The choice is stored
in `profiles.ui_theme`. Signing in, the public site and billing always use the original.

- The app shell sets `data-theme` on its root and on `<html>` (for dialogs and toasts portalled to
  `<body>`), so pages outside the app never carry it.
- `app/globals.css` restyles the existing component classes under `[data-theme]` and remaps the Win98
  colour tokens to system colours, so most markup is shared. Theme-specific tweaks use the `ios:`
  variant; screens whose layout differs (dashboard, register, Sales with its receipt panel, Settings)
  branch on the theme (`Window` and server pages read it from the profile, client components from
  `useIos()`).

## How the data stays correct

- Every table has Row Level Security; each user only sees and changes their own rows.
- A sale is recorded by one Postgres function, `complete_sale`, in a single transaction: it locks
  the products, rejects insufficient stock, computes prices/tax/totals server-side, writes the
  sale, its items and the inventory movements, and decrements stock. If anything fails, nothing
  is written. The client sends a per-checkout id, so a retried request can't record a sale twice.
- Stock levels can only change through `complete_sale`, `adjust_stock` (restock / stock
  count) and `void_sale`, so every change lands in the `inventory_movements` audit trail.
- A sale recorded by mistake is voided from its receipt page (*Void sale*, with a reason):
  `void_sale` puts its items back into stock (VOID movements), marks it voided with when and why,
  and it drops out of the dashboard and reports. It stays in Sales and the exports, marked Voided;
  receipt numbers are never reused, and a void can't be undone.
- Sale items store the product name, price and cost at the time of sale, so editing or
  archiving a product never changes history. Products that have been sold are archived instead
  of deleted.
