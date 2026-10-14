import type { ReactNode } from "react";
import { SmoothScroll } from "@/components/smooth-scroll";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SmoothScroll />
      {children}
    </>
  );
}
