import Tour from "@/components/tour/Tour";
import { Logo } from "@/components/brand/Logo";

export default function Home() {
  return (
    <main id="top" className="gharaana">
      <Tour />
      <footer className="foot">
        <Logo tone="white" className="foot__logo" />
        <p>The clouds are drawn live and the Earth is NASA&rsquo;s imagery. The map is live too: its pins are real homes, each at its owner&rsquo;s asking price.</p>
      </footer>
    </main>
  );
}
