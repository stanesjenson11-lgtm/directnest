"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buildTour } from "./timeline";
import { Captions, Close, Hero, HeroTitle, Nav } from "./Chrome";
import { PIN_FADE, TOTAL, pw } from "./config";
import film from "./film.json";
import "./tour.css";

type Tone = "ink" | "paper";

const PINS = [
  { id: "home", label: "Your home" },
  { id: "metro", label: "Metro" },
  { id: "lake", label: "Lake" },
  { id: "school", label: "School" },
  { id: "hospital", label: "Hospital" },
  { id: "supermarket", label: "Supermarket" },
] as const;

// The tour is a film path-traced in Blender (apps/web/film): frame 1 is tick 0, the last frame is tick TOTAL.
const DURATION = (film.frames - 1) / film.fps;
// Phones held upright get a portrait cut from the centre of the frame (encode.py PHONE: x 656..1264 of 1920).
const PHONE = "(orientation: portrait) and (max-width: 699px)";
const PHONE_CROP = { x0: 656 / 1920, w: 608 / 1920 };
const SRC = { av1: "/tour/film-1080-av1.mp4", hevc: "/tour/film-1080-hevc.mp4", h264: "/tour/film-1080.mp4", phone: "/tour/film-phone.mp4" };

// The steady pace of a wheel or trackpad glide: film seconds per second (the whole tour in about 36 s).
const SPEED = 1.4;

/** While the title is up the film holds its first frame (the cut-out of the blocks lines up with it); it catches up by tick 22. */
const filmTick = (t: number) => (t < 4 ? 0 : t < 22 ? ((t - 4) * 22) / 18 : t);

/** The scroll tour: a sticky stage with the film, played by scroll, and the HTML layer on top. */
export default function Tour() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const api = useRef<ReturnType<typeof buildTour> | null>(null);
  const [tone, setTone] = useState<Tone>("ink");
  const [ready, setReady] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    const v = video.current!;
    const phone = matchMedia(PHONE).matches;
    const onReady = () => setReady("ready");
    const onFail = () => setReady("failed");
    v.addEventListener("loadeddata", onReady);
    v.addEventListener("error", onFail);
    // The film starts downloading when the visitor first scrolls or touches the page (or 3 s after it has loaded), so
    // it never competes with the first view, and someone who leaves at once never pays for it.
    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
      // the smallest file this browser can play: AV1 (12 MB), HEVC for Safari on Macs (about 15), else H.264 (30)
      v.src = phone ? SRC.phone
        : v.canPlayType('video/mp4; codecs="av01.0.08M.08"') ? SRC.av1
        : v.canPlayType('video/mp4; codecs="hvc1.1.6.L120.90"') ? SRC.hevc
        : SRC.h264;
      v.load();
    };
    const WAKE = ["wheel", "touchstart", "pointerdown", "keydown", "scroll"] as const;
    for (const e of WAKE) addEventListener(e, load, { passive: true });
    let idle = 0;
    const later = () => { idle = window.setTimeout(load, 3000); };
    if (document.readyState === "complete") later();
    else addEventListener("load", later, { once: true });

    let target = 0;
    const ctx = gsap.context(() => {
      api.current = buildTour(root.current!, {
        reduced,
        onTick: (t) => { target = (filmTick(t) / TOTAL) * DURATION; },
      });
    }, root);

    // Mouse and trackpad: the tour runs at one steady speed whatever the wheel does. A wheel or trackpad move only says
    // "keep going" (and which way); the page then glides at a constant pace, easing in, and easing out about 0.4 s after
    // the last move, so every scene takes the same time however fast or slow the fingers are. Nothing snaps: it stops
    // where you stop. Past either end of the tour the wheel scrolls the page as usual; touch keeps the phone's own scroll.
    let teardown = () => {};
    if (!reduced && matchMedia("(pointer: fine)").matches) {
      let dir = 0, until = 0, vel = 0, pos = 0, last = 0, glide = 0;
      const ends = () => [api.current!.goto(0), api.current!.goto(TOTAL)] as const;
      const run = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const [top, end] = ends();
        const want = now < until ? dir * ((end - top) / DURATION) * SPEED : 0;
        vel += (want - vel) * (1 - Math.exp(-dt / 0.22));
        if (want === 0 && Math.abs(vel) < 4) {
          vel = 0;
          glide = 0;
          return;
        }
        pos = Math.min(end, Math.max(top, pos + vel * dt));
        window.scrollTo(0, pos);
        glide = requestAnimationFrame(run);
      };
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || !e.deltaY) return; // pinch-zoom, sideways swipes
        const d = Math.sign(e.deltaY);
        const [top, end] = ends();
        if ((d > 0 && scrollY >= end - 1) || (d < 0 && scrollY <= top + 1)) return;
        e.preventDefault();
        if (d !== dir) vel = 0; // turning round: no backwards momentum
        dir = d;
        until = performance.now() + 400;
        if (!glide) {
          pos = scrollY;
          last = performance.now();
          glide = requestAnimationFrame(run);
        }
      };
      addEventListener("wheel", onWheel, { passive: false });
      teardown = () => {
        removeEventListener("wheel", onWheel);
        cancelAnimationFrame(glide);
      };
    }

    // Moving forward, the film plays (frames decode in order, no seeking) at the speed the scroll is moving, plus a gentle
    // correction for any gap, so a steady glide gives a steady film. It pauses once caught up; a frame or two of
    // overshoot is held rather than sought back. Jumps and scrolling back seek.
    const pins = PINS.map((p) => root.current!.querySelector<HTMLElement>(`[data-wpin="${p.id}"]`)!);
    const FRAME = 1 / 60; // the encodes are 60 fps (film/encode.py)
    let canPlay = !reduced;
    let frameId = 0;
    let speed = 0, lastTarget = 0, lastNow = performance.now(); // how fast the scroll moves the film (s per s)
    // The nav goes white where the film is dark behind the logo, navy where it is light (per frame, from film/tone.py).
    const shade = film.logo[phone ? "phone" : "desk"];
    let shown: Tone = "ink";
    const step = () => {
      frameId = requestAnimationFrame(step);
      const t = shade[Math.min(shade.length - 1, Math.round(v.currentTime * film.fps))] === "D" ? "paper" : "ink";
      if (t !== shown) setTone((shown = t));
      const now = performance.now();
      const dt = (now - lastNow) / 1000;
      lastNow = now;
      if (dt > 0) speed += ((target - lastTarget) / dt - speed) * Math.min(1, dt * 6);
      lastTarget = target;
      if (v.readyState < 2) return;
      const ahead = target - v.currentTime;
      const going = !v.paused;
      if (canPlay && ahead < 1.5 && ahead > -FRAME * 3 && (speed > 0.05 || ahead > FRAME * 2)) {
        v.playbackRate = Math.min(4, Math.max(0.25, Math.max(0, speed) + ahead * 1.5));
        if (!going) v.play().catch(() => { canPlay = false; }); // e.g. iOS low-power mode: seeking still works
      } else if (ahead > -FRAME * 3 && ahead <= FRAME * 2) {
        if (going) v.pause(); // caught up (or a hair past): hold
      } else if (!v.seeking) {
        if (!v.paused) v.pause();
        v.currentTime = target;
      }
      placePins(v, pins, phone);
    };
    frameId = requestAnimationFrame(step);

    return () => {
      teardown();
      cancelAnimationFrame(frameId);
      removeEventListener("load", later);
      for (const e of WAKE) removeEventListener(e, load);
      clearTimeout(idle);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("error", onFail);
      api.current?.destroy();
      ctx.revert();
    };
  }, []);

  function goToTick(tick: number) {
    const y = api.current?.goto(tick);
    if (y == null) return;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  return (
    <section className="tour" ref={root} aria-label="Gharaana tour">
      <div className="stage" data-world={ready}>
        {/* the film's first frame, shown at once (it is the largest paint), then the film itself over it */}
        <picture>
          <source media={PHONE} srcSet="/tour/film-poster-phone.webp" />
          <img className="film" src="/tour/film-poster.webp" alt="" fetchPriority="high" />
        </picture>
        <video ref={video} className="film film--video" muted playsInline preload="auto" aria-hidden="true" />
        <HeroTitle />
        {/* the community's blocks cut from frame 1, laid over the title so it sits behind them */}
        <picture>
          <source media={PHONE} srcSet="/tour/hero-cutout-phone.webp" />
          <img className="film film--cutout" data-cutout src="/tour/hero-cutout.webp" alt="" decoding="async" />
        </picture>
        <div className="wpins" aria-hidden="true">
          {PINS.map((p) => (
            <div key={p.id} className="wpin" data-wpin={p.id}>
              <span className="wpin__chip">{p.label}</span>
              <i className="wpin__dot" />
            </div>
          ))}
        </div>
        <Close />
        <Hero />
        <Captions />
        <Nav tone={tone} onBook={() => goToTick(TOTAL - 1)} />
      </div>
    </section>
  );
}

let pinsShown = true;
/** Pins sit where Blender projected each place for this frame, mapped through the video's object-fit: cover crop. */
function placePins(v: HTMLVideoElement, els: HTMLElement[], phone: boolean) {
  const frame = Math.round(v.currentTime * film.fps) + 1;
  const tick = (v.currentTime / DURATION) * TOTAL;
  const alpha = pw(PIN_FADE, tick);
  const { from, to, points } = film.pins;
  if (alpha < 0.01 || frame < from || frame > to) {
    if (pinsShown) for (const el of els) el.style.opacity = "0";
    pinsShown = false;
    return;
  }
  pinsShown = true;
  const w = v.clientWidth, h = v.clientHeight;
  const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
  const s = Math.max(w / vw, h / vh);
  const dw = vw * s, dh = vh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
  PINS.forEach((p, i) => {
    const [fx, y] = points[p.id][frame - from];
    const x = phone ? (fx - PHONE_CROP.x0) / PHONE_CROP.w : fx;
    els[i].style.opacity = String(alpha);
    els[i].style.transform = `translate(${ox + x * dw}px, ${oy + y * dh}px)`;
  });
}
