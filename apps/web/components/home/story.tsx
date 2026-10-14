"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { loadMotion } from "@/lib/motion";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/**
 * Turns the server-rendered beats (readable as plain stacked sections) into one pinned,
 * scroll-scrubbed story. Under reduced motion nothing here runs and the stack stays as is.
 */
export function Story({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mm: { revert(): void } | undefined;
    let cancelled = false;
    loadMotion().then(({ gsap, CustomBounce }) => {
      if (cancelled) return;
      const m = (mm = gsap.matchMedia());
      m.add(
        { motion: "(prefers-reduced-motion: no-preference)", small: "(max-width: 767px)" },
        (ctx) => {
          const { motion, small } = ctx.conditions as { motion: boolean; small: boolean };
          const el = root.current;
          if (!motion || !el) return;

          el.classList.add("is-animated");
          const q = gsap.utils.selector(el);
          const counter = q("[data-counter]")[0] as HTMLElement;
          const counterText = counter.textContent;
          CustomBounce.create("settle", { strength: 0.32 });

          const rocket = el.querySelector<SVGGElement>("#rocket")!;
          const bb = rocket.getBBox();
          const trails = q(".trail");
          const trail = { p: 0 };
          const count = { v: 0 };

          gsap.set(rocket, { autoAlpha: 0 });
          gsap.set(q(".trail-static"), { autoAlpha: 0 });
          gsap.set(trails, { drawSVG: "0% 0%" });
          counter.textContent = inr.format(0);

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: el,
              start: "top top",
              end: small ? "+=300%" : "+=420%",
              pin: q(".story-stage")[0],
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          });

          // Beat 0 â†’ 1: the hero steps aside
          tl.to(q(".hero-copy"), { autoAlpha: 0, y: -70, duration: 1 }, 0)
            .to(q(".hero-board"), { autoAlpha: 0, y: -50, rotate: -4, duration: 1 }, 0.1)

            // Beat 1: the brokerage leaves on a rocket, right to left
            .fromTo(q("[data-beat='1'] .beat-copy"), { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.7)
            .set(rocket, { autoAlpha: 1 }, 1.2)
            .to(
              rocket,
              {
                duration: 3,
                motionPath: {
                  path: "#flight",
                  align: "#flight",
                  alignOrigin: [-bb.x / bb.width, -bb.y / bb.height],
                  autoRotate: 180,
                },
              },
              1.2,
            )
            .to(
              trail,
              {
                p: 100,
                duration: 3,
                onUpdate: () => gsap.set(trails, { drawSVG: `${Math.max(0, trail.p - 26)}% ${trail.p}%` }),
              },
              1.2,
            )
            .to(
              count,
              {
                v: 45000,
                duration: 2.4,
                ease: "power1.inOut",
                onUpdate: () => {
                  counter.textContent = inr.format(Math.round(count.v / 500) * 500);
                },
              },
              1.5,
            )
            .to(trails, { autoAlpha: 0, duration: 0.5 }, 4.1)
            .to(q(".sky-prop"), { autoAlpha: 0, duration: 0.6 }, 4.3)
            .to(q("[data-beat='1'] .beat-copy"), { autoAlpha: 0, y: -50, duration: 0.7 }, 4.4)

            // Beat 2: a real home settles into place, then the stamp
            .fromTo(q("[data-beat='2'] .beat-copy"), { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 4.9)
            .fromTo(q(".plan"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 4.9)
            .fromTo(q(".wall"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.1, stagger: 0.06 }, 5)
            .from(q(".tag"), { y: () => -window.innerHeight, duration: 1.2, ease: "settle", stagger: 0.16 }, 5.6)
            .from(q("#keys"), { y: () => -window.innerHeight, rotate: -60, duration: 1.2, ease: "settle" }, 6.4)
            .fromTo(
              q("#stamp"),
              // CSS already tilts the stamp -8deg via the `rotate` property; this adds on top.
              { autoAlpha: 0, scale: 1.9, rotate: -16 },
              { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.45, ease: "expo.out" },
              7,
            )
            .to(q("[data-beat='2'] .beat-copy, .plan"), { autoAlpha: 0, y: -50, duration: 0.7 }, 7.9)

            // Beat 3: the product itself, tilting up into view
            .fromTo(q("[data-beat='3'] .beat-copy"), { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 8.3)
            .fromTo(
              q("#device"),
              { autoAlpha: 0, yPercent: 45, rotateX: 34, scale: 0.88 },
              { autoAlpha: 1, yPercent: 0, rotateX: 0, scale: 1, duration: 1.5, ease: "power2.out" },
              8.4,
            )
            .from(q(".demo-row"), { autoAlpha: 0, x: -24, duration: 0.5, stagger: 0.12 }, 9.4)
            .from(q(".pin"), { autoAlpha: 0, scale: 0, transformOrigin: "50% 100%", duration: 0.45, ease: "back.out(2)", stagger: 0.09 }, 9.5)
            .to(q(".skyline-wrap"), { yPercent: 22, duration: 1.8 }, 8.3)
            .to({}, { duration: 0.8 }); // hold the final frame before releasing the pin

          return () => {
            el.classList.remove("is-animated");
            counter.textContent = counterText;
          };
        },
      );
    });
    return () => {
      cancelled = true;
      mm?.revert();
    };
  }, []);

  return (
    <div ref={root} className="story">
      {children}
    </div>
  );
}
