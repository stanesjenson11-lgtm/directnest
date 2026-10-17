"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";

type AuthError = { code?: string; status?: number; message?: string };

function explain(e: AuthError) {
  // 429 is the per-connection limit in lib/auth.ts, so it isn't about the number typed.
  if (e.code === "INVALID_OTP") return "That code doesn't match. Check the SMS and try again.";
  if (e.code === "OTP_EXPIRED") return "That code has expired. Send a new one.";
  if (e.code === "TOO_MANY_ATTEMPTS") return "Too many wrong codes. Send a new one.";
  if (e.code === "INVALID_PHONE_NUMBER") return "Enter a 10-digit Indian mobile number.";
  return e.message || "Something went wrong. Try again.";
}

const field =
  "flex h-12 items-center rounded-xl border border-hairline bg-canvas focus-within:border-indigo has-[[aria-invalid=true]]:border-danger";

export function PhoneSignIn({ next, google, dev }: { next: string; google: boolean; dev: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  const e164 = `+91${phone}`;

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () =>
    start(async () => {
      setError(null);
      const { error } = await authClient.phoneNumber.sendOtp({ phoneNumber: e164 });
      if (error) return setError(explain(error));
      setStep("code");
      setCooldown(30);
    });

  const verify = (code: string) =>
    start(async () => {
      setError(null);
      const { error } = await authClient.phoneNumber.verify({ phoneNumber: e164, code });
      if (error) return setError(explain(error));
      router.replace(next);
      router.refresh();
    });

  return (
    <div className="mx-auto w-full max-w-sm">
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <h1 className="text-[1.75rem] leading-tight font-semibold">Sign in or create an account</h1>
          <p className="mt-2 text-muted">We&rsquo;ll text you a 6-digit code. Owners never see your number unless you call them.</p>
          <label htmlFor="phone" className="mt-8 block text-[14px] font-medium">
            Mobile number
          </label>
          <div className={`mt-1.5 ${field}`}>
            <span className="px-3 text-muted tabular-nums">+91</span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus
              required
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              title="A 10-digit Indian mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              aria-invalid={!!error}
              aria-describedby={error ? "auth-error" : undefined}
              className="h-full min-w-0 flex-1 bg-transparent pr-3 tabular-nums focus-visible:outline-none"
            />
          </div>
          {error && (
            <p id="auth-error" role="alert" className="mt-2 text-[14px] text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 h-12 w-full cursor-pointer rounded-full bg-indigo font-semibold text-canvas transition-colors hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Sending…" : "Send code"}
          </button>
          {google && (
            <>
              <p className="my-5 flex items-center gap-3 text-[13px] text-muted before:h-px before:flex-1 before:bg-hairline after:h-px after:flex-1 after:bg-hairline">
                or
              </p>
              <button
                type="button"
                onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}
                className="h-12 w-full cursor-pointer rounded-full border border-hairline font-semibold hover:border-muted"
              >
                Continue with Google
              </button>
            </>
          )}
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(String(new FormData(e.currentTarget).get("code")));
          }}
        >
          <h1 className="text-[1.75rem] leading-tight font-semibold">Enter the code</h1>
          <p className="mt-2 text-muted tabular-nums">
            Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}.{" "}
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              className="cursor-pointer font-medium text-indigo hover:underline"
            >
              Change number
            </button>
          </p>
          <label htmlFor="code" className="mt-8 block text-[14px] font-medium">
            6-digit code
          </label>
          <div className={`mt-1.5 ${field}`}>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              pattern="[0-9]{6}"
              maxLength={6}
              aria-invalid={!!error}
              aria-describedby={error ? "auth-error" : undefined}
              onChange={(e) => e.target.value.length === 6 && !pending && verify(e.target.value)}
              className="h-full w-full bg-transparent px-4 text-[1.25rem] tracking-[0.4em] tabular-nums focus-visible:outline-none"
            />
          </div>
          {error && (
            <p id="auth-error" role="alert" className="mt-2 text-[14px] text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-5 h-12 w-full cursor-pointer rounded-full bg-indigo font-semibold text-canvas transition-colors hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || pending}
            onClick={send}
            className="mt-3 h-10 w-full cursor-pointer rounded-full text-[15px] font-medium text-indigo disabled:cursor-default disabled:text-muted"
          >
            {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
          </button>
          {dev && <p className="mt-6 rounded-lg bg-surface p-3 text-[13px] text-muted">Development: the code is printed in the terminal running the dev server.</p>}
        </form>
      )}
    </div>
  );
}
