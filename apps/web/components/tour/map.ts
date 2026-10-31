// The tour's live map: the app's own map (lib/maplibre), as a globe from space down to Bengaluru's streets, with the
// same homes /search shows (app/api/pins). Tour.tsx imports it only once the visitor starts to scroll.
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibre } from "maplibre-gl";
import { loadMapLibre, MAP_STYLE } from "@/lib/maplibre";
import { PINS_AT, REF_H, cameraAt } from "./config";

// NASA's Blue Marble (public domain) for the globe, to zoom 8; the vector map takes over beneath it from zoom 8 to 10.
// Served from public/earth: NASA's own server (GIBS) took ~3.7 s a tile and forbids caching. Only the tiles the flight
// sees are there (SCRIPT.md); a missing one shows its parent, a little softer.
const EARTH = "/earth/{z}/{y}/{x}.webp";
// While the visitor reads the hero, the hidden map visits these ticks once, so the flight finds the Earth, the city's
// streets and their labels' fonts already loaded.
const WARM = [36, 54, 68, 82, 100];

type Pin = { id: string; lat: number; lng: number; label: string };
const SPACING = 0.014; // degrees of latitude (~1.5 km): a price chip's width at the tour's closest view

export async function startMap(el: HTMLElement, onReady: () => void, onFail: () => void) {
  const ml = await loadMapLibre();
  const m: MapLibre = new ml.Map({
    container: el,
    style: MAP_STYLE,
    ...cameraAt(0),
    maxPitch: 85, // the clouds' horizon, low over the globe (config.ts skyFraming)
    interactive: false, // the page's scroll drives it; the pins stay clickable
    attributionControl: { compact: true },
    fadeDuration: 0,
  });
  m.on("error", (e) => {
    if (!m.loaded() && /style|fetch|network/i.test(String(e.error?.message))) onFail();
  });
  // style.load, not load: load waits for the first full render, which would show the plain street style (a pale ball,
  // with borders) on the globe until then
  m.once("style.load", () => {
    m.setProjection({ type: "globe" });
    for (const l of m.getStyle().layers) {
      // no borders, ever (the app's maps never draw them); below zoom 8 the globe is the imagery alone, without labels
      if (l.id.includes("boundary")) m.setLayoutProperty(l.id, "visibility", "none");
      else if (l.type !== "background") m.setLayerZoomRange(l.id, Math.max(8, l.minzoom ?? 0), l.maxzoom ?? 24);
    }
    // under the imagery, ocean, not the street map's pale ground: a tile still on its way never shows as a white patch
    const bg = m.getStyle().layers.find((l) => l.type === "background");
    const ground = bg && m.getPaintProperty(bg.id, "background-color");
    if (bg && typeof ground === "string") {
      m.setPaintProperty(bg.id, "background-color", ["interpolate", ["linear"], ["zoom"], 7.5, "#0b2a4a", 9.5, ground]);
    }
    m.addSource("earth", { type: "raster", tiles: [EARTH], tileSize: 256, minzoom: 1, maxzoom: 8, attribution: "Imagery: NASA" });
    m.addLayer({
      id: "earth", type: "raster", source: "earth", maxzoom: 10, // (gone by 10: no tiles asked for past it)
      paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 8, 1, 10, 0], "raster-fade-duration": 0 },
    });
    m.setSky({ "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 1, 9, 0] });
    onReady();
    // the warm-up stops as soon as the tour first shows the map (set)
    const warm = (i: number) => {
      if (last >= 0) return;
      if (i === WARM.length) return m.jumpTo(view(0));
      m.jumpTo(view(WARM[i]));
      m.once("idle", () => warm(i + 1));
    };
    warm(0);
    getPins();
  });

  // the pins go on when the map first gets close enough for them; their chips rise in one after another (tour.css)
  let pins: Promise<Pin[]> | null = null;
  let placed = false;
  const getPins = (): Promise<Pin[]> => (pins ??=fetch("/api/pins").then((r) => (r.ok ? r.json() : [])).catch(() => []));
  const place = () => {
    getPins().then((list) => {
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

  let last = -1, lastFov = 0;
  /** The camera at a tick, for this screen (the zooms are for one REF_H high). */
  function view(tick: number) {
    const { fov, ...v } = cameraAt(tick);
    if (fov !== lastFov) m.setVerticalFieldOfView((lastFov = fov));
    return { ...v, zoom: v.zoom + Math.log2(el.clientHeight / REF_H) };
  }
  return {
    /** Shows the map as it is at this tick. */
    set(tick: number) {
      if (tick === last) return;
      last = tick;
      m.jumpTo(view(tick));
      const on = tick >= PINS_AT;
      if (on) place();
      el.classList.toggle("pins-on", on);
    },
    destroy() {
      m.remove();
    },
  };
}
