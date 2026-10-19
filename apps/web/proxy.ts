import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { consoleNeeds, homeFor, isStaffRole, meetsNeed } from "@/lib/roles";

// The door to the staff console. Before any /admin page or /api/admin route runs, the request must come from someone
// signed in whose role opens that URL (lib/roles.ts decides which). It checks the role, not the authenticator: pages and
// routes still call requireAdmin / staffGate, which also check the authenticator, so removing this file would not open
// anything. A console URL nobody listed is for the super admin only, so a forgotten page is closed, not open.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const need = consoleNeeds(pathname);
  if (need === null) return NextResponse.next();

  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user.role;
  // Not on the team: the console doesn't exist, as far as they can tell.
  if (!isStaffRole(role)) return new NextResponse("Not found", { status: 404 });
  // On the team but not for this section: back to their dashboard (pages) or a refusal (routes and actions).
  if (!meetsNeed(role, need)) {
    return request.method === "GET" && !pathname.startsWith("/api/") ? NextResponse.redirect(new URL(homeFor(role), request.url)) : new NextResponse("Forbidden", { status: 403 });
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
