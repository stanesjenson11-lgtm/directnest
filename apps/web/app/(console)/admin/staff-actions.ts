"use server";

import { revalidatePath } from "next/cache";
import { isStaffRole } from "@/lib/roles";
import { requireAdmin } from "@/lib/session";
import { setRole, type RoleResult } from "@/lib/staff";

export type StaffState = { error?: string; ok?: string };

const PROBLEM: Record<Exclude<RoleResult, "ok">, string> = {
  "bad-phone": "Enter a 10-digit Indian mobile number.",
  "no-account": "No account has that number yet. They need to sign in once first.",
  self: "You can't change your own role.",
  banned: "That account is suspended.",
};

async function apply(form: FormData): Promise<StaffState> {
  const me = await requireAdmin("staff");
  const phone = `+91${String(form.get("phone") ?? "").replace(/\D/g, "").slice(-10)}`;
  const role = form.get("role");
  if (role !== "member" && !isStaffRole(role)) return { error: "Choose a role." };
  const r = await setRole(me.id, phone, role);
  if (r !== "ok") return { error: PROBLEM[r] };
  revalidatePath("/admin/staff");
  return { ok: role === "member" ? "Access removed." : "Saved." };
}

/** The add-someone form: shows what went wrong next to the field. */
export async function addStaff(_: StaffState, form: FormData) {
  return apply(form);
}

/** A row's role picker or Remove button. The people listed exist, so there is nothing to report back. */
export async function changeStaff(form: FormData) {
  await apply(form);
}
