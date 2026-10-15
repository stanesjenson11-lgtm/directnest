"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SignInLink() {
  const path = usePathname();
  const next = path === "/sign-in" ? "/" : path;
  return (
    <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="rounded-full px-3 py-2 text-muted transition-colors hover:text-ink">
      Sign in
    </Link>
  );
}
