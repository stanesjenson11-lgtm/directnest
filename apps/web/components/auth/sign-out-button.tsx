"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.replace("/");
          router.refresh();
        })
      }
      className="h-10 cursor-pointer rounded-full border border-hairline px-4 text-[15px] font-medium hover:border-muted disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
