import Link from "next/link";
import { can, type Section } from "@/lib/roles";
import { getSession } from "@/lib/session";

// The last field is the section a role needs to see the tab; null = every staff member (their own authenticator).
const PAGES: readonly (readonly [string, string, Section | null])[] = [
  ["/admin", "Review queue", "queue"],
  ["/admin/leads", "Sales leads", "leads"],
  ["/admin/support", "Support", "support"],
  ["/admin/users", "Users", "users"],
  ["/admin/projects", "Projects", "projects"],
  ["/admin/plans", "Plans", "plans"],
  ["/admin/pages", "Blog and areas", "pages"],
  ["/admin/import", "Import", "import"],
  ["/admin/staff", "Staff", "staff"],
  ["/admin/security", "Security", null],
];

export async function AdminNav({ current }: { current: string }) {
  const role = (await getSession())?.user.role;
  return (
    <nav aria-label="Admin" className="mb-8 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-hairline text-[15px] font-medium">
      {PAGES.filter(([, , section]) => !section || can(role, section)).map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={href === current ? "page" : undefined}
          className={`border-b-2 px-3 py-2 whitespace-nowrap ${href === current ? "border-indigo text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
