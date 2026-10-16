import Image from "next/image";
import Link from "next/link";
import { Hero } from "@/components/home/hero";
import { Wordmark } from "@/components/home/scenery";
import { ScrollTouches } from "@/components/home/scroll-touches";
import { RENTALS } from "@/lib/search";

const STEPS = [
  {
    title: "Photograph each room on your phone",
    body: "We remove location data from every photo before it's stored.",
  },
  {
    title: "Show us the home is yours",
    body: "Upload an electricity bill or property tax receipt. Only our review team sees it, and we delete it 30 days after review.",
  },
  {
    title: "Go live once a person approves it",
    body: "Buyers then contact you directly. Your listing stays up for as long as you keep confirming it's available.",
  },
];

const SAFEGUARDS = [
  [
    "A person approves every listing",
    "Nothing goes live until someone on our team has checked the photos, the details and the owner's proof.",
  ],
  [
    "Repeat photos get flagged",
    "If the same photos turn up on another account, that listing goes to a reviewer before anyone sees it.",
  ],
  [
    "Listings expire after 30 days",
    "Unless the owner confirms the home is still available, it comes down on its own. No ghost listings.",
  ],
  [
    "Your number stays private",
    "We never share your phone number with owners or anyone else. You decide whom to call.",
  ],
];

const LOCALITIES = [
  "Koramangala",
  "HSR Layout",
  "Indiranagar",
  "Whitefield",
  "Bellandur",
  "Marathahalli",
  "Electronic City",
  "JP Nagar",
  "Jayanagar",
  "BTM Layout",
  "Hebbal",
  "Yelahanka",
];

function SiteHeader() {
  return (
    <header className="on-dusk absolute inset-x-0 top-0 z-20 text-moonlight">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-5 sm:px-8 lg:px-14">
        <Link href="/" aria-label="DirectNest home" className="rounded-md">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[15px] font-medium sm:gap-2">
          {RENTALS && (
            <Link href="/search?type=rent" className="hidden rounded-full px-3 py-2 text-moonlight-dim transition-colors hover:text-moonlight sm:inline-block">
              Rent
            </Link>
          )}
          <Link href="/search" className="hidden rounded-full px-3 py-2 text-moonlight-dim transition-colors hover:text-moonlight sm:inline-block">
            Buy
          </Link>
          <Link
            href="/post"
            className="rounded-full border border-moonlight/40 px-4 py-2 transition-colors duration-200 ease-out-quint hover:bg-moonlight hover:text-dusk"
          >
            Post your property
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <ScrollTouches />
      <main>
        <Hero />

        <section id="owners" aria-labelledby="owners-title" className="bg-canvas py-[clamp(96px,13vw,180px)]">
          <div className="mx-auto grid max-w-[1440px] gap-14 px-4 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-14">
            <div>
              <h2 id="owners-title" className="t-headline max-w-[15ch]">
                Post your home in three steps. Free for owners.
              </h2>
              <p className="mt-5 max-w-[46ch] text-muted">
                No listing fee and no broker calls. Buyers sign in with a verified phone number before they see yours.
              </p>
              <div className="relative mt-10 aspect-[4/3] overflow-hidden rounded-xl bg-surface">
                <div data-parallax className="absolute inset-x-0 -inset-y-[8%]">
                  <Image
                    src="https://images.unsplash.com/photo-1765775585873-868ae680fc26?fit=crop&ar=4:3"
                    alt="Hanging planters on a balcony behind an iron window grill, evening light outside."
                    fill
                    sizes="(min-width: 1024px) 45vw, 92vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
            <div className="self-center">
              <ol>
                {STEPS.map((s, i) => (
                  <li key={s.title} className="grid grid-cols-[3.5rem_1fr] gap-x-4 border-t border-hairline py-8 last:border-b sm:grid-cols-[4.5rem_1fr]">
                    <span aria-hidden="true" className="t-wide text-5xl leading-none font-medium text-indigo tabular-nums">
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold">{s.title}</h3>
                      <p className="mt-2 max-w-[44ch] text-muted">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/post"
                className="mt-10 inline-flex h-12 items-center rounded-full bg-indigo px-6 font-semibold text-canvas transition-[background-color,transform] duration-150 ease-out-quint hover:bg-indigo-deep active:scale-[0.97]"
              >
                Post your property
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="safeguards-title" className="bg-surface py-[clamp(96px,12vw,160px)]">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-14">
            <h2 id="safeguards-title" className="t-headline max-w-[20ch]">
              How we keep brokers out and listings real.
            </h2>
            <dl className="mt-12 grid gap-x-16 md:grid-cols-2">
              {SAFEGUARDS.map(([title, body]) => (
                <div key={title} className="border-t border-hairline py-7">
                  <dt className="text-xl font-semibold">{title}</dt>
                  <dd className="mt-2 max-w-[48ch] text-muted">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="localities-title" className="overflow-x-clip bg-canvas py-[clamp(96px,12vw,160px)]">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-14">
            <h2 id="localities-title" className="t-headline">
              Start with a neighbourhood in Bengaluru.
            </h2>
            {[LOCALITIES.slice(0, 6), LOCALITIES.slice(6)].map((row, i) => (
              <ul key={row[0]} data-drift={i === 0 ? 1 : -1} className="mt-6 flex max-w-5xl flex-wrap gap-x-8 gap-y-4 first-of-type:mt-10">
                {row.map((l) => (
                  <li key={l}>
                    <Link
                      href={`/search?city=Bengaluru&q=${encodeURIComponent(l)}`}
                      className="t-wide text-[clamp(1.5rem,3vw,2.25rem)] leading-tight font-medium decoration-indigo decoration-2 underline-offset-[0.2em] transition-colors hover:text-indigo hover:underline"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>
      </main>

      <footer className="on-dusk bg-dusk text-moonlight">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-4 py-16 sm:px-8 md:flex-row md:items-end md:justify-between lg:px-14">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-[36ch] text-moonlight-dim">Homes from verified owners, across India.</p>
          </div>
          <p className="text-sm text-moonlight-dim">© 2026 DirectNest</p>
        </div>
      </footer>
    </>
  );
}
