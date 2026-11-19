-- llar · "email me when the registry is back" requests
-- Apply via the Supabase SQL editor or `supabase db push`.
--
-- When Catastro (the land registry) is down, the buyer flow can't generate a
-- report. Instead of losing the buyer, it offers to email the report once
-- Catastro is back and stores the request in the existing waitlist table.
-- These columns are all additive and nullable/defaulted, so existing
-- early-access rows and code keep working.

alter table waitlist
  add column if not exists reason text not null default 'early_access'
    check (reason in ('early_access', 'registry_down')),
  -- The exact flat, when the buyer had already picked one.
  add column if not exists cadastral_ref text,
  add column if not exists asking_price_eur numeric,
  -- Filled in by scripts/process-pending.mts once the report is generated.
  add column if not exists report_id uuid references reports(id) on delete set null,
  add column if not exists processed_at timestamptz;

create index if not exists waitlist_pending_idx
  on waitlist (reason, processed_at);
