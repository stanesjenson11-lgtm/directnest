import { relations, sql } from "drizzle-orm";
import { bigint, boolean, date, index, integer, pgEnum, pgTable, point, primaryKey, serial, smallint, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";

export * from "./auth-schema.ts";

export const listingType = pgEnum("listing_type", ["rent", "buy"]);
export const propertyKind = pgEnum("property_kind", ["apartment", "independent-house", "villa"]);
export const furnishing = pgEnum("furnishing", ["full", "semi", "none"]);
export const parking = pgEnum("parking", ["none", "bike", "car"]);
export const listingStatus = pgEnum("listing_status", ["pending_review", "active", "rented", "expired", "rejected"]);
export const room = pgEnum("room", ["living", "bedroom", "kitchen", "bathroom", "exterior", "balcony"]);
export const saleCondition = pgEnum("sale_condition", ["new", "resale"]); // new = from the builder

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
    saleCondition: saleCondition(), // sales only
    videoUrl: text(), // YouTube link; we embed it rather than host video
    visitVerifiedAt: timestamp({ withTimezone: true }), // our staff saw the home in person
    ownerVerified: boolean().notNull().default(false),
    proofKey: text(), // private upload; deleted 30 days after review
    riskFlags: text().array().notNull().default(sql`'{}'::text[]`), // e.g. duplicate-photos, for the review queue
    rejectReason: text(),
    reviewedAt: timestamp({ withTimezone: true }),
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
    dhash: bigint({ mode: "bigint" }), // 64-bit difference hash; near-equal hashes across owners flag reused photos
  },
  (t) => [index("listing_photos_listing_idx").on(t.listingId, t.position)],
);

export const uploadKind = pgEnum("upload_kind", ["photo", "proof"]);

/** Every file someone uploaded. The post action only accepts keys found here for the same owner. */
export const uploads = pgTable("uploads", {
  key: text().primaryKey(),
  ownerId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  kind: uploadKind().notNull(),
  dhash: bigint({ mode: "bigint" }),
  ext: text().notNull(), // proof files keep their type (pdf, jpg)
  createdAt: now(),
});

const userRef = () =>
  text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const listingRef = () =>
  text()
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" });

/** Every time someone saw an owner's number. Caps scraping and tells owners who's interested. */
export const contactReveals = pgTable(
  "contact_reveals",
  { id: serial().primaryKey(), userId: userRef(), listingId: listingRef(), createdAt: now() },
  (t) => [index("contact_reveals_user_idx").on(t.userId, t.createdAt), index("contact_reveals_listing_idx").on(t.listingId)],
);

export const leadKind = pgEnum("lead_kind", ["callback", "visit"]);
export const leadStatus = pgEnum("lead_status", ["new", "confirmed", "declined", "done"]);
// The sales team's own pipeline for each request, separate from the owner's answer above.
export const crmStage = pgEnum("crm_stage", ["new", "contacted", "visited", "negotiating", "won", "lost"]);

/** A buyer asking the owner to call back, or to visit. The owner answers from their dashboard. */
export const leads = pgTable(
  "leads",
  {
    id: serial().primaryKey(),
    listingId: listingRef(),
    requesterId: userRef(),
    kind: leadKind().notNull(),
    preferredDate: date({ mode: "string" }),
    preferredSlot: text(), // morning | afternoon | evening
    note: text(),
    status: leadStatus().notNull().default("new"),
    crmStage: crmStage().notNull().default("new"),
    crmNote: text(), // staff only; never shown to the buyer or the owner
    crmUpdatedAt: timestamp({ withTimezone: true }),
    createdAt: now(),
  },
  (t) => [index("leads_listing_idx").on(t.listingId), index("leads_requester_idx").on(t.requesterId)],
);

export const savedSearches = pgTable(
  "saved_searches",
  { id: serial().primaryKey(), userId: userRef(), query: text().notNull(), label: text().notNull(), createdAt: now() },
  (t) => [index("saved_searches_user_idx").on(t.userId)],
);

export const shortlists = pgTable(
  "shortlists",
  { userId: userRef(), listingId: listingRef(), createdAt: now() },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);

/** One chat per buyer and listing. The read markers say up to when each side has seen the thread. */
export const conversations = pgTable(
  "conversations",
  {
    id: serial().primaryKey(),
    listingId: listingRef(),
    buyerId: userRef(),
    ownerId: userRef(),
    buyerReadAt: now(),
    ownerReadAt: now(),
    lastMessageAt: now(),
    createdAt: now(),
  },
  (t) => [uniqueIndex("conversations_listing_buyer_idx").on(t.listingId, t.buyerId), index("conversations_owner_idx").on(t.ownerId, t.lastMessageAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: serial().primaryKey(),
    conversationId: integer()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: userRef(),
    body: text().notNull(),
    createdAt: now(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.id), index("messages_sender_idx").on(t.senderId, t.createdAt)],
);

export const listingsRelations = relations(listings, ({ one, many }) => ({
  owner: one(user, { fields: [listings.ownerId], references: [user.id] }),
  photos: many(listingPhotos),
}));

export const listingPhotosRelations = relations(listingPhotos, ({ one }) => ({
  listing: one(listings, { fields: [listingPhotos.listingId], references: [listings.id] }),
}));
