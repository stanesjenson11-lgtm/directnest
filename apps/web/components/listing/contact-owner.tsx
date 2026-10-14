"use client";

import { useId, useRef, useState } from "react";

// ponytail: the paid reveal needs phone sign-in (MSG91), plans and Razorpay. Until those exist this dialog shows the
// real first step and says plainly that sign-in isn't switched on, rather than faking a number.
export function ContactOwner({ owner, label, className = "" }: { owner: string; label?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [sent, setSent] = useState(false);
  const first = owner.split(" ")[0];
  const id = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSent(false);
          dialog.current?.showModal();
        }}
        className={`h-12 w-full cursor-pointer rounded-full bg-indigo px-6 font-semibold text-canvas transition-[background-color,transform] duration-150 ease-out-quint hover:bg-indigo-deep active:scale-[0.98] ${className}`}
      >
        {label ?? <>Get {first}&rsquo;s number</>}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(92vw,440px)] rounded-2xl bg-canvas p-0 text-ink shadow-2xl backdrop:bg-ink/40"
      >
        <form
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <h2 id={`${id}-title`} className="text-xl font-semibold">
            Get {first}&rsquo;s number
          </h2>
          <p className="mt-2 text-muted">
            Sign in with your phone to see the number and call {first} directly. We never share your number with owners or
            anyone else.
          </p>
          <label htmlFor={`${id}-phone`} className="mt-5 block text-[14px] font-medium">
            Your mobile number
          </label>
          <div className="mt-1.5 flex h-12 items-center rounded-xl border border-hairline focus-within:border-indigo">
            <span className="px-3 text-muted tabular-nums">+91</span>
            <input
              id={`${id}-phone`}
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              title="A 10-digit Indian mobile number"
              className="h-full min-w-0 flex-1 bg-transparent pr-3 tabular-nums focus-visible:outline-none"
            />
          </div>
          {sent && (
            <p role="status" className="mt-4 rounded-lg bg-surface p-3 text-[14px]">
              Phone sign-in isn&rsquo;t switched on in this preview yet. Once it is, you&rsquo;ll get a one-time code by SMS,
              pick a plan, and see {first}&rsquo;s number straight away.
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="h-11 cursor-pointer rounded-full px-5 font-semibold text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button type="submit" className="h-11 cursor-pointer rounded-full bg-indigo px-6 font-semibold text-canvas hover:bg-indigo-deep">
              Send code
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
