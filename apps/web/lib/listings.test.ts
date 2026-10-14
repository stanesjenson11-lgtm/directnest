// Runs against the dev database: pnpm db:start && pnpm db:migrate && pnpm db:seed, then pnpm test.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.ts";
import { searchCards, type Card } from "./listings.ts";
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

test("results never carry the private address", async () => {
  const [card] = await search({});
  assert.ok(card && !("addressPrivate" in card));
});
