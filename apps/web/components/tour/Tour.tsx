"use client";

import { useEffect, useRef, useState } from "react";
import type { buildTour } from "./timeline";
import { RENTALS } from "@/lib/search";
import { Captions, Close, Hero, HeroTitle, Nav, VillaCard } from "./Chrome";
import { MARKS, TOTAL, lin, pw } from "./config";
import film from "./earth.json";
import "./tour.css";

type Tone = "ink" | "paper";

// The tour is a film path-traced in Blender (apps/web/film/earth.py); film.map says which film second each tick shows.
const MAP = film.map as [number, number][];
const filmSec = (tick: number) => lin(MAP, tick);
// Before the first scroll the clouds drift: the film loops its opening seconds (its frame film.loop[1] is frame 1 again).
const LOOP = (film.loop[1] - 1) / film.fps;
// Phones held upright get a portrait cut of the frame, 608 of its 1920 px wide, its centre following the subject
// (film.crop, in film seconds; encode.py cuts the phone films the same way).
const PHONE = "(orientation: portrait) and (max-width: 699px)";
const CROP_W = 608 / 1920;
const cropX0 = (sec: number) => Math.min(1 - CROP_W, Math.max(0, pw(film.crop as [number, number][], sec) - CROP_W / 2));
const SRC = {
  av1: "/tour/earth-1080-av1.mp4", hevc: "/tour/earth-1080-hevc.mp4", h264: "/tour/earth-1080.mp4",
  phoneHevc: "/tour/earth-phone-hevc.mp4", phone: "/tour/earth-phone.mp4",
};

// The tour's one steady pace (a wheel glide, and the tour's own glide after a swipe), in ticks per second. The whole
// tour takes about 20 s.
const PACE: [number, number][] = [[0, 5.4], [TOTAL, 5.4]];

// The film's labels (config MARKS) and the markers on the roofs: a sale marker reads "For sale"; rent markers only get a
// label once rentals launch (lib/search.ts).
const PINS = Object.entries(film.pins as Record<string, string>)
  .filter(([, kind]) => kind === "sale" || RENTALS)
  .map(([key, kind]) => ({ id: `pin-${key}`, label: kind === "sale" ? "For sale" : "For rent", kind: "pin" as const, sale: kind === "sale" }));
const LABELS = [...MARKS.map((m) => ({ ...m, sale: false })), ...PINS];

/** The scroll tour: a sticky stage with the film, played by scroll, and the HTML layer on top. */
export default function Tour() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const api = useRef<ReturnType<typeof buildTour> | null>(null);
  const jump = useRef<(tick: number) => void>(() => {});
  const [tone, setTone] = useState<Tone>("ink");
  const [ready, setReady] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const v = video.current!;
    const phone = matchMedia(PHONE).matches;
    const onReady = () => setReady("ready");
    const onFail = () => setReady("failed");
    v.addEventListener("loadeddata", onReady);
    v.addEventListener("error", onFail);
    // The film, and the HTML layer's timeline (with GSAP), start downloading when the visitor first scrolls or touches
    // the page (or 3 s after it has loaded): they never compete with the first view, which is plain HTML and CSS, and
    // someone who leaves at once never pays for them.
    let dead = false, stop = () => {}, loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
      import("./timeline").then(({ buildTour }) => { if (!dead) stop = start(buildTour); });
      // desktops: HEVC where it plays (under 8 MB, decoded in hardware), else AV1 (8), else H.264 (9.5);
      // phones: HEVC at the cut's full 608x1080 (3.5; iPhones decode it in hardware), else H.264 at 540x960 (3.5)
      const hevc = v.canPlayType('video/mp4; codecs="hvc1.1.6.L120.90"');
      v.src = phone ? (hevc ? SRC.phoneHevc : SRC.phone)
        : hevc ? SRC.hevc
        : v.canPlayType('video/mp4; codecs="av01.0.08M.08"') ? SRC.av1
        : SRC.h264;
      v.load();
    };
    const WAKE = ["wheel", "touchstart", "pointerdown", "keydown", "scroll"] as const;
    for (const e of WAKE) addEventListener(e, load, { passive: true });
    let idle = 0;
    if (scrollY > 2) load(); // a reload mid-tour: the browser restored the scroll before these listeners were here
    const later = () => { idle = window.setTimeout(load, 3000); };
    if (document.readyState === "complete") later();
    else addEventListener("load", later, { once: true });

    return () => {
      dead = true;
      stop();
      removeEventListener("load", later);
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("error", onFail);
    };

    function start(build: typeof buildTour) {
      let goal = 0; // the tick the scroll asks for (the tour itself glides there: step, below)
      const glides = !reduced && matchMedia("(pointer: fine)").matches; // mouse or trackpad (touch keeps its native scroll)
      api.current = build(root.current!, { reduced, onTick: (t) => { goal = t; } });

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
      // and out; the film and the HTML layer (captions, hero, close) both show where the tour is, so they never drift apart.
      // A wheel glide moves the page at that same pace, so there goal and tour stay together; a swipe moves the page at once
      // and the tour glides after it, so a flick plays at the same speed as a slow swipe and the film plays, never seeks.
      // Moving forward, the film plays (frames decode in order, no seeking) at the tour's speed, plus a gentle correction
      // for any gap. It pauses once caught up; a frame or two of overshoot is held rather than sought back. Going back seeks,
      // and so do the tour's only jumps: Book, the backlog cap (step, below) and reduced motion.
      const marks = LABELS.map((m) => ({
        el: root.current!.querySelector<HTMLElement>(`[data-mark="${m.id}"]`)!,
        at: (film.marks as Record<string, { from: number; points: (number[] | null)[] }>)[m.id] as Track,
      }));
      const FRAME = 1 / (phone ? 30 : 60); // desktop films are 60 fps, phone films 30 (film/encode.py)
      let canPlay = !reduced;
      let frameId = 0;
      let now = goal, vel = 0, shownAt = -1; // the tour's tick, its speed (ticks per second), the tick the HTML layer shows
      let speed = 0, lastTarget = 0, lastMs = performance.now(); // how fast the film should move (s per s)
      jump.current = (tick) => { // "Book a viewing": straight there, not a glide through the tour
        window.scrollTo(0, api.current!.goto(tick));
        goal = now = tick;
        vel = 0;
      };
      // The nav goes white where the film is dark behind the logo, navy where it is light (per frame, from film/tone.py).
      const shade = film.logo[phone ? "phone" : "desk"];
      let shown: Tone = "ink";
      const step = () => {
        frameId = requestAnimationFrame(step);
        const t = shade[Math.min(shade.length - 1, Math.round(v.currentTime * film.fps))] === "D" ? "paper" : "ink";
        if (t !== shown) setTone((shown = t));
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
          // arrived; never past the goal and back, which would step the film backwards
          if ((goal - next) * gap <= 0 || (Math.abs(goal - next) < 0.01 && Math.abs(vel) < 0.05)) {
            now = goal;
            vel = 0;
          } else now = next;
        }
        placeMarks(v, marks, phone); // before the timeline writes its styles: no second style recalc
        if (now !== shownAt) api.current!.seek((shownAt = now));
        const target = filmSec(now);
        if (dt > 0) speed = (target - lastTarget) / dt; // the tour moves smoothly: no need to smooth this
        lastTarget = target;
        if (v.readyState < 2) return;
        if (canPlay && now === 0 && goal === 0) {
          // at rest under the title: the clouds drift, round the loop (its last frame runs into its first)
          if (v.currentTime >= LOOP - FRAME && !v.seeking) v.currentTime = 0;
          if (v.playbackRate !== 1) v.playbackRate = 1;
          if (v.paused) v.play().catch(() => { canPlay = false; });
          return;
        }
        // still in the loop when the tour sets off: play on out of it (seeking to the film would jump the clouds)
        const ahead = target - v.currentTime;
        const loopLeft = v.currentTime < LOOP ? LOOP - v.currentTime : 0;
        const going = !v.paused;
        // a quarter second past the tour is held, not sought back (a jump back was the hitch when a glide came to rest);
        // scrolling backwards still follows frame by frame
        const behindOk = speed < -0.05 ? FRAME * 2 : 0.25;
        if (ahead < -behindOk || ahead - loopLeft > 1.5) {
          if (!v.seeking) {
            if (going) v.pause();
            v.currentTime = target;
          }
        } else if (canPlay && !v.ended && (going ? speed > 0.3 || ahead > 0.12 : speed > 0.3 || ahead > 0.25)) {
          // (play() on an ended film would restart it from frame 1)
          // play at the tour's own speed, nudged towards it; only touch the rate when it really changes. Once the tour
          // has stopped, a gap of a few frames is left as it is (creeping through them slowly read as a stutter), and a
          // bigger gap is closed at a normal pace, never a crawl.
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
      <div className="stage" data-world={ready}>
        {/* the film's first frame, shown at once (it is the largest paint), then the film itself over it */}
        <picture>
          <source media={PHONE} srcSet="/tour/earth-poster-phone.webp" />
          <img className="film" src="/tour/earth-poster.webp" alt="" fetchPriority="high" />
        </picture>
        <video ref={video} className="film film--video" muted playsInline preload="auto" aria-hidden="true"
          disablePictureInPicture disableRemotePlayback />
        <HeroTitle />
        {/* the film's labels: countries, cities, areas, the markers on the roofs (placed every frame from the 3D camera) */}
        <div className="marks">
          {LABELS.map((m) => m.kind === "pin" ? (
            <a key={m.id} className="mark mark--pin" data-mark={m.id} href={m.sale ? "/search?type=buy" : "/search?type=rent"}>
              <span className="mark__chip">{m.label}</span>
            </a>
          ) : (
            <span key={m.id} className={`mark mark--${m.kind}`} data-mark={m.id} aria-hidden="true">
              <span className="mark__chip">{m.label}</span>
            </span>
          ))}
        </div>
        <VillaCard />
        <Close />
        <Hero />
        <Captions />
        <Nav tone={tone} onBook={() => jump.current(TOTAL - 1)} />
      </div>
    </section>
  );
}

type Track = { from: number; points: ([number, number] | null)[] };

/** Labels sit where Blender projected each place for this frame (null: behind the Earth, off screen, not yet there),
 *  mapped through the video's object-fit: cover crop (and, on phones, the portrait cut), fading in and out over the
 *  first and last few frames of their span. Hidden ones can't be clicked or tabbed to. */
function placeMarks(v: HTMLVideoElement, marks: { el: HTMLElement; at: Track }[], phone: boolean) {
  const frame = Math.round(v.currentTime * film.fps) + 1;
  const w = v.clientWidth, h = v.clientHeight;
  const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
  const s = Math.max(w / vw, h / vh);
  const dw = vw * s, dh = vh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
  const x0 = cropX0(v.currentTime);
  for (const { el, at } of marks) {
    const i = frame - at.from;
    const p = i >= 0 && i < at.points.length ? at.points[i] : null;
    const x = p ? (phone ? (p[0] - x0) / CROP_W : p[0]) : -1;
    if (!p || x < -0.02 || x > 1.02) {
      if (el.dataset.on) {
        el.style.opacity = "0";
        el.style.visibility = "hidden";
        delete el.dataset.on;
      }
      continue;
    }
    el.dataset.on = "1";
    el.style.opacity = String(Math.min(1, Math.min(i, at.points.length - 1 - i) / 6));
    el.style.visibility = "visible";
    el.style.transform = `translate(${ox + x * dw}px, ${oy + p[1] * dh}px)`;
  }
}
