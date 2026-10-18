"use client";

import { useState, useTransition } from "react";
import { confirmEnrollment, startEnrollment } from "../mfa-actions";

type Started = { uri: string; codes: string[] };

const button = "mt-5 h-12 w-full cursor-pointer rounded-full bg-indigo font-semibold text-canvas hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70";

export function Enroll() {
  const [started, setStarted] = useState<Started | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!started)
    return (
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const s = await startEnrollment();
            if (s) setStarted(s);
          })
        }
        className={button}
      >
        {pending ? "Starting…" : "Start"}
      </button>
    );

  // No QR image: phones open the otpauth link straight in the authenticator app, desktops type the key.
  const key = new URL(started.uri).searchParams.get("secret");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code"));
        start(async () => setError((await confirmEnrollment(code)) ?? null));
      }}
    >
      <p className="mt-8 text-[14px] font-medium">1. Add it to your authenticator app</p>
      <p className="mt-1.5 text-muted">
        On your phone, <a href={started.uri} className="font-medium text-indigo hover:underline">open this link</a>. Otherwise add a time-based account by hand with this key:
      </p>
      <p className="mt-2 rounded-lg bg-surface p-3 font-mono text-[14px] break-all select-all">{key}</p>
      <p className="mt-6 text-[14px] font-medium">2. Keep these backup codes somewhere safe</p>
      <p className="mt-1.5 text-muted">Each works once if you lose your phone. They are not shown again.</p>
      <ul className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-surface p-3 font-mono text-[14px] select-all">
        {started.codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <label htmlFor="code" className="mt-6 block text-[14px] font-medium">
        3. Enter the 6-digit code it shows
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        aria-invalid={!!error}
        aria-describedby={error ? "enroll-error" : undefined}
        className="mt-1.5 h-12 w-full rounded-xl border border-hairline bg-canvas px-4 text-[1.25rem] tracking-[0.4em] tabular-nums focus-visible:border-indigo focus-visible:outline-none aria-[invalid=true]:border-danger"
      />
      {error && (
        <p id="enroll-error" role="alert" className="mt-2 text-[14px] text-danger">
          {error}
        </p>
      )}
      <button disabled={pending} className={button}>
        {pending ? "Checking…" : "Turn on"}
      </button>
    </form>
  );
}
