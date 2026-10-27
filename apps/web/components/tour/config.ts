// The tour is one master timeline measured in "ticks" (the scroll, 0..TOTAL), played as one continuous shot (the script
// is components/tour/HIGGSFIELD.md): above the clouds; up through them until the whole Earth hangs in space; down again
// onto Bengaluru, where the live map takes over and the homes come up. The film is public/tour/hero.mp4: a seamless
// loop of the clouds (LOOP seconds) for the hero, then the rise and the descent.
export const TOTAL = 100;

// The cloud loop at the head of the film, seconds: it plays under the title until the visitor scrolls.
export const LOOP = 5;
// Which film second each tick shows: tick 0 is the loop's last frame (the same as its first), the end of the film is the
// handoff.
export const CLIP: [number, number][] = [[0, 0], [66, 1]]; // 0..1 of the way from LOOP to the film's end
// The film crossfades into the map over these ticks.
export const HANDOFF: [number, number] = [66, 72];

// The map's camera, eased between rows: tick, longitude, latitude, zoom, pitch, bearing. Before the handoff it only shows
// when there is no film: the globe from space, turning to India.
export const CAMERA: [number, number, number, number, number, number][] = [
  [0, 64, 16, 1.6, 0, 0],
  [33, 72, 14, 2.6, 0, 0],
  [66, 77.6, 12.97, 6.4, 0, 0], // the handoff: Bengaluru from high above, north up (the film's last frame)
  [80, 77.62, 12.96, 10.6, 40, -12],
  [92, 77.64, 12.95, 12.3, 55, -26],
  [100, 77.64, 12.95, 12.3, 55, -26],
];
// The homes' price pins come up once the map is close enough to read them.
export const PINS_AT = 82;
// The nav's colour, from these ticks on: ink over the bright clouds, white in space, ink again on the light map.
export const TONE_BREAKS: [number, "ink" | "paper"][] = [[0, "ink"], [14, "paper"], [76, "ink"]];

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
export const CAPTIONS: Record<string, [number, number]> = { earth: [26, 44], pins: [83, 91] };
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
