"use client";

import { useActionState } from "react";
import { authError, authField, authInput, authLabel, authPrimary, rise } from "@/components/auth/ui";
import { verifyMfa } from "../mfa-actions";

export function VerifyForm() {
  const [error, action, pending] = useActionState(verifyMfa, null);
  return (
    <form action={action} className="mt-8 space-y-5">
      <div className="auth-rise" style={rise(3)}>
        <label htmlFor="code" className={authLabel}>
          Authenticator or backup code
        </label>
        <div className={authField}>
          <input
        id="code"
        name="code"
        autoComplete="one-time-code"
        inputMode="text"
        autoFocus
        required
        aria-invalid={!!error}
        aria-describedby={error ? "mfa-error" : undefined}
            className={`${authInput} text-[1.25rem] tracking-[0.2em] tabular-nums`}
          />
        </div>
        {error && (
          <p id="mfa-error" role="alert" className={authError}>
            {error}
          </p>
        )}
      </div>
      <button disabled={pending} className={`auth-rise ${authPrimary}`} style={rise(4)}>
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
