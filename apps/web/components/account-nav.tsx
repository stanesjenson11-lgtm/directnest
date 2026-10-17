import Link from "next/link";
import { unreadTotal } from "@/lib/chat";
import { getSession } from "@/lib/session";
import { SignInLink } from "./sign-in-link";

const link = "rounded-full px-3 py-2 text-muted transition-colors hover:text-ink";

// Streams into the header; the rest of the page stays static.
export async function AccountNav() {
  const session = await getSession();
  if (!session) return <SignInLink />;
  const unread = await unreadTotal(session.user.id);
  return (
    <>
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
