import Link from "next/link";

const PAGES = [
  ["/admin", "Review queue"],
  ["/admin/users", "Users"],
] as const;

export function AdminNav({ current }: { current: (typeof PAGES)[number][0] }) {
  return (
    <nav aria-label="Admin" className="mb-8 flex gap-1 border-b border-hairline text-[15px] font-medium">
      {PAGES.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={href === current ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 ${href === current ? "border-indigo text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
