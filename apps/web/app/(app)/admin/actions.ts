"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { setBanned } from "@/lib/admin";
import { db } from "@/lib/db";
import { readImport, runImport, type ImportResult } from "@/lib/import";
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

function done(id: string) {
  // ponytail: proofs are due for deletion 30 days after reviewed_at; a nightly job does that once pg-boss is in.
  updateTag(`listing:${id}`);
  revalidatePath("/admin");
}
