import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Anek_Latin, Kalam } from "next/font/google";
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
  title: "DirectNest: rent straight from the owner",
  description:
    "Homes for rent and sale from verified owners in Bengaluru and across India. A person approves every listing. No brokerage, ever.",
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
