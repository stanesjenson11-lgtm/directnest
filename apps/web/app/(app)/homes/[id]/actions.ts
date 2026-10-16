"use server";

import { revealPhone, type Reveal } from "@/lib/contact";
import { getSession } from "@/lib/session";

export async function revealContact(listingId: string): Promise<Reveal | { ok: false; reason: "signed-out" }> {
  const session = await getSession();
  if (!session) return { ok: false, reason: "signed-out" };
  return revealPhone(session.user.id, String(listingId).slice(0, 200));
}
