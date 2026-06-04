import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. BYPASSES Row Level Security — server-only,
 * never import into client code. Used by the generation pipeline and operator
 * actions that write reports/sources/cache.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
