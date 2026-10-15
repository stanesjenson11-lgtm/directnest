import Link from "next/link";
import { getSession } from "@/lib/session";
import { SignInLink } from "./sign-in-link";

// Streams into the header; the rest of the page stays static.
export async function AccountNav() {
  const session = await getSession();
  if (!session) return <SignInLink />;
  return (
    <Link href="/account" className="rounded-full px-3 py-2 text-muted transition-colors hover:text-ink">
      Your account
    </Link>
  );
}
