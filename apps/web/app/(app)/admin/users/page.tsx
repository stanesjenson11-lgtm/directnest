import type { Metadata } from "next";
import { Suspense } from "react";
import { findUsers } from "@/lib/admin";
import { phone } from "@/lib/format";
import { isStaffRole, ROLE_LABEL } from "@/lib/roles";
import { requireAdmin } from "@/lib/session";
import { setUserBanned } from "../actions";
import { AdminNav } from "../admin-nav";

// Neutral title, like the review queue.
export const metadata: Metadata = { title: "DirectNest", robots: { index: false } };

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface" />}>
        <Users searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Users({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  await requireAdmin("users");
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw : "";
  const people = await findUsers(q);

  return (
    <>
      <AdminNav current="/admin/users" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2rem] leading-tight font-semibold">Users</h1>
          <p className="mt-1 text-muted">Newest first. Banning signs the person out and hides their homes until you unban them.</p>
        </div>
        <form role="search" className="flex gap-2">
          <label htmlFor="user-q" className="sr-only">
            Name or phone number
          </label>
          <input
            id="user-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Name or phone number"
            className="h-10 w-64 rounded-full border border-hairline bg-canvas px-4 text-[15px] focus-visible:border-indigo focus-visible:outline-none"
          />
          <button className="h-10 cursor-pointer rounded-full bg-indigo px-5 font-semibold text-canvas hover:bg-indigo-deep">Search</button>
        </form>
      </div>

      {people.length === 0 ? (
        <p className="mt-8 border-t border-hairline pt-6 text-muted">Nobody matches &ldquo;{q}&rdquo;.</p>
      ) : (
        <ul className="mt-6">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 border-t border-hairline py-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name || "No name"}</span>
                  {isStaffRole(p.role) && <span className="rounded bg-indigo/10 px-1.5 py-0.5 text-[12px] font-semibold text-indigo">{ROLE_LABEL[p.role]}</span>}
                  {p.banned && <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[12px] font-semibold text-danger">Banned</span>}
                </p>
                <p className="text-[14px] text-muted tabular-nums">
                  {p.phone ? phone(p.phone) : "No phone"} · joined {p.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                  {p.listings} {p.listings === 1 ? "listing" : "listings"} · {p.reveals} {p.reveals === 1 ? "number" : "numbers"} seen this week
                </p>
              </div>
              {!isStaffRole(p.role) && (
                <form action={setUserBanned.bind(null, p.id, !p.banned)}>
                  <button
                    className={`h-9 cursor-pointer rounded-full px-4 text-[14px] font-semibold ${p.banned ? "border border-hairline hover:border-muted" : "border border-danger text-danger hover:bg-danger/8"}`}
                  >
                    {p.banned ? "Unban" : "Ban"}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
