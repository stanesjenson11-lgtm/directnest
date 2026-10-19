import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdminRole } from "@/lib/session";
import { Enroll } from "./enroll";

export const metadata: Metadata = { title: "DirectNest", robots: { index: false } };

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" />}>
        <Security />
      </Suspense>
    </main>
  );
}

async function Security() {
  const { user } = await requireAdminRole();
  return user.twoFactorEnabled ? (
    <>
      <h1 className="text-[2rem] leading-tight font-semibold">Security</h1>
      <p className="mt-1 text-muted">
        Your authenticator app is on. If you lose the phone and your backup codes, someone with server access resets it with <code>pnpm reset-admin-2fa</code>.
      </p>
    </>
  ) : (
    <div className="mx-auto max-w-sm">
      <h1 className="text-[1.75rem] leading-tight font-semibold">Set up your authenticator</h1>
      <p className="mt-2 text-muted">Staff pages need a code from an authenticator app on top of your phone sign-in. Do this now, before anything else.</p>
      <Enroll />
    </div>
  );
}
