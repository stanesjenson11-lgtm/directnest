import Link from "next/link";
import { Story } from "./story";
import { DeviceDemo } from "./device-demo";
import { FloorPlan, GateBoard, KeyRing, Rocket, Sky, Skyline, VerifiedStamp } from "./scenery";

const CITIES = ["Bengaluru", "Mumbai", "Pune", "Hyderabad", "Chennai", "Delhi NCR"];

// [label, left%, top%] inside the floor plan (600 × 420 viewBox)
const TAGS: [string, number, number][] = [
  ["2 BHK", 17, 21],
  ["Semi-furnished", 22, 43],
  ["East-facing", 70, 16],
  ["Pet-friendly", 69, 62],
  ["Metro 400 m", 14, 70],
  ["Lift and power backup", 70, 84],
];

// Exits high on the left so the trail never crosses the beat-1 headline.
const FLIGHT = "M1760 640 C1320 560 1120 150 780 200 S300 40 -260 110";

function SearchForm() {
  return (
    <form action="/search" method="get" role="search" className="mt-8 w-full max-w-xl">
      <fieldset className="mb-3 flex gap-1">
        <legend className="sr-only">Looking to</legend>
        {[
          ["rent", "Rent"],
          ["buy", "Buy"],
        ].map(([value, label], i) => (
          <label
            key={value}
            className="cursor-pointer rounded-full px-4 py-1.5 text-[15px] font-medium text-moonlight-dim transition-colors duration-200 ease-out-quint has-checked:bg-moonlight has-checked:text-dusk has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-streetlight"
          >
            <input type="radio" name="type" value={value} defaultChecked={i === 0} className="sr-only" />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-stretch gap-2 rounded-[28px] bg-canvas p-2 sm:flex-nowrap sm:rounded-full">
        <label htmlFor="city" className="sr-only">
          City
        </label>
        <select
          id="city"
          name="city"
          defaultValue="Bengaluru"
          className="h-12 w-full cursor-pointer rounded-full bg-surface px-4 text-[15px] font-medium text-ink sm:w-auto"
        >
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label htmlFor="q" className="sr-only">
          Locality, landmark or metro station
        </label>
        <input
          id="q"
          name="q"
          type="search"
          autoComplete="off"
          placeholder="Locality or landmark"
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-ink placeholder:text-muted focus-visible:outline-none"
        />
        <button
          type="submit"
          className="h-12 shrink-0 cursor-pointer rounded-full bg-streetlight px-6 font-semibold text-dusk transition-[transform,background-color] duration-150 ease-out-quint hover:bg-[oklch(0.86_0.14_82)] active:scale-[0.97]"
        >
          Search
        </button>
      </div>
    </form>
  );
}

export function Hero() {
  return (
    <Story>
      <div className="story-stage on-dusk text-moonlight">
        {/* Beat 0: the gate at dusk */}
        <section data-beat="0" className="beat overflow-hidden" aria-label="DirectNest">
          <Sky />
          <div className="skyline-wrap absolute inset-x-0 bottom-0 h-[24svh] lg:h-[30svh]">
            <Skyline />
          </div>
          <div className="hero-board absolute right-0 bottom-0 h-[36svh] translate-x-[8%] sm:h-[48svh] lg:right-[3%] lg:h-[84svh] lg:translate-x-0">
            <GateBoard className="h-full w-auto" />
          </div>
          <div className="hero-copy relative z-10 mx-auto max-w-[1440px] px-4 pt-28 sm:px-8 sm:pt-36 lg:px-14 lg:pt-[20svh]">
            <h1 className="t-display max-w-[14ch]">Rent straight from the owner.</h1>
            <p className="mt-5 max-w-[42ch] text-lg text-moonlight-dim">
              Every owner shows proof that the home is theirs, and a person on our team approves every listing. No
              brokerage, ever.
            </p>
            <SearchForm />
          </div>
        </section>

        {/* Beat 1: the broker's fee leaves */}
        <section data-beat="1" className="beat overflow-hidden" aria-labelledby="beat-fee">
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <path id="flight" d={FLIGHT} fill="none" />
            <path className="trail" d={FLIGHT} fill="none" stroke="var(--color-streetlight)" strokeWidth="16" strokeLinecap="round" opacity="0.16" />
            <path className="trail" d={FLIGHT} fill="none" stroke="var(--color-streetlight)" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
            <path className="trail-static" d="M1145 310 C1030 234 916 180 780 200" fill="none" stroke="var(--color-streetlight)" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
            <Rocket id="rocket" transform="translate(780 200) rotate(-8)" />
          </svg>
          <div className="beat-copy relative mx-auto flex min-h-svh max-w-[1440px] flex-col justify-end px-4 pb-[27svh] sm:px-8 lg:px-14 lg:pb-[32svh]">
            <h2 id="beat-fee" className="t-headline max-w-[18ch]">
              Keep the month&rsquo;s rent a broker would take.
            </h2>
            <p className="t-wide mt-5 text-[clamp(2.75rem,8vw,6rem)] leading-none font-semibold">
              <span data-counter className="text-streetlight tabular-nums">
                ₹45,000
              </span>{" "}
              <span className="block text-[0.42em] font-medium sm:inline">stays with you.</span>
            </p>
            <p className="mt-5 max-w-[46ch] text-moonlight-dim">
              That&rsquo;s one month&rsquo;s rent on a 2 BHK in Koramangala, the usual broker&rsquo;s fee. Here there&rsquo;s no
              broker between you and the owner.
            </p>
          </div>
        </section>

        {/* Beat 2: real home, real owner */}
        <section data-beat="2" className="beat" aria-labelledby="beat-owner">
          <div className="mx-auto grid min-h-svh max-w-[1440px] content-center items-center gap-10 px-4 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-14">
            <div className="beat-copy">
              <h2 id="beat-owner" className="t-headline max-w-[16ch]">
                Real owners, checked by real people.
              </h2>
              <p className="mt-5 max-w-[42ch] text-moonlight-dim">
                Before a home goes live, its owner uploads an electricity bill or property tax receipt, and someone on our
                team reviews the listing. Brokers don&rsquo;t get through.
              </p>
            </div>
            <div className="plan relative mx-auto aspect-[600/420] w-full max-w-[min(640px,calc((100svh-260px)*1.43))]">
              <FloorPlan />
              {TAGS.map(([label, left, top]) => (
                <span
                  key={label}
                  className="tag absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas px-3 py-1 text-[13px] font-medium whitespace-nowrap text-ink sm:text-[15px]"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  {label}
                </span>
              ))}
              <KeyRing id="keys" aria-hidden="true" className="absolute top-[86%] left-[40%] w-[13%]" />
              <VerifiedStamp
                id="stamp"
                role="img"
                aria-label="Owner verified"
                className="absolute top-[-9%] right-[-3%] w-[22%] -rotate-8"
              />
            </div>
          </div>
        </section>

        {/* Beat 3: the product */}
        <section data-beat="3" className="beat" aria-labelledby="beat-search">
          <div className="mx-auto flex min-h-svh max-w-[1440px] flex-col items-center px-4 pt-14 pb-6 sm:px-8 lg:px-14">
            <div className="beat-copy text-center">
              <h2 id="beat-search" className="t-headline mx-auto max-w-[20ch]">
                Search the way you actually hunt for a flat.
              </h2>
              <p className="mx-auto mt-4 hidden max-w-[56ch] text-moonlight-dim sm:block">
                Draw your own area on the map. See rent and maintenance as one number. Know when the owner last confirmed
                the home is still available.
              </p>
              <Link
                href="/search?city=Bengaluru&type=rent"
                className="mt-5 inline-flex h-12 items-center rounded-full bg-streetlight px-6 font-semibold text-dusk transition-colors duration-150 ease-out-quint hover:bg-[oklch(0.86_0.14_82)]"
              >
                Search homes in Bengaluru
              </Link>
            </div>
            <div className="mt-6 flex w-full justify-center [perspective:1400px]">
              <DeviceDemo />
            </div>
          </div>
        </section>
      </div>
    </Story>
  );
}
