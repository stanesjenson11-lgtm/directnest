import { haversine } from "./search";

export const BENGALURU: [number, number] = [12.9716, 77.5946];

/** Locality centres. Searching one of these names searches 3 km around it. */
export const LOCALITIES: Record<string, [number, number]> = {
  Koramangala: [12.9352, 77.6245],
  "HSR Layout": [12.9116, 77.6474],
  Indiranagar: [12.9784, 77.6408],
  Whitefield: [12.9698, 77.75],
  Bellandur: [12.926, 77.6762],
  Marathahalli: [12.9569, 77.7011],
  "Electronic City": [12.8452, 77.6602],
  "JP Nagar": [12.9063, 77.5857],
  Jayanagar: [12.925, 77.5938],
  "BTM Layout": [12.9166, 77.6101],
  Hebbal: [13.0358, 77.597],
  Yelahanka: [13.1007, 77.5963],
  Malleshwaram: [13.0035, 77.571],
};

// ponytail: approximate coordinates for the preview. Replace with BMRCL's station list when the database lands.
const METRO: [string, number, number][] = [
  ["Indiranagar", 12.9783, 77.6387],
  ["Halasuru", 12.976, 77.6266],
  ["Swami Vivekananda Road", 12.9859, 77.6449],
  ["Baiyappanahalli", 12.9907, 77.6525],
  ["Hoodi", 12.9888, 77.7113],
  ["Kundalahalli", 12.9776, 77.7158],
  ["Whitefield (Kadugodi)", 12.9956, 77.7579],
  ["Jayanagar", 12.9296, 77.5802],
  ["Rashtreeya Vidyalaya Road", 12.9216, 77.5802],
  ["Banashankari", 12.9152, 77.5736],
  ["JP Nagar", 12.9071, 77.5734],
  ["Central Silk Board", 12.9177, 77.6232],
  ["BTM Layout", 12.915, 77.61],
  ["Bommanahalli", 12.9037, 77.6247],
  ["Electronic City", 12.848, 77.664],
  ["Mantri Square Sampige Road", 12.9907, 77.5706],
  ["Kuvempu Road", 12.9985, 77.5568],
];

export function nearestMetro(lat: number, lng: number) {
  let best = { name: "", metres: Infinity };
  for (const [name, la, ln] of METRO) {
    const metres = haversine(lat, lng, la, ln);
    if (metres < best.metres) best = { name, metres };
  }
  return best;
}
