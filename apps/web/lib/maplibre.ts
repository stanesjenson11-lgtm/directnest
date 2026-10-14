// Shared map setup for client components. MapLibre (~250 KB) is only ever loaded through here, on demand.

// ponytail: OpenFreeMap tiles (free, no key) for the preview. The quote budgets Google Maps; swap MAP_STYLE or the
// map components when the client's key exists. Bounds stay inside Bengaluru so national borders never render.
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
export const MAP_LIMITS: [[number, number], [number, number]] = [
  [77.25, 12.7],
  [78.0, 13.3],
];
export const INDIGO = "#4651c6"; // --color-indigo in sRGB; map paint properties don't take oklch

export async function loadMapLibre() {
  const ml = await import("maplibre-gl");
  ml.setWorkerUrl("/maplibre-gl-worker.mjs"); // see scripts/copy-map-worker.mjs
  return ml;
}
