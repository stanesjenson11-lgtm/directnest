import { NextResponse } from "next/server";
import { inrShort } from "@/lib/format";
import { searchCards } from "@/lib/listings";
import { parseSearch } from "@/lib/parse-search";

// The home page's map: the same homes, at the same places, as /search with no filters (its pins). Cached at the edge so
// the home page itself stays static and the database sees one query every few minutes, not one per visitor.
export async function GET() {
  const cards = await searchCards(parseSearch({}));
  const pins = cards.map((c) => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    label: inrShort(c.type === "rent" ? c.price + c.maintenance : c.price),
  }));
  return NextResponse.json(pins, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
