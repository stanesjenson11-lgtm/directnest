import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Anek_Latin, Geist } from "next/font/google";
import { RENTALS } from "@/lib/search";
import "./globals.css";

const anek = Anek_Latin({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-anek",
  display: "swap",
});

// Only used on the sign-in screens, whose design is set in it. Not preloaded, so other pages don't fetch it.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: `DirectNest: ${RENTALS ? "rent or buy" : "buy"} straight from verified owners`,
  description:
    `Homes for ${RENTALS ? "rent and sale" : "sale"} from verified owners in Bengaluru. A person approves every listing before it goes live.`,
};

export const viewport: Viewport = {
  themeColor: "#1c2150",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${anek.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  );
}
