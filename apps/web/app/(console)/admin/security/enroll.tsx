"use client";

import { useState, useTransition } from "react";
import { encode } from "uqr";
import { confirmEnrollment, startEnrollment } from "../mfa-actions";

type Started = { uri: string; codes: string[] };

const button = "mt-5 h-12 w-full cursor-pointer rounded-full bg-indigo font-semibold text-canvas hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70";

/** The authenticator link as a QR code, drawn here in the browser: the key never goes to a QR service. Always dark on white, so every scanner reads it. */
function Qr({ value }: { value: string }) {
  const { data, size } = encode(value, { ecc: "M" });
  const path = data.flatMap((row, y) => row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : []))).join("");
  const margin = 4; // the quiet zone scanners need around a code
  return (
    <svg viewBox={`${-margin} ${-margin} ${size + 2 * margin} ${size + 2 * margin}`} role="img" aria-label="QR code to scan with your authenticator app" shapeRendering="crispEdges" className="mx-auto mt-3 h-52 w-52 rounded-lg bg-white">
      <path d={path} fill="#000" />
    </svg>
  );
}

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

  const key = new URL(started.uri).searchParams.get("secret");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code"));
        start(async () => setError((await confirmEnrollment(code)) ?? null));
      }}
    >
      <p className="mt-8 text-[14px] font-medium">1. Scan this with your authenticator app</p>
      <p className="mt-1.5 text-muted">Open Google Authenticator, Microsoft Authenticator, Authy or 1Password on your phone, add an account, and point the camera here.</p>
      <Qr value={started.uri} />
      <p className="mt-3 text-[14px] text-muted">
        Can&rsquo;t scan? On this phone, <a href={started.uri} className="font-medium text-indigo hover:underline">open this link</a>, or add a time-based account by hand with this key:
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
