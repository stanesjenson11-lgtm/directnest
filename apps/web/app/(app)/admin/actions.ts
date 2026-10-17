"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { setBanned } from "@/lib/admin";
import { isStage, updateCrm } from "@/lib/crm";
import { db } from "@/lib/db";
import { readImport, runImport, type ImportResult } from "@/lib/import";
import { featureListing, readPlan, savePlan } from "@/lib/plans";
import { listings } from "@/lib/schema";
import { requireAdmin } from "@/lib/session";
import { REJECT_REASONS } from "./reasons";

// Both only touch listings still pending, so two reviewers can't double-decide one listing.
export async function approve(id: string) {
  const me = await requireAdmin();
  await db
    .update(listings)
    .set({
      status: "active",
      ownerVerified: true,
      reviewedAt: sql`now()`,
      confirmedAt: sql`now()`,
      expiresAt: sql`now() + interval '30 days'`,
    })
    // A reviewer can never approve their own listing.
    .where(and(eq(listings.id, id), eq(listings.status, "pending_review"), ne(listings.ownerId, me.id)));
  done(id);
}

export async function reject(id: string, form: FormData) {
  await requireAdmin();
  const reason = String(form.get("reason"));
  if (!(REJECT_REASONS as readonly string[]).includes(reason)) return;
  await db
    .update(listings)
    .set({ status: "rejected", rejectReason: reason, reviewedAt: sql`now()` })
    .where(and(eq(listings.id, id), eq(listings.status, "pending_review")));
  done(id);
}

/** Our staff saw the home in person. Works before or after approval; nobody marks their own listing. */
export async function markVisited(id: string) {
  const me = await requireAdmin();
  await db
    .update(listings)
    .set({ visitVerifiedAt: sql`now()` })
    .where(and(eq(listings.id, id), isNull(listings.visitVerifiedAt), ne(listings.ownerId, me.id)));
  done(id);
}

/** Ban or unban someone. Their cached listing pages are refreshed straight away, so a ban takes them down at once. */
export async function setUserBanned(userId: string, banned: boolean) {
  const me = await requireAdmin();
  if (!(await setBanned(me.id, String(userId), banned === true))) return;
  const theirs = await db.select({ id: listings.id }).from(listings).where(eq(listings.ownerId, String(userId)));
  for (const { id } of theirs) updateTag(`listing:${id}`);
  revalidatePath("/admin/users");
}

/** Checks a spreadsheet without writing anything; what the import page shows before anyone commits. */
export async function previewImport(text: string) {
  await requireAdmin();
  const { errors, rows } = readImport(String(text));
  return {
    errors,
    rows: rows.map(({ line, errors, data }) => ({ line, errors, title: data && `${data.bhk ? `${data.bhk} BHK` : "1 RK"} in ${data.area}, ${data.locality}`, owner: data?.ownerName, price: data?.price, photos: data?.photoUrls.length })),
  };
}

/** One batch of rows (header included). The page sends small batches so photo downloads never hit a request time limit. */
export async function importBatch(text: string): Promise<ImportResult[]> {
  await requireAdmin();
  const results = await runImport(String(text));
  revalidatePath("/admin");
  return results;
}

/** The sales team moves a request along its pipeline and keeps notes on it. */
export async function saveCrm(id: number, form: FormData) {
  await requireAdmin();
  const stage = form.get("stage");
  if (!Number.isInteger(id) || !isStage(stage)) return;
  await updateCrm(id, stage, String(form.get("note") ?? ""));
  revalidatePath("/admin/leads");
}

export type AdminFormState = { error?: string; ok?: string };

/** Creates (id null) or edits a plan. The public plans page is cached under the "plans" tag. */
export async function savePlanAction(id: number | null, _: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireAdmin();
  if (id !== null && !Number.isInteger(id)) return { error: "Unknown plan." };
  const r = readPlan(form);
  if ("error" in r) return r;
  await savePlan(id, r.plan);
  updateTag("plans");
  revalidatePath("/admin/plans");
  return { ok: "Saved." };
}

/** Features a listing for some days (0 stops). Takes the listing's link or its id. */
export async function featureAction(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const raw = String(form.get("listing") ?? "").trim();
  const id = raw.split("/homes/").pop()!.split(/[?#/]/)[0].slice(0, 200);
  const days = Number(form.get("days"));
  if (!id || !Number.isInteger(days) || days < 0 || days > 365) return { error: "Paste the listing's link and choose the number of days." };
  if (!(await featureListing(id, days))) return { error: "There's no listing with that link." };
  revalidatePath("/admin/plans");
  return { ok: days ? `Featured for ${days} days.` : "No longer featured." };
}

function done(id: string) {
  // ponytail: proofs are due for deletion 30 days after reviewed_at; a nightly job does that once pg-boss is in.
  updateTag(`listing:${id}`);
  revalidatePath("/admin");
}
