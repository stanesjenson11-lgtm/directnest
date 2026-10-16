import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/account-nav";
import { Wordmark } from "@/components/home/scenery";
import { RENTALS } from "@/lib/search";

// Daylight header for product pages (search, listing, post). Fixed 64px so pages can size against it.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" aria-label="DirectNest home" className="shrink-0 rounded-md text-ink">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[15px] font-medium whitespace-nowrap">
          {RENTALS && (
            <Link href="/search?type=rent" className="hidden rounded-full px-3 py-2 text-muted transition-colors hover:text-ink md:inline-block">
              Rent
            </Link>
          )}
          <Link href="/search" className="hidden rounded-full px-3 py-2 text-muted transition-colors hover:text-ink md:inline-block">
            Buy
          </Link>
          <Suspense fallback={<span className="inline-block w-16" />}>
            <AccountNav />
          </Suspense>
          <Link
            href="/post"
            className="ml-1 rounded-full border border-indigo px-4 py-2 text-indigo transition-colors duration-150 ease-out-quint hover:bg-indigo hover:text-canvas"
          >
            <span className="sm:hidden">Post</span>
            <span className="hidden sm:inline">Post your property</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
