import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Confirm your number | DirectNest", robots: { index: false } };

// The second step after Google or Apple: a 6-digit SMS code that attaches a mobile number to the account.
export default function VerifyPhonePage({ searchParams }: PageProps<"/verify-phone">) {
  return (
    <main className="px-4 pt-16 pb-24 sm:pt-24">
      <Suspense>
        <VerifyPhone searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function VerifyPhone({ searchParams }: Pick<PageProps<"/verify-phone">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (session.user.phoneNumberVerified) redirect(next);
  return <PhoneSignIn link next={next} providers={{ google: false, apple: false }} dev={process.env.NODE_ENV === "development"} />;
}
