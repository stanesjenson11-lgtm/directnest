// The one seam between pages and data. Swap these bodies for Postgres/PostGIS queries; callers stay the same.
import { LOCALITIES, nearestMetro } from "./places";
import { filterListings, haversine, type Listing, type SearchParams } from "./search";
import { SEED } from "./seed";

/** What a result tile and a map pin need, and nothing more. */
export type Card = Pick<
  Listing,
  "id" | "type" | "title" | "locality" | "area" | "lat" | "lng" | "price" | "maintenance" | "deposit" | "bhk" | "carpetSqft" | "furnishing" | "confirmedDaysAgo"
> & { photos: string[]; metro: { name: string; metres: number } };

export const toCard = (l: Listing): Card => ({
  id: l.id,
  type: l.type,
  title: l.title,
  locality: l.locality,
  area: l.area,
  lat: l.lat,
  lng: l.lng,
  price: l.price,
  maintenance: l.maintenance,
  deposit: l.deposit,
  bhk: l.bhk,
  carpetSqft: l.carpetSqft,
  furnishing: l.furnishing,
  confirmedDaysAgo: l.confirmedDaysAgo,
  photos: l.photos.slice(0, 5).map((p) => p.src),
  metro: nearestMetro(l.lat, l.lng),
});

/** True until the database is connected; pages say so instead of passing samples off as real homes. */
export const SAMPLE_DATA = true;

export async function searchListings(p: SearchParams) {
  return filterListings(SEED, p, LOCALITIES);
}

export async function getListing(id: string) {
  return SEED.find((l) => l.id === id);
}

export async function listingIds() {
  return SEED.map((l) => l.id);
}

export async function similarListings(l: Listing, limit = 3) {
  return SEED.filter((o) => o.id !== l.id && o.type === l.type && Math.abs(o.bhk - l.bhk) <= 1)
    .sort((a, b) => haversine(l.lat, l.lng, a.lat, a.lng) - haversine(l.lat, l.lng, b.lat, b.lng))
    .slice(0, limit);
}
