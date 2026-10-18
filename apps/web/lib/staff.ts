// Staff accounts: who has a role, and giving or taking one. Super admin pages only.
import { asc, eq, inArray } from "drizzle-orm";
import { logAuditEvent } from "./audit.ts";
import { db } from "./db.ts";
import { STAFF_ROLES, type StaffRole } from "./roles.ts";
import { twoFactor, user } from "./schema.ts";

export const listStaff = () =>
  db
    .select({ id: user.id, name: user.name, phone: user.phoneNumber, role: user.role, authenticator: user.twoFactorEnabled })
    .from(user)
    .where(inArray(user.role, [...STAFF_ROLES]))
    .orderBy(asc(user.role), asc(user.name));

export type RoleResult = "ok" | "bad-phone" | "no-account" | "self" | "banned";

/**
 * Gives someone a staff role, changes it, or ("member") takes it away. They must have signed in once, so the account
 * exists. Nobody changes their own role, so the console can never be left without a super admin. Taking a role away
 * also deletes their authenticator, so a later promotion enrols a fresh one.
 */
export async function setRole(adminId: string, phone: string, role: StaffRole | "member"): Promise<RoleResult> {
  if (!/^\+91[6-9]\d{9}$/.test(phone)) return "bad-phone";
  const [target] = await db.select({ id: user.id, role: user.role, banned: user.banned }).from(user).where(eq(user.phoneNumber, phone));
  if (!target) return "no-account";
  if (target.id === adminId) return "self";
  if (target.banned) return "banned";
  await db.transaction(async (tx) => {
    await tx.update(user).set({ role, updatedAt: new Date(), ...(role === "member" && { twoFactorEnabled: false }) }).where(eq(user.id, target.id));
    if (role === "member") await tx.delete(twoFactor).where(eq(twoFactor.userId, target.id));
  });
  await logAuditEvent("ADMIN_ROLE_CHANGED", { userId: adminId, targetId: target.id, details: { from: target.role, to: role } });
  return "ok";
}
