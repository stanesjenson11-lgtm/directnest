"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
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

function done(id: string) {
  // ponytail: proofs are due for deletion 30 days after reviewed_at; a nightly job does that once pg-boss is in.
  updateTag(`listing:${id}`);
  revalidatePath("/admin");
}
