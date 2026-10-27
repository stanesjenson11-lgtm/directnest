// The hero's opening, drawn live on the GPU: dawn over a sea of cloud, then the camera rising out of it until the clouds
// curve away into a planet with a thin blue rim in black space (where the live globe, map.ts, takes over). One fragment
// shader over the whole canvas, raymarching a layer of cloud made of noise; drawn small and scaled up (cloud is soft).

import { skyCamera } from "./config";

// uRise: 0 just over the cloud tops .. 1 the edge of space. uCam: the camera at that rise (config.ts skyCamera: height,
// pitch, the cloud sea's radius, field of view). uTime: seconds, the wind's drift.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uRise;
uniform vec4 uCam;

const vec3 SUN = vec3(0.4749, 0.0523, 0.8784); // just up, right of the view

float hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 p, int oct) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    v += a * noise(p);
    p = p * 2.02 + vec3(0.17, 0.31, 0.43);
    a *= 0.5;
  }
  return v;
}
// the cloud layer: y 0..1, flat bases, billowing tops; the wind blows the field towards the camera
float density(vec3 p, int oct) {
  vec3 q = p + vec3(uTime * 0.02, 0.0, -uTime * 0.06);
  // billows, and over them slow, wide cloud systems with clear sky between (as the Earth looks from orbit)
  float n = fbm(q * vec3(0.38, 0.8, 0.38), oct) + 0.3 * (noise(q * vec3(0.035, 0.0, 0.035)) - 0.5);
  float h = clamp(p.y, 0.0, 1.0);
  float body = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.45, 1.0, h));
  // denser close to (the sea of cloud we wake over), more broken from orbit
  return clamp((n - 0.36 + 0.07 * (1.0 - uRise) - h * 0.18) * 4.0, 0.0, 1.0) * body;
}
// bg: 1 for the sky itself, 0 for the haze on the clouds (which has no sun's disc: it would draw a line of it below the sun)
vec3 sky(vec3 rd, float bg) {
  float h = rd.y;
  // the horizon glows gold towards the sun and cools away from it
  float toward = max(dot(normalize(vec3(rd.x, 0.0, rd.z)), normalize(vec3(SUN.x, 0.0, SUN.z))), 0.0);
  vec3 low = mix(vec3(0.5, 0.52, 0.78), vec3(1.0, 0.62, 0.34), pow(toward, 3.0));
  vec3 mid = vec3(0.28, 0.42, 0.78), top = vec3(0.035, 0.085, 0.27);
  mid = mix(mid, vec3(0.06, 0.14, 0.34), uRise);
  top = mix(top, vec3(0.004, 0.008, 0.025), uRise);
  low = mix(low, vec3(0.55, 0.65, 1.0), uRise * 0.6);
  vec3 c = mix(low, mid, smoothstep(-0.02, 0.11, h));
  c = mix(c, top, smoothstep(0.08, 0.55, h));
  // below the horizon (round the planet's edge, once high up): haze low down, space higher
  vec3 below = mix(vec3(0.80, 0.76, 0.72), vec3(0.002, 0.004, 0.012), smoothstep(0.2, 0.7, uRise));
  c = mix(c, below, smoothstep(0.02, -0.12, h));
  c *= 1.0 - 0.85 * smoothstep(0.35, 0.85, uRise) * bg; // the sky going dark as we leave it
  float s = max(dot(rd, SUN), 0.0);
  c += vec3(1.0, 0.62, 0.30) * (pow(s, 6.0) * 0.35 + (pow(s, 60.0) * 0.9 + pow(s, 600.0) * 2.0) * bg) * (1.0 - uRise * 0.9);
  c += vec3(1.0, 0.95, 0.85) * smoothstep(0.99955, 0.99975, s) * 8.0 * bg;
  // stars, once high up
  vec3 g = floor(rd * 260.0);
  float st = step(0.9975, hash(g)) * smoothstep(0.3, 0.9, uRise) * smoothstep(0.0, 0.2, h);
  return c + st * 0.9;
}
void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  float alt = uCam.x, pitch = uCam.y, R = uCam.z;
  vec3 ro = vec3(0.0, alt, 0.0);
  float yaw = 0.1;
  vec3 fw = normalize(vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)));
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(fw + (uv.x * rt + uv.y * up) * uCam.w);
  vec3 col = vec3(0.0);
  float a = 0.0;
  bool ground = false;
  vec3 air = vec3(0.0);
  float t = rd.y < 0.0 ? max(0.0, (alt - 1.05) / -rd.y) * 0.85 : 0.0;
  float far = 70.0 + alt * 6.0;
  for (int i = 0; i < 72; i++) {
    if (t > far || a > 0.97) break;
    vec3 p = ro + rd * t;
    vec2 d = p.xz;
    p.y += dot(d, d) / (2.0 * R); // the cloud sea curves away: the Earth's curve shows as we climb
    float dt = 0.05 + t * 0.016;
    if (p.y <= -0.05) { ground = true; break; }
    if (p.y < 1.05) {
      float den = density(p, 5);
      if (den > 0.002) {
        float sh = density(p + SUN * 0.16, 3) + density(p + SUN * 0.42, 2);
        float light = exp(-sh * 3.4);
        float phase = 0.55 + 0.9 * pow(max(dot(rd, SUN), 0.0), 6.0);
        vec3 sunc = vec3(1.0, 0.70, 0.45) * mix(1.9, 2.7, uRise); // dawn gold, then hard sunlight in space
        vec3 amb = mix(mix(vec3(0.2, 0.25, 0.46), vec3(0.5, 0.56, 0.82), p.y), mix(vec3(0.36, 0.45, 0.66), vec3(0.75, 0.82, 0.95), p.y), uRise);
        vec3 c = sunc * light * phase + amb * (0.36 + 0.5 * p.y);
        float k = 1.0 - exp(-den * dt * 9.0);
        float haze = 1.0 - exp(-t * 0.012 / (1.0 + alt * 0.05));
        c = mix(c, sky(normalize(vec3(rd.x, 0.02, rd.z)), 0.0) * (1.0 - uRise * 0.4), haze);
        col += (1.0 - a) * k * c;
        a += (1.0 - a) * k;
      }
    } else if (p.y < 5.0) {
      // the thin air over the clouds: rays that skim it far out make the blue rim on the planet's edge
      air += exp(-(p.y - 1.05) * 0.9) * dt * vec3(0.30, 0.52, 1.0);
    }
    t += dt;
  }
  // past the clouds: the land far below them, or the sky (and once high up, space round the planet)
  vec3 bg = ground ? mix(vec3(0.42, 0.50, 0.66), vec3(0.08, 0.17, 0.30), smoothstep(0.1, 0.6, uRise)) : sky(rd, 1.0);
  col += (1.0 - a) * bg;
  col += air * 0.018 * smoothstep(0.15, 0.7, uRise) * (1.0 - a);
  col = col / (1.0 + col * 0.55);
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";

/** null when the browser has no WebGL (the tour then opens on the live globe). */
export function startClouds(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, powerPreference: "high-performance" });
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, "p");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle over it all
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const at = (name: string) => gl.getUniformLocation(prog, name);
  const uRes = at("uRes"), uTime = at("uTime"), uRise = at("uRise"), uCam = at("uCam");

  // drawn at a fraction of the screen's pixels: half on a desktop, a third on a phone, and less if frames run slow
  let scale = matchMedia("(pointer: coarse)").matches ? 0.33 : 0.5;
  let slow = 0, lastMs = 0;
  return {
    draw(rise: number, time: number) {
      const ms = performance.now();
      if (lastMs && ms - lastMs < 200) slow = ms - lastMs > 40 ? slow + 1 : Math.max(0, slow - 1);
      lastMs = ms;
      if (slow > 20 && scale > 0.2) {
        scale *= 0.8;
        slow = 0;
      }
      const w = Math.max(1, Math.round(canvas.clientWidth * scale)), h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uRise, rise);
      const c = skyCamera(rise);
      gl.uniform4f(uCam, c.alt, c.pitch, c.radius, c.fov);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
