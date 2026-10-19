"use client";

import { useActionState } from "react";
import { verifyMfa } from "../mfa-actions";

export function VerifyForm() {
  const [error, action, pending] = useActionState(verifyMfa, null);
  return (
    <form action={action}>
      <label htmlFor="code" className="mt-8 block text-[14px] font-medium">
        Code
      </label>
      <input
        id="code"
        name="code"
        autoComplete="one-time-code"
        inputMode="text"
        autoFocus
        required
        aria-invalid={!!error}
        aria-describedby={error ? "mfa-error" : undefined}
        className="mt-1.5 h-12 w-full rounded-xl border border-hairline bg-canvas px-4 text-[1.25rem] tracking-[0.2em] tabular-nums focus-visible:border-indigo focus-visible:outline-none aria-[invalid=true]:border-danger"
      />
      {error && (
        <p id="mfa-error" role="alert" className="mt-2 text-[14px] text-danger">
          {error}
        </p>
      )}
      <button disabled={pending} className="mt-5 h-12 w-full cursor-pointer rounded-full bg-indigo font-semibold text-canvas hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70">
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
