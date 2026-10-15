// Runs against the dev database: pnpm db:start && pnpm db:migrate && pnpm db:seed, then pnpm test.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, pool } from "./db.ts";
import { photosUsedElsewhere, searchCards, type Card } from "./listings.ts";
import { listingPhotos, listings, user } from "./schema.ts";
import { parseSearch } from "./parse-search.ts";
import { LOCALITIES } from "./places.ts";
import { haversine } from "./search.ts";
import { SEED } from "./seed.ts";

after(() => pool.end());

const search = (raw: Record<string, string>) => searchCards(parseSearch(raw));
const monthly = (c: Pick<Card, "type" | "price" | "maintenance">) => (c.type === "rent" ? c.price + c.maintenance : c.price);
const seedCount = (f: (l: (typeof SEED)[number]) => boolean) => SEED.filter(f).length;

test("rent by default; buy returns only sales", async () => {
  const rent = await search({});
  assert.equal(rent.length, seedCount((l) => l.type === "rent"));
  assert.equal((await search({ type: "buy" })).length, seedCount((l) => l.type === "buy"));
});

test("budget counts rent + maintenance; 4 BHK means 4 or more", async () => {
  const capped = await search({ max: "30000" });
  assert.ok(capped.every((c) => monthly(c) <= 30000));
  assert.equal(capped.length, seedCount((l) => l.type === "rent" && l.price + l.maintenance <= 30000));
  const big = await search({ type: "buy", bhk: "4" });
  assert.ok(big.length > 0 && big.every((c) => c.bhk >= 4));
});

test("a locality name searches about 3 km around it", async () => {
  const [lat, lng] = LOCALITIES.Koramangala;
  const near = await search({ q: "Koramangala" });
  assert.ok(near.length >= 3);
  assert.ok(near.every((c) => haversine(lat, lng, c.lat, c.lng) < 3200));
});

test("map box and drawn area", async () => {
  const box = await search({ bbox: "77.7,12.9,77.8,13.0" });
  assert.ok(box.length > 0 && box.every((c) => c.lng >= 77.7 && c.lng <= 77.8 && c.lat >= 12.9 && c.lat <= 13));
  const drawn = await search({ area: "77.6,12.92;77.66,12.92;77.66,12.95;77.6,12.95" });
  assert.ok(drawn.length > 0 && drawn.every((c) => c.lng > 77.6 && c.lng < 77.66 && c.lat > 12.92 && c.lat < 12.95));
});

test("filters combine and sorting holds", async () => {
  const pets = await search({ pets: "1", bhk: "2,3" });
  assert.equal(pets.length, seedCount((l) => l.type === "rent" && l.pets && (l.bhk === 2 || l.bhk === 3)));
  const cheapest = (await search({ sort: "price-asc" })).map(monthly);
  assert.deepEqual(cheapest, [...cheapest].sort((a, b) => a - b));
});

test("a photo reused by another owner is caught, even slightly altered", async () => {
  const owner = `test-owner-${Date.now()}`;
  const hash = -0x1234_5678_9abc_def0n;
  await db.insert(user).values({ id: owner, name: "Test", email: `${owner}@test.invalid` });
  try {
    await db.insert(listings).values({
      id: owner, ownerId: owner, type: "rent", kind: "apartment", bhk: 1, title: "t", locality: "x", area: "x",
      addressPrivate: "x", location: { x: 77.6, y: 12.9 }, price: 1, carpetSqft: 500, floor: 1, totalFloors: 2,
      furnishing: "none", facing: "East", ageYears: 1, pets: false, nonVeg: true, parking: "none", bathrooms: 1,
      balconies: 1, description: "x",
    });
    await db.insert(listingPhotos).values({ listingId: owner, position: 0, src: "x", room: "living", dhash: hash });
    const altered = hash ^ 0b101n; // two bits off
    assert.equal(await photosUsedElsewhere([altered], "someone-else", 6), true);
    assert.equal(await photosUsedElsewhere([altered], owner, 6), false, "owners may reuse their own photos");
    assert.equal(await photosUsedElsewhere([~hash], "someone-else", 6), false);
  } finally {
    await db.delete(user).where(eq(user.id, owner)); // cascades to the listing and photo
  }
});

test("results never carry the private address", async () => {
  const [card] = await search({});
  assert.ok(card && !("addressPrivate" in card));
});
