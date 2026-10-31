"use client";

import { useEffect, useRef, useState } from "react";
import type { buildTour } from "./timeline";
import { Captions, Close, Hero, Nav } from "./Chrome";
import { HANDOFF, RISE, TONE_BREAKS, TOTAL, altitudeAt, cameraAt, horizonAt, lin } from "./config";
import "./tour.css";

type Tone = "ink" | "paper";
type LiveMap = Awaited<ReturnType<typeof import("./map").startMap>>;
type Clouds = NonNullable<ReturnType<typeof import("./clouds").startClouds>>;

// How quickly the tour catches up with the scroll (s): a short, smooth lag, like a scrubbed timeline's, never a fixed pace.
const LAG = 0.28;

/** The scroll tour: a sticky stage with the clouds (clouds.ts) over the live map (map.ts), played by scroll, and the
 *  HTML layer on top; config.ts says what each tick shows. */
export default function Tour() {
  const root = useRef<HTMLElement>(null);
  const sky = useRef<HTMLCanvasElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const flare = useRef<HTMLDivElement>(null);
  const hud = useRef<HTMLParagraphElement>(null);
  const api = useRef<ReturnType<typeof buildTour> | null>(null);
  const jump = useRef<(tick: number) => void>(() => {});
  const [tone, setTone] = useState<Tone>(TONE_BREAKS[0][1]);
  const [clouds, setClouds] = useState<"loading" | "ready" | "failed">("loading");
  const [map, setMap] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const handoff = handoffView();
    if (handoff) root.current!.dataset.handoff = "1"; // (set here, not in the markup: the server can't know the query)
    let dead = false, loaded = false, stopTour = () => {};
    let live: LiveMap | null = null, cl: Clouds | null = null;

    // The clouds start at once: they are the first view. The map and the HTML layer's timeline (with GSAP) come once the
    // page has loaded (or at the first scroll or touch, if sooner): the map then loads the whole flight under the clouds
    // while the visitor reads the hero (map.ts WARM).
    if (!handoff) {
      import("./clouds").then(({ startClouds }) => {
        if (dead) return;
        cl = startClouds(sky.current!);
        setClouds(cl ? "ready" : "failed");
      });
    }
    const load = () => {
      if (loaded) return;
      loaded = true;
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
      import("./timeline").then(({ buildTour }) => { if (!dead) stopTour = start(buildTour); });
      import("./map")
        .then(({ startMap }) => startMap(mapBox.current!, () => setMap("ready"), () => setMap("failed")))
        .then((m) => { if (dead) m.destroy(); else live = m; })
        .catch(() => setMap("failed"));
    };
    const WAKE = ["wheel", "touchstart", "pointerdown", "keydown", "scroll"] as const;
    for (const e of WAKE) addEventListener(e, load, { passive: true });
    let idle = 0;
    if (scrollY > 2 || handoff) load(); // a reload mid-tour: the browser restored the scroll before these listeners were here
    const later = () => { idle = window.setTimeout(load, 300); };
    if (document.readyState === "complete") later();
    else addEventListener("load", later, { once: true });

    // One clock, the tour's own: the scroll sets a goal and the tour eases after it, so a flick lands softly and a slow
    // scroll is followed closely; the clouds, the map and the HTML layer all show where the tour is.
    let goal = handoff ? HANDOFF[1] : 0, now = goal, shownAt = -1, shown: Tone = TONE_BREAKS[0][1], read = "";
    let frameId = 0, lastMs = performance.now(), drift = 0;
    const step = () => {
      frameId = requestAnimationFrame(step);
      const ms = performance.now();
      const dt = Math.min(0.1, (ms - lastMs) / 1000);
      lastMs = ms;
      if (reduced || Math.abs(goal - now) < 0.02) now = goal;
      else now += (goal - now) * (1 - Math.exp(-dt / LAG));
      if (api.current && now !== shownAt) api.current.seek((shownAt = now));
      const t: Tone = TONE_BREAKS.findLast(([at]) => now >= at)![1];
      if (t !== shown) setTone((shown = t));
      // the clouds over the map until they dissolve into it (no clouds: the globe opens the tour); once gone, not drawn
      const fade = cl ? Math.min(1, Math.max(0, (now - HANDOFF[0]) / (HANDOFF[1] - HANDOFF[0]))) : 1;
      sky.current!.style.opacity = String(1 - fade);
      mapBox.current!.style.opacity = String(fade);
      // the sun's glare on the horizon, at its height mid-dissolve
      const glare = fade > 0 && fade < 1;
      flare.current!.style.opacity = glare ? String(Math.sin(Math.PI * fade)) : "0";
      if (glare) flare.current!.style.transform = `translateY(${horizonAt(now) * 100}%)`;
      if (cl && fade < 1) {
        if (!reduced) drift += dt; // the wind (with reduced motion, still clouds)
        cl.draw(lin(RISE, now), drift);
      }
      // with reduced motion, past the clouds, the globe and then the city, never the flight between
      const shot = reduced && now > HANDOFF[1] ? (now < 60 ? HANDOFF[1] : TOTAL) : now;
      // the map is only drawn from shortly before it shows (it would cost the phone for nothing under the clouds)
      if (fade > 0 || now >= HANDOFF[0] - 2) live?.set(shot);
      const r = readout(shot);
      if (r !== read) hud.current!.textContent = read = r;
    };
    frameId = requestAnimationFrame(step);

    return () => {
      dead = true;
      cancelAnimationFrame(frameId);
      stopTour();
      live?.destroy();
      cl?.destroy();
      removeEventListener("load", later);
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
    };

    function start(build: typeof buildTour) {
      api.current = build(root.current!, { reduced, onTick: (t) => { if (!handoff) goal = t; } });
      jump.current = (tick) => { // "Book a viewing": straight there, not through the tour
        window.scrollTo(0, api.current!.goto(tick));
        goal = now = tick;
      };
      return () => {
        api.current?.destroy();
        api.current = null;
      };
    }
  }, []);

  return (
    <section className="tour" ref={root} aria-label="Gharaana tour">
      <div className="stage" data-clouds={clouds} data-map={map}>
        {/* the live map (map.ts): the globe, then Bengaluru with its homes' prices */}
        <div ref={mapBox} className="map" />
        {/* dawn over the clouds, drawn live (clouds.ts); it dissolves into the globe */}
        <canvas ref={sky} className="sky" aria-hidden="true" />
        <div ref={flare} className="flare" aria-hidden="true" />
        <Hero />
        <Close />
        <Captions />
        {/* where the camera is over the Earth, and how high: an instrument's readout for the flight (config.ts) */}
        <p ref={hud} className="hud" data-tone={tone} aria-hidden="true" data-hud />
        <Nav tone={tone} onBook={() => jump.current(TOTAL - 1)} />
      </div>
    </section>
  );
}

/** The camera's place and height at a tick, as the readout shows them. */
function readout(t: number) {
  const [lng, lat] = cameraAt(t).center, km = altitudeAt(t);
  const height = km < 100 ? km.toFixed(1) : Math.round(km).toLocaleString("en-IN");
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? "S" : "N"}   ${lng.toFixed(2)}° E   ·   ${height} km`;
}

/** ?handoff: the globe as the clouds leave it, nothing over it (to check the dissolve's framing; SCRIPT.md). */
function handoffView() {
  return new URLSearchParams(location.search).has("handoff");
}
