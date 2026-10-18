import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { getSession, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in | DirectNest", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="px-4 pt-16 pb-24 sm:pt-24">
      <Suspense>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignIn({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const p = await searchParams;
  const next = safeNext(p.next);
  // Already signed in: on to where they were going, or to confirm their number first.
  const session = await getSession();
  if (session) redirect(session.user.phoneNumberVerified ? next : `/verify-phone?next=${encodeURIComponent(next)}`);
  return (
    <PhoneSignIn
      next={next}
      providers={{ google: !!process.env.GOOGLE_CLIENT_ID, apple: !!process.env.APPLE_CLIENT_ID }}
      failed={p.error === "1"}
      dev={process.env.NODE_ENV === "development"}
    />
  );
}
