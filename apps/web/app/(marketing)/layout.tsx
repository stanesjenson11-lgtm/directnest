import type { ReactNode } from "react";
import { Gloock, Hanken_Grotesk } from "next/font/google";

// The home page tour: Hanken Grotesk for text (a free stand-in for Neue Haas Grotesk, see components/tour/tour.css)
// and Gloock, a free ball-terminal serif, for the title, the cards and the captions.
// Neither is preloaded: Next sends preloads as a Link header, and Chrome held the page's first paint for 1-2 s while
// those fonts came in. With swap, the text shows at once in a size-matched fallback and changes face a moment later.
const fallback = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-fallback", display: "swap", preload: false });
const serif = Gloock({ subsets: ["latin"], weight: "400", variable: "--font-gloock", display: "swap", preload: false });

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className={`${fallback.variable} ${serif.variable}`}>{children}</div>;
}
