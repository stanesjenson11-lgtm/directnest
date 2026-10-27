import { test } from "node:test";
import assert from "node:assert/strict";
import { HANDOFF, REF_H, RISE, altitudeAt, cameraAt, lin, skyCamera } from "./config.ts";

const rad = (d: number) => (d * Math.PI) / 180;

test("during the dissolve, the globe's horizon is where the clouds' is", () => {
  for (let t = HANDOFF[0]; t < HANDOFF[1]; t += 1) {
    // the clouds: their horizon's angle above the middle of the view
    const { alt, pitch, radius, fov } = skyCamera(lin(RISE, t));
    const clouds = -Math.atan(Math.sqrt((2 * (alt - 0.9)) / radius)) - pitch;
    // the globe, placed as MapLibre places it: the map's centre on a sphere, the camera pitched back from it
    const cam = cameraAt(t);
    assert.equal(cam.fov, (360 / Math.PI) * Math.atan(fov));
    const R = (512 * 2 ** cam.zoom) / (2 * Math.PI), d = (0.5 * REF_H) / Math.tan(rad(cam.fov) / 2);
    const eye = [-d * Math.sin(rad(cam.pitch)), R + d * Math.cos(rad(cam.pitch))];
    const D = Math.hypot(eye[0], eye[1]);
    const view = Math.atan2(R - eye[1], -eye[0]); // towards the map's centre
    const horizon = Math.atan2(-eye[1], -eye[0]) + Math.asin(R / D); // the globe's edge, seen from the camera
    assert.ok(Math.abs(horizon - view - clouds) < 1e-9, `tick ${t}: ${horizon - view} vs ${clouds}`);
  }
});

test("the camera runs on without a jump as the clouds leave, and climbs to the whole Earth", () => {
  const [a, b] = [cameraAt(HANDOFF[1] - 1e-6), cameraAt(HANDOFF[1] + 1e-6)];
  for (const k of ["zoom", "pitch", "fov", "bearing"] as const) assert.ok(Math.abs(a[k] - b[k]) < 1e-3, k);
  let last = 0;
  for (let t = 0; t <= 36; t++) {
    const km = altitudeAt(t);
    assert.ok(km >= last - 1e-6, `tick ${t}`);
    last = km;
  }
  assert.ok(altitudeAt(0) > 5 && altitudeAt(0) < 30 && altitudeAt(36) > 15000);
});
