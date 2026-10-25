/* The floor-plan card over the last frame of the villa film: the same villa (apps/web/film/house.py), drawn to scale,
   ground and first floor side by side. Illustrative, not a listing. */

type Room = { name: string; x0: number; y0: number; x1: number; y1: number; tint?: boolean };

// metres, the villa's own axes: x across the front (-6.86 .. 6.88), y from the front (0) to the back (13)
const GROUND: Room[] = [
  { name: "Living hall", x0: -6.86, y0: 0.55, x1: -2.33, y1: 6.5, tint: true },
  { name: "Foyer", x0: -2.33, y0: 1.6, x1: 0.15, y1: 4.5 },
  { name: "Garage", x0: 0.15, y0: 0.3, x1: 6.88, y1: 6.0 },
  { name: "Kitchen and dining", x0: -6.86, y0: 6.5, x1: -1.0, y1: 13 },
  { name: "Stair", x0: -1.0, y0: 4.5, x1: 1.6, y1: 9.0 },
  { name: "Bath", x0: -1.0, y0: 9.0, x1: 1.6, y1: 13 },
  { name: "Guest bedroom", x0: 1.6, y0: 6.0, x1: 6.88, y1: 13 },
];
const FIRST: Room[] = [
  { name: "Bedroom", x0: -6.23, y0: 0, x1: -2.29, y1: 6.0 },
  { name: "Lounge", x0: -2.29, y0: 1.6, x1: 0.15, y1: 6.0 },
  { name: "Master bedroom", x0: 0.15, y0: 0, x1: 5.95, y1: 6.5, tint: true },
  { name: "Bath", x0: -6.23, y0: 6.0, x1: -3.8, y1: 9.0 },
  { name: "Stair", x0: -3.8, y0: 6.0, x1: -1.0, y1: 9.0 },
  { name: "Bedroom", x0: -6.23, y0: 9.0, x1: -1.0, y1: 13 },
  { name: "Walk-in", x0: 0.15, y0: 6.5, x1: 2.8, y1: 10 },
  { name: "Master bath", x0: 2.8, y0: 6.5, x1: 5.95, y1: 10, tint: true },
  { name: "Landing", x0: -1.0, y0: 6.0, x1: 0.15, y1: 10 },
  { name: "Study", x0: -1.0, y0: 10, x1: 5.95, y1: 13 },
];
// the balconies on the first floor's front (dashed: open to the sky)
const BALCONIES = [{ x0: -2.29, y0: 0, x1: 0.15, y1: 1.6 }, { x0: 0.15, y0: -0.25, x1: 7.25, y1: 0 }];

const S = 20; // svg units per metre
const X = (x: number) => (x + 7.4) * S;
const Y = (y: number) => (13.6 - y) * S; // the front at the bottom of the drawing

function Floor({ rooms, label, balconies }: { rooms: Room[]; label: string; balconies?: typeof BALCONIES }) {
  return (
    <g>
      {balconies?.map((b, i) => (
        <rect key={i} x={X(b.x0)} y={Y(b.y1)} width={(b.x1 - b.x0) * S} height={(b.y1 - b.y0) * S} className="plan__open" />
      ))}
      {rooms.map((r, i) => (
        <rect key={i} x={X(r.x0)} y={Y(r.y1)} width={(r.x1 - r.x0) * S} height={(r.y1 - r.y0) * S}
          className={r.tint ? "plan__room plan__room--seen" : "plan__room"} />
      ))}
      {rooms.map((r, i) => {
        const w = (r.x1 - r.x0) * S;
        return w > 52 ? (
          <text key={i} x={X((r.x0 + r.x1) / 2)} y={Y((r.y0 + r.y1) / 2)} className="plan__label" textAnchor="middle" dominantBaseline="middle">
            {r.name}
          </text>
        ) : null;
      })}
      <text x={X(-6.86)} y={Y(-1.6)} className="plan__floor">{label}</text>
    </g>
  );
}

export function PlanCard() {
  return (
    <div className="plan" data-plan>
      <div className="plan__card">
        <div className="plan__spec">
          <h2 className="plan__title">The plan.</h2>
          <p className="plan__kind">A four-bedroom villa on two floors.</p>
          <dl className="plan__rooms">
            <dt>Ground floor</dt>
            <dd>Living hall, kitchen and dining, a guest bedroom, the garage</dd>
            <dt>First floor</dt>
            <dd>Master bedroom with its bath, two bedrooms, a lounge, two balconies</dd>
          </dl>
          <p className="plan__note">An illustrative home, not a listing.</p>
          <a className="btn btn--sun plan__cta" href="/search?type=buy&amp;q=villa">Find villas</a>
        </div>
        <svg className="plan__svg" viewBox={`0 0 ${2 * 15 * S + 20} ${15.6 * S}`} role="img" aria-labelledby="plan-svg-title">
          <title id="plan-svg-title">Floor plans of the villa: ground floor and first floor</title>
          <Floor rooms={GROUND} label="Ground floor" />
          <g transform={`translate(${15 * S + 20} 0)`}>
            <Floor rooms={FIRST} label="First floor" balconies={BALCONIES} />
          </g>
        </svg>
      </div>
    </div>
  );
}
