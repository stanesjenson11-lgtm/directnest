import type { CSSProperties } from "react";

// The sign-in screens' parts, after the split-screen sign-in the team chose: a large light title, soft rounded fields and
// full-width buttons. Shared by every sign-in step (number, code, authenticator, staff check, setup).
export const authTitle = "auth-rise text-4xl leading-[1.05] font-light tracking-[-0.035em] text-ink md:text-5xl";
export const authLead = "auth-rise mt-4 text-muted";
export const authLabel = "text-[14px] font-medium text-muted";
export const authField =
  "mt-1.5 flex h-14 items-center rounded-2xl border border-hairline bg-surface transition-colors focus-within:border-indigo focus-within:bg-canvas has-[[aria-invalid=true]]:border-danger";
export const authInput = "h-full w-full min-w-0 flex-1 rounded-2xl bg-transparent px-4 text-[16px] text-ink placeholder:text-muted focus-visible:outline-none";
export const authCode = `${authInput} text-[1.25rem] tracking-[0.4em] tabular-nums`;
export const authPrimary =
  "h-14 w-full cursor-pointer rounded-2xl bg-indigo font-semibold text-canvas transition-colors hover:bg-indigo-deep disabled:cursor-wait disabled:opacity-70";
export const authSecondary =
  "flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-hairline font-semibold text-ink transition-colors hover:bg-surface disabled:cursor-wait disabled:opacity-70";
export const authQuiet = "flex h-11 w-full cursor-pointer items-center justify-center rounded-2xl text-[15px] font-medium text-muted hover:text-ink disabled:cursor-default";
export const authNotice = "auth-rise mt-6 rounded-2xl bg-surface p-4 text-[14px] text-ink";
export const authError = "mt-2 text-[14px] text-danger";

/** Order in the entrance: each step comes in a moment after the one before (see .auth-rise in globals.css). */
export const rise = (i: number) => ({ "--i": i }) as CSSProperties;
