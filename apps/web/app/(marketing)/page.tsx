import Tour from "@/components/tour/Tour";
import { Logo } from "@/components/brand/Logo";

export default function Home() {
  return (
    <main id="top" className="gharaana">
      <Tour />
      <footer className="foot">
        <Logo tone="white" className="foot__logo" />
        <p>The neighbourhood, homes and markers in this tour are an illustrative 3D model of a Bengaluru-style area, not real listings or locations. Earth imagery: NASA. Borders: Natural Earth.</p>
      </footer>
    </main>
  );
}
