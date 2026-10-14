import { relations, sql } from "drizzle-orm";
import { bigint, boolean, date, index, integer, pgEnum, pgTable, point, serial, smallint, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";

export * from "./auth-schema.ts";

export const listingType = pgEnum("listing_type", ["rent", "buy"]);
export const propertyKind = pgEnum("property_kind", ["apartment", "independent-house", "villa"]);
export const furnishing = pgEnum("furnishing", ["full", "semi", "none"]);
export const parking = pgEnum("parking", ["none", "bike", "car"]);
export const listingStatus = pgEnum("listing_status", ["pending_review", "active", "rented", "expired", "rejected"]);
export const room = pgEnum("room", ["living", "bedroom", "kitchen", "bathroom", "exterior", "balcony"]);

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const listings = pgTable(
  "listings",
  {
    id: text().primaryKey(), // readable slug, e.g. 2bhk-5th-block-koramangala-1
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: listingStatus().notNull().default("pending_review"),
    sample: boolean().notNull().default(false), // seeded demo listings, labelled as such in the UI
    type: listingType().notNull(),
    kind: propertyKind().notNull(),
    bhk: smallint().notNull(), // 0 = 1 RK
    title: text().notNull(),
    city: text().notNull().default("Bengaluru"),
    locality: text().notNull(),
    area: text().notNull(),
    addressPrivate: text().notNull(), // never selected for public pages
    // Public map position (x = lng, y = lat), jittered off the building. Core point type + GiST: no PostGIS needed yet.
    location: point({ mode: "xy" }).notNull(),
    price: bigint({ mode: "number" }).notNull(), // monthly rent, or sale price
    maintenance: integer().notNull().default(0),
    deposit: bigint({ mode: "number" }).notNull().default(0),
    carpetSqft: integer().notNull(),
    floor: smallint().notNull(),
    totalFloors: smallint().notNull(),
    furnishing: furnishing().notNull(),
    facing: text().notNull(),
    ageYears: smallint().notNull(),
    availableFrom: date({ mode: "string" }), // null = now
    tenants: text().array().notNull().default(sql`'{}'::text[]`), // empty = anyone
    pets: boolean().notNull(),
    nonVeg: boolean().notNull(),
    parking: parking().notNull(),
    bathrooms: smallint().notNull(),
    balconies: smallint().notNull(),
    amenities: text().array().notNull().default(sql`'{}'::text[]`),
    description: text().notNull(),
    ownerVerified: boolean().notNull().default(false),
    createdAt: now(),
    confirmedAt: now(), // owner last said "still available"
    expiresAt: timestamp({ withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
  },
  (t) => [
    index("listings_location_gist").using("gist", t.location),
    index("listings_search_idx").on(t.status, t.type, t.city, t.bhk),
    index("listings_owner_idx").on(t.ownerId),
  ],
);

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: serial().primaryKey(),
    listingId: text()
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    src: text().notNull(), // absolute URL (stock) or storage key (uploads)
    room: room().notNull(),
    credit: text(),
  },
  (t) => [index("listing_photos_listing_idx").on(t.listingId, t.position)],
);

export const listingsRelations = relations(listings, ({ one, many }) => ({
  owner: one(user, { fields: [listings.ownerId], references: [user.id] }),
  photos: many(listingPhotos),
}));

export const listingPhotosRelations = relations(listingPhotos, ({ one }) => ({
  listing: one(listings, { fields: [listingPhotos.listingId], references: [listings.id] }),
}));
