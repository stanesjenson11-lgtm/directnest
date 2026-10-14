"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { INDIGO, loadMapLibre, MAP_LIMITS, MAP_STYLE } from "@/lib/maplibre";

/** Approximate location only: a 400 m circle, never a pin on the building. Loads when scrolled near. */
export function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let map: import("maplibre-gl").Map | undefined;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        try {
          const ml = await loadMapLibre();
          map = new ml.Map({
            container: el,
            style: MAP_STYLE,
            center: [lng, lat],
            zoom: 14.2,
            maxBounds: MAP_LIMITS,
            cooperativeGestures: true,
            attributionControl: { compact: true },
          });
          map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
          map.on("load", () => {
            map!.addSource("approx", { type: "geojson", data: circle(lng, lat, 400) });
            map!.addLayer({ id: "approx-fill", type: "fill", source: "approx", paint: { "fill-color": INDIGO, "fill-opacity": 0.12 } });
            map!.addLayer({ id: "approx-line", type: "line", source: "approx", paint: { "line-color": INDIGO, "line-width": 2 } });
          });
        } catch {
          setFailed(true);
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      map?.remove();
    };
  }, [lat, lng]);

  return (
    <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-surface">
      <div ref={box} className="h-full w-full" />
      {failed && <p className="absolute inset-0 grid place-items-center text-[14px] text-muted">The map couldn&rsquo;t load.</p>}
    </div>
  );
}

function circle(lng: number, lat: number, metres: number) {
  const ring: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    ring.push([
      lng + (metres / (111_320 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a),
      lat + (metres / 110_540) * Math.sin(a),
    ]);
  }
  return { type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [ring] } };
}
