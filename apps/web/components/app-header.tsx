import { connection } from "next/server";
import { Suspense } from "react";
import { HeaderShell } from "@/components/nav/header-shell";
import { SiteHeader, type Member } from "@/components/nav/site-header";
import { inbox, unreadTotal } from "@/lib/chat";
import { latestNotifications, unreadCount } from "@/lib/notify";
import { homeFor, isStaffRole, ROLE_LABEL } from "@/lib/roles";
import { RENTALS } from "@/lib/search";
import { getSession } from "@/lib/session";

// The header every page shares. The bar itself is static; who is signed in streams into it, so pages stay cacheable.
// "docked" is a fixed 64px so search and chat can size against it; the home page passes "overlay" to float over its hero.
export function AppHeader({ variant = "docked" }: { variant?: "overlay" | "docked" }) {
  return (
    <Suspense fallback={<HeaderShell variant={variant} rentals={RENTALS} />}>
      <WithMember variant={variant} />
    </Suspense>
  );
}

const when = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

async function WithMember({ variant }: { variant: "overlay" | "docked" }) {
  await connection(); // who is signed in is decided per request, never prerendered
  const session = await getSession();
  let member: Member | null = null;
  if (session) {
    const id = session.user.id;
    const [alerts, chats, unread, unreadAlerts] = await Promise.all([latestNotifications(id, 5), inbox(id, 5), unreadTotal(id), unreadCount(id)]);
    const role = session.user.role;
    member = {
      name: session.user.name,
      image: session.user.image ?? null,
      alerts: unreadAlerts,
      unread,
      alertItems: alerts.map((a) => ({ id: a.id, text: a.text, href: a.href, unread: !a.readAt, when: when(a.createdAt) })),
      chatItems: chats.map((c) => ({ id: c.id, title: c.title, who: c.otherName || "Owner", last: c.last, unread: c.unread, when: when(c.lastMessageAt) })),
      console: isStaffRole(role) ? { href: homeFor(role), label: ROLE_LABEL[role] } : null,
    };
  }
  return <SiteHeader variant={variant} member={member} rentals={RENTALS} />;
}
