"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Turnstile } from "./turnstile";

type AuthError = { code?: string; status?: number; message?: string };

function explain(e: AuthError) {
  // 429 is the per-connection limit in lib/auth.ts, so it isn't about the number typed.
  if (e.code === "INVALID_OTP") return "That code doesn't match. Check the SMS and try again.";
  if (e.code === "OTP_EXPIRED") return "That code has expired. Send a new one.";
  if (e.code === "TOO_MANY_ATTEMPTS") return "Too many wrong codes. Send a new one.";
  if (e.code === "INVALID_PHONE_NUMBER") return "Enter a 10-digit Indian mobile number.";
  if (e.code === "PHONE_NUMBER_EXIST") return "That number already has a DirectNest account. Sign in with it, or use another number.";
  if (e.code === "BOT_DETECTED" || e.status === 403) return "Security verification failed. Please try again.";
  return e.message || "Something went wrong. Try again.";
}

const field =
  "flex h-12 items-center rounded-xl border border-hairline bg-canvas focus-within:border-indigo has-[[aria-invalid=true]]:border-danger";
const social =
  "flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-full border font-semibold transition-colors disabled:cursor-wait disabled:opacity-70";

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
    <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.09Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.83 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.17a11 11 0 0 0 0 9.86l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.36c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.07l3.66 2.84C6.7 7.3 9.13 5.36 12 5.36Z" />
  </svg>
);
const AppleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M16.37 12.63c-.03-2.4 1.96-3.56 2.05-3.62-1.12-1.63-2.86-1.86-3.48-1.88-1.48-.15-2.89.87-3.64.87-.75 0-1.91-.85-3.14-.83-1.62.02-3.11.94-3.94 2.39-1.68 2.92-.43 7.24 1.21 9.6.8 1.16 1.76 2.45 3.01 2.4 1.21-.05 1.67-.78 3.13-.78 1.46 0 1.87.78 3.15.75 1.3-.02 2.12-1.17 2.91-2.34.92-1.34 1.3-2.64 1.32-2.7-.03-.01-2.53-.97-2.58-3.86ZM14 5.5c.66-.8 1.11-1.92.99-3.03-.95.04-2.1.64-2.78 1.43-.61.7-1.14 1.84-1 2.93 1.06.08 2.14-.54 2.79-1.33Z" />
  </svg>
);

/**
 * Sign in, or (link) confirm the mobile number of someone who signed in with Google or Apple.
 * Both end in the same 6-digit SMS code; Google and Apple just come first when they are set up.
 */
export function PhoneSignIn({
  next,
  providers,
  dev,
  link = false,
  failed = false,
}: {
  next: string;
  providers: { google: boolean; apple: boolean };
  dev: boolean;
  link?: boolean;
  failed?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [check, setCheck] = useState(0); // a Turnstile token works once; a new key remounts the widget for a fresh one
  const [error, setError] = useState<string | null>(failed ? "We couldn't sign you in with that account. Try again, or use your mobile number." : null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, start] = useTransition();
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const e164 = `+91${phone}`;
  const withSocial = !link && (providers.google || providers.apple);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const goSocial = (provider: "google" | "apple") => {
    setSigningIn(provider);
    setError(null);
    // The mobile number comes second: /verify-phone lets people who have confirmed theirs straight through.
    authClient.signIn.social({
      provider,
      callbackURL: `/verify-phone?next=${encodeURIComponent(next)}`,
      errorCallbackURL: `/sign-in?error=1&next=${encodeURIComponent(next)}`,
    });
  };

  const send = () =>
    start(async () => {
      setError(null);
      const { error } = await authClient.phoneNumber.sendOtp({
        phoneNumber: e164,
        fetchOptions: {
          headers: turnstileToken ? { "x-turnstile-token": turnstileToken } : {},
        },
      });
      setTurnstileToken(null);
      setCheck((n) => n + 1);
      if (error) return setError(explain(error));
      setStep("code");
      setCooldown(30);
    });

  const verify = (code: string) =>
    start(async () => {
      setError(null);
      const { error } = await authClient.phoneNumber.verify({ phoneNumber: e164, code, ...(link && { updatePhoneNumber: true }) });
      if (error) return setError(explain(error));
      router.replace(next);
      router.refresh();
    });

  const signOut = () =>
    start(async () => {
      await authClient.signOut();
      router.replace("/");
      router.refresh();
    });

  const turnstile = <Turnstile key={check} onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />;

  return (
    <div className="mx-auto w-full max-w-sm">
      {step === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <h1 className="text-[1.75rem] leading-tight font-semibold">{link ? "Confirm your mobile number" : "Sign in or create an account"}</h1>
          <p className="mt-2 text-muted">
            {link
              ? "One last step. We'll text you a 6-digit code. Owners never see your number unless you call them."
              : withSocial
                ? "Continue with Google or Apple, then confirm your mobile number with a 6-digit code. Owners never see it unless you call them."
                : "We’ll text you a 6-digit code. Owners never see your number unless you call them."}
          </p>

          {withSocial && (
            <div className="mt-8 flex flex-col gap-3">
              {providers.google && (
                <button type="button" disabled={!!signingIn} onClick={() => goSocial("google")} className={`${social} border-hairline hover:border-muted`}>
                  <GoogleMark />
                  {signingIn === "google" ? "Opening Google…" : "Continue with Google"}
                </button>
              )}
              {providers.apple && (
                <button type="button" disabled={!!signingIn} onClick={() => goSocial("apple")} className={`${social} border-black bg-black text-white hover:bg-black/85`}>
                  <AppleMark />
                  {signingIn === "apple" ? "Opening Apple…" : "Continue with Apple"}
                </button>
              )}
              <p className="mt-2 flex items-center gap-3 text-[13px] text-muted before:h-px before:flex-1 before:bg-hairline after:h-px after:flex-1 after:bg-hairline">
                or use your mobile number
              </p>
            </div>
          )}

          <label htmlFor="phone" className={`${withSocial ? "mt-3" : "mt-8"} block text-[14px] font-medium`}>
            Mobile number
          </label>
          <div className={`mt-1.5 ${field}`}>
            <span className="px-3 text-muted tabular-nums">+91</span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              autoFocus={!withSocial}
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
          {turnstile}
          <button
            type="submit"
            disabled={pending || !turnstileToken}
            className="mt-5 h-12 w-full cursor-pointer rounded-full bg-indigo font-semibold text-canvas transition-colors hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Sending…" : "Send code"}
          </button>
          {link && (
            <button type="button" onClick={signOut} disabled={pending} className="mt-3 h-10 w-full cursor-pointer rounded-full text-[15px] font-medium text-muted hover:text-ink">
              Not you? Sign out
            </button>
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
            {pending ? "Checking…" : link ? "Confirm" : "Sign in"}
          </button>
          {turnstile}
          <button
            type="button"
            disabled={cooldown > 0 || pending || !turnstileToken}
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
