// The tour is one master timeline measured in "ticks" (the scroll, 0..TOTAL), played as one continuous shot (the script
// is components/tour/SCRIPT.md): dawn over the clouds (clouds.ts, drawn live); up out of them until they curve away into
// the planet; the live globe (map.ts) takes over, turns to India and comes down onto Bengaluru, where the homes come up.
export const TOTAL = 100;

// How far the camera has risen out of the clouds (0 the cloud tops .. 1 the edge of space), by tick.
export const RISE: [number, number][] = [[0, 0], [24, 0.92]];
// The clouds dissolve into the live globe over these ticks.
export const HANDOFF: [number, number] = [17, 25];

/** The clouds' camera at a rise (clouds.ts draws with it): its height over the cloud layer (1 deep), its pitch (radians,
 *  looking down below 0), the radius the cloud sea curves away with, and its field of view (the tangent of half the
 *  screen's height). */
export function skyCamera(rise: number) {
  const k = Math.min(1, Math.max(0, (rise - 0.1) / 0.9));
  return { alt: 3 + 31 * rise * rise, pitch: 0.044 - 0.664 * k * k * (3 - 2 * k), radius: 900 - 810 * rise, fov: 0.62 };
}

export const REF_H = 810; // the screen height (px) the globe's zooms are for; map.ts scales them to the screen's
const TOPS = 0.9; // how high in the cloud layer the clouds' horizon is

/** How far below level the clouds' horizon is (radians): a circle round straight down, as a real planet's is. */
const dip = ({ alt, radius }: ReturnType<typeof skyCamera>) => Math.atan(Math.sqrt((2 * (alt - TOPS)) / radius));

/** The globe's zoom and pitch that frame it as the clouds' camera frames their planet (with the clouds' field of view):
 *  the horizon at the same height, curving the same way, so the one dissolves into the other. The horizon is rho from
 *  straight down, the middle of the view tau. */
function skyFraming(rise: number) {
  const cam = skyCamera(rise), { pitch, fov } = cam;
  const rho = Math.PI / 2 - dip(cam);
  const tau = Math.PI / 2 + pitch;
  const phi = Math.asin(Math.sin(tau) / Math.sin(rho)); // the globe's pitch, at the map's centre
  const k = Math.sin(tau) / Math.sin(phi - tau); // the globe's radius over the camera's distance from the map's centre
  // (MapLibre's globe is 512 * 2^zoom / 2π px in radius; its camera is 0.5 * height / tan(fov / 2) px from the centre)
  return { zoom: Math.log2((k * Math.PI * REF_H) / (512 * fov)), pitch: (phi * 180) / Math.PI };
}
const LEAVE = skyFraming(RISE[RISE.length - 1][1]); // the globe as the clouds leave it

// The globe's camera once the clouds have gone, eased between rows: tick, longitude, latitude, zoom, pitch, bearing.
// Until then it is skyFraming's, looking north over the Indian Ocean with India coming up over the horizon.
export const CAMERA: [number, number, number, number, number, number][] = [
  [HANDOFF[1], 75.3, 0, LEAVE.zoom, LEAVE.pitch, 0],
  [36, 76.5, 12, 2.1, 12, 0], // the whole Earth, India at its heart
  [54, 77.6, 13.2, 4.6, 0, 0],
  [68, 77.6, 12.97, 7.8, 15, -4], // Bengaluru from high above
  [82, 77.62, 12.96, 11.0, 42, -14],
  [92, 77.64, 12.95, 12.3, 55, -26],
  [100, 77.64, 12.95, 12.3, 55, -26],
];
// The globe's field of view (degrees, of the screen's height): the clouds' while they dissolve, then MapLibre's own.
const FOV: [number, number][] = [[HANDOFF[1], (360 / Math.PI) * Math.atan(skyCamera(0).fov)], [36, 36.87]];
// The homes' price pins come up once the map is close enough to read them.
export const PINS_AT = 82;
// The nav's colour, from these ticks on: white over the dawn sky and in space, ink on the light map.
export const TONE_BREAKS: [number, "ink" | "paper"][] = [[0, "paper"], [74, "ink"]];

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

/** The globe's camera at a tick, for a screen REF_H high. */
export function cameraAt(t: number) {
  const col = (i: number) => pw(CAMERA.map((r) => [r[0], r[i]] as [number, number]), t);
  // (before the dissolve, where the clouds may look above level, the globe waits framed as they will first show it)
  const framed = t < HANDOFF[1] ? skyFraming(lin(RISE, Math.max(t, HANDOFF[0]))) : { zoom: col(3), pitch: col(4) };
  return { center: [col(1), col(2)] as [number, number], ...framed, bearing: col(5), fov: pw(FOV, t) };
}

/** How high the camera is over the Earth (km) at a tick: the globe's camera, as MapLibre places it. */
export function altitudeAt(t: number) {
  // in the clouds: as high over a planet the Earth's size as sees its horizon that far down (the globe agrees)
  if (t < HANDOFF[1]) return 6371 * (1 / Math.cos(dip(skyCamera(lin(RISE, t)))) - 1);
  const { zoom, pitch, fov } = cameraAt(t);
  const k = (512 * 2 ** zoom * Math.tan((fov * Math.PI) / 360)) / (Math.PI * REF_H); // as in skyFraming
  return 6371 * (Math.sqrt(1 + k * k + 2 * k * Math.cos((pitch * Math.PI) / 180)) / k - 1);
}

/** How far down the screen the clouds' horizon is at a tick (0 the top, 1 the foot), where the globe's is too. */
export function horizonAt(t: number) {
  const cam = skyCamera(lin(RISE, t));
  return 0.5 - Math.tan(-dip(cam) - cam.pitch) / (2 * cam.fov);
}
