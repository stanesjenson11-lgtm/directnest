// Pure search logic shared by server and browser: filters → matching listings, params → URL.
// No imports from the app so `node --test lib/search.test.ts` runs it directly.

export type ListingType = "rent" | "buy";
export type Furnishing = "full" | "semi" | "none";
export type Tenant = "family" | "bachelors" | "company";
export type PropertyKind = "apartment" | "independent-house" | "villa";
export type Room = "living" | "bedroom" | "kitchen" | "bathroom" | "exterior" | "balcony";

export interface Photo {
  src: string;
  room: Room;
  credit: string;
}

export interface Listing {
  id: string;
  type: ListingType;
  kind: PropertyKind;
  bhk: number; // 0 = 1 RK
  title: string;
  locality: string;
  area: string;
  lat: number; // public, approximate (jittered); exact address is never in this object
  lng: number;
  price: number; // monthly rent, or sale price
  maintenance: number; // monthly
  deposit: number; // rent only
  carpetSqft: number;
  floor: number;
  totalFloors: number;
  furnishing: Furnishing;
  facing: string;
  ageYears: number;
  availableInDays: number;
  tenants: Tenant[]; // empty = anyone
  pets: boolean;
  nonVeg: boolean;
  parking: "none" | "bike" | "car";
  bathrooms: number;
  balconies: number;
  amenities: string[];
  description: string;
  photos: Photo[];
  owner: { name: string; verified: boolean };
  listedDaysAgo: number;
  confirmedDaysAgo: number;
}

export const SORTS = ["relevant", "newest", "price-asc", "price-desc"] as const;

export type { SearchParams } from "./parse-search.ts";
import type { SearchParams } from "./parse-search.ts";

/** Back to a query string, dropping defaults so URLs stay short and shareable. */
export function toQuery(p: Partial<SearchParams>) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    if ((k === "type" && v === "rent") || (k === "sort" && v === "relevant")) continue;
    if (k === "area" && Array.isArray(v)) {
      const n = v as number[];
      const pairs: string[] = [];
      for (let i = 0; i < n.length; i += 2) pairs.push(`${n[i].toFixed(5)},${n[i + 1].toFixed(5)}`);
      out.set(k, pairs.join(";"));
    } else if (k === "bbox" && Array.isArray(v)) {
      out.set(k, v.map((n) => Number(n).toFixed(4)).join(","));
    } else out.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  return out.toString();
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(a)); // metres
}

/** Ray casting. `poly` is a flat [lng, lat, lng, lat, …] ring. */
export function inPolygon(lng: number, lat: number, poly: number[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [poly[i], poly[i + 1], poly[j], poly[j + 1]];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const monthlyCost = (l: Listing) => (l.type === "rent" ? l.price + l.maintenance : l.price);

/** `centres` maps a locality name to its centre; a matching `q` searches 3 km around it. */
export function filterListings(all: Listing[], p: SearchParams, centres: Record<string, [number, number]> = {}) {
  const q = p.q?.toLowerCase();
  const centre = q ? Object.entries(centres).find(([name]) => name.toLowerCase() === q)?.[1] : undefined;

  const results = all.filter((l) => {
    if (l.type !== p.type) return false;
    if (p.area) {
      if (!inPolygon(l.lng, l.lat, p.area)) return false;
    } else if (p.bbox) {
      const [w, s, e, n] = p.bbox;
      if (l.lng < w || l.lng > e || l.lat < s || l.lat > n) return false;
    } else if (centre) {
      if (haversine(centre[0], centre[1], l.lat, l.lng) > 3000) return false;
    } else if (q && !`${l.title} ${l.locality} ${l.area}`.toLowerCase().includes(q)) return false;

    if (p.bhk?.length && !p.bhk.some((b) => (b === 4 ? l.bhk >= 4 : l.bhk === b))) return false;
    const cost = monthlyCost(l);
    if (p.min !== undefined && cost < p.min) return false;
    if (p.max !== undefined && p.max > 0 && cost > p.max) return false;
    if (p.furnishing?.length && !p.furnishing.includes(l.furnishing)) return false;
    if (p.kind?.length && !p.kind.includes(l.kind)) return false;
    if (p.tenants && l.tenants.length > 0 && !l.tenants.includes(p.tenants)) return false;
    if (p.avail === "now" && l.availableInDays > 0) return false;
    if (p.avail && p.avail !== "now" && l.availableInDays > Number(p.avail)) return false;
    if (p.pets && !l.pets) return false;
    if (p.parking && l.parking !== "car") return false;
    return true;
  });

  const by: Record<SearchParams["sort"], (a: Listing, b: Listing) => number> = {
    // ponytail: "relevant" = freshest owner confirmation first; real ranking comes with the search backend.
    relevant: (a, b) => a.confirmedDaysAgo - b.confirmedDaysAgo || a.listedDaysAgo - b.listedDaysAgo,
    newest: (a, b) => a.listedDaysAgo - b.listedDaysAgo,
    "price-asc": (a, b) => monthlyCost(a) - monthlyCost(b),
    "price-desc": (a, b) => monthlyCost(b) - monthlyCost(a),
  };
  return results.sort(by[p.sort]);
}
