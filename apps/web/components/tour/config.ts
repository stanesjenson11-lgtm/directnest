// The tour is one master timeline measured in "ticks"; the film's own clock is film seconds, and earth.json's `map`
// (from apps/web/film/earth_shots.py MAP) says which film second each tick shows. Flat stretches of the map hold the film
// still while the page shows HTML over it. Before the first scroll the film loops its opening seconds (earth.json
// `loop`): the clouds drift under the title.
export const TOTAL = 100;

export type Stop = {
  id: string;
  title: string;
  line: string;
  tone: "ink" | "paper"; // caption colour
};

// Each line names something the app really does (search, listing checks, filters, the map on every listing).
// ponytail: no prices, stats or addresses; the city, the villa and the markers on it are an illustrative model.
export const STOPS: Stop[] = [
  { id: "earth", title: "From Earth to your next home.", line: "Search Bengaluru by area, metro station or project.", tone: "paper" },
  { id: "city", title: "Bengaluru, area by area.", line: "Homes from verified owners. A person checks every listing.", tone: "paper" },
  { id: "pins", title: "Every home on one map.", line: "Filter by BHK, parking and amenities.", tone: "paper" },
  { id: "around", title: "And what’s around it.", line: "Each listing’s map shows the metro, schools and hospitals nearby.", tone: "paper" },
];

// When each caption is on screen [in, out], in ticks.
export const CAPTIONS: Record<string, [number, number]> = {
  earth: [22, 33], city: [55, 63], pins: [66, 75.5], around: [88.5, 94.5],
};

// The villa's card while the film holds on its front, and the close, in ticks.
export const VILLA: [number, number] = [83.5, 88];
export const CLOSE_AT = 96;

// The labels the film carries: where each sits on screen comes from the 3D camera, every frame (earth.json marks).
// The markers on the roofs are "pin-<key>" (their kind, sale or rent, is earth.json pins).
export const MARKS: { id: string; label: string; kind: "geo" | "city" | "area" | "place" }[] = [
  { id: "india", label: "India", kind: "geo" },
  { id: "karnataka", label: "Karnataka", kind: "geo" },
  { id: "tamil-nadu", label: "Tamil Nadu", kind: "geo" },
  { id: "bengaluru", label: "Bengaluru", kind: "city" },
  { id: "mysuru", label: "Mysuru", kind: "city" },
  { id: "city-bengaluru", label: "Bengaluru", kind: "city" },
  { id: "yelahanka", label: "Yelahanka", kind: "area" },
  { id: "whitefield", label: "Whitefield", kind: "area" },
  { id: "sarjapur", label: "Sarjapur", kind: "area" },
  { id: "electronic-city", label: "Electronic City", kind: "area" },
  { id: "clubhouse", label: "Clubhouse and pool", kind: "place" },
  { id: "park", label: "Park", kind: "place" },
  { id: "lake", label: "Lake walk", kind: "place" },
];

/** Piecewise lookup in a [tick, value] table, eased between rows. */
export function pw(table: [number, number][], t: number) {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const [t0, v0] = table[i - 1], [t1, v1] = table[i];
      const k = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * k * k * (3 - 2 * k);
    }
  }
  return table[table.length - 1][1];
}

/** The same lookup, straight lines between rows (the tick -> film second map). */
export function lin(table: [number, number][], t: number) {
  if (t <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (t <= table[i][0]) {
      const [t0, v0] = table[i - 1], [t1, v1] = table[i];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return table[table.length - 1][1];
}
