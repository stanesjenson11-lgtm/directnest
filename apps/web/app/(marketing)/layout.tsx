import type { ReactNode } from "react";
import { Hanken_Grotesk } from "next/font/google";

// The home page tour is set in Hanken Grotesk, a free stand-in for Neue Haas Grotesk (see components/tour/tour.css).
const fallback = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-fallback",
  display: "swap",
});

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={fallback.variable}>{children}</div>;
}
