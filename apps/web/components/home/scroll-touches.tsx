"use client";

import { useEffect } from "react";
import { loadMotion } from "@/lib/motion";

// Scroll-linked motion for the daylight sections: [data-parallax] images and [data-drift] rows.
export function ScrollTouches() {
  useEffect(() => {
    let mm: { revert(): void } | undefined;
    let cancelled = false;
    loadMotion().then(({ gsap }) => {
      if (cancelled) return;
      const m = (mm = gsap.matchMedia());
      m.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
          gsap.fromTo(
            el,
            { yPercent: -7 },
            { yPercent: 7, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } },
          );
        });
        gsap.utils.toArray<HTMLElement>("[data-drift]").forEach((el) => {
          const dir = Number(el.dataset.drift) || 1;
          gsap.fromTo(
            el,
            { xPercent: 6 * dir },
            { xPercent: -6 * dir, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } },
          );
        });
      });
    });
    return () => {
      cancelled = true;
      mm?.revert();
    };
  }, []);
  return null;
}
