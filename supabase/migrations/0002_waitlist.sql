-- llar · early-access waitlist
-- Apply via the Supabase SQL editor or `supabase db push`.
--
-- Captures leads from the /[locale]/early-access page while the live
-- report-generation flow is gated. Append-only: a person may sign up more
-- than once (e.g. to add a flat later), so email is intentionally NOT unique.
-- The floor/door are stored separately from the address so the exact unit is
-- queryable when we open.

create table if not exists waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  address    text,
  floor      text,
  door       text,
  locale     text,
  created_at timestamptz not null default now()
);
create index if not exists waitlist_email_idx on waitlist (email);
create index if not exists waitlist_created_idx on waitlist (created_at);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Locked down like every other table. Inserts happen server-side via the
-- SERVICE ROLE key (which bypasses RLS); signed-in operators can read the list.
alter table waitlist enable row level security;

create policy operator_all_waitlist on waitlist
  for all to authenticated using (true) with check (true);
