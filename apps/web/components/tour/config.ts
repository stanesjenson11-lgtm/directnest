// The tour is one master timeline measured in "ticks". Everything below is in ticks.
export const TOTAL = 110;

export type Stop = {
  id: string;
  rail: string; // label in the stop rail
  at: number; // where a click on the rail lands
  kicker?: string; // small script line above the title
  title: string;
  line: string;
  tone: "ink" | "paper"; // caption colour
};

// Each line names something the app really does (search, listing checks, photos and video, filters, shortlists, the map).
// ponytail: no prices, stats or addresses; the scene is an illustrative model.
export const STOPS: Stop[] = [
  { id: "sky", rail: "Skyline", at: 12, kicker: "Bengaluru", title: "From above, the city.", line: "Start with an area, a metro line or a project.", tone: "ink" },
  { id: "tower", rail: "Building", at: 27, kicker: "Verified", title: "Closer, one building.", line: "A person checks every listing before it goes live.", tone: "ink" },
  { id: "inside", rail: "Inside", at: 58, kicker: "Living room", title: "Inside, room by room.", line: "Photos and video tours before you visit.", tone: "ink" },
  { id: "plan", rail: "Plan", at: 76, kicker: "Floor plan", title: "The same home, from above.", line: "Every room, seen from above.", tone: "ink" },
  { id: "hood", rail: "Neighbourhood", at: 90, kicker: "Neighbourhood", title: "Then the neighbourhood.", line: "Schools, hospitals and the metro, on the map.", tone: "ink" },
  { id: "close", rail: "Evening", at: 109, title: "", line: "", tone: "paper" },
];

// Where the nav and rail switch between ink and white, in ticks.
export const TONE_BREAKS: [number, "ink" | "paper"][] = [
  [0, "ink"],
  [100, "paper"],
];
