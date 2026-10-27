// The tour is one master timeline measured in "ticks" (the scroll, 0..TOTAL), played as one continuous shot (the script
// is components/tour/SCRIPT.md): dawn over the clouds (clouds.ts, drawn live); up out of them until they curve away into
// the planet; the live globe (map.ts) takes over, turns to India and comes down onto Bengaluru, where the homes come up.
export const TOTAL = 100;

// How far the camera has risen out of the clouds (0 the cloud tops .. 1 the edge of space), by tick.
export const RISE: [number, number][] = [[0, 0], [24, 0.92]];
// The clouds dissolve into the live globe over these ticks.
export const HANDOFF: [number, number] = [17, 25];

// The globe's camera, eased between rows: tick, longitude, latitude, zoom, pitch, bearing. It takes over as the clouds
// leave it: the Earth's curve from low orbit with India ahead, as the clouds' last frame frames their planet.
export const CAMERA: [number, number, number, number, number, number][] = [
  [0, 75, -3, 4.4, 62, 0],
  [17, 75, -3, 4.4, 62, 0],
  [25, 75.3, 0, 4.0, 58, 0],
  [36, 76.5, 12, 2.1, 12, 0], // the whole Earth, India at its heart
  [54, 77.6, 13.2, 4.6, 0, 0],
  [68, 77.6, 12.97, 7.8, 15, -4], // Bengaluru from high above
  [82, 77.62, 12.96, 11.0, 42, -14],
  [92, 77.64, 12.95, 12.3, 55, -26],
  [100, 77.64, 12.95, 12.3, 55, -26],
];
// The homes' price pins come up once the map is close enough to read them.
export const PINS_AT = 82;
// The nav's colour, from these ticks on: ink over the bright clouds, white in space, ink again on the light map.
export const TONE_BREAKS: [number, "ink" | "paper"][] = [[0, "ink"], [13, "paper"], [74, "ink"]];

export type Stop = {
  id: string;
  title: string;
  line: string;
  tone: "ink" | "paper"; // caption colour
};

// Each line names something the app really does (search by map, listing checks, owners' own prices, no brokerage).
// ponytail: no stats or invented prices; the prices on the map are the live listings' own.
export const STOPS: Stop[] = [
  { id: "earth", title: "Start from anywhere.", line: "Owners list from across India and abroad. You search Bengaluru, street by street.", tone: "paper" },
  { id: "pins", title: "Every pin is a home you can visit.", line: "The price is the owner’s own. No brokerage, ever.", tone: "ink" },
];

// When each caption is on screen [in, out], in ticks.
export const CAPTIONS: Record<string, [number, number]> = { earth: [30, 46], pins: [83, 91] };
export const CLOSE_AT = 92;

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

/** The same lookup, straight lines between rows. */
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

/** The map's camera at a tick. */
export function cameraAt(t: number) {
  const col = (i: number) => pw(CAMERA.map((r) => [r[0], r[i]] as [number, number]), t);
  return { center: [col(1), col(2)] as [number, number], zoom: col(3), pitch: col(4), bearing: col(5) };
}
