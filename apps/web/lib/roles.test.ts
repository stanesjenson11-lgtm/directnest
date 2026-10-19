import assert from "node:assert/strict";
import { test } from "node:test";
import { can, homeFor, SECTIONS, STAFF_ROLES } from "./roles.ts";

test("each role opens only its own sections; nobody else opens any", () => {
  for (const s of SECTIONS) assert.ok(can("admin", s), `super admin opens ${s}`);
  assert.ok(can("reviewer", "queue") && !can("reviewer", "plans") && !can("reviewer", "staff"));
  assert.ok(can("support", "support") && !can("support", "leads") && !can("support", "queue"));
  assert.ok(can("sales", "leads") && can("sales", "users") && !can("sales", "queue") && !can("sales", "support") && !can("sales", "listings"));
  assert.ok(can("reviewer", "listings") && !can("support", "listings"));
  for (const not of ["member", "", "Admin", null, undefined]) for (const s of SECTIONS) assert.ok(!can(not, s), `${String(not)} opens ${s}`);
});

test("a role's landing page is one it can open, so a wrong-section redirect can't loop", () => {
  // Everyone lands on the dashboard, which every role may open.
  for (const r of STAFF_ROLES) {
    assert.equal(homeFor(r), "/admin");
    assert.ok(can(r, "overview"), `${r} opens the dashboard`);
  }
});
