import type { SVGProps } from "react";

/* Hand-built SVG scenery for the homepage story. Server components: no JS shipped. */

const BACK = "oklch(0.33 0.075 272)";
const FRONT = "oklch(0.2 0.055 266)";
const IRON = "oklch(0.16 0.04 266)";
const WARM_WINDOW = "oklch(0.82 0.13 78)";
const TUBE_WINDOW = "oklch(0.9 0.04 200)";

// Deterministic PRNG so server output is stable between builds.
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Building = {
  x: number;
  w: number;
  h: number;
  tank?: number;
  mumty?: number;
  windows: { x: number; y: number; warm: boolean; o: number }[];
};

function buildings(
  seed: number,
  o: { minW: number; maxW: number; minH: number; maxH: number; lit: number; gap: number },
) {
  const r = rng(seed);
  const list: Building[] = [];
  for (let x = -30; x < 1630; ) {
    const w = Math.round(o.minW + r() * (o.maxW - o.minW));
    const h = Math.round(o.minH + r() * (o.maxH - o.minH));
    const windows: Building["windows"] = [];
    for (let wy = 360 - h + 18; wy < 340; wy += 24)
      for (let wx = x + 12; wx < x + w - 16; wx += 20)
        if (r() < o.lit) windows.push({ x: wx, y: wy, warm: r() < 0.65, o: 0.5 + r() * 0.45 });
    list.push({
      x,
      w,
      h,
      tank: r() < 0.6 ? Math.round(x + 10 + r() * (w - 44)) : undefined,
      mumty: r() < 0.35 ? Math.round(x + 8 + r() * (w - 50)) : undefined,
      windows,
    });
    x += w + Math.round(r() * o.gap);
  }
  return list;
}

const back = buildings(7, { minW: 70, maxW: 150, minH: 140, maxH: 260, lit: 0.1, gap: 10 });
const front = buildings(23, { minW: 90, maxW: 190, minH: 70, maxH: 160, lit: 0.2, gap: 26 });

// Coconut palm: fronds are filled leaves that arch up, then droop to the tip.
function Palm({ x }: { x: number }) {
  const t = { x: x + 14, y: 212 };
  const f = (n: number) => n.toFixed(1);
  const fronds = [-172, -146, -116, -64, -34, -8].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const tip = { x: t.x + Math.cos(a) * 64, y: t.y + Math.sin(a) * 30 + 30 };
    const c = { x: t.x + Math.cos(a) * 36, y: t.y + Math.sin(a) * 34 - 18 };
    return `M${t.x} ${t.y} Q${f(c.x)} ${f(c.y)} ${f(tip.x)} ${f(tip.y)} Q${f(c.x)} ${f(c.y + 14)} ${t.x} ${t.y + 4} Z`;
  });
  return (
    <g fill={FRONT}>
      <path d={`M${x} 360 C${x + 7} 300 ${x + 1} 262 ${t.x} ${t.y}`} stroke={FRONT} strokeWidth={7} fill="none" strokeLinecap="round" />
      {fronds.map((d) => (
        <path key={d} d={d} />
      ))}
      <circle cx={t.x - 4} cy={t.y + 8} r={4} />
      <circle cx={t.x + 4} cy={t.y + 9} r={4} />
    </g>
  );
}

function Lamp({ x, delay }: { x: number; delay: number }) {
  return (
    <g>
      <circle
        cx={x + 20}
        cy={252}
        r={54}
        fill="url(#lamp-glow)"
        className="lamp-glow"
        style={{ animationDelay: `${delay}s` }}
      />
      <path d={`M${x} 360 V256 Q${x + 2} 246 ${x + 20} 247`} stroke={FRONT} strokeWidth={4} fill="none" />
      <rect x={x + 13} y={246} width={15} height={6} rx={2} fill={FRONT} />
      <rect x={x + 15} y={251} width={11} height={3} rx={1.5} fill="oklch(0.9 0.12 85)" />
    </g>
  );
}

export function Skyline() {
  return (
    <svg
      viewBox="0 0 1600 360"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="lamp-glow">
          <stop offset="0" stopColor="oklch(0.85 0.14 80)" stopOpacity="0.55" />
          <stop offset="1" stopColor="oklch(0.85 0.14 80)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Back layer: towers, a mobile tower */}
      <g fill={BACK}>
        {back.map((b) => (
          <rect key={b.x} x={b.x} y={360 - b.h} width={b.w} height={b.h} />
        ))}
      </g>
      <g stroke={BACK} strokeWidth={2.5} fill="none">
        <path d="M1163 360 L1180 52 L1197 360 M1166 330 L1194 296 L1169 262 L1191 228 L1172 194 L1188 160 L1175 126 L1185 92" />
        <rect x={1170} y={70} width={6} height={22} fill={BACK} />
        <rect x={1184} y={78} width={6} height={22} fill={BACK} />
      </g>
      <circle cx={1180} cy={48} r={3.5} fill="oklch(0.6 0.2 27)" className="tower-light" />
      <g>
        {back.flatMap((b) =>
          b.windows.map((w) => (
            <rect
              key={`${w.x}-${w.y}`}
              x={w.x}
              y={w.y}
              width={7}
              height={10}
              fill={w.warm ? WARM_WINDOW : TUBE_WINDOW}
              opacity={w.o * 0.5}
            />
          )),
        )}
      </g>

      {/* Front layer: low-rise homes with water tanks and stair rooms */}
      <g fill={FRONT}>
        {front.map((b) => (
          <g key={b.x}>
            <rect x={b.x} y={360 - b.h} width={b.w} height={b.h} />
            <rect x={b.x - 3} y={360 - b.h - 3} width={b.w + 6} height={4} />
            {b.mumty !== undefined && <rect x={b.mumty} y={360 - b.h - 26} width={36} height={26} />}
            {b.tank !== undefined && (
              <g>
                <rect x={b.tank} y={360 - b.h - 24} width={26} height={21} rx={3} />
                <ellipse cx={b.tank + 13} cy={360 - b.h - 24} rx={13} ry={4.5} />
                <rect x={b.tank + 9} y={360 - b.h - 31} width={8} height={5} rx={1.5} />
              </g>
            )}
          </g>
        ))}
        {/* Neem tree */}
        <rect x={642} y={300} width={9} height={60} />
        {[
          [620, 302, 32],
          [650, 284, 34],
          [684, 304, 30],
          [604, 322, 24],
          [664, 322, 28],
        ].map(([cx, cy, r]) => (
          <circle key={cx} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <Palm x={214} />
      <Palm x={944} />
      <Palm x={1462} />
      <g>
        {front.flatMap((b) =>
          b.windows.map((w) => (
            <rect
              key={`${w.x}-${w.y}`}
              x={w.x}
              y={w.y}
              width={8}
              height={11}
              rx={1}
              fill={w.warm ? WARM_WINDOW : TUBE_WINDOW}
              opacity={w.o}
            />
          )),
        )}
      </g>
      <Lamp x={110} delay={0.6} />
      <Lamp x={530} delay={0.9} />
      <Lamp x={1060} delay={1.2} />
      <Lamp x={1370} delay={1.5} />
    </svg>
  );
}

export function Sky() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Crescent moon */}
      <svg className="sky-prop absolute top-[13%] right-[30%] hidden h-14 w-14 sm:block lg:top-[16%] lg:right-[44%]" viewBox="0 0 56 56">
        <defs>
          <mask id="crescent">
            <rect width="56" height="56" fill="white" />
            <circle cx="36" cy="22" r="20" fill="black" />
          </mask>
        </defs>
        <circle cx="28" cy="28" r="20" fill="oklch(0.95 0.03 95)" mask="url(#crescent)" />
      </svg>
      {/* A kite that got away */}
      <svg className="sky-prop kite absolute top-[24%] left-[58%] hidden h-16 w-12 sm:block" viewBox="0 0 48 64">
        <path d="M24 2 L44 24 L24 46 L4 24 Z" fill="oklch(0.62 0.17 20)" />
        <path d="M24 2 V46 M4 24 H44" stroke="oklch(0.3 0.06 20)" strokeWidth="1.2" />
        <path d="M24 46 q -4 6 0 9 q 4 3 0 8" stroke="oklch(0.85 0.04 266)" strokeWidth="1.2" fill="none" />
      </svg>
      {/* Birds heading home, right to left */}
      <svg className="birds absolute top-[9%] left-0 h-10 w-36" viewBox="0 0 144 40">
        {[
          [10, 18],
          [36, 8],
          [58, 22],
          [88, 12],
        ].map(([x, y]) => (
          <path
            key={x}
            className="bird"
            d={`M${x} ${y} q 7 -7 14 0 q 7 -7 14 0`}
            stroke="oklch(0.16 0.04 266)"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </svg>
    </div>
  );
}

/* The gate, with the TO-LET board tied to its bars. */
export function GateBoard({ className }: { className?: string }) {
  const bars = Array.from({ length: 13 }, (_, i) => 88 + i * 30);
  return (
    <svg
      viewBox="0 0 460 600"
      className={className}
      role="img"
      aria-label="A hand-painted TO-LET board tied to a gate: 2 BHK, brokers please excuse."
    >
      <defs>
        <radialGradient id="gate-light">
          <stop offset="0" stopColor="oklch(0.9 0.12 85)" stopOpacity="0.6" />
          <stop offset="1" stopColor="oklch(0.9 0.12 85)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Pillar with its gate light */}
      <circle cx="32" cy="40" r="44" fill="url(#gate-light)" className="lamp-glow" style={{ animationDelay: "0.3s" }} />
      <circle cx="32" cy="42" r="13" fill="oklch(0.93 0.07 90)" />
      <rect x="25" y="54" width="14" height="6" fill={IRON} />
      <rect x="-6" y="60" width="76" height="16" rx="2" fill={IRON} />
      <rect x="0" y="76" width="64" height="524" fill="oklch(0.22 0.05 266)" />
      <rect x="0" y="76" width="64" height="524" fill="none" stroke="oklch(0.3 0.06 266)" strokeWidth="1" />
      {/* Gate bars */}
      <g stroke={IRON} strokeWidth="5">
        {bars.map((x) => (
          <line key={x} x1={x} y1="122" x2={x} y2="600" />
        ))}
        <line x1="64" y1="150" x2="470" y2="150" strokeWidth="7" />
        <line x1="64" y1="560" x2="470" y2="560" strokeWidth="7" />
        <line x1="64" y1="520" x2="470" y2="520" strokeWidth="4" />
      </g>
      <g fill={IRON}>
        {bars.map((x) => (
          <path key={x} d={`M${x - 6} 126 L${x} 104 L${x + 6} 126 Z`} />
        ))}
      </g>
      {/* The board */}
      <g className="board-swing" style={{ transformOrigin: "250px 178px", transformBox: "view-box" }}>
        <path d="M128 200 C 120 186 132 176 142 182 M372 200 C 380 186 368 176 358 182" stroke="oklch(0.62 0.03 266)" strokeWidth="2.2" fill="none" />
        <rect x="100" y="196" width="300" height="198" rx="10" fill="var(--color-board-enamel)" />
        <rect x="112" y="208" width="276" height="174" rx="6" fill="none" stroke="var(--color-board-paint)" strokeWidth="3" />
        <text
          x="250"
          y="290"
          textAnchor="middle"
          fill="var(--color-board-paint)"
          style={{ fontFamily: "var(--font-anek)", fontWeight: 800, fontSize: 86, fontVariationSettings: '"wdth" 75', letterSpacing: 3 }}
        >
          TO-LET
        </text>
        <text
          x="250"
          y="330"
          textAnchor="middle"
          fill="var(--color-board-paint)"
          style={{ fontFamily: "var(--font-anek)", fontWeight: 700, fontSize: 30, fontVariationSettings: '"wdth" 90' }}
        >
          2 BHK
        </text>
        <text
          x="250"
          y="366"
          textAnchor="middle"
          fill="oklch(0.3 0.08 266)"
          style={{ fontFamily: "var(--font-kalam)", fontSize: 24 }}
        >
          Brokers please excuse.
        </text>
      </g>
    </svg>
  );
}

/* Rocket pointing left. Local origin (0,0) is the nozzle, so it rides the flight path tail-first. */
export function Rocket(props: SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      {/* The broker's slip, dangling from a fin */}
      <path d="M-4 34 Q 30 74 70 68" stroke="var(--color-moonlight-dim)" strokeWidth="1.5" fill="none" />
      <g transform="translate(66 52) rotate(5)">
        <rect width="132" height="52" rx="3" fill="var(--color-board-enamel)" />
        <text x="12" y="21" fill="var(--color-ink)" style={{ fontFamily: "var(--font-kalam)", fontSize: 15 }}>
          Brokerage
        </text>
        <text
          x="12"
          y="43"
          fill="var(--color-board-paint)"
          style={{ fontFamily: "var(--font-anek)", fontWeight: 700, fontSize: 21, fontVariantNumeric: "tabular-nums" }}
        >
          ₹45,000
        </text>
      </g>
      <g className="rocket-flame">
        <path d="M1 -9 C 22 -12 42 -5 64 0 C 42 5 22 12 1 9 Z" fill="var(--color-streetlight)" />
        <path d="M1 -5 C 14 -6 28 -3 40 0 C 28 3 14 6 1 5 Z" fill="oklch(0.96 0.06 95)" />
      </g>
      <rect x="-6" y="-10" width="7" height="20" rx="1.5" fill="var(--color-dusk-deep)" />
      <path d="M-32 -18 L-10 -37 L-2 -37 L-6 -16 Z M-32 18 L-10 37 L-2 37 L-6 16 Z" fill="var(--color-board-paint)" />
      <path
        d="M-124 0 C-112 -16 -82 -22 -42 -20 L-6 -16 L-6 16 L-42 20 C-82 22 -112 16 -124 0 Z"
        fill="var(--color-moonlight)"
        stroke="var(--color-dusk-deep)"
        strokeWidth="2"
      />
      <path d="M-124 0 C-116 -11 -106 -16 -96 -18 L-96 18 C-106 16 -116 11 -124 0 Z" fill="var(--color-board-paint)" />
      <circle cx="-68" cy="0" r="8.5" fill="var(--color-indigo)" stroke="var(--color-streetlight)" strokeWidth="2.5" />
      <path d="M-72 -4 a 5 5 0 0 1 5 -2" stroke="oklch(0.9 0.04 266)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </g>
  );
}

/* A 2 BHK floor plan, walls drawn as separate paths so they can be traced. */
export function FloorPlan() {
  const walls = [
    "M310 400 H580 V20 H60 V400 H250", // outer, with the main-door gap
    "M340 20 V150",
    "M340 210 V400",
    "M340 210 H420",
    "M480 210 H580",
    "M60 260 H140",
    "M200 260 V400",
    "M60 120 H26 V250 H60", // balcony rail
  ];
  const doors = ["M340 150 A 60 60 0 0 1 400 210", "M420 210 A 60 60 0 0 0 480 270", "M140 260 A 60 60 0 0 1 200 320", "M250 400 A 60 60 0 0 1 310 340"];
  const labels: [string, number, number][] = [
    ["Living", 190, 140],
    ["Bedroom", 460, 100],
    ["Bedroom", 460, 320],
    ["Kitchen", 112, 344],
  ];
  return (
    <svg viewBox="0 0 600 420" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <g fill="none" stroke="var(--color-moonlight)" strokeLinecap="round" strokeLinejoin="round">
        {walls.map((d) => (
          <path key={d} className="wall" d={d} strokeWidth={d.startsWith("M60 120") ? 2 : 4} />
        ))}
        {doors.map((d) => (
          <path key={d} className="wall" d={d} strokeWidth={1.5} strokeDasharray="4 5" opacity={0.6} />
        ))}
      </g>
      {labels.map(([t, x, y]) => (
        <text key={`${t}${y}`} x={x} y={y} textAnchor="middle" fill="var(--color-moonlight-dim)" style={{ fontSize: 15 }}>
          {t}
        </text>
      ))}
    </svg>
  );
}

export function VerifiedStamp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 120" {...props}>
      <defs>
        <path id="stamp-ring" d="M60 60 m -40 0 a 40 40 0 1 1 80 0 a 40 40 0 1 1 -80 0" />
      </defs>
      <circle cx="60" cy="60" r="56" fill="var(--color-verified-wash)" />
      <circle cx="60" cy="60" r="51" fill="none" stroke="var(--color-verified)" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="29" fill="none" stroke="var(--color-verified)" strokeWidth="1.5" />
      <text fill="var(--color-verified)" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 2.2 }}>
        <textPath href="#stamp-ring">OWNER VERIFIED · OWNER VERIFIED ·</textPath>
      </text>
      <path d="M48 61 L57 70 L74 51" stroke="var(--color-verified)" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KeyRing(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 90 70" {...props}>
      <circle cx="22" cy="22" r="15" fill="none" stroke="var(--color-moonlight-dim)" strokeWidth="3" />
      <g fill="var(--color-streetlight)">
        <circle cx="36" cy="34" r="11" />
        <path d="M44 38 L84 52 L82 58 L76 56 L74 62 L68 60 L70 54 L42 44 Z" />
      </g>
      <circle cx="36" cy="34" r="4" fill="var(--color-dusk)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
        <path d="M3 13 L14 4 L25 13 M6.5 10.5 V24 H21.5 V10.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="15.5" r="2.6" fill="currentColor" />
        <path d="M12.7 17 L12 21 H16 L15.3 17 Z" fill="currentColor" />
      </svg>
      <span className="t-wide text-xl font-semibold tracking-tight">DirectNest</span>
    </span>
  );
}
