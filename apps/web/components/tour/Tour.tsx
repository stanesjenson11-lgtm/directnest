"use client";

import { useEffect, useRef, useState } from "react";
import type Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buildTour } from "./timeline";
import { Captions, Close, Hero, HeroTitle, Nav, StopRail } from "./Chrome";
import { PIN_FADE, STOPS, TOTAL, pw } from "./config";
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

/** While the title is up the film holds its first frame (the cut-out of the blocks lines up with it); it catches up by tick 22. */
const filmTick = (t: number) => (t < 4 ? 0 : t < 22 ? ((t - 4) * 22) / 18 : t);

/** The scroll tour: a sticky stage with the film, played by scroll, and the HTML layer on top. */
export default function Tour() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const api = useRef<ReturnType<typeof buildTour> | null>(null);
  const smooth = useRef<Lenis | null>(null);
  const [tone, setTone] = useState<Tone>("ink");
  const [active, setActive] = useState(0);
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
    // The film starts downloading once the page has loaded, so it never competes with the first view.
    const load = () => {
      // the smallest file this browser can play: AV1 (12 MB), HEVC for Safari on Macs (about 15), else H.264 (30)
      v.src = phone ? SRC.phone
        : v.canPlayType('video/mp4; codecs="av01.0.08M.08"') ? SRC.av1
        : v.canPlayType('video/mp4; codecs="hvc1.1.6.L120.90"') ? SRC.hevc
        : SRC.h264;
      v.load();
    };
    if (document.readyState === "complete") load();
    else addEventListener("load", load, { once: true });

    let target = 0;
    const ctx = gsap.context(() => {
      api.current = buildTour(root.current!, {
        reduced,
        onTone: setTone,
        onStop: setActive,
        onTick: (t) => { target = (filmTick(t) / TOTAL) * DURATION; },
      });
    }, root);

    // Mouse and trackpad: Lenis glides every wheel move in the same time, however fast it comes, and once the wheel
    // stops the page settles on the nearest stop of the tour (within half a screen). Touch stays the phone's own scroll:
    // smoother there, and phones never download Lenis.
    let gone = false;
    let teardown = () => {};
    if (!reduced && matchMedia("(pointer: fine)").matches) {
      Promise.all([import("lenis"), import("lenis/snap")]).then(([{ default: Smooth }, { default: Snap }]) => {
        if (gone) return;
        const l = new Smooth({ duration: 1.05, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, syncTouch: false });
        smooth.current = l;
        l.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => l.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        const snap = new Snap(l, { type: "proximity", distanceThreshold: "50%", duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
        let removers: (() => void)[] = [];
        const place = () => {
          removers.forEach((r) => r());
          removers = STOPS.map((s) => api.current?.goto(s.at)).filter((y): y is number => y != null).map((y) => snap.add(y));
        };
        place();
        ScrollTrigger.addEventListener("refresh", place);
        teardown = () => {
          ScrollTrigger.removeEventListener("refresh", place);
          snap.destroy();
          gsap.ticker.remove(tick);
          l.destroy();
          smooth.current = null;
        };
      });
    }

    // Moving forward a little at a time, the film plays (frames decode in order, no seeking), sped up or slowed to keep
    // pace with the scroll; jumps and scrolling back seek. Either way it lands on the frame the scroll asks for.
    const pins = PINS.map((p) => root.current!.querySelector<HTMLElement>(`[data-wpin="${p.id}"]`)!);
    let canPlay = !reduced;
    let frameId = 0;
    const step = () => {
      frameId = requestAnimationFrame(step);
      if (v.readyState < 2) return;
      const ahead = target - v.currentTime;
      if (Math.abs(ahead) < 0.6 / film.fps) {
        if (!v.paused) v.pause();
      } else if (canPlay && ahead > 0 && ahead < 1.5) {
        v.playbackRate = Math.min(6, Math.max(0.6, ahead * 2.5));
        if (v.paused) v.play().catch(() => { canPlay = false; }); // e.g. iOS low-power mode: seeking still works
      } else if (!v.seeking) {
        if (!v.paused) v.pause();
        v.currentTime = target;
      }
      placePins(v, pins, phone);
    };
    frameId = requestAnimationFrame(step);

    return () => {
      gone = true;
      teardown();
      cancelAnimationFrame(frameId);
      removeEventListener("load", load);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("error", onFail);
      api.current?.destroy();
      ctx.revert();
    };
  }, []);

  function goToTick(tick: number) {
    const y = api.current?.goto(tick);
    if (y == null) return;
    if (smooth.current) smooth.current.scrollTo(y, { duration: 2.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y, behavior: "smooth" });
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
        <StopRail tone={tone} active={active} onGo={(i) => goToTick(STOPS[i].at)} />
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
    let [x, y] = points[p.id][frame - from];
    if (phone) x = (x - PHONE_CROP.x0) / PHONE_CROP.w;
    els[i].style.opacity = String(alpha);
    els[i].style.transform = `translate(${ox + x * dw}px, ${oy + y * dh}px)`;
  });
}
