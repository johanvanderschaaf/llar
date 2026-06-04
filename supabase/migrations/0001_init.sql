-- llar · Phase 2 initial schema
-- Apply via the Supabase SQL editor or `supabase db push`.

-- ── updated_at helper ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── reports ─────────────────────────────────────────────────────────────────
create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  cadastral_ref text,
  status        text not null default 'draft'
                check (status in ('draft','in_review','published')),
  input         jsonb not null default '{}'::jsonb,
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists reports_status_idx on reports (status);
create index if not exists reports_cadastral_idx on reports (cadastral_ref);
drop trigger if exists reports_updated_at on reports;
create trigger reports_updated_at before update on reports
  for each row execute function set_updated_at();

-- ── report_sources (provenance log) ─────────────────────────────────────────
create table if not exists report_sources (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references reports(id) on delete cascade,
  source     text not null,
  status     text not null check (status in ('ok','unavailable','error','manual')),
  to_verify  boolean not null default false,
  payload    jsonb,
  note       text,
  fetched_at timestamptz not null default now(),
  unique (report_id, source)
);
create index if not exists report_sources_report_idx on report_sources (report_id);

-- ── source_cache (cost/latency control) ─────────────────────────────────────
create table if not exists source_cache (
  source     text not null,
  cache_key  text not null,
  payload    jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (source, cache_key)
);

-- ── orders (created now, used in Phase 4) ───────────────────────────────────
create table if not exists orders (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid references reports(id) on delete set null,
  buyer_email        text,
  status             text not null default 'created'
                     check (status in ('created','checkout','paid','refunded')),
  stripe_session_id  text,
  amount_eur         numeric(10,2),
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index if not exists orders_report_idx on orders (report_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- All tables locked down by default. The server uses the SERVICE ROLE key,
-- which bypasses RLS, for the operator dashboard + pipeline. Authenticated
-- operators get explicit access here so client-side reads also work.
-- Public read of PUBLISHED reports is intentionally deferred to Phase 4
-- (when the consumer funnel exists).
alter table reports        enable row level security;
alter table report_sources enable row level security;
alter table source_cache   enable row level security;
alter table orders         enable row level security;

-- Any signed-in user (the operator) can read/write. Tighten to an allowlist
-- once there is more than one role.
create policy operator_all_reports on reports
  for all to authenticated using (true) with check (true);
create policy operator_all_sources on report_sources
  for all to authenticated using (true) with check (true);
create policy operator_all_cache on source_cache
  for all to authenticated using (true) with check (true);
create policy operator_all_orders on orders
  for all to authenticated using (true) with check (true);
