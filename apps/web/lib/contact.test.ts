// Runs against the dev database, like listings.test.ts.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { count, eq, inArray } from "drizzle-orm";
import { db, pool } from "./db.ts";
import { REVEALS_PER_DAY, revealPhone } from "./contact.ts";
import { contactReveals, listings, user } from "./schema.ts";
import { SEED } from "./seed.ts";

after(() => pool.end());

const home = (id: string, ownerId: string) => ({
  id, ownerId, status: "active" as const, type: "buy" as const, kind: "apartment" as const, bhk: 2, title: "t", locality: "x",
  area: "x", addressPrivate: "x", location: { x: 77.6, y: 12.9 }, price: 1, carpetSqft: 900, floor: 1, totalFloors: 4,
  furnishing: "none" as const, facing: "East", ageYears: 1, pets: false, nonVeg: true, parking: "none" as const,
  bathrooms: 1, balconies: 1, description: "x",
});

test("numbers are logged once per listing and capped per day", async () => {
  const t = `test-reveal-${Date.now()}`;
  const [owner, viewer] = [`${t}-owner`, `${t}-viewer`];
  await db.insert(user).values([
    { id: owner, name: "Owner", email: `${owner}@test.invalid`, phoneNumber: `+9198${String(Date.now()).slice(-8)}` },
    { id: viewer, name: "Viewer", email: `${viewer}@test.invalid` },
  ]);
  try {
    await db.insert(listings).values([home(`${t}-a`, owner), home(`${t}-b`, owner)]);
    const reveals = async () => (await db.select({ n: count() }).from(contactReveals).where(eq(contactReveals.userId, viewer)))[0].n;

    const first = await revealPhone(viewer, `${t}-a`);
    assert.ok(first.ok && first.phone.startsWith("+9198"));
    await revealPhone(viewer, `${t}-a`);
    assert.equal(await reveals(), 1, "seeing the same number again isn't counted");
    assert.deepEqual(await revealPhone(owner, `${t}-b`), { ok: true, phone: first.ok && first.phone }, "owners see their own");

    await db.insert(contactReveals).values(Array.from({ length: REVEALS_PER_DAY }, () => ({ userId: viewer, listingId: `${t}-a` })));
    assert.deepEqual(await revealPhone(viewer, `${t}-b`), { ok: false, reason: "limit" });
    assert.ok((await revealPhone(viewer, `${t}-a`)).ok, "numbers already seen stay visible past the cap");

    assert.deepEqual(await revealPhone(viewer, SEED[0].id), { ok: false, reason: "sample" });
    assert.deepEqual(await revealPhone(viewer, "no-such-home"), { ok: false, reason: "gone" });
  } finally {
    await db.delete(user).where(inArray(user.id, [owner, viewer])); // cascades to listings and reveals
  }
});
