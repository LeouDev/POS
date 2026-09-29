-- 60-day free trial: every business gets trial_ends_at 60 days after its profile is created
-- (first sign-in). Owners can't set or change it themselves; extend a trial from the dashboard
-- or SQL editor with e.g.  update profiles set trial_ends_at = trial_ends_at + interval '30 days' where ...

alter table public.profiles
  add column trial_ends_at timestamptz not null default (now() + interval '60 days');

-- Accounts that already exist get 60 days from when they were created.
update public.profiles set trial_ends_at = created_at + interval '60 days';

-- Profiles are created by the app on first sign-in. Only these columns may be supplied, so the
-- trial end, receipt counter and creation time always come from their defaults.
revoke insert on public.profiles from authenticated;
grant insert (user_id, business_name, owner_name, currency, tax_rate, timezone) on public.profiles to authenticated;
