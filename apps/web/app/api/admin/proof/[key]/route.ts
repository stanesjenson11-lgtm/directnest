import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { MEDIA_DIR } from "@/lib/media";
import { uploads } from "@/lib/schema";
import { getSession } from "@/lib/session";

// Ownership proofs, for the review team only. Never cached anywhere.
export async function GET(_request: Request, { params }: RouteContext<"/api/admin/proof/[key]">) {
  const session = await getSession();
  if (session?.user.role !== "admin") return new Response("Not found", { status: 404 });
  const { key } = await params;
  const [row] = await db.select({ ext: uploads.ext }).from(uploads).where(eq(uploads.key, key));
  if (!row || !["pdf", "jpg"].includes(row.ext)) return new Response("Not found", { status: 404 });
  try {
    const body = await readFile(join(MEDIA_DIR, "private", `${key}.${row.ext}`));
    return new Response(body, {
      headers: {
        "content-type": row.ext === "pdf" ? "application/pdf" : "image/jpeg",
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
