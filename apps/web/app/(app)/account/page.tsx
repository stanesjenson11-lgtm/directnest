import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { daysAgo, inr, inrShort } from "@/lib/format";
import imageLoader from "@/lib/image-loader";
import { ownerListings } from "@/lib/listings";
import { requireUser } from "@/lib/session";
import { confirmAvailable, markRented } from "./actions";

export const metadata: Metadata = { title: "Your account | DirectNest", robots: { index: false } };

const STATUS = {
  pending_review: ["Waiting for review", "bg-surface text-muted"],
  active: ["Live", "bg-verified-wash text-verified"],
  rented: ["Rented", "bg-surface text-muted"],
  expired: ["Expired", "bg-danger/10 text-danger"],
  rejected: ["Not approved", "bg-danger/10 text-danger"],
} as const;

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-24 sm:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" />}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const me = await requireUser("/account");
  const homes = await ownerListings(me.id);
  const phone = me.phoneNumber ? `${me.phoneNumber.slice(0, 3)} ${me.phoneNumber.slice(3, 8)} ${me.phoneNumber.slice(8)}` : null;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] leading-tight font-semibold">Your account</h1>
          <p className="mt-1 text-muted tabular-nums">{[me.name, phone].filter(Boolean).join(", ") || "Signed in"}</p>
        </div>
        <SignOutButton />
      </header>

      <section aria-labelledby="homes" className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 id="homes" className="text-xl font-semibold">
            Your homes
          </h2>
          {homes.length > 0 && (
            <Link href="/post" className="text-[15px] font-medium text-indigo hover:underline">
              Post another home
            </Link>
          )}
        </div>

        {homes.length === 0 ? (
          <div className="mt-4 border-t border-hairline pt-8">
            <p className="text-muted">You haven&rsquo;t listed a home yet. It&rsquo;s free, and a person reviews it before it goes live.</p>
            <Link href="/post" className="mt-5 inline-flex h-11 items-center rounded-full bg-indigo px-6 font-semibold text-canvas hover:bg-indigo-deep">
              Post your property
            </Link>
          </div>
        ) : (
          <ul className="mt-4">
            {homes.map((h) => {
              const [status, tone] = STATUS[h.status];
              const label = h.status === "rented" && h.type === "buy" ? "Sold" : status;
              return (
                <li key={h.id} className="flex flex-wrap gap-4 border-t border-hairline py-5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small thumbnail from the listing's own photos */}
                  {h.cover ? <img src={imageLoader({ src: h.cover, width: 240 })} alt="" className="aspect-[4/3] w-28 shrink-0 rounded-lg object-cover" /> : <span className="aspect-[4/3] w-28 shrink-0 rounded-lg bg-surface" />}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${tone}`}>{label}</span>
                      <span className="text-[14px] text-muted tabular-nums">{h.type === "rent" ? `${inr(h.price + h.maintenance)} /month` : inrShort(h.price)}</span>
                    </p>
                    <p className="mt-1 truncate font-medium">
                      {h.status === "active" ? (
                        <Link href={`/homes/${h.id}`} className="hover:underline">
                          {h.title}
                        </Link>
                      ) : (
                        h.title
                      )}
                    </p>
                    <p className="mt-0.5 text-[14px] text-muted">
                      {h.status === "active" &&
                        (h.expiresInDays <= 7
                          ? `Confirm it's still available within ${Math.max(h.expiresInDays, 0)} days, or it comes down.`
                          : `You confirmed it ${daysAgo(h.confirmedDaysAgo)}.`)}
                      {h.status === "pending_review" && "We review new homes within a day."}
                      {h.status === "expired" && "Confirm it's still available to put it back up."}
                      {h.status === "rejected" && `${h.rejectReason ?? "It wasn't approved"}. Fix it and post it again.`}
                    </p>
                  </div>
                  {(h.status === "active" || h.status === "expired") && (
                    <div className="flex w-full gap-2 sm:w-auto sm:flex-col">
                      <form action={confirmAvailable.bind(null, h.id)}>
                        <button className="h-9 cursor-pointer rounded-full bg-indigo px-4 text-[14px] font-semibold text-canvas hover:bg-indigo-deep">Still available</button>
                      </form>
                      {h.status === "active" && (
                        <form action={markRented.bind(null, h.id)}>
                          <button className="h-9 cursor-pointer rounded-full border border-hairline px-4 text-[14px] font-semibold hover:border-muted">
                            {h.type === "rent" ? "Mark as rented" : "Mark as sold"}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
