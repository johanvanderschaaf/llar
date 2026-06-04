import { NextResponse } from "next/server";
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
  } catch {
    return NextResponse.json({ streets: [] });
  }
}
