import type { ReactNode } from "react";
import { can, isStaffRole, ROLE_LABEL, sectionsOf, type Section } from "@/lib/roles";
import { getSession, staffGate } from "@/lib/session";
import { ConsoleNav, type NavGroup } from "./console-nav";

// Every console link, grouped; a role sees only the sections it may open. A null section is open to all staff.
const GROUPS: { label: string; items: { href: string; label: string; section: Section | null }[] }[] = [
  {
    label: "Work",
    items: [
      { href: "/admin", label: "Review queue", section: "queue" },
      { href: "/admin/leads", label: "Sales leads", section: "leads" },
      { href: "/admin/support", label: "Support", section: "support" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/projects", label: "Projects", section: "projects" },
      { href: "/admin/plans", label: "Plans", section: "plans" },
      { href: "/admin/pages", label: "Blog and areas", section: "pages" },
      { href: "/admin/import", label: "Import", section: "import" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/users", label: "Users", section: "users" },
      { href: "/admin/staff", label: "Staff", section: "staff" },
    ],
  },
  { label: "You", items: [{ href: "/admin/security", label: "Security", section: null }] },
];

/**
 * The staff console's frame. The sidebar shows once the person has passed their authenticator; before that
 * (setting one up, entering a code) the page stands alone. Presentation only: every page and action still runs
 * its own requireAdmin(section).
 */
export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const role = session?.user.role;
  if (!session || !isStaffRole(role)) return children; // the pages answer with a plain 404
  if ((await staffGate(sectionsOf(role)[0])).gate !== "ok") return children;

  const groups: NavGroup[] = GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => !i.section || can(role, i.section)).map(({ href, label }) => ({ href, label })),
  })).filter((g) => g.items.length);

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col md:flex-row">
      <ConsoleNav groups={groups} name={session.user.name} roleLabel={ROLE_LABEL[role]} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
