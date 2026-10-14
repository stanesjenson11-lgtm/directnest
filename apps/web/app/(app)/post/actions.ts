"use server";

import { z } from "zod";

const money = z.coerce.number().int().min(0).max(1_000_000_000);
const optionalMoney = z.preprocess((v) => (v === "" || v === undefined ? 0 : v), money);

const listingSchema = z
  .object({
    type: z.enum(["rent", "buy"]),
    kind: z.enum(["apartment", "independent-house", "villa"]),
    bhk: z.coerce.number().int().min(0).max(4),
    carpetSqft: z.coerce.number().int().min(100, "Carpet area looks too small").max(20000),
    floor: z.coerce.number().int().min(0).max(80),
    totalFloors: z.coerce.number().int().min(1).max(80),
    facing: z.string().min(1),
    furnishing: z.enum(["full", "semi", "none"]),
    ageYears: z.coerce.number().int().min(0).max(100),
    locality: z.string().trim().min(2, "Tell us the locality").max(80),
    area: z.string().trim().min(2, "Add the block, sector or street").max(120),
    address: z.string().trim().min(10, "Add the full address, it stays private").max(400),
    price: money.min(1000, "Enter the rent or price"),
    maintenance: optionalMoney,
    deposit: optionalMoney,
    availableFrom: z.string().optional(),
    tenants: z.array(z.enum(["family", "bachelors", "company"])),
    pets: z.enum(["yes", "no"]),
    food: z.enum(["any", "veg"]),
    parking: z.enum(["none", "bike", "car"]),
    amenities: z.array(z.string().max(60)).max(30),
    photoCount: z.coerce.number().int().min(4, "Add at least 4 photos, one for each room"),
    hasProof: z.literal("1", { error: "Upload an electricity bill or property tax receipt" }),
    ownerName: z.string().trim().min(2, "Enter your name").max(80),
    ownerPhone: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
  })
  .refine((d) => d.floor <= d.totalFloors, { path: ["floor"], message: "Floor can't be above the top floor" })
  .refine((d) => d.type === "buy" || d.deposit > 0, { path: ["deposit"], message: "Enter the security deposit" });

export type PostState =
  | { status: "idle" }
  | { status: "error"; errors: Record<string, string> }
  | { status: "done"; name: string };

export async function submitListing(_prev: PostState, form: FormData): Promise<PostState> {
  const raw = Object.fromEntries(form);
  const parsed = listingSchema.safeParse({ ...raw, tenants: form.getAll("tenants"), amenities: form.getAll("amenities") });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { status: "error", errors };
  }
  // ponytail: no database yet. Here the listing gets inserted as PENDING_REVIEW, photos go to R2 through
  // presigned uploads (EXIF stripped, dHash computed), and the proof document lands in the private bucket.
  return { status: "done", name: parsed.data.ownerName.split(" ")[0] };
}
