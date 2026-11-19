import { NextResponse } from "next/server";
import { CatastroDownError } from "@/adapters/catastro-outage";
import { locateUnits } from "@/adapters/catastro-search";

/**
 * GET /api/catastro/units?tv=CL&nv=SORS&num=35 → unit matches.
 * Public (proxies public Catastro data) so the buyer form can resolve units.
 */
export async function GET(request: Request) {
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
  } catch (e) {
    // Tell the form the registry is down, so the buyer isn't told "no results"
    // for an address that exists.
    if (e instanceof CatastroDownError) {
      return NextResponse.json({ units: [], registryDown: true }, { status: 503 });
    }
    return NextResponse.json({ units: [] });
  }
}
