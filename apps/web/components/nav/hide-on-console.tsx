"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The staff console draws its own chrome, so the public footer stays out of it. */
export function HideOnConsole({ children }: { children: ReactNode }) {
  return usePathname().startsWith("/admin") ? null : children;
}
