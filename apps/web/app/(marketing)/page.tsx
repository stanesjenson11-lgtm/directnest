import Tour from "@/components/tour/Tour";
import { Logo } from "@/components/brand/Logo";

export default function Home() {
  return (
    <main id="top" className="gharaana">
      <Tour />
      <footer className="foot">
        <Logo tone="white" className="foot__logo" />
        <p>The opening film is AI-generated. The map after it is live: its pins are real homes, each at its owner&rsquo;s asking price.</p>
      </footer>
    </main>
  );
}
