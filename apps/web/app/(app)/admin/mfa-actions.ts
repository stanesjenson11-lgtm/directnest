"use server";

import { APIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { MFA_COOKIE, MFA_TTL_MS, mfaToken } from "@/lib/admin-mfa";
import { logAuditEvent } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { twoFactor } from "@/lib/schema";
import { requireAdminRole } from "@/lib/session";

const MAX_TRIES = 5;

/**
 * Spends one try before the code is checked, so parallel guesses can't outrun the counter. After MAX_TRIES wrong
 * codes the account is locked for 15 minutes; a lock that has run out restarts the count at 1.
 */
async function spendTry(userId: string) {
  const next = sql`case when ${twoFactor.lockedUntil} is not null then 1 else ${twoFactor.failedVerificationCount} + 1 end`;
  const rows = await db
    .update(twoFactor)
    .set({
      failedVerificationCount: next,
      lockedUntil: sql`case when ${next} >= ${MAX_TRIES} then now() + interval '15 minutes' else null end`,
    })
    .where(sql`${twoFactor.userId} = ${userId} and (${twoFactor.lockedUntil} is null or ${twoFactor.lockedUntil} <= now())`)
    .returning({ id: twoFactor.id });
  return rows.length > 0;
}

/** Six digits = authenticator code, anything else = a backup code (single use). */
async function checkCode(userId: string, raw: string): Promise<"ok" | "wrong" | "locked"> {
  if (!(await spendTry(userId))) return "locked";
  const code = raw.replace(/\s/g, "");
  const h = await headers();
  try {
    if (/^\d{6}$/.test(code)) await auth.api.verifyTOTP({ body: { code }, headers: h });
    else await auth.api.verifyBackupCode({ body: { code }, headers: h });
  } catch (e) {
    if (e instanceof APIError) return "wrong";
    throw e;
  }
  await db.update(twoFactor).set({ failedVerificationCount: 0, lockedUntil: null }).where(eq(twoFactor.userId, userId));
  return "ok";
}

const audit = async (action: string, userId: string) => {
  const h = await headers();
  await logAuditEvent(action, { userId, ipAddress: h.get("cf-connecting-ip") || h.get("x-forwarded-for"), userAgent: h.get("user-agent") });
};

/** Step 1 of enrolling: a secret for the authenticator app and single-use backup codes. Shown once. */
export async function startEnrollment() {
  const { user } = await requireAdminRole();
  if (user.twoFactorEnabled) return null;
  const r = await auth.api.enableTwoFactor({ body: { method: "totp" }, headers: await headers() });
  if (r.method !== "totp") return null;
  // The app would label the entry with the placeholder email phone sign-in made up; the number is what staff recognise.
  const uri = user.phoneNumber ? r.totpURI.replace(encodeURIComponent(user.email), encodeURIComponent(user.phoneNumber)) : r.totpURI;
  return { uri, codes: r.backupCodes };
}

/** Step 2: the first code from the app turns it on. The session is replaced, so the next page asks for a fresh code. */
export async function confirmEnrollment(code: string) {
  const { user } = await requireAdminRole();
  if (user.twoFactorEnabled || !/^\d{6}$/.test(code.trim())) return "Enter the 6-digit code from your authenticator app.";
  const result = await checkCode(user.id, code);
  if (result === "locked") return "Too many wrong codes. Try again in 15 minutes.";
  if (result === "wrong") return "That code doesn't match. Check the time on your phone and try again.";
  await audit("ADMIN_MFA_ENROLLED", user.id);
  redirect("/admin/verify?enrolled=1");
}

/** Once per session: a code, or a backup code, then the review pages open for 12 hours. */
export async function verifyMfa(_: string | null, form: FormData) {
  const { user, session } = await requireAdminRole();
  if (!user.twoFactorEnabled) redirect("/admin/security");
  const result = await checkCode(user.id, String(form.get("code") ?? ""));
  if (result === "locked") {
    await audit("ADMIN_MFA_LOCKED", user.id);
    return "Too many wrong codes. Try again in 15 minutes.";
  }
  if (result === "wrong") {
    await audit("ADMIN_MFA_FAILED", user.id);
    return "That code doesn't match. Try again, or use a backup code.";
  }
  await audit("ADMIN_MFA_OK", user.id);
  const { secret } = await auth.$context;
  (await cookies()).set(MFA_COOKIE, mfaToken(secret, session.id), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MFA_TTL_MS / 1000,
  });
  redirect("/admin");
}
