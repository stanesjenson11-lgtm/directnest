import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdminRole } from "@/lib/session";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "DirectNest", robots: { index: false } };

export default function VerifyPage({ searchParams }: PageProps<"/admin/verify">) {
  return (
    <main className="mx-auto max-w-sm px-4 pt-16 pb-24 sm:px-6">
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-surface" />}>
        <Verify searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Verify({ searchParams }: Pick<PageProps<"/admin/verify">, "searchParams">) {
  const { user } = await requireAdminRole();
  if (!user.twoFactorEnabled) redirect("/admin/security");
  const enrolled = (await searchParams).enrolled === "1";
  return (
    <>
      <h1 className="text-[1.75rem] leading-tight font-semibold">Staff verification</h1>
      <p className="mt-2 text-muted">
        {enrolled ? "Authenticator added. Enter the next code to finish signing in." : "Enter the 6-digit code from your authenticator app, or one of your backup codes."}
      </p>
      <VerifyForm />
    </>
  );
}
