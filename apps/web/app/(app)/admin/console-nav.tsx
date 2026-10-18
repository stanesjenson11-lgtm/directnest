"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavGroup = { label: string; items: { href: string; label: string }[] };

// The home of the console ("/admin") is a prefix of every other path, so it matches only itself.
const isHere = (path: string, href: string) => (href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`));

const row = "flex h-11 items-center rounded-xl px-3 text-[15px] transition-colors";

/** Left sidebar on tablets and up; one scrolling row of tabs on phones. Both list the same links, only the visible one is read out. */
export function ConsoleNav({ groups, name, roleLabel }: { groups: NavGroup[]; name: string; roleLabel: string }) {
  const path = usePathname();
  const link = (href: string, label: string) => {
    const here = isHere(path, href);
    return (
      <Link key={href} href={href} aria-current={here ? "page" : undefined} className={`${row} ${here ? "bg-surface font-semibold text-ink" : "text-muted hover:bg-surface hover:text-ink"}`}>
        {label}
      </Link>
    );
  };

  return (
    <>
      <nav aria-label="Console" className="hidden w-60 shrink-0 pt-10 pl-6 md:sticky md:top-20 md:block md:max-h-[calc(100svh-5rem)] md:self-start md:overflow-y-auto">
        <p className="px-3">
          <span className="block truncate font-semibold">{name || "Staff"}</span>
          <span className="block text-[14px] text-muted">{roleLabel}</span>
        </p>
        {groups.map((g) => (
          <div key={g.label} className="mt-6">
            <h2 className="px-3 pb-1 text-[13px] font-semibold text-muted">{g.label}</h2>
            <div className="flex flex-col gap-0.5">{g.items.map((i) => link(i.href, i.label))}</div>
          </div>
        ))}
        <Link href="/" className={`${row} mt-8 text-muted hover:bg-surface hover:text-ink`}>
          Back to DirectNest
        </Link>
      </nav>

      <nav aria-label="Console" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-hairline px-4 pt-4 pb-2 sm:px-6 md:hidden">
        {groups.flatMap((g) => g.items).map((i) => (
          <Link key={i.href} href={i.href} aria-current={isHere(path, i.href) ? "page" : undefined} className={`${row} shrink-0 whitespace-nowrap ${isHere(path, i.href) ? "bg-surface font-semibold text-ink" : "text-muted"}`}>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
