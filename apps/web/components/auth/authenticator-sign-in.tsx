"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authCode, authError, authField, authLabel, authLead, authNotice, authPrimary, authQuiet, authTitle, rise } from "./ui";

const PROBLEM: Record<string, string> = {
  WRONG_CODE: "That code doesn't match. Check the time on your phone and try again.",
  LOCKED: "Too many wrong codes. Try again in 15 minutes.",
};

/**
 * For a team member who already had today's text-message code in this browser: just the authenticator code.
 * The server checks everything again (lib/staff-day-plugin.ts); this only asks for it.
 */
export function AuthenticatorSignIn({ name, phone, next, notice }: { name: string; phone: string; next: string; notice?: string }) {
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
    <div>
      <h1 className={authTitle} style={rise(1)}>
        Welcome back{name ? `, ${name}` : ""}
      </h1>
      <p className={authLead} style={rise(2)}>
        You confirmed <span className="tabular-nums">{phone}</span> by text message earlier today. Enter the 6-digit code from your authenticator app to sign in.
      </p>
      {notice && (
        <p className={authNotice} style={rise(3)}>
          {notice}
        </p>
      )}
      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(String(new FormData(e.currentTarget).get("code")));
        }}
      >
        <div className="auth-rise" style={rise(3)}>
          <label htmlFor="code" className={authLabel}>
            Authenticator code
          </label>
          <div className={authField}>
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
              className={authCode}
            />
          </div>
          {error && (
            <p id="day-error" role="alert" className={authError}>
              {error}
            </p>
          )}
        </div>
        <button disabled={pending} className={`auth-rise ${authPrimary}`} style={rise(4)}>
          {pending ? "Checking…" : "Sign in"}
        </button>
      </form>
      <Link href={other} className={`auth-rise mt-4 ${authQuiet}`} style={rise(5)}>
        Use a mobile number or a backup code instead
      </Link>
    </div>
  );
}
