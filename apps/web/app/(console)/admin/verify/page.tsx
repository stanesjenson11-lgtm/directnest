import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/session";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "DirectNest", robots: { index: false } };

export default function VerifyPage() {
  return (
    <main className="mx-auto max-w-sm px-4 pt-16 pb-24 sm:px-6">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-surface" />}>
        <Verify />
      </Suspense>
    </main>
  );
}

async function Verify() {
  const { user } = await requireAdminRole();
  if (!user.twoFactorEnabled) redirect("/admin/security");
  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-semibold">Staff verification</h1>
      <p className="mt-2 text-muted">Enter the 6-digit code from your authenticator app, or one of your backup codes. The console then stays open until the end of the day.</p>
      <VerifyForm />
    </>
  );
}
