import "server-only";
import { createAdminClient } from "./supabase/admin";

/** True if a paid order exists for this report (i.e. the buyer unlocked it). */
export async function hasPaidOrder(reportId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("id")
    .eq("report_id", reportId)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}
