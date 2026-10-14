"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { submitListing, type PostState } from "@/app/(app)/post/actions";
import { inr } from "@/lib/format";
import { LOCALITIES } from "@/lib/places";

const AMENITIES = ["Lift", "Power backup", "24×7 security", "Gym", "Swimming pool", "Club house", "Children's play area", "Gas pipeline", "Intercom", "CCTV", "Visitor parking", "Rainwater harvesting"];
const SECTIONS = [
  ["what", "The home"],
  ["where", "Location"],
  ["money", "Price and terms"],
  ["amenities", "Amenities"],
  ["photos", "Photos"],
  ["proof", "Proof of ownership"],
  ["you", "Your details"],
] as const;

const input =
  "h-11 w-full rounded-lg border border-hairline bg-canvas px-3 text-ink placeholder:text-muted focus-visible:border-indigo focus-visible:outline-none aria-[invalid=true]:border-danger";
const choice =
  "flex cursor-pointer items-center justify-center rounded-lg border border-hairline px-4 py-2.5 text-[15px] font-medium transition-colors duration-150 has-checked:border-indigo has-checked:bg-indigo/8 has-checked:text-indigo has-focus-visible:outline-2 has-focus-visible:outline-indigo";

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid content-start gap-1.5 text-[14px] font-medium">
      {label}
      {children}
      {hint && !error && <span className="font-normal text-muted">{hint}</span>}
      {error && <span className="font-normal text-danger">{error}</span>}
    </label>
  );
}

function Choices({ name, legend, options, defaultValue, multiple, error }: { name: string; legend: string; options: readonly (readonly [string, string])[]; defaultValue?: string; multiple?: boolean; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[14px] font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label key={value} className={choice}>
            <input type={multiple ? "checkbox" : "radio"} name={name} value={value} defaultChecked={value === defaultValue} required={!multiple} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-[14px] text-danger">{error}</p>}
    </fieldset>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-hairline py-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-h`} className="text-xl font-semibold">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-[60ch] text-muted">{intro}</p>}
      <div className="mt-6 grid gap-6">{children}</div>
    </section>
  );
}

export function PostForm({ sample }: { sample: boolean }) {
  const [state, action, pending] = useActionState<PostState, FormData>(submitListing, { status: "idle" });
  const [type, setType] = useState<"rent" | "buy">("rent");
  const [price, setPrice] = useState(0);
  const [maintenance, setMaintenance] = useState(0);
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [proof, setProof] = useState<string | null>(null);
  const summary = useRef<HTMLDivElement>(null);
  const e = state.status === "error" ? state.errors : {};

  useEffect(() => {
    if (state.status !== "idle") summary.current?.focus();
  }, [state]);
  // Free blob previews when the form goes away; removals free their own.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (state.status === "done") {
    return (
      <div ref={summary} tabIndex={-1} className="mx-auto max-w-xl py-16 text-center focus-visible:outline-none">
        <p className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-verified-wash text-verified">
          <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </p>
        <h1 className="mt-5 text-[1.75rem] font-semibold">Thanks, {state.name}. Your home is in the review queue.</h1>
        <p className="mt-3 text-muted">
          Someone on our team checks the photos, the details and your ownership proof, usually within a day. We&rsquo;ll email you when it&rsquo;s live.
        </p>
        {sample && <p className="mt-4 rounded-lg bg-surface p-3 text-[14px]">This is a preview build: listings aren&rsquo;t saved until the database is connected.</p>}
        <Link href="/search" className="mt-8 inline-flex h-12 items-center rounded-full bg-indigo px-6 font-semibold text-canvas hover:bg-indigo-deep">
          See homes like yours
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-x-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <header className="mb-10 max-w-2xl lg:col-start-2">
        <h1 className="text-[2rem] leading-tight font-semibold text-balance">Post your property. It&rsquo;s free.</h1>
        <p className="mt-2 text-muted">About ten minutes. Keep a bill or tax receipt and a few photos handy.</p>
      </header>
      <nav aria-label="Form sections" className="hidden lg:block">
        <ol className="sticky top-24 grid gap-1 text-[15px]">
          {SECTIONS.map(([id, label], i) => (
            <li key={id}>
              <a href={`#${id}`} className="flex gap-3 rounded-md px-2 py-1.5 text-muted hover:bg-surface hover:text-ink">
                <span className="w-4 text-right tabular-nums">{i + 1}</span>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <form
        noValidate={false}
        onSubmit={(ev) => {
          ev.preventDefault();
          const data = new FormData(ev.currentTarget);
          startTransition(() => action(data));
        }}
        className="min-w-0 max-w-2xl"
      >
        {state.status === "error" && (
          <div ref={summary} tabIndex={-1} role="alert" className="mb-8 rounded-xl bg-danger/8 p-4 focus-visible:outline-none">
            <p className="font-semibold">A few things need fixing before this can go to review:</p>
            <ul className="mt-2 list-disc pl-5 text-[15px]">
              {Object.values(e).map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        <Section id="what" title="The home">
          <fieldset>
            <legend className="mb-1.5 text-[14px] font-medium">You want to</legend>
            <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
              {(
                [
                  ["rent", "Rent it out"],
                  ["buy", "Sell it"],
                ] as const
              ).map(([v, l]) => (
                <label key={v} className={choice}>
                  <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <Choices name="kind" legend="Property type" defaultValue="apartment" options={[["apartment", "Flat"], ["independent-house", "Independent house"], ["villa", "Villa"]]} />
          <Choices name="bhk" legend="Bedrooms" defaultValue="2" options={[["0", "1 RK"], ["1", "1 BHK"], ["2", "2 BHK"], ["3", "3 BHK"], ["4", "4+ BHK"]]} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Carpet area (sq ft)" error={e.carpetSqft}>
              <input name="carpetSqft" type="number" inputMode="numeric" min={100} required className={input} aria-invalid={!!e.carpetSqft} />
            </Field>
            <Field label="Floor" hint="0 for ground" error={e.floor}>
              <input name="floor" type="number" inputMode="numeric" min={0} required className={input} aria-invalid={!!e.floor} />
            </Field>
            <Field label="Floors in building" error={e.totalFloors}>
              <input name="totalFloors" type="number" inputMode="numeric" min={1} required className={input} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Main door faces">
              <select name="facing" required defaultValue="" className={input}>
                <option value="" disabled>
                  Choose a direction
                </option>
                {["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Age of building (years)">
              <input name="ageYears" type="number" inputMode="numeric" min={0} required className={input} />
            </Field>
          </div>
          <Choices name="furnishing" legend="Furnishing" defaultValue="semi" options={[["full", "Furnished"], ["semi", "Semi-furnished"], ["none", "Unfurnished"]]} />
        </Section>

        <Section id="where" title="Location" intro="Tenants see the locality and an approximate area. The full address is only shared with people who contact you.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Locality" error={e.locality}>
              <input name="locality" list="post-localities" required autoComplete="off" placeholder="e.g. HSR Layout" className={input} aria-invalid={!!e.locality} />
              <datalist id="post-localities">
                {Object.keys(LOCALITIES).map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
            <Field label="Block, sector or street" error={e.area}>
              <input name="area" required placeholder="e.g. Sector 2" className={input} aria-invalid={!!e.area} />
            </Field>
          </div>
          <Field label="Full address" hint="Private. Never shown on the listing." error={e.address}>
            <textarea name="address" required rows={3} className={`${input} h-auto py-2`} aria-invalid={!!e.address} />
          </Field>
        </Section>

        <Section id="money" title="Price and terms" intro="Tenants see rent and maintenance as one monthly number, so they know exactly what they'll pay.">
          <div className={`grid gap-4 ${type === "rent" ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <Field label={type === "rent" ? "Monthly rent (₹)" : "Price (₹)"} error={e.price}>
              <input name="price" type="number" inputMode="numeric" min={1000} required onChange={(ev) => setPrice(Number(ev.target.value) || 0)} className={`${input} tabular-nums`} aria-invalid={!!e.price} />
            </Field>
            <Field label="Maintenance per month (₹)" hint="0 if included">
              <input name="maintenance" type="number" inputMode="numeric" min={0} onChange={(ev) => setMaintenance(Number(ev.target.value) || 0)} className={`${input} tabular-nums`} />
            </Field>
            {type === "rent" && (
              <Field label="Security deposit (₹)" error={e.deposit}>
                <input name="deposit" type="number" inputMode="numeric" min={0} required className={`${input} tabular-nums`} aria-invalid={!!e.deposit} />
              </Field>
            )}
          </div>
          {type === "rent" && price > 0 && (
            <p className="rounded-lg bg-surface p-3 text-[15px] tabular-nums" aria-live="polite">
              Tenants will see <strong>{inr(price + maintenance)} a month</strong>
              {maintenance > 0 && ` (${inr(price)} rent + ${inr(maintenance)} maintenance)`}.
            </p>
          )}
          {type === "rent" && (
            <>
              <Field label="Available from">
                <input name="availableFrom" type="date" className={`${input} sm:max-w-xs`} />
              </Field>
              <Choices name="tenants" legend="You'd prefer (leave empty for anyone)" multiple options={[["family", "Families"], ["bachelors", "Bachelors"], ["company", "Company lease"]]} />
              <Choices name="pets" legend="Pets" defaultValue="yes" options={[["yes", "Allowed"], ["no", "Not allowed"]]} />
              <Choices name="food" legend="Food" defaultValue="any" options={[["any", "No restrictions"], ["veg", "Vegetarian only"]]} />
            </>
          )}
          {type === "buy" && (
            <>
              <input type="hidden" name="pets" value="yes" />
              <input type="hidden" name="food" value="any" />
            </>
          )}
          <Choices name="parking" legend="Parking" defaultValue="car" options={[["none", "None"], ["bike", "Two-wheeler"], ["car", "Car"]]} />
        </Section>

        <Section id="amenities" title="Amenities">
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {AMENITIES.map((a) => (
              <label key={a} className="flex cursor-pointer items-center gap-3 rounded-md py-1.5 text-[15px]">
                <input type="checkbox" name="amenities" value={a} className="h-4 w-4 accent-indigo" />
                {a}
              </label>
            ))}
          </div>
        </Section>

        <Section id="photos" title="Photos" intro="At least 4: the living room, each bedroom, the kitchen and a bathroom. We remove location data from every photo before it's stored.">
          <input type="hidden" name="photoCount" value={photos.length} />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-hairline px-6 py-10 text-center hover:border-indigo has-focus-visible:border-indigo">
            <span className="font-semibold text-indigo">Add photos</span>
            <span className="text-[14px] text-muted">JPG or PNG from your phone or computer, up to 20</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(ev) => {
                const files = [...(ev.target.files ?? [])].slice(0, 20 - photos.length);
                const added = files.map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
                urls.current.push(...added.map((a) => a.url));
                setPhotos((p) => [...p, ...added]);
                ev.target.value = "";
              }}
            />
          </label>
          {e.photoCount && <p className="text-[14px] text-danger">{e.photoCount}</p>}
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <li key={p.url} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  <img src={p.url} alt={`Photo ${i + 1}: ${p.name}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/75 px-1.5 py-0.5 text-[12px] font-medium text-canvas">Cover</span>}
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(p.url);
                      setPhotos((ps) => ps.filter((x) => x.url !== p.url));
                    }}
                    aria-label={`Remove photo ${i + 1}`}
                    className="absolute top-1.5 right-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-canvas/90 text-ink"
                  >
                    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="proof" title="Proof of ownership" intro="An electricity bill or property tax receipt in your name, or a family member's. Only our review team sees it, and we delete it 30 days after we decide.">
          <input type="hidden" name="hasProof" value={proof ? "1" : ""} />
          <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-hairline p-4 hover:border-indigo has-focus-visible:border-indigo">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface text-indigo">
              <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
                <path d="M5 2h7l4 4v12H5z M12 2v4h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{proof ?? "Upload a bill or tax receipt"}</span>
              <span className="text-[14px] text-muted">PDF, JPG or PNG</span>
            </span>
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(ev) => setProof(ev.target.files?.[0]?.name ?? null)} />
          </label>
          {e.hasProof && <p className="text-[14px] text-danger">{e.hasProof}</p>}
        </Section>

        <Section id="you" title="Your details" intro="Your number is shown only to tenants on a paid plan, a few a day at most. Brokers who slip through get reported and removed.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" error={e.ownerName}>
              <input name="ownerName" required autoComplete="name" className={input} aria-invalid={!!e.ownerName} />
            </Field>
            <Field label="Mobile number" error={e.ownerPhone}>
              <span className="flex h-11 items-center rounded-lg border border-hairline focus-within:border-indigo">
                <span className="px-3 text-muted tabular-nums">+91</span>
                <input
                  name="ownerPhone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  required
                  pattern="[6-9][0-9]{9}"
                  maxLength={10}
                  title="A 10-digit Indian mobile number"
                  className="h-full min-w-0 flex-1 bg-transparent pr-3 tabular-nums focus-visible:outline-none"
                  aria-invalid={!!e.ownerPhone}
                />
              </span>
            </Field>
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-8">
          <button
            type="submit"
            disabled={pending}
            className="h-12 cursor-pointer rounded-full bg-indigo px-8 font-semibold text-canvas transition-[background-color,transform] duration-150 hover:bg-indigo-deep active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? "Sending…" : "Send for review"}
          </button>
          <p className="text-[14px] text-muted">Free. A person reviews every listing before it goes live.</p>
        </div>
      </form>
    </div>
  );
}
