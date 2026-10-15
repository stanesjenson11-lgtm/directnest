import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
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

/** Review-team pages. Anyone else gets a plain 404, so the pages don't advertise themselves. */
export async function requireAdmin() {
  const session = await getSession();
  if (session?.user.role !== "admin") notFound();
  return session.user;
}

/** Only allow same-site paths as a post-sign-in destination. */
export const safeNext = (next: unknown) => (typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/");
