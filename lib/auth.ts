import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Require a signed-in operator; redirect to login otherwise. */
export async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return user;
}
