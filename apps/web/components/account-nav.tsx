import Link from "next/link";
import { unreadTotal } from "@/lib/chat";
import { unreadCount } from "@/lib/notify";
import { getSession } from "@/lib/session";
import { SignInLink } from "./sign-in-link";

const link = "rounded-full px-3 py-2 text-muted transition-colors hover:text-ink";

// Streams into the header; the rest of the page stays static.
export async function AccountNav() {
  const session = await getSession();
  if (!session) return <SignInLink />;
  const [unread, alerts] = await Promise.all([unreadTotal(session.user.id), unreadCount(session.user.id)]);
  return (
    <>
      <Link href="/notifications" aria-label={alerts ? `Alerts, ${alerts} new` : "Alerts"} className="relative grid h-10 w-10 place-items-center rounded-full text-muted transition-colors hover:text-ink">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {alerts > 0 && (
          <span aria-hidden="true" className="absolute top-1 right-1 min-w-4 rounded-full bg-indigo px-1 text-center text-[11px] leading-4 font-semibold text-canvas tabular-nums">
            {alerts > 9 ? "9+" : alerts}
          </span>
        )}
      </Link>
      <Link href="/messages" className={`hidden items-center gap-1.5 sm:inline-flex ${link}`}>
        Messages
        {unread > 0 && (
          <span className="rounded-full bg-indigo px-1.5 text-[12px] leading-5 font-semibold text-canvas tabular-nums">
            {unread}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </Link>
      {session.user.role === "admin" && (
        <Link href="/admin" className={`hidden md:inline-block ${link}`}>
          Review queue
        </Link>
      )}
      <Link href="/account" className={link}>
        Your account
      </Link>
    </>
  );
}
