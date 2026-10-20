import Link from "next/link";
import type { ReactNode } from "react";
import { GateBoard, Skyline, Wordmark } from "@/components/home/scenery";
import { ICONS, type IconName } from "@/components/nav/icons";
import { rise } from "./ui";

// What sits beside the form: why the site can be trusted, in the home page's own words. The design these screens follow
// shows customer quotes here; DirectNest has no real ones yet, and made-up quotes would be misleading, so these are facts.
const POINTS: [IconName, string, string][] = [
  ["security", "Proof of ownership", "Every owner shows an electricity bill or property tax receipt before a home goes live."],
  ["queue", "Checked by a person", "Someone on our team reviews every listing. Brokers don't get through."],
  ["home", "No brokerage, ever", "You talk to the owner directly. Nobody takes a month's rent."],
];

/**
 * The sign-in screens' frame: the form on the left, the dusk street from the home page on the right (wide screens only).
 * `inset` is for the staff steps inside the console, which already has its own header and logo.
 */
export function AuthShell({ children, inset = false }: { children: ReactNode; inset?: boolean }) {
  return (
    <div className={`flex w-full flex-col md:flex-row ${inset ? "min-h-[calc(100dvh-5.5rem)]" : "min-h-dvh"}`}>
      <section className="flex flex-1 flex-col px-6 py-6 sm:px-10">
        {!inset && (
          <Link href="/" aria-label="DirectNest home" className="auth-rise self-start rounded-full text-ink">
            <Wordmark />
          </Link>
        )}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>

      {/* Held in view while a long step (the authenticator setup) scrolls beside it. */}
      <aside aria-label="Why DirectNest" className={`relative hidden flex-1 p-4 md:sticky md:block md:self-start ${inset ? "md:top-[4.75rem] md:h-[calc(100dvh-5.5rem)]" : "md:top-0 md:h-dvh"}`}>
        <div className="auth-scene on-dusk absolute inset-4 overflow-hidden rounded-3xl text-moonlight">
          {/* The home page's street, without its moon and kite: here they would sit behind the headline. */}
          <div className="absolute inset-x-0 bottom-0 h-[30%]">
            <Skyline />
          </div>
          <div className="absolute right-[3%] bottom-0 hidden h-[60%] lg:block">
            <GateBoard className="h-full w-auto" />
          </div>
          <p className="t-wide absolute top-10 left-10 max-w-[13ch] text-[clamp(2rem,3.2vw,3.25rem)] leading-[1.02] font-medium tracking-[-0.02em] text-balance">
            Homes straight from verified owners.
          </p>
          {/* Stacked on the left, so the TO-LET board stays in view on the right. */}
          <ul className="absolute bottom-8 left-8 grid w-[min(21rem,calc(100%-4rem))] gap-3">
            {POINTS.map(([icon, title, text], i) => {
              const Icon = ICONS[icon];
              return (
                <li key={title} style={rise(8 + 2 * i)} className="auth-rise flex items-start gap-3 rounded-3xl border border-moonlight/10 bg-dusk-deep/55 p-4 backdrop-blur-xl">
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-moonlight/10 text-streetlight">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[14px] leading-snug">
                    <span className="block font-semibold text-moonlight">{title}</span>
                    <span className="mt-1 block text-moonlight-dim">{text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
