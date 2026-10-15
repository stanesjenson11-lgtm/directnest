"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef } from "react";
import { authClient } from "@/lib/auth-client";

// ponytail: the reveal itself needs contact plans and Razorpay. Until then a signed-in person is told so plainly.
export function ContactOwner({ owner, label, className = "" }: { owner: string; label?: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  const { data: session } = authClient.useSession();
  const first = owner.split(" ")[0];
  const id = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={`h-12 w-full cursor-pointer rounded-full bg-indigo px-6 font-semibold text-canvas transition-[background-color,transform] duration-150 ease-out-quint hover:bg-indigo-deep active:scale-[0.98] ${className}`}
      >
        {label ?? <>Get {first}&rsquo;s number</>}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(92vw,440px)] rounded-2xl bg-canvas p-6 text-ink shadow-2xl backdrop:bg-ink/40"
      >
        <h2 id={`${id}-title`} className="text-xl font-semibold">
          Get {first}&rsquo;s number
        </h2>
        {session ? (
          <p className="mt-2 text-muted">
            Owner numbers come with a contact plan. Plans open when payments go live, so this preview can&rsquo;t show numbers yet.
          </p>
        ) : (
          <p className="mt-2 text-muted">
            Sign in with your phone to see the number and call {first} directly. We never share your number with owners or anyone else.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="h-11 cursor-pointer rounded-full px-5 font-semibold text-muted hover:text-ink">
            {session ? "Close" : "Cancel"}
          </button>
          {!session && (
            <Link
              href={`/sign-in?next=${encodeURIComponent(path)}`}
              className="inline-flex h-11 items-center rounded-full bg-indigo px-6 font-semibold text-canvas hover:bg-indigo-deep"
            >
              Sign in to continue
            </Link>
          )}
        </div>
      </dialog>
    </>
  );
}
