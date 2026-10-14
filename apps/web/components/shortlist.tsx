"use client";

import { useSyncExternalStore } from "react";

// ponytail: shortlist lives in this browser only; sync to the `shortlists` table once sign-in exists.
const KEY = "dn-shortlist";
const EMPTY: string[] = [];
const subscribers = new Set<() => void>();
let cache: string[] | undefined;

function snapshot() {
  if (!cache) {
    try {
      cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      cache = [];
    }
  }
  return cache!;
}

function toggle(id: string) {
  const list = snapshot();
  cache = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  subscribers.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

export function ShortlistButton({
  id,
  title,
  className = "",
  onLight = false,
}: {
  id: string;
  title: string;
  className?: string;
  onLight?: boolean; // dark outline for white surfaces; default is for photos
}) {
  const saved = useSyncExternalStore(subscribe, snapshot, () => EMPTY).includes(id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from your shortlist` : `Add ${title} to your shortlist`}
      onClick={(e) => {
        e.preventDefault();
        toggle(id);
      }}
      className={`grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-transform duration-150 ease-out-quint active:scale-90 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow-[0_1px_2px_oklch(0.2_0.03_266/0.5)]" aria-hidden="true">
        <path
          d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
          fill={saved ? "var(--color-indigo)" : onLight ? "none" : "oklch(0.2 0.03 266 / 0.25)"}
          stroke={onLight && !saved ? "var(--color-ink)" : "white"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
