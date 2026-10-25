import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CAPTIONS, CLOSE_AT, INTER, PLAN, TOTAL } from "./config";

type Vars = gsap.TweenVars;

export type TourHooks = {
  reduced: boolean;
  onTick: (tick: number) => void; // where the scroll asks the tour to be; Tour.tsx moves the tour there and calls seek()
};

const FADE = new Set(["opacity", "autoAlpha"]);

/** The HTML layer over the film: hero, the "from the ground up" card, captions, the floor plan, close. The film itself is rendered from apps/web/film.
 *  The timeline is not scrubbed by the scroll: Tour.tsx seeks it to the tour's own tick, which the film follows too, so
 *  the two never drift apart. Tour.tsx imports this module (and GSAP with it) only after the page is up, so it never
 *  holds up the first paint. */
export function buildTour(root: HTMLElement, o: TourHooks) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  let api!: ReturnType<typeof make>;
  const ctx = gsap.context(() => { api = make(root, o); }, root);
  return { ...api, destroy() { api.destroy(); ctx.revert(); } };
}

function make(root: HTMLElement, o: TourHooks) {
  const q = gsap.utils.selector(root);

  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  const st = ScrollTrigger.create({
    trigger: root,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => o.onTick(self.progress * TOTAL),
  });

  /** fromTo on the master timeline. With reduced motion, only fades animate; movement snaps. */
  function fx(target: gsap.TweenTarget, from: Vars, to: Vars, at: number, dur: number, ease = "none", later = false) {
    if (!o.reduced) {
      tl.fromTo(target, from, { duration: dur, ease, ...to, immediateRender: !later }, at);
      return;
    }
    const split = (v: Vars) => {
      const fade: Vars = {}, rest: Vars = {};
      for (const k of Object.keys(v)) {
        if (k === "ease") continue;
        (FADE.has(k) || k === "stagger" ? fade : rest)[k] = v[k];
      }
      return { fade, rest };
    };
    const f = split(from), t = split(to);
    if (Object.keys(t.fade).length) tl.fromTo(target, f.fade, { duration: Math.min(dur, 1.5), ease: "none", ...t.fade, immediateRender: !later }, at);
    if (Object.keys(f.rest).length) tl.set(target, f.rest, at);
    if (Object.keys(t.rest).length) tl.set(target, t.rest, at + dur);
  }

  // the hero is gone by tick 4, while the film still holds its first frame (film.json map)
  fx("[data-hero-title], [data-hero]", { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -90 }, 0.4, 3.2, "power2.in");

  // the card the film cuts under: opaque while the cut happens (ticks 20-30 hold the film)
  const [ia, ib] = INTER;
  fx("[data-inter]", { autoAlpha: 0 }, { autoAlpha: 1 }, ia, 2.5);
  fx("[data-inter] .inter__title", { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, ia + 0.6, 2.2, "power3.out");
  fx("[data-inter] .inter__line", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, ia + 1.6, 2, "power2.out");
  fx("[data-inter]", { autoAlpha: 1 }, { autoAlpha: 0 }, ib, 2, "none", true);

  const cap = (id: string, inAt: number, outAt: number) => {
    const s = `[data-cap="${id}"]`;
    fx(s, { autoAlpha: 0 }, { autoAlpha: 1 }, inAt, 0.6);
    fx(`${s} .wi`, { yPercent: 115 }, { yPercent: 0, stagger: 0.18 }, inAt, 1.4, "power3.out");
    fx(`${s} .cap__line`, { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, inAt + 0.9, 1.4, "power2.out");
    fx(s, { autoAlpha: 1 }, { autoAlpha: 0 }, outAt, 1.2, "none", true);
  };
  for (const [id, [inAt, outAt]] of Object.entries(CAPTIONS)) cap(id, inAt, outAt);

  // the floor plan over the film's last frame, then the way in
  const [pa, pb] = PLAN;
  fx("[data-plan]", { autoAlpha: 0 }, { autoAlpha: 1 }, pa, 2);
  fx("[data-plan] .plan__card", { y: 60, scale: 0.97 }, { y: 0, scale: 1 }, pa + 0.3, 2.2, "power3.out");
  fx("[data-plan]", { autoAlpha: 1 }, { autoAlpha: 0 }, pb, 1.2, "none", true);
  fx(".sc-close", { autoAlpha: 0 }, { autoAlpha: 1 }, CLOSE_AT, 2);
  fx("[data-close] > *", { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.3 }, CLOSE_AT + 0.4, 1.6, "power3.out");

  tl.set({}, {}, TOTAL); // fix total length

  /* ---- magnetic buttons ---- */
  const cleanups: (() => void)[] = [];
  if (matchMedia("(hover: hover) and (pointer: fine)").matches && !o.reduced) {
    for (const b of q("[data-magnet]")) {
      const qx = gsap.quickTo(b, "x", { duration: 0.5, ease: "power3" });
      const qy = gsap.quickTo(b, "y", { duration: 0.5, ease: "power3" });
      const mv = (e: PointerEvent) => {
        const r = b.getBoundingClientRect();
        qx((e.clientX - (r.left + r.width / 2)) * 0.28);
        qy((e.clientY - (r.top + r.height / 2)) * 0.28);
      };
      const lv = () => { qx(0); qy(0); };
      b.addEventListener("pointermove", mv as EventListener);
      b.addEventListener("pointerleave", lv);
      cleanups.push(() => { b.removeEventListener("pointermove", mv as EventListener); b.removeEventListener("pointerleave", lv); });
    }
  }

  // The intro (title words rising, line and search fading up) is plain CSS in tour.css: it starts with the first paint
  // instead of waiting for this script, which on a phone took seconds.
  document.documentElement.dataset.ready = "1";

  return {
    /** The scroll y of a tick. */
    goto(tick: number) {
      return st.start + (tick / TOTAL) * (st.end - st.start);
    },
    /** Shows the HTML layer as it is at this tick. */
    seek(tick: number) {
      tl.time(Math.min(TOTAL, Math.max(0, tick)));
    },
    destroy() {
      cleanups.forEach((f) => f());
      st.kill();
      tl.kill();
    },
  };
}
