import type { ReactNode } from "react";
import { Anton, Gloock, Hanken_Grotesk, Yellowtail } from "next/font/google";

// The home page tour: Hanken Grotesk for text (a free stand-in for Neue Haas Grotesk, see components/tour/tour.css),
// and free, commercially licensed stand-ins for the display faces picked for it: Anton for Victory Striker Sans,
// Gloock for Runiga, Yellowtail for Rooster (those three are personal-use only).
const fallback = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-fallback", display: "swap" });
const hero = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const serif = Gloock({ subsets: ["latin"], weight: "400", variable: "--font-gloock", display: "swap", preload: false }); // captions, below the fold
const script = Yellowtail({ subsets: ["latin"], weight: "400", variable: "--font-yellowtail", display: "swap" });

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={`${fallback.variable} ${hero.variable} ${serif.variable} ${script.variable}`}>{children}</div>;
}
