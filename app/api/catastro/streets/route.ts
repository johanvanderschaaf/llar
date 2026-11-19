import { NextResponse } from "next/server";
import { CatastroDownError } from "@/adapters/catastro-outage";
import { searchStreets } from "@/adapters/catastro-search";

/**
 * GET /api/catastro/streets?q=sor → street suggestions.
 * Public: proxies the public Catastro callejero so the buyer form can
 * autocomplete addresses without an account.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const streets = await searchStreets(q);
    return NextResponse.json({ streets });
  } catch (e) {
    // Tell the form the registry is down, so the buyer isn't told "no results"
    // for an address that exists.
    if (e instanceof CatastroDownError) {
      return NextResponse.json({ streets: [], registryDown: true }, { status: 503 });
    }
    return NextResponse.json({ streets: [] });
  }
}
