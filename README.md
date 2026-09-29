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

After the trial, KASSIX Pro costs ₱399 for 30 days or ₱3,990 for 365 days, paid through a PayMongo
hosted checkout (GCash, Maya, QR Ph, GrabPay, cards). Nothing renews automatically: each payment adds
its days after the account's current end date (`profiles.paid_until`), so paying early loses nothing.

- **Lock:** once the trial and paid time are over, every page sends the owner to `/billing`. The
  database enforces the same rule: RLS hides and protects all business data, and `complete_sale` /
  `adjust_stock` refuse to run. Data is kept and comes back as soon as the account pays.
- **Payments** are recorded only by the webhook `/api/paymongo/webhook`, which checks PayMongo's
  signature and calls `record_payment()` with the Supabase secret key. It's idempotent per checkout
  session, so PayMongo's retries never add time twice. Owners can read their payment history but
  can't write it.

Setup:

1. Run `supabase/migrations/20260930000000_kassix_pro.sql`.
2. In PayMongo, enable the payment methods (Settings → Payment Methods) and create a webhook
   (Developers → Webhooks) to `https://<your-domain>/api/paymongo/webhook` for the
   `checkout_session.payment.paid` event.
3. Set `SUPABASE_SECRET_KEY`, `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` (see `.env.example`)
   in Vercel and redeploy. Test keys and a test webhook first; switch both to live when you go live.

To try the lock, set a test account's `trial_ends_at` to a past date in the Supabase table editor.

## How the data stays correct

- Every table has Row Level Security; each user only sees and changes their own rows.
- A sale is recorded by one Postgres function, `complete_sale`, in a single transaction: it locks
  the products, rejects insufficient stock, computes prices/tax/totals server-side, writes the
  sale, its items and the inventory movements, and decrements stock. If anything fails, nothing
  is written. The client sends a per-checkout id, so a retried request can't record a sale twice.
- Stock levels can only change through `complete_sale` and `adjust_stock` (restock / stock
  count), so every change lands in the `inventory_movements` audit trail.
- Sale items store the product name, price and cost at the time of sale, so editing or
  archiving a product never changes history. Products that have been sold are archived instead
  of deleted.
