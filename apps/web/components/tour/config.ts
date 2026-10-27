// The tour is one master timeline measured in "ticks" (the scroll, 0..TOTAL). It opens on the Higgsfield clip (public/tour
// space.mp4, made as components/tour/HIGGSFIELD.md says): space, the Earth, down to south India. At the handoff the live
// map takes over, framed as the clip ends, and flies on down into Bengaluru, where the homes are.
export const TOTAL = 100;

// How far through the clip each tick is (0..1 of its length, whatever it turns out to be).
export const CLIP: [number, number][] = [[0, 0], [4, 0], [40, 1]];
// The clip crossfades into the map over these ticks.
export const HANDOFF: [number, number] = [40, 46];

// The map's camera, eased between rows: tick, longitude, latitude, zoom, pitch, bearing. Before the handoff it only shows
// when there is no clip: the globe from space, turning to India.
export const CAMERA: [number, number, number, number, number, number][] = [
  [0, 62, 16, 1.6, 0, 0],
  [20, 70, 15, 2.4, 0, 0],
  [40, 77.6, 13.0, 4.2, 0, 0], // the handoff: south India from orbit, north up (the clip's last frame)
  [56, 77.6, 12.97, 8.6, 25, -6],
  [70, 77.62, 12.96, 11.2, 48, -16],
  [88, 77.64, 12.95, 12.3, 55, -26],
  [100, 77.64, 12.95, 12.3, 55, -26],
];
// The homes' price pins come up once the map is close enough to read them; the nav turns ink once the map is light.
export const PINS_AT = 66;
export const LIGHT_AT = 52;

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
  { id: "city", title: "Bengaluru, from above.", line: "Homes from verified owners. A person checks every listing.", tone: "paper" },
  { id: "pins", title: "Every pin is a home you can visit.", line: "The price is the owner’s own. No brokerage, ever.", tone: "ink" },
];

// When each caption is on screen [in, out], in ticks.
export const CAPTIONS: Record<string, [number, number]> = { earth: [14, 34], city: [47, 58], pins: [70, 84] };
export const CLOSE_AT = 90;

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
