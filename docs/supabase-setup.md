# Supabase setup (Phase 2)

You only need to do this once. ~5 minutes.

## 1. Create the project
1. Go to <https://supabase.com> → **New project**.
2. Name it (e.g. `llar`), pick a region close to you (e.g. `eu-west`), set a
   strong database password (save it somewhere; not needed by the app).
3. Wait for it to finish provisioning.

## 2. Copy the keys into `.env.local`
In the dashboard: **Project Settings → API**. Copy:

| Supabase field            | `.env.local` variable             |
| ------------------------- | --------------------------------- |
| Project URL               | `NEXT_PUBLIC_SUPABASE_URL`        |
| `anon` `public` key       | `NEXT_PUBLIC_SUPABASE_ANON_KEY`   |
| `service_role` `secret`   | `SUPABASE_SERVICE_ROLE`           |

> The `service_role` key bypasses all security — keep it server-side only. It is
> already excluded from the client bundle (no `NEXT_PUBLIC_` prefix).

## 3. Apply the schema
In the dashboard: **SQL Editor → New query**, paste the contents of
`supabase/migrations/0001_init.sql`, and **Run**. This creates `reports`,
`report_sources`, `source_cache`, `orders`, with Row Level Security enabled.

## 4. Enable magic-link login + add yourself as the operator
1. **Authentication → Providers → Email**: ensure **Email** is enabled and turn
   **Confirm email** on (magic link).
2. **Authentication → URL Configuration**: add `http://localhost:3000/**` (and
   later your Vercel URL) to the redirect allowlist.
3. **Authentication → Users → Add user → Send invitation** to your own email.
   That address becomes the operator login.

## 5. Tell me when done
Once the keys are in `.env.local` and the migration has run, I'll wire the
operator login + dashboard and we'll verify it live against your project.
