import Link from "next/link";
import { Wordmark } from "@/components/home/scenery";

// Daylight header for product pages (search, listing, post). Fixed 64px so pages can size against it.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="DirectNest home" className="rounded-md text-ink">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[15px] font-medium">
          <Link href="/search?type=rent" className="hidden rounded-full px-3 py-2 text-muted transition-colors hover:text-ink sm:inline-block">
            Rent
          </Link>
          <Link href="/search?type=buy" className="hidden rounded-full px-3 py-2 text-muted transition-colors hover:text-ink sm:inline-block">
            Buy
          </Link>
          <Link
            href="/post"
            className="ml-1 rounded-full border border-indigo px-4 py-2 text-indigo transition-colors duration-150 ease-out-quint hover:bg-indigo hover:text-canvas"
          >
            Post your property
          </Link>
        </nav>
      </div>
    </header>
  );
}
