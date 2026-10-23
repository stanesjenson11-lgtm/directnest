"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buildTour } from "./timeline";
import { Captions, Close, Hero, Nav, StopRail } from "./Chrome";
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
const SRC = { small: "/tour/film-720.mp4", large: "/tour/film-1080.mp4" };

/** The scroll tour: a sticky stage with the film, scrubbed by scroll, and the HTML layer on top. */
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

    let lenis: Lenis | null = null;
    const raf = (t: number) => lenis?.raf(t * 1000);
    if (!reduced) {
      lenis = new Lenis({ lerp: 0.09 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }
    smooth.current = lenis;

    const v = video.current!;
    // phones get the 720p encode (less to download); both are cut with a keyframe every few frames so seeking is quick
    v.src = Math.min(screen.width, screen.height) < 700 ? SRC.small : SRC.large;
    const onReady = () => setReady("ready");
    const onFail = () => setReady("failed");
    v.addEventListener("loadeddata", onReady);
    v.addEventListener("error", onFail);

    let target = 0;
    const ctx = gsap.context(() => {
      api.current = buildTour(root.current!, {
        reduced,
        onTone: setTone,
        onStop: setActive,
        onTick: (t) => { target = (t / TOTAL) * DURATION; },
      });
    }, root);

    // Seek towards the scroll position, one seek at a time (a new seek before the last lands just queues decoding).
    const pins = PINS.map((p) => root.current!.querySelector<HTMLElement>(`[data-wpin="${p.id}"]`)!);
    let frameId = 0;
    const step = () => {
      frameId = requestAnimationFrame(step);
      if (v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - target) > 0.5 / film.fps) v.currentTime = target;
      placePins(v, pins);
    };
    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("error", onFail);
      api.current?.destroy();
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis?.destroy();
      smooth.current = null;
    };
  }, []);

  function goToTick(tick: number) {
    const y = api.current?.goto(tick);
    if (y == null) return;
    if (smooth.current) smooth.current.scrollTo(y, { duration: 2.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y });
  }

  return (
    <section className="tour" ref={root} aria-label="Gharaana tour">
      <div className="stage" data-world={ready}>
        <video ref={video} className="film" poster="/tour/film-poster.jpg" muted playsInline preload="auto" aria-hidden="true" />
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

/** Pins sit where Blender projected each place for this frame, mapped through the video's object-fit: cover crop. */
function placePins(v: HTMLVideoElement, els: HTMLElement[]) {
  const frame = Math.round(v.currentTime * film.fps) + 1;
  const tick = (v.currentTime / DURATION) * TOTAL;
  const alpha = pw(PIN_FADE, tick);
  const { from, to, points } = film.pins;
  if (alpha < 0.01 || frame < from || frame > to) {
    for (const el of els) el.style.opacity = "0";
    return;
  }
  const w = v.clientWidth, h = v.clientHeight;
  const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
  const s = Math.max(w / vw, h / vh);
  const dw = vw * s, dh = vh * s, ox = (w - dw) / 2, oy = (h - dh) / 2;
  PINS.forEach((p, i) => {
    const [x, y] = points[p.id][frame - from];
    els[i].style.opacity = String(alpha);
    els[i].style.transform = `translate(${ox + x * dw}px, ${oy + y * dh}px)`;
  });
}
