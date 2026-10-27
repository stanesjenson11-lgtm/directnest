"use client";

import { useEffect, useRef, useState } from "react";
import type { buildTour } from "./timeline";
import { Captions, Close, Hero, HeroTitle, Nav } from "./Chrome";
import { CLIP, HANDOFF, LOOP, TONE_BREAKS, TOTAL, lin } from "./config";
import "./tour.css";

type Tone = "ink" | "paper";
type LiveMap = Awaited<ReturnType<typeof import("./map").startMap>>;

// The tour opens on the Higgsfield film (one MP4, object-fit: cover, so phones see its middle) and hands over to the live
// map (map.ts); config.ts says which film moment and which map view each tick shows.
const CLIP_SRC = "/tour/hero.mp4";
// How quickly the tour catches up with the scroll (s): a short, smooth lag, like a scrubbed timeline's, never a fixed pace.
const LAG = 0.28;

/** The scroll tour: a sticky stage with the clip and the map, played by scroll, and the HTML layer on top. */
export default function Tour() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const api = useRef<ReturnType<typeof buildTour> | null>(null);
  const jump = useRef<(tick: number) => void>(() => {});
  const [tone, setTone] = useState<Tone>("ink");
  // the film: until it plays, the poster; if it never comes (not made yet, or a failed load), the map's globe opens the tour
  const [clip, setClip] = useState<"loading" | "ready" | "failed">("loading");
  const [map, setMap] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const v = video.current!;
    const handoff = handoffView();
    if (handoff) root.current!.dataset.handoff = "1"; // (set here, not in the markup: the server can't know the query)
    let clipOk = !handoff, clipReady = false;
    const onClip = () => { clipReady = true; setClip("ready"); };
    const onClipFail = () => { clipOk = false; setClip("failed"); };
    v.addEventListener("loadeddata", onClip);
    v.addEventListener("error", onClipFail);
    // The clip, the map and the HTML layer's timeline (with GSAP) start downloading when the visitor first scrolls or
    // touches the page (or 3 s after it has loaded): they never compete with the first view, which is plain HTML and
    // CSS, and someone who leaves at once never pays for them.
    let dead = false, stop = () => {}, loaded = false;
    let live: LiveMap | null = null;
    const load = () => {
      if (loaded) return;
      loaded = true;
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
      import("./timeline").then(({ buildTour }) => { if (!dead) stop = start(buildTour); });
      import("./map")
        .then(({ startMap }) => startMap(mapBox.current!, () => setMap("ready"), () => setMap("failed")))
        .then((m) => { if (dead) m.destroy(); else live = m; })
        .catch(() => setMap("failed"));
      if (handoff) onClipFail();
      else {
        v.src = CLIP_SRC;
        v.load();
      }
    };
    const WAKE = ["wheel", "touchstart", "pointerdown", "keydown", "scroll"] as const;
    for (const e of WAKE) addEventListener(e, load, { passive: true });
    let idle = 0;
    if (scrollY > 2 || handoff) load(); // a reload mid-tour: the browser restored the scroll before these listeners were here
    const later = () => { idle = window.setTimeout(load, 3000); };
    if (document.readyState === "complete") later();
    else addEventListener("load", later, { once: true });

    return () => {
      dead = true;
      stop();
      live?.destroy();
      removeEventListener("load", later);
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
      v.removeEventListener("loadeddata", onClip);
      v.removeEventListener("error", onClipFail);
    };

    function start(build: typeof buildTour) {
      let goal = handoff ? HANDOFF[0] : 0; // the tick the scroll asks for (the tour eases after it: step, below)
      api.current = build(root.current!, { reduced, onTick: (t) => { if (!handoff) goal = t; } });

      // One clock, the tour's own: the scroll sets a goal and the tour eases after it, so a flick lands softly and a slow
      // scroll is followed closely; the film, the map and the HTML layer all show where the tour is, so they never drift
      // apart. Moving forward the film plays (frames decode in order, no seeking) at the tour's speed, plus a gentle
      // correction for any gap, and pauses once caught up. Going back seeks, and so does "Book a viewing".
      const FRAME = 1 / 24;
      let canPlay = !reduced;
      let frameId = 0;
      let now = goal, shownAt = -1; // the tour's tick, the tick the HTML layer shows
      let speed = 0, lastTarget = 0, lastMs = performance.now(); // how fast the film should move (s per s)
      jump.current = (tick) => { // "Book a viewing": straight there, not through the tour
        window.scrollTo(0, api.current!.goto(tick));
        goal = now = tick;
      };
      let shown: Tone = "ink";
      const step = () => {
        frameId = requestAnimationFrame(step);
        const ms = performance.now();
        const dt = Math.min(0.1, (ms - lastMs) / 1000);
        lastMs = ms;
        if (reduced || Math.abs(goal - now) < 0.02) now = goal;
        else now += (goal - now) * (1 - Math.exp(-dt / LAG));
        if (now !== shownAt) api.current!.seek((shownAt = now));
        const t: Tone = TONE_BREAKS.findLast(([at]) => now >= at)![1];
        if (t !== shown) setTone((shown = t));
        // the map: only drawn once it can be seen (while the clip plays it would cost the phone for nothing); with reduced
        // motion it shows the handoff view, then the city, never the flight between
        const fade = clipOk ? Math.min(1, Math.max(0, (now - HANDOFF[0]) / (HANDOFF[1] - HANDOFF[0]))) : 1;
        mapBox.current!.style.opacity = String(fade);
        if (clipReady) v.style.opacity = String(1 - fade);
        if (fade > 0 || now >= HANDOFF[0] - 4) live?.set(reduced ? (now < HANDOFF[1] ? HANDOFF[0] : TOTAL) : now);
        if (!clipOk || v.readyState < 2 || !v.duration) return;
        if (canPlay && now === 0 && goal === 0) {
          // at rest under the title: the clouds drift, round the loop (its last frame is its first)
          if (v.currentTime >= LOOP - FRAME && !v.seeking) v.currentTime = 0;
          if (v.playbackRate !== 1) v.playbackRate = 1;
          if (v.paused) v.play().catch(() => { canPlay = false; });
          return;
        }
        const target = LOOP + lin(CLIP, now) * (v.duration - LOOP - FRAME);
        if (dt > 0) speed = (target - lastTarget) / dt; // the tour moves smoothly: no need to smooth this
        lastTarget = target;
        const ahead = target - v.currentTime;
        // still in the loop when the tour sets off: play on out of it into the rise (seeking would jump the clouds)
        const loopLeft = v.currentTime < LOOP ? LOOP - v.currentTime : 0;
        const going = !v.paused;
        // a quarter second past the tour is held, not sought back (a jump back was the hitch when the tour came to rest);
        // scrolling backwards still follows frame by frame
        const behindOk = speed < -0.05 ? FRAME * 2 : 0.25;
        if (ahead < -behindOk || ahead - loopLeft > 1.5) {
          if (!v.seeking) {
            if (going) v.pause();
            v.currentTime = target;
          }
        } else if (canPlay && !v.ended && (going ? speed > 0.3 || ahead > 0.12 : speed > 0.3 || ahead > 0.25)) {
          // (play() on an ended clip would restart it from frame 1)
          // play at the tour's own speed, nudged towards it; only touch the rate when it really changes
          const rate = Math.min(6, Math.max(speed > 0.3 ? 0.25 : 0.9, Math.max(0, speed) + ahead * 2));
          if (Math.abs(rate - v.playbackRate) > 0.05) v.playbackRate = rate;
          if (!going) v.play().catch(() => { canPlay = false; }); // e.g. iOS low-power mode: seeking still works
        } else if (going) {
          v.pause(); // at rest: hold this frame
        }
      };
      frameId = requestAnimationFrame(step);

      return () => {
        cancelAnimationFrame(frameId);
        api.current?.destroy();
        api.current = null;
      };
    }
  }, []);

  return (
    <section className="tour" ref={root} aria-label="Gharaana tour">
      <div className="stage" data-clip={clip} data-map={map}>
        {/* the clip's first frame, shown at once (it is the largest paint), then the clip itself over it */}
        {/* eslint-disable-next-line @next/next/no-img-element -- already a sized WebP; next/image's loader would only delay it */}
        <img className="film film--poster" src="/tour/hero-poster.webp" alt="" fetchPriority="high" />
        <video ref={video} className="film film--video" muted playsInline preload="auto" aria-hidden="true"
          disablePictureInPicture disableRemotePlayback />
        {/* the live map (map.ts): the globe, then Bengaluru with its homes' prices */}
        <div ref={mapBox} className="map" />
        <HeroTitle />
        <Close />
        <Hero />
        <Captions />
        <Nav tone={tone} onBook={() => jump.current(TOTAL - 1)} />
      </div>
    </section>
  );
}

/** ?handoff: the map frozen as the clip must end, nothing over it (the end frame Higgsfield is given; HIGGSFIELD.md). */
function handoffView() {
  return new URLSearchParams(location.search).has("handoff");
}
