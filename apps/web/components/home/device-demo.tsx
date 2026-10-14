import Image from "next/image";
import { Wordmark } from "./scenery";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const unsplash = (id: string) => `https://images.unsplash.com/${id}?fit=crop&ar=4:3`;

// Illustrative rows for the product preview. Photos: Poojan Thanekar and Uppu Vamsi on Unsplash.
const rows = [
  {
    img: unsplash("photo-1745429523615-2a82c60bfc02"),
    rent: 45000,
    maintenance: 2500,
    deposit: 225000,
    title: "2 BHK in 5th Block, Koramangala",
    facts: ["1,150 sq ft", "Semi-furnished", "Floor 3 of 4"],
    confirmed: "Owner confirmed 2 days ago",
  },
  {
    img: unsplash("photo-1745429523635-ad375f836bf2"),
    rent: 38000,
    maintenance: 3000,
    deposit: 150000,
    title: "2 BHK near Sony World Signal",
    facts: ["980 sq ft", "Unfurnished", "Floor 2 of 5"],
    confirmed: "Owner confirmed today",
  },
  {
    img: unsplash("photo-1765775585873-868ae680fc26"),
    rent: 52000,
    maintenance: 4000,
    deposit: 300000,
    title: "3 BHK with a balcony garden, 8th Block",
    facts: ["1,420 sq ft", "Furnished", "Floor 4 of 4"],
    confirmed: "Owner confirmed 5 days ago",
  },
];

// Map pins: [label, left%, top%, active]
const pins: [string, number, number, boolean][] = [
  ["₹47.5k", 46, 44, true],
  ["₹41k", 30, 30, false],
  ["₹56k", 64, 26, false],
  ["₹35k", 22, 62, false],
  ["₹61k", 72, 58, false],
  ["₹44k", 52, 70, false],
];

function MapArt() {
  return (
    <svg viewBox="0 0 500 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <rect width="500" height="500" fill="oklch(0.965 0.01 130)" />
      <path d="M318 330 C 360 300 430 318 448 360 C 466 404 420 440 372 430 C 330 420 290 372 318 330 Z" fill="oklch(0.86 0.05 230)" />
      <path d="M40 60 h 110 v 70 h -110 Z M210 380 h 80 v 70 h -80 Z" fill="oklch(0.91 0.06 150)" />
      <g stroke="oklch(0.88 0.01 266)" strokeWidth="13" fill="none" strokeLinecap="round">
        <path d="M-10 190 C 120 170 260 210 520 160" />
        <path d="M180 -10 C 200 120 170 300 230 520" />
      </g>
      <g stroke="oklch(1 0 0)" fill="none" strokeLinecap="round">
        <path d="M-10 190 C 120 170 260 210 520 160" strokeWidth="10" />
        <path d="M180 -10 C 200 120 170 300 230 520" strokeWidth="10" />
        <path d="M-10 300 H 520 M 340 -10 V 300 M 60 190 V 520 M 420 -10 C 400 120 460 220 520 260" strokeWidth="5" />
        <path d="M100 100 H 300 M 240 250 H 440 M 110 400 H 300" strokeWidth="3" />
      </g>
      {/* Namma Metro purple line */}
      <path d="M-10 120 C 140 140 300 90 520 110" stroke="oklch(0.45 0.18 305)" strokeWidth="4" fill="none" />
      {[90, 250, 410].map((x, i) => (
        <circle key={x} cx={x} cy={[131, 118, 108][i]} r="5.5" fill="white" stroke="oklch(0.45 0.18 305)" strokeWidth="3" />
      ))}
      {/* The area the tenant drew */}
      <path
        d="M120 150 L 300 120 L 380 230 L 330 380 L 150 390 L 96 270 Z"
        fill="oklch(0.5 0.16 266 / 0.08)"
        stroke="var(--color-indigo)"
        strokeWidth="2.5"
        strokeDasharray="7 6"
        strokeLinejoin="round"
      />
      <text x="120" y="470" fill="oklch(0.5 0.02 266)" style={{ fontSize: 15 }}>
        Koramangala
      </text>
    </svg>
  );
}

export function DeviceDemo() {
  return (
    <div
      id="device"
      role="img"
      aria-label="Preview of DirectNest search: a map of Koramangala with an area drawn on it and price pins, beside listings that show rent plus maintenance, the deposit, and when the owner last confirmed."
      className="device mx-auto aspect-[4/5] w-[min(100%,calc((100svh-330px)*0.8))] min-w-[280px] rounded-[22px] bg-dusk-deep p-2 shadow-[0_40px_80px_-30px_oklch(0.1_0.05_266/0.7)] md:aspect-[16/10] md:w-[min(1080px,100%,calc((100svh-340px)*1.6))] md:min-w-[560px]"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[15px] bg-canvas text-ink">
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 text-[13px]">
          <Wordmark className="hidden scale-90 text-ink md:inline-flex" />
          <span className="flex-1 truncate rounded-full bg-surface px-4 py-1.5 text-muted md:mx-6">Koramangala, Bengaluru</span>
          <span className="hidden rounded-full bg-ink px-3 py-1.5 font-medium text-canvas sm:inline">Rent</span>
        </div>
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:grid-rows-1">
          <div className="order-2 flex min-h-0 flex-col md:order-1">
            <div className="hidden gap-2 overflow-hidden border-b border-hairline px-4 py-2.5 text-[12px] whitespace-nowrap md:flex">
              <span className="rounded-full border border-indigo px-3 py-1 font-medium text-indigo">Your drawn area</span>
              {["2 BHK", "Under ₹50,000", "Pet-friendly"].map((c) => (
                <span key={c} className="rounded-full border border-hairline px-3 py-1">
                  {c}
                </span>
              ))}
            </div>
            <ul className="min-h-0 flex-1 overflow-hidden">
              {rows.map((r, i) => (
                <li
                  key={r.title}
                  className={`demo-row gap-3 border-b border-hairline p-3 last:border-0 md:p-3.5 ${i === 0 ? "flex" : "hidden md:flex"}`}
                >
                  <div className="relative aspect-[4/3] w-[34%] max-w-[150px] shrink-0 overflow-hidden rounded-md bg-surface">
                    <Image src={r.img} alt="" fill sizes="150px" className="object-cover" />
                  </div>
                  <div className="min-w-0 text-[12px] leading-snug md:text-[13px]">
                    <p className="tabular-nums">
                      <span className="text-[17px] font-semibold md:text-[19px]">{inr.format(r.rent + r.maintenance)}</span>
                      <span className="text-muted"> /month</span>
                    </p>
                    <p className="text-muted tabular-nums">
                      {inr.format(r.rent)} rent + {inr.format(r.maintenance)} maintenance
                    </p>
                    <p className="text-muted tabular-nums">Deposit {inr.format(r.deposit)}</p>
                    <p className="mt-1 truncate font-medium">{r.title}</p>
                    <p className="hidden flex-wrap gap-x-3 text-muted xl:flex">
                      {r.facts.map((f) => (
                        <span key={f} className="whitespace-nowrap">
                          {f}
                        </span>
                      ))}
                    </p>
                    <span className="mt-1.5 inline-block rounded bg-verified-wash px-1.5 py-0.5 text-[11px] font-medium text-verified">
                      {r.confirmed}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative order-1 min-h-0 md:order-2">
            <MapArt />
            {pins.map(([label, left, top, active]) => (
              <span
                key={label}
                className={`absolute -translate-x-1/2 -translate-y-full ${active ? "z-10" : ""}`}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <span
                  className={`pin block rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${
                    active
                      ? "bg-streetlight text-dusk shadow-[0_6px_16px_-6px_oklch(0.22_0.025_266/0.45)]"
                      : "border border-hairline bg-canvas text-ink"
                  }`}
                >
                  {label}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
