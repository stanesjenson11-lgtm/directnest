// Server-side: turns untrusted URL params into SearchParams. Kept apart from lib/search.ts so zod never ships to the browser.
import { z } from "zod";
import { SORTS } from "./search.ts";

const list = <T extends string>(values: readonly [T, ...T[]]) =>
  z
    .string()
    .transform((s) => s.split(",").filter((v): v is T => (values as readonly string[]).includes(v)))
    .optional()
    .catch(undefined);

const num = z.coerce.number().int().nonnegative().optional().catch(undefined);

const coords = (min: number) =>
  z
    .string()
    .transform((s) => s.split(/[;,]/).map(Number))
    .refine((a) => a.length >= min && a.every(Number.isFinite))
    .optional()
    .catch(undefined);

export const searchSchema = z.object({
  type: z.enum(["rent", "buy"]).catch("rent"),
  q: z.string().trim().max(80).optional().catch(undefined),
  bhk: z
    .string()
    .transform((s) => s.split(",").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 4))
    .optional()
    .catch(undefined),
  min: num,
  max: num,
  furnishing: list(["full", "semi", "none"]),
  tenants: z.enum(["family", "bachelors", "company"]).optional().catch(undefined),
  kind: list(["apartment", "independent-house", "villa"]),
  avail: z.enum(["now", "15", "30"]).optional().catch(undefined),
  pets: z.literal("1").optional().catch(undefined),
  parking: z.literal("1").optional().catch(undefined),
  sort: z.enum(SORTS).catch("relevant"),
  bbox: coords(4), // west,south,east,north
  area: coords(6), // lng,lat;lng,lat;… (≥ 3 points)
});

export type SearchParams = z.infer<typeof searchSchema>;

export function parseSearch(raw: Record<string, string | string[] | undefined>): SearchParams {
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return searchSchema.parse(flat);
}
