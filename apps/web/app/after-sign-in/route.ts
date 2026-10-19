import { redirect } from "next/navigation";
import { homeFor, isStaffRole } from "@/lib/roles";
import { getSession, safeNext } from "@/lib/session";
import { claimInvite } from "@/lib/staff";

// The one place every sign-in ends up, whether by mobile number, Google or Apple. The account decides the door:
// team members land in the console, everyone else goes where they were headed (after confirming their mobile number).
export async function GET(request: Request) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);

  // A role reserved for this email (Staff page) is handed over here, on the first sign-in with a verified address.
  const role = (await claimInvite(session.user)) ?? session.user.role;
  if (isStaffRole(role)) redirect(next.startsWith("/admin") ? next : homeFor(role));
  redirect(session.user.phoneNumberVerified ? next : `/verify-phone?next=${encodeURIComponent(next)}`);
}
