# KASSIX POS

A simple point of sale for small businesses: products, inventory, a fast register, sales history
with receipts, and sales/profit reports. Windows 98 look, built with Next.js 16, Supabase
(Postgres + Auth), Tailwind CSS, Recharts, React Hook Form and Zod.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable
   (anon) key from **Project Settings → API Keys**.
3. Create the database objects: paste `supabase/migrations/20260929000000_init.sql` into the
   Supabase **SQL editor** and run it, or run
   `npx supabase link --project-ref <ref>` then `npx supabase db push`.
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
