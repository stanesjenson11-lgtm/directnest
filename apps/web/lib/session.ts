import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { MFA_COOKIE, mfaValid } from "./admin-mfa.ts";
import { auth } from "./auth.ts";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** For pages and actions that need a signed-in person. `next` is where to come back to. */
export async function requireUser(next: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return session.user;
}

/** Anyone else gets a plain 404, so the review-team pages don't advertise themselves. Not enough on its own: see requireAdmin. */
export async function requireAdminRole() {
  const session = await getSession();
  if (session?.user.role !== "admin") notFound();
  return session;
}

/** Review-team pages and actions. Staff also enrol and pass an authenticator (admin/mfa-actions.ts) once per session. */
export async function requireAdmin() {
  const { user, session } = await requireAdminRole();
  if (!user.twoFactorEnabled) redirect("/admin/security");
  const { secret } = await auth.$context;
  if (!mfaValid(secret, session.id, (await cookies()).get(MFA_COOKIE)?.value)) redirect("/admin/verify");
  return user;
}

/** Only allow same-site paths as a post-sign-in destination. */
export const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/");
