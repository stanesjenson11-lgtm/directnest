import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Anek_Latin, Kalam } from "next/font/google";
import { RENTALS } from "@/lib/search";
import "./globals.css";

const anek = Anek_Latin({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-anek",
  display: "swap",
});

// Only used for hand-painted lettering inside illustrations (the TO-LET board).
const kalam = Kalam({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-kalam",
  display: "swap",
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
    <html lang="en-IN" className={`${anek.variable} ${kalam.variable}`}>
      <body>{children}</body>
    </html>
  );
}
