// Staff tools for people: find them, and ban or unban. Admin pages only.
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "./db.ts";
import { session, user } from "./schema.ts";

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Newest first; `q` matches a name or any part of a phone number. */
export async function findUsers(q = "") {
  const term = q.trim().slice(0, 60);
  const digits = term.replace(/\D/g, "");
  return db
    .select({
      id: user.id,
      name: user.name,
      phone: user.phoneNumber,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
      listings: sql<number>`(select count(*) from listings l where l.owner_id = "user"."id")`.mapWith(Number),
      reveals: sql<number>`(select count(*) from contact_reveals r where r.user_id = "user"."id" and r.created_at > now() - interval '7 days')`.mapWith(Number),
    })
    .from(user)
    .where(term ? or(ilike(user.name, `%${escapeLike(term)}%`), digits ? ilike(user.phoneNumber, `%${digits}%`) : undefined) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(50);
}

/** Banning signs the person out everywhere; the session hook in lib/auth.ts stops them signing back in. Admins can't be banned here. */
export async function setBanned(adminId: string, userId: string, banned: boolean) {
  if (adminId === userId) return false;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(user)
      .set({ banned, updatedAt: new Date() })
      .where(and(eq(user.id, userId), ne(user.role, "admin")))
      .returning({ id: user.id });
    if (row && banned) await tx.delete(session).where(eq(session.userId, userId));
    return !!row;
  });
}
