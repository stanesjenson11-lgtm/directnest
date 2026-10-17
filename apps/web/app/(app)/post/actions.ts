"use server";

import { randomUUID } from "node:crypto";
import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { bhkLabel, youtubeId } from "@/lib/format";
import { photosUsedElsewhere } from "@/lib/listings";
import { SAME_PHOTO } from "@/lib/media";
import { LOCALITIES } from "@/lib/places";
import { listingPhotos, listings, uploads, user } from "@/lib/schema";
import { AMENITIES, RENTALS } from "@/lib/search";
import { requireUser } from "@/lib/session";

const money = z.coerce.number().int().min(0).max(1_000_000_000);
const optionalMoney = z.preprocess((v) => (v === "" || v === undefined ? 0 : v), money);
const ROOMS = ["living", "bedroom", "kitchen", "bathroom", "exterior", "balcony"] as const;

const listingSchema = z
  .object({
    type: z.enum(RENTALS ? ["rent", "buy"] : ["buy"], "We only list homes for sale right now"),
    kind: z.enum(["apartment", "independent-house", "villa"]),
    bhk: z.coerce.number().int().min(0).max(4),
    carpetSqft: z.coerce.number().int().min(100, "Carpet area looks too small").max(20000),
    floor: z.coerce.number().int().min(0).max(80),
    totalFloors: z.coerce.number().int().min(1).max(80),
    facing: z.string().min(1),
    furnishing: z.enum(["full", "semi", "none"]),
    saleCondition: z.enum(["new", "resale"]).optional(),
    bathrooms: z.coerce.number().int().min(1, "Add at least one bathroom").max(10),
    balconies: z.coerce.number().int().min(0).max(10),
    videoUrl: z
      .string()
      .trim()
      .max(300)
      .transform((v) => (v ? youtubeId(v) : ""))
      .refine((v) => v !== null, "Paste a YouTube link, like https://youtu.be/…")
      .optional(),
    ageYears: z.coerce.number().int().min(0).max(100),
    locality: z.string().trim().min(2, "Tell us the locality").max(80),
    area: z.string().trim().min(2, "Add the block, sector or street").max(120),
    address: z.string().trim().min(10, "Add the full address, it stays private").max(400),
    lat: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(12.7).max(13.3).optional()),
    lng: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().min(77.25).max(78).optional()),
    description: z.string().trim().min(40, "Describe the home in a sentence or two (at least 40 characters)").max(1500),
    price: money.min(1000, "Enter the rent or price"),
    maintenance: optionalMoney,
    deposit: optionalMoney,
    availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    tenants: z.array(z.enum(["family", "bachelors", "company"])),
    pets: z.enum(["yes", "no"]),
    food: z.enum(["any", "veg"]),
    parking: z.enum(["none", "bike", "car"]),
    amenities: z.array(z.enum(AMENITIES)),
    photoKeys: z.array(z.uuid()).min(4, "Add at least 4 photos, one for each room").max(20),
    photoRooms: z.array(z.enum(ROOMS)),
    proofKey: z.uuid({ error: "Upload an electricity bill or property tax receipt" }),
    ownerName: z.string().trim().min(2, "Enter your name").max(80),
  })
  .refine((d) => d.floor <= d.totalFloors, { path: ["floor"], message: "Floor can't be above the top floor" })
  .refine((d) => d.type === "buy" || d.deposit > 0, { path: ["deposit"], message: "Enter the security deposit" })
  .refine((d) => d.type === "rent" || d.saleCondition, { path: ["saleCondition"], message: "Choose new or resale" })
  .refine((d) => d.photoRooms.length === d.photoKeys.length, { path: ["photoKeys"], message: "Choose a room for each photo" })
  .refine((d) => (d.lat !== undefined && d.lng !== undefined) || Object.keys(LOCALITIES).includes(d.locality), {
    path: ["lat"],
    message: "Drop a pin on the map so people know roughly where it is",
  });

export type PostState = { status: "idle" } | { status: "error"; errors: Record<string, string> } | { status: "done"; name: string };

const KIND_WORD = { apartment: "flat", "independent-house": "independent house", villa: "villa" } as const;

export async function submitListing(_prev: PostState, form: FormData): Promise<PostState> {
  const me = await requireUser("/post");
  const parsed = listingSchema.safeParse({
    ...Object.fromEntries(form),
    tenants: form.getAll("tenants"),
    amenities: form.getAll("amenities"),
    photoKeys: form.getAll("photoKey"),
    photoRooms: form.getAll("photoRoom"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { status: "error", errors };
  }
  const d = parsed.data;

  // Only files this person uploaded count; never trust keys or hashes from the browser.
  const mine = await db
    .select({ key: uploads.key, kind: uploads.kind, dhash: uploads.dhash })
    .from(uploads)
    .where(and(eq(uploads.ownerId, me.id), inArray(uploads.key, [...d.photoKeys, d.proofKey])));
  const hashes = new Map(mine.filter((u) => u.kind === "photo").map((u) => [u.key, u.dhash]));
  if (d.photoKeys.some((k) => !hashes.has(k)) || !mine.some((u) => u.key === d.proofKey && u.kind === "proof")) {
    return { status: "error", errors: { photoKeys: "Some uploads didn't finish. Remove and add those files again." } };
  }

  // Signals for the reviewer, never automatic bans: photos already used by another owner, or a burst of listings.
  const flags: string[] = [];
  const known = [...hashes.values()].filter((h): h is bigint => h !== null);
  if (await photosUsedElsewhere(known, me.id, SAME_PHOTO)) flags.push("duplicate-photos");
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(listings)
    .where(and(eq(listings.ownerId, me.id), gt(listings.createdAt, sql`now() - interval '30 days'`)));
  if (recent >= 2) flags.push("many-listings");

  // Public position: the pin (or the locality centre) nudged up to ~150 m, so the building can't be pinpointed.
  const [lat, lng] = d.lat !== undefined && d.lng !== undefined ? [d.lat, d.lng] : LOCALITIES[d.locality];
  const jitter = () => (Math.random() - 0.5) * 0.0027;
  const what = d.bhk === 0 ? "1 RK studio" : `${bhkLabel(d.bhk)} ${KIND_WORD[d.kind]}`;
  const id = `${d.bhk === 0 ? "1rk" : `${d.bhk}bhk`}-${d.area}-${d.locality}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) + "-" + randomUUID().slice(0, 6);

  await db.transaction(async (tx) => {
    await tx.insert(listings).values({
      id,
      ownerId: me.id,
      type: d.type,
      kind: d.kind,
      bhk: d.bhk,
      title: `${what} in ${d.area}, ${d.locality}`,
      locality: d.locality,
      area: d.area,
      addressPrivate: d.address,
      location: { x: lng + jitter(), y: lat + jitter() },
      price: d.price,
      maintenance: d.maintenance,
      deposit: d.type === "rent" ? d.deposit : 0,
      carpetSqft: d.carpetSqft,
      floor: d.floor,
      totalFloors: d.totalFloors,
      furnishing: d.furnishing,
      facing: d.facing,
      ageYears: d.ageYears,
      availableFrom: d.availableFrom || null,
      tenants: d.tenants,
      pets: d.pets === "yes",
      nonVeg: d.food === "any",
      parking: d.parking,
      bathrooms: d.bathrooms,
      balconies: d.balconies,
      saleCondition: d.type === "buy" ? d.saleCondition : null,
      videoUrl: d.videoUrl ? `https://www.youtube.com/watch?v=${d.videoUrl}` : null,
      amenities: d.amenities,
      description: d.description,
      proofKey: d.proofKey,
      riskFlags: flags,
    });
    await tx.insert(listingPhotos).values(
      d.photoKeys.map((key, position) => ({ listingId: id, position, src: `/media/${key}`, room: d.photoRooms[position], dhash: hashes.get(key) })),
    );
    if (!me.name) await tx.update(user).set({ name: d.ownerName }).where(eq(user.id, me.id));
  });

  revalidatePath("/account");
  return { status: "done", name: d.ownerName.split(" ")[0] };
}
