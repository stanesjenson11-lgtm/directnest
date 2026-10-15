import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignInLink } from "./sign-in-link";

const link = "rounded-full px-3 py-2 text-muted transition-colors hover:text-ink";

// Streams into the header; the rest of the page stays static.
export async function AccountNav() {
  const session = await getSession();
  if (!session) return <SignInLink />;
  return (
    <>
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
