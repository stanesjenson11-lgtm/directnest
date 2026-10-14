// Motion libraries load after hydration so they never compete with first paint on a 4G phone.
let loading: ReturnType<typeof load> | undefined;

async function load() {
  const [{ gsap }, { ScrollTrigger }, { MotionPathPlugin }, { DrawSVGPlugin }, { CustomEase }, { CustomBounce }] =
    await Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
      import("gsap/MotionPathPlugin"),
      import("gsap/DrawSVGPlugin"),
      import("gsap/CustomEase"),
      import("gsap/CustomBounce"),
    ]);
  gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, DrawSVGPlugin, CustomEase, CustomBounce);
  return { gsap, ScrollTrigger, CustomBounce };
}

export const loadMotion = () => (loading ??= load());

export const prefersMotion = () => matchMedia("(prefers-reduced-motion: no-preference)").matches;
