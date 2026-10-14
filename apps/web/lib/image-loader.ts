// Images are resized at the source CDN, never by our 1-vCPU server.
// ponytail: Unsplash only for now; map R2 listing photos to their pre-built 480/960/1600 variants here when uploads exist.
export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (!src.startsWith("https://")) return src;
  const url = new URL(src);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality ?? 70));
  url.searchParams.set("auto", "format");
  return url.toString();
}
