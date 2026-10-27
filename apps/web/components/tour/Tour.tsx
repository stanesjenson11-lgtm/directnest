"use client";

import { useEffect, useRef, useState } from "react";
import type { buildTour } from "./timeline";
import { Captions, Close, Hero, HeroTitle, Nav } from "./Chrome";
import { CLIP, HANDOFF, LIGHT_AT, TOTAL, lin, pw } from "./config";
import "./tour.css";

type Tone = "ink" | "paper";
type LiveMap = Awaited<ReturnType<typeof import("./map").startMap>>;

// The tour opens on the Higgsfield clip (one MP4, object-fit: cover, so phones see its middle) and hands over to the live
// map (map.ts); config.ts says which clip moment and which map view each tick shows.
const CLIP_SRC = "/tour/space.mp4";

// The tour's one steady pace (a wheel glide, and the tour's own glide after a swipe), in ticks per second. The whole
// tour takes about 20 s.
const PACE: [number, number][] = [[0, 5.4], [TOTAL, 5.4]];

/** The scroll tour: a sticky stage with the clip and the map, played by scroll, and the HTML layer on top. */
export default function Tour() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const api = useRef<ReturnType<typeof buildTour> | null>(null);
  const jump = useRef<(tick: number) => void>(() => {});
  const [tone, setTone] = useState<Tone>("paper");
  // the clip: until it plays, the poster; if it never comes (not made yet, or a failed load), the map's globe opens the tour
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
      let goal = handoff ? HANDOFF[0] : 0; // the tick the scroll asks for (the tour itself glides there: step, below)
      const glides = !reduced && !handoff && matchMedia("(pointer: fine)").matches; // mouse or trackpad (touch keeps its native scroll)
      api.current = build(root.current!, { reduced, onTick: (t) => { if (!handoff) goal = t; } });

      // Mouse and trackpad: the tour runs at one steady pace whatever the wheel does. A wheel move only says "keep going"
      // (and which way); the page then glides at a constant pace (a little slower inside the flat), easing in, and easing
      // out a moment after the last move, so every scene takes the same time however fast or slow the scroll. Nothing
      // snaps: it stops where you stop. Past either end of the tour the page scrolls as usual.
      // Touch keeps the phone's own (native) scroll (scrolling a touch screen from JavaScript lagged and floated on iPhone
      // Safari); the tour glides after it at the same pace (step, below).
      let teardown = () => {};
      if (glides) {
        let dir = 0, until = 0, pxVel = 0, pos = 0, last = 0, glide = 0;
        const ends = () => [api.current!.goto(0), api.current!.goto(TOTAL)] as const;
        const run = (ms: number) => {
          if (Math.abs(scrollY - pos) > 2) pos = scrollY; // something else scrolled (Book, keys, scrollbar): go on from there
          const dt = Math.min(0.05, (ms - last) / 1000);
          last = ms;
          const [top, end] = ends();
          const full = ((end - top) / TOTAL) * pw(PACE, ((pos - top) / (end - top)) * TOTAL); // px per second here
          const want = ms < until ? dir * full : 0;
          pxVel += (want - pxVel) * (1 - Math.exp(-dt / (want ? 0.12 : 0.2))); // quick to start, a short ease to rest
          // no slow crawl at the end: once down to a fifth of full pace, it has arrived
          if (want === 0 && Math.abs(pxVel) < full / 5) {
            pxVel = 0;
            glide = 0;
            return;
          }
          pos = Math.min(end, Math.max(top, pos + pxVel * dt));
          window.scrollTo(0, pos);
          glide = requestAnimationFrame(run);
        };
        /** Asks the glide to keep going in direction d; false when that way is past the tour (let the page scroll). */
        const nudge = (d: number) => {
          const [top, end] = ends();
          if ((d > 0 && scrollY >= end - 1) || (d < 0 && scrollY <= top + 1)) return false;
          if (d !== dir) pxVel = 0; // turning round: no backwards momentum
          dir = d;
          until = performance.now() + 250; // a wheel's notches come ~100-250 ms apart while it turns
          if (!glide) {
            pos = scrollY;
            last = performance.now();
            glide = requestAnimationFrame(run);
          }
          return true;
        };
        const onWheel = (e: WheelEvent) => {
          if (e.ctrlKey || !e.deltaY) return; // pinch-zoom, sideways swipes
          if (nudge(Math.sign(e.deltaY))) e.preventDefault();
        };
        addEventListener("wheel", onWheel, { passive: false });
        teardown = () => {
          removeEventListener("wheel", onWheel);
          cancelAnimationFrame(glide);
        };
      }

      // One clock, the tour's own: the scroll only sets a goal, and the tour moves towards it at the steady PACE, easing in
      // and out; the clip, the map and the HTML layer all show where the tour is, so they never drift apart. Moving
      // forward, the clip plays (frames decode in order, no seeking) at the tour's speed, plus a gentle correction for any
      // gap, and pauses once caught up. Going back seeks, and so do the tour's only jumps: Book and the backlog cap.
      const FRAME = 1 / 24;
      let canPlay = !reduced;
      let frameId = 0;
      let now = goal, vel = 0, shownAt = -1; // the tour's tick, its speed (ticks per second), the tick the HTML layer shows
      let speed = 0, lastTarget = 0, lastMs = performance.now(); // how fast the clip should move (s per s)
      jump.current = (tick) => { // "Book a viewing": straight there, not a glide through the tour
        window.scrollTo(0, api.current!.goto(tick));
        goal = now = tick;
        vel = 0;
      };
      let shown: Tone = "paper";
      const step = () => {
        frameId = requestAnimationFrame(step);
        const ms = performance.now();
        const dt = Math.min(0.1, (ms - lastMs) / 1000);
        lastMs = ms;
        if (reduced) now = goal;
        else if (now !== goal) {
          // a big jump (scrollbar, End, a hard flick, scroll restoration) is not glided all the way: the tour skips to
          // 12 ticks short of it (about 2 s at PACE) and glides the rest
          if (Math.abs(goal - now) > 12) now = goal - Math.sign(goal - now) * 12;
          const gap = goal - now;
          const pace = pw(PACE, now); // ticks per second
          const want = Math.sign(gap) * Math.min(pace, Math.abs(gap) / 0.25); // full pace, slowing over the last 1/4 s
          vel += (want - vel) * (1 - Math.exp(-dt / 0.12));
          const next = Math.min(TOTAL, Math.max(0, now + vel * dt));
          // arrived; never past the goal and back, which would step the clip backwards
          if ((goal - next) * gap <= 0 || (Math.abs(goal - next) < 0.01 && Math.abs(vel) < 0.05)) {
            now = goal;
            vel = 0;
          } else now = next;
        }
        if (now !== shownAt) api.current!.seek((shownAt = now));
        // the nav goes white over space and the globe, ink once the map below is light
        const t: Tone = now < LIGHT_AT ? "paper" : "ink";
        if (t !== shown) setTone((shown = t));
        // the map: only drawn once it can be seen (while the clip plays it would cost the phone for nothing); with reduced
        // motion it shows the handoff view, then the city, never the flight between
        const fade = clipOk ? Math.min(1, Math.max(0, (now - HANDOFF[0]) / (HANDOFF[1] - HANDOFF[0]))) : 1;
        mapBox.current!.style.opacity = String(fade);
        if (clipReady) v.style.opacity = String(1 - fade);
        if (fade > 0 || now >= HANDOFF[0] - 4) live?.set(reduced ? (now < HANDOFF[1] ? HANDOFF[0] : TOTAL) : now);
        if (!clipOk || v.readyState < 2 || !v.duration) return;
        const target = lin(CLIP, now) * (v.duration - FRAME);
        if (dt > 0) speed = (target - lastTarget) / dt; // the tour moves smoothly: no need to smooth this
        lastTarget = target;
        const ahead = target - v.currentTime;
        const going = !v.paused;
        // a quarter second past the tour is held, not sought back (a jump back was the hitch when a glide came to rest);
        // scrolling backwards still follows frame by frame
        const behindOk = speed < -0.05 ? FRAME * 2 : 0.25;
        if (ahead < -behindOk || ahead > 1.5) {
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
        teardown();
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
        <img className="film film--poster" src="/tour/space-poster.webp" alt="" fetchPriority="high" />
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
