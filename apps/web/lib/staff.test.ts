// Runs against the dev database, like admin.test.ts.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { setBanned } from "./admin.ts";
import { db, pool } from "./db.ts";
import { twoFactor, user } from "./schema.ts";
import { listStaff, setRole } from "./staff.ts";

after(() => pool.end());

test("a super admin gives, changes and takes away staff access", async () => {
  const t = `test-staff-${Date.now()}`;
  const [admin, person, suspended] = [`${t}-a`, `${t}-p`, `${t}-s`];
  const tail = String(Date.now()).slice(-8);
  const [adminPhone, personPhone, suspendedPhone] = [`+9198${tail}`, `+9196${tail}`, `+9197${tail}`];
  const roleOf = async (id: string) => (await db.select({ role: user.role, two: user.twoFactorEnabled }).from(user).where(eq(user.id, id)))[0];
  await db.insert(user).values([
    { id: admin, name: "Boss", email: `${admin}@test.invalid`, role: "admin", phoneNumber: adminPhone },
    { id: person, name: "Person", email: `${person}@test.invalid`, phoneNumber: personPhone },
    { id: suspended, name: "Suspended", email: `${suspended}@test.invalid`, phoneNumber: suspendedPhone, banned: true },
  ]);
  try {
    assert.equal(await setRole(admin, "12345", "sales"), "bad-phone");
    assert.equal(await setRole(admin, `+9195${tail}`, "sales"), "no-account", "they must have signed in once");
    assert.equal(await setRole(admin, suspendedPhone, "sales"), "banned");
    assert.equal(await setRole(admin, adminPhone, "member"), "self", "nobody changes their own role");

    assert.equal(await setRole(admin, personPhone, "reviewer"), "ok");
    assert.equal((await roleOf(person)).role, "reviewer");
    assert.ok((await listStaff()).some((s) => s.id === person), "listed once they have a role");
    assert.equal(await setBanned(admin, person, true), false, "staff can't be banned from the users page");
    assert.equal(await setRole(admin, personPhone, "support"), "ok", "and can be moved to another role");

    // Taking the role away takes the authenticator with it, so a later promotion enrols a fresh one.
    await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, person));
    await db.insert(twoFactor).values({ id: `${t}-tf`, secret: "x", backupCodes: "x", userId: person });
    assert.equal(await setRole(admin, personPhone, "member"), "ok");
    assert.deepEqual(await roleOf(person), { role: "member", two: false });
    assert.equal((await db.select().from(twoFactor).where(eq(twoFactor.userId, person))).length, 0);
    assert.ok(!(await listStaff()).some((s) => s.id === person));
  } finally {
    await db.delete(user).where(inArray(user.id, [admin, person, suspended]));
  }
});
