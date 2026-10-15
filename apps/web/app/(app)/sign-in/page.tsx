import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneSignIn } from "@/components/auth/phone-sign-in";
import { safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in | DirectNest", robots: { index: false } };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="px-4 pt-16 pb-24 sm:pt-24">
      <Suspense>
        {searchParams.then((p) => (
          <PhoneSignIn next={safeNext(p.next)} google={!!process.env.GOOGLE_CLIENT_ID} dev={process.env.NODE_ENV === "development"} />
        ))}
      </Suspense>
    </main>
  );
}
