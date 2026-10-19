"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const PROBLEM: Record<string, string> = {
  WRONG_CODE: "That code doesn't match. Check the time on your phone and try again.",
  LOCKED: "Too many wrong codes. Try again in 15 minutes.",
};

/**
 * For a team member who already had today's text-message code in this browser: just the authenticator code.
 * The server checks everything again (lib/staff-day-plugin.ts); this only asks for it.
 */
export function AuthenticatorSignIn({ name, phone, next }: { name: string; phone: string; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const other = `/sign-in?phone=1&next=${encodeURIComponent(next)}`;

  const submit = (code: string) =>
    start(async () => {
      setError(null);
      const res = await fetch("/api/auth/staff-day/sign-in", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
      if (res?.ok) {
        router.replace(`/after-sign-in?next=${encodeURIComponent(next)}`);
        router.refresh();
        return;
      }
      const message = (await res?.json().catch(() => null))?.message as string | undefined;
      if (message === "NO_DAY") return router.replace(other); // today's text message is no longer on record: start with a number
      setError(PROBLEM[message ?? ""] ?? (res?.status === 429 ? "Too many tries. Wait a few minutes and try again." : "We couldn't sign you in. Try again."));
    });

  return (
    <form
      className="mx-auto w-full max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        submit(String(new FormData(e.currentTarget).get("code")));
      }}
    >
      <h1 className="text-[1.75rem] leading-tight font-semibold">Welcome back{name ? `, ${name}` : ""}</h1>
      <p className="mt-2 text-muted">
        You confirmed <span className="tabular-nums">{phone}</span> by text message earlier today. Enter the 6-digit code from your authenticator app to sign in.
      </p>
      <label htmlFor="code" className="mt-8 block text-[14px] font-medium">
        Authenticator code
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        pattern="[0-9]{6}"
        maxLength={6}
        required
        aria-invalid={!!error}
        aria-describedby={error ? "day-error" : undefined}
        className="mt-1.5 h-12 w-full rounded-xl border border-hairline bg-canvas px-4 text-[1.25rem] tracking-[0.4em] tabular-nums focus-visible:border-indigo focus-visible:outline-none aria-[invalid=true]:border-danger"
      />
      {error && (
        <p id="day-error" role="alert" className="mt-2 text-[14px] text-danger">
          {error}
        </p>
      )}
      <button disabled={pending} className="mt-5 h-12 w-full cursor-pointer rounded-full bg-indigo font-semibold text-canvas hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70">
        {pending ? "Checking…" : "Sign in"}
      </button>
      <Link href={other} className="mt-3 flex h-10 w-full items-center justify-center rounded-full text-[15px] font-medium text-muted hover:text-ink">
        Use a mobile number or a backup code instead
      </Link>
    </form>
  );
}
