"use client";

import { useEffect } from "react";
import "lenis/dist/lenis.css";
import { loadMotion, prefersMotion } from "@/lib/motion";

// Brand pages only. Search and map pages must not use this (it fights map wheel and scroll panels).
export function SmoothScroll() {
  useEffect(() => {
    if (!prefersMotion()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    Promise.all([import("lenis"), loadMotion()]).then(([{ default: Lenis }, { gsap, ScrollTrigger }]) => {
      if (cancelled) return;
      const lenis = new Lenis({ anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      cleanup = () => {
        gsap.ticker.remove(tick);
        lenis.destroy();
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
  return null;
}
