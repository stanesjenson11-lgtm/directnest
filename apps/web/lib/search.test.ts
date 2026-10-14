// Run: node --test lib/search.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSearch } from "./parse-search.ts";
import { filterListings, inPolygon, toQuery, type Listing } from "./search.ts";

const base: Listing = {
  id: "a", type: "rent", kind: "apartment", bhk: 2, title: "2 BHK", locality: "Koramangala", area: "5th Block",
  lat: 12.935, lng: 77.62, price: 40000, maintenance: 3000, deposit: 200000, carpetSqft: 1000, floor: 2,
  totalFloors: 4, furnishing: "semi", facing: "East", ageYears: 5, availableInDays: 0, tenants: [], pets: true,
  nonVeg: true, parking: "car", bathrooms: 2, balconies: 1, amenities: [], description: "", photos: [],
  owner: { name: "A", verified: true }, listedDaysAgo: 3, confirmedDaysAgo: 1,
};
const make = (o: Partial<Listing>): Listing => ({ ...base, ...o });

const homes = [
  make({ id: "kora-2", price: 40000 }),
  make({ id: "kora-3", bhk: 3, price: 60000, pets: false, confirmedDaysAgo: 5 }),
  make({ id: "hsr-1", bhk: 1, locality: "HSR Layout", lat: 12.911, lng: 77.647, price: 22000, tenants: ["family"] }),
  make({ id: "wf-4", bhk: 5, locality: "Whitefield", lat: 12.97, lng: 77.75, price: 90000, furnishing: "full" }),
  make({ id: "sale", type: "buy", price: 14_500_000 }),
];

const ids = (raw: Record<string, string>) => filterListings(homes, parseSearch(raw)).map((l) => l.id);

test("type defaults to rent and excludes sales", () => {
  assert.ok(!ids({}).includes("sale"));
  assert.deepEqual(ids({ type: "buy" }), ["sale"]);
});

test("bhk 4 means 4 or more; budget uses rent + maintenance", () => {
  assert.deepEqual(ids({ bhk: "4" }), ["wf-4"]);
  assert.deepEqual(ids({ max: "43000" }).sort(), ["hsr-1", "kora-2"]); // 40k + 3k = 43k is inside
  assert.deepEqual(ids({ max: "42999" }), ["hsr-1"]);
});

test("filters combine; tenants keeps 'anyone' listings", () => {
  assert.deepEqual(ids({ pets: "1", bhk: "2,3" }), ["kora-2"]);
  assert.deepEqual(ids({ tenants: "bachelors" }).includes("hsr-1"), false);
  assert.equal(ids({ tenants: "family" }).length, 4);
});

test("bbox and drawn area", () => {
  assert.deepEqual(ids({ bbox: "77.7,12.9,77.8,13.0" }), ["wf-4"]);
  const square = "77.6,12.92;77.66,12.92;77.66,12.95;77.6,12.95";
  assert.deepEqual(ids({ area: square }).sort(), ["kora-2", "kora-3"]);
  assert.equal(inPolygon(77.63, 12.93, [77.6, 12.92, 77.66, 12.92, 77.66, 12.95, 77.6, 12.95]), true);
});

test("sorting and junk params", () => {
  assert.deepEqual(ids({ sort: "price-asc" })[0], "hsr-1");
  assert.deepEqual(ids({ sort: "relevant" }).at(-1), "kora-3");
  assert.equal(ids({ bhk: "abc", max: "-5", sort: "nope", bbox: "1,2" }).length, 4);
});

test("query round-trips and drops defaults", () => {
  const p = parseSearch({ type: "rent", bhk: "2,3", sort: "relevant", q: "HSR Layout" });
  assert.equal(toQuery(p), "q=HSR+Layout&bhk=2%2C3");
});
