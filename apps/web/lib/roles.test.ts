import assert from "node:assert/strict";
import { test } from "node:test";
import { can, homeFor, SECTIONS, STAFF_ROLES } from "./roles.ts";

test("each role opens only its own sections; nobody else opens any", () => {
  for (const s of SECTIONS) assert.ok(can("admin", s), `super admin opens ${s}`);
  assert.ok(can("reviewer", "queue") && !can("reviewer", "plans") && !can("reviewer", "staff"));
  assert.ok(can("support", "support") && !can("support", "leads") && !can("support", "queue"));
  assert.ok(can("sales", "leads") && !can("sales", "queue") && !can("sales", "users"));
  for (const not of ["member", "", "Admin", null, undefined]) for (const s of SECTIONS) assert.ok(!can(not, s), `${String(not)} opens ${s}`);
});

test("a role's landing page is one it can open, so a wrong-section redirect can't loop", () => {
  const section = { "/admin": "queue", "/admin/support": "support", "/admin/leads": "leads" } as const;
  for (const r of STAFF_ROLES) assert.ok(can(r, section[homeFor(r) as keyof typeof section]), `${r} lands on ${homeFor(r)}`);
});
