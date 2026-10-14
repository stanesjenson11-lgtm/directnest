const inrFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹45,000 · ₹2,25,000 (Indian digit grouping). */
export const inr = (n: number) => inrFormat.format(n);

/** Compact Indian price: ₹47.5k, ₹85 L, ₹1.45 Cr. */
export function inrShort(n: number) {
  const trim = (x: number) => String(Number(x.toFixed(2)));
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  if (n >= 1e3) return `₹${trim(n / 1e3)}k`;
  return `₹${n}`;
}

export const sqft = (n: number) => `${n.toLocaleString("en-IN")} sq ft`;

export const bhkLabel = (bhk: number) => (bhk === 0 ? "1 RK" : `${bhk} BHK`);

export function daysAgo(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export function distance(m: number) {
  return m < 1000 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1)} km`;
}
