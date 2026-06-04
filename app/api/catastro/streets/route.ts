import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchStreets } from "@/adapters/catastro-search";

/** GET /api/catastro/streets?q=sor → street suggestions (operator-only). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const streets = await searchStreets(q);
    return NextResponse.json({ streets });
  } catch {
    return NextResponse.json({ streets: [] });
  }
}
