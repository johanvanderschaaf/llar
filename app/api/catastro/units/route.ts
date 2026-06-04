import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { locateUnits } from "@/adapters/catastro-search";

/** GET /api/catastro/units?tv=CL&nv=SORS&num=35 → unit matches (operator-only). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const tv = sp.get("tv") ?? "";
  const nv = sp.get("nv") ?? "";
  const num = sp.get("num") ?? "";
  if (!tv || !nv || !num) {
    return NextResponse.json({ units: [] });
  }
  try {
    const units = await locateUnits(tv, nv, num);
    return NextResponse.json({ units });
  } catch {
    return NextResponse.json({ units: [] });
  }
}
