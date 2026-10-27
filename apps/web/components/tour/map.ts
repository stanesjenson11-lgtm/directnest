// The tour's live map: the app's own map (lib/maplibre), as a globe from space down to Bengaluru's streets, with the
// same homes /search shows (app/api/pins). Tour.tsx imports it only once the visitor starts to scroll.
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibre } from "maplibre-gl";
import { loadMapLibre, MAP_STYLE } from "@/lib/maplibre";
import { PINS_AT, cameraAt } from "./config";

// NASA's Blue Marble (public domain) for the globe, to zoom 8; the vector map takes over beneath it from zoom 8 to 10.
const EARTH = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default//EPSG3857_500m/{z}/{y}/{x}.jpeg";

type Pin = { id: string; lat: number; lng: number; label: string };
const SPACING = 0.014; // degrees of latitude (~1.5 km): a price chip's width at the tour's closest view

export async function startMap(el: HTMLElement, onReady: () => void, onFail: () => void) {
  const ml = await loadMapLibre();
  const m: MapLibre = new ml.Map({
    container: el,
    style: MAP_STYLE,
    ...cameraAt(0),
    interactive: false, // the page's scroll drives it; the pins stay clickable
    attributionControl: { compact: true },
    fadeDuration: 0,
  });
  m.on("error", (e) => {
    if (!m.loaded() && /style|fetch|network/i.test(String(e.error?.message))) onFail();
  });
  m.once("load", () => {
    m.setProjection({ type: "globe" });
    for (const l of m.getStyle().layers) {
      // no borders, ever (the app's maps never draw them); below zoom 8 the globe is the imagery alone, without labels
      if (l.id.includes("boundary")) m.setLayoutProperty(l.id, "visibility", "none");
      else if (l.type !== "background") m.setLayerZoomRange(l.id, Math.max(8, l.minzoom ?? 0), l.maxzoom ?? 24);
    }
    m.addSource("earth", { type: "raster", tiles: [EARTH], tileSize: 256, minzoom: 1, maxzoom: 8, attribution: "Imagery: NASA" });
    m.addLayer({
      id: "earth", type: "raster", source: "earth",
      paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 8, 1, 10, 0], "raster-fade-duration": 0 },
    });
    m.setSky({ "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 1, 9, 0] });
    onReady();
  });

  // the pins go on when the map first gets close enough for them; their chips rise in one after another (tour.css)
  let pins: Promise<Pin[]> | null = null;
  let placed = false;
  const place = () => {
    pins ??= fetch("/api/pins").then((r) => (r.ok ? r.json() : [])).catch(() => []);
    pins.then((list) => {
      if (placed) return;
      placed = true;
      // as on /search, prices that would sit on top of each other are dots: a home gets its price only when no home
      // before it (the list is in /search's order) is within ~1.5 km
      const priced: Pin[] = [];
      list.forEach((p, i) => {
        const chip = !priced.some((q) => Math.abs(q.lat - p.lat) < SPACING && Math.abs(q.lng - p.lng) < SPACING * 1.6);
        if (chip) priced.push(p);
        const a = document.createElement("a");
        a.className = chip ? "hpin" : "hpin hpin--dot";
        a.href = `/homes/${p.id}`;
        // out of the tab order: a keyboard gets "See every home on the map" instead of a few hundred stops
        a.tabIndex = -1;
        a.setAttribute("aria-hidden", "true");
        const face = document.createElement("span");
        if (chip) face.textContent = p.label;
        face.style.setProperty("--d", `${(i % 24) * 35}ms`);
        a.append(face);
        new ml.Marker({ element: a, anchor: "bottom" }).setLngLat([p.lng, p.lat]).addTo(m);
      });
    });
  };

  let last = -1;
  return {
    /** Shows the map as it is at this tick. */
    set(tick: number) {
      if (tick === last) return;
      last = tick;
      m.jumpTo(cameraAt(tick));
      const on = tick >= PINS_AT;
      if (on) place();
      el.classList.toggle("pins-on", on);
    },
    destroy() {
      m.remove();
    },
  };
}
