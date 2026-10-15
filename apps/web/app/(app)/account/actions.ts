"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { listings } from "@/lib/schema";
import { requireUser } from "@/lib/session";

// Every action checks ownership in the WHERE clause, so a forged id can only ever touch the caller's own rows.

/** "Still available": resets the 30-day clock and moves the listing up in "recently confirmed". */
export async function confirmAvailable(id: string) {
  const me = await requireUser("/account");
  const [row] = await db
    .update(listings)
    .set({ confirmedAt: sql`now()`, expiresAt: sql`now() + interval '30 days'`, status: sql`case when ${listings.status} = 'expired' then 'active'::listing_status else ${listings.status} end` })
    .where(and(eq(listings.id, id), eq(listings.ownerId, me.id)))
    .returning({ id: listings.id });
  if (row) refresh(id);
}

export async function markRented(id: string) {
  const me = await requireUser("/account");
  const [row] = await db
    .update(listings)
    .set({ status: "rented" })
    .where(and(eq(listings.id, id), eq(listings.ownerId, me.id), eq(listings.status, "active")))
    .returning({ id: listings.id });
  if (row) refresh(id);
}

function refresh(id: string) {
  updateTag(`listing:${id}`); // the public page drops a rented listing straight away
  revalidatePath("/account");
}
