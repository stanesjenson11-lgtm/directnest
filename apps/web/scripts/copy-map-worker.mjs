// MapLibre finds its worker next to its own bundle, which Turbopack renames. Serve it from /public instead.
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";

const src = createRequire(import.meta.url).resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
copyFileSync(src, new URL("../public/maplibre-gl-worker.mjs", import.meta.url));
