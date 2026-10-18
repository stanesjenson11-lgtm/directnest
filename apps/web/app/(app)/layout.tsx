import type { ReactNode } from "react";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { HideOnConsole } from "@/components/nav/hide-on-console";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {/* The skip link in the header lands here. */}
      <div id="content" tabIndex={-1} className="outline-none">
        {children}
      </div>
      <HideOnConsole>
        <AppFooter />
      </HideOnConsole>
    </>
  );
}
