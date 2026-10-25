// The tour is one master timeline measured in "ticks"; the film's own clock is film seconds, and film.json's `map`
// (from apps/web/film/shots.py MAP) says which film second each tick shows. Flat stretches of the map hold the film
// still while the page shows HTML over it: the title, the "from the ground up" card, the hotspots, the floor plan.
export const TOTAL = 100;

export type Stop = {
  id: string;
  title: string;
  line: string;
  tone: "ink" | "paper"; // caption colour
};

// Each line names something the app really does (search, listing checks, photos and video, filters, shortlists).
// ponytail: no prices, stats or addresses; the villa is an illustrative model.
export const STOPS: Stop[] = [
  { id: "build", title: "See how it was built.", line: "A person checks every listing before it goes live.", tone: "paper" },
  { id: "explore", title: "Explore the home.", line: "Tap a room, or keep scrolling.", tone: "paper" },
  { id: "hall", title: "The living hall.", line: "Photos and video tours before you visit.", tone: "paper" },
  { id: "bedroom", title: "The bedroom.", line: "Shortlist homes and save your searches.", tone: "paper" },
  { id: "bath", title: "The bath.", line: "Filter by BHK, parking and amenities.", tone: "paper" },
];

// When each caption is on screen [in, out], in ticks.
export const CAPTIONS: Record<string, [number, number]> = {
  build: [31, 47], explore: [52.5, 60.5], hall: [63, 68.5], bedroom: [71, 75.5], bath: [78, 82.5],
};

// The "from the ground up" card over the cut to the building site, and the floor plan at the end, in ticks.
export const INTER: [number, number] = [17.5, 28.5];
export const PLAN: [number, number] = [88.5, 95.5];
export const CLOSE_AT = 96;

// Rooms you can jump to from the villa's front: where each label sits comes from the film (film.json pins); the tick is
// where its room's shot starts.
export const HOTSPOTS = [
  { id: "hall", label: "Living hall", tick: 62.4 },
  { id: "bedroom", label: "Bedroom", tick: 70.4 },
  { id: "bath", label: "Bath", tick: 77.4 },
] as const;
// The hotspots fade in and out with the film, in film seconds (they show while the film holds on the front).
export const PIN_FADE: [number, number][] = [[0, 0], [12.6, 0], [13.4, 1], [13.96, 1], [13.99, 0]];

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
