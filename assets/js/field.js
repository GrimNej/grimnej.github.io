// WebGL particle field that lives behind the whole page.
// One set of particles holds four formations and morphs between them as the
// visitor scrolls: a halo around the portrait, a data terrain, a deep field
// behind the work, and an ember vortex around the contact section.

const SCENES = ["halo", "terrain", "deep", "vortex"];

const VERT = /* glsl */ `#version 300 es
precision highp float;

in vec3 aHalo;
in vec3 aTerrain;
in vec3 aDeep;
in vec3 aVortex;
in vec3 aSeed;

uniform mat4 uProj;
uniform mat4 uView;
uniform float uTime;
uniform vec4 uW;
uniform float uIntro;
uniform vec3 uHaloC;
uniform float uHaloS;
uniform vec3 uVortexC;
uniform float uVortexS;
uniform vec2 uHalf;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uAspect;
uniform float uTurb;
uniform float uPx;

out vec3 vColor;
out float vAlpha;

const vec3 SIGNAL = vec3(0.545, 0.612, 1.0);
const vec3 ICE = vec3(0.435, 0.89, 1.0);
const vec3 WHITE = vec3(0.93, 0.95, 1.0);
const vec3 EMBER = vec3(1.0, 0.478, 0.27);
const vec3 GOLD = vec3(1.0, 0.75, 0.45);

vec3 flow(vec3 p, float t) {
  return vec3(
    sin(p.y * 1.7 + t * 0.6) + sin(p.z * 2.3 - t * 0.4),
    sin(p.z * 1.9 + t * 0.5) + sin(p.x * 2.1 + t * 0.3),
    sin(p.x * 1.6 - t * 0.5) + sin(p.y * 2.4 + t * 0.45)
  ) * 0.5;
}

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1., 0., 0., 0., c, s, 0., -s, c); }

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  float t = uTime;
  float id = float(gl_VertexID);

  // Halo: shell + tilted ring around the portrait.
  vec3 h = rotY(t * 0.07 + aSeed.y * 0.0) * aHalo;
  h += flow(aHalo * 1.6, t * 0.6) * 0.035;
  vec3 pHalo = uHaloC + h * uHaloS;

  // Terrain: a wide landscape of points rolling under the content.
  vec3 g = aTerrain;
  float wave = sin(g.x * 3.2 + t * 0.55) * 0.5 + sin(g.z * 4.1 - t * 0.4) * 0.35 + sin((g.x + g.z) * 6.0 + t * 0.8) * 0.15;
  vec3 pTerrain = vec3(g.x * uHalf.x * 1.75, -uHalf.y * 0.6 + wave * uHalf.y * 0.17, g.z * uHalf.y * 1.6 - uHalf.y * 0.4);

  // Deep field: slow drift toward the camera, wrapping around.
  vec3 d = aDeep;
  float z = fract(d.z * 0.5 + 0.5 + t * 0.012) * 2.0 - 1.0;
  vec3 pDeep = vec3(d.x * uHalf.x * 1.5, d.y * uHalf.y * 1.5, z * 2.2 - 0.6);
  pDeep += flow(d * 2.0, t * 0.3) * 0.03;

  // Vortex: a tilted accretion disk with differential rotation.
  float r = aVortex.x;
  float ang = aVortex.y + t * (0.22 / (0.25 + r));
  vec3 v = vec3(cos(ang) * r, aVortex.z, sin(ang) * r);
  v = rotX(0.3) * v;
  vec3 pVortex = uVortexC + v * uVortexS;

  // Per-particle staggered weights make transitions feel organic.
  float lag = aSeed.x * 0.45;
  vec4 w = smoothstep(vec4(lag), vec4(lag + 0.55), uW);
  float sw = w.x + w.y + w.z + w.w;
  w = sw > 0.001 ? w / sw : uW;

  vec3 pos = pHalo * w.x + pTerrain * w.y + pDeep * w.z + pVortex * w.w;
  pos += flow(pos * 1.3 + aSeed * 3.0, t * 1.4) * uTurb * 0.06;

  // Intro: particles stream in from a wide scatter.
  vec3 start = normalize(vec3(hash(id * 1.3) - 0.5, hash(id * 2.7) - 0.5, hash(id * 4.1) - 0.5) + 1e-4) * (2.4 + aSeed.y * 2.6);
  float k = clamp(uIntro * 1.5 - aSeed.x * 0.5, 0.0, 1.0);
  k = 1.0 - pow(1.0 - k, 3.0);
  pos = mix(start, pos, k);

  vec4 view = uView * vec4(pos, 1.0);
  vec4 clip = uProj * view;

  // Cursor: push points away in screen space and warm them up.
  vec2 ndc = clip.xy / clip.w;
  vec2 dm = ndc - uMouse;
  dm.x *= uAspect;
  float dist = length(dm);
  float heat = smoothstep(0.32, 0.0, dist) * uMouseOn;
  vec2 push = (dm / max(dist, 1e-4)) * heat * 0.07;
  push.x /= uAspect;
  clip.xy += push * clip.w;
  gl_Position = clip;

  // Colour per formation.
  float dust = aTerrain.y;
  float ring = step(1.2, length(aHalo)) * (1.0 - dust);
  vec3 cHalo = mix(SIGNAL, WHITE, smoothstep(0.35, 1.0, aSeed.y));
  cHalo = mix(cHalo, ICE, step(0.86, aSeed.z));
  cHalo = mix(cHalo, mix(WHITE, ICE, aSeed.y * 0.6), ring * 0.7);
  cHalo = mix(cHalo, mix(SIGNAL, ICE, aSeed.y), dust * 0.8);
  vec3 cTerrain = mix(SIGNAL * 0.8, ICE, clamp(wave * 0.6 + 0.5, 0.0, 1.0));
  vec3 cDeep = mix(WHITE, SIGNAL, aSeed.y);
  vec3 cVortex = mix(vec3(1.0, 0.9, 0.75), GOLD, smoothstep(0.5, 0.62, r));
  cVortex = mix(cVortex, EMBER, smoothstep(0.62, 1.05, r));
  cVortex = mix(cVortex, SIGNAL, smoothstep(1.2, 1.7, r) * 0.7);

  vec3 col = cHalo * w.x + cTerrain * w.y + cDeep * w.z + cVortex * w.w;
  col = mix(col, EMBER, heat * 0.85);

  float aHaloA = mix(mix(0.62, 1.0, ring), 0.58, dust);
  float aVortexA = mix(1.0, 0.45, smoothstep(0.55, 1.7, r));
  float a = aHaloA * w.x + 0.62 * w.y + 0.42 * w.z + aVortexA * w.w;
  a *= 0.55 + 0.45 * sin(t * (0.6 + aSeed.y) + aSeed.x * 40.0) * 0.5 + 0.25;
  a = min(1.0, a + heat * 0.6);
  a *= k;

  float size = (0.55 + aSeed.z * 0.95) * (1.0 + heat * 0.8);
  size *= aSeed.z > 0.975 ? 2.1 : 1.0;
  size *= 1.0 + w.w * 0.25 - w.y * 0.1;
  gl_PointSize = clamp(size * 0.0062 * uPx / max(-view.z, 0.2), 0.6, 14.0);

  vColor = col;
  vAlpha = a;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision mediump float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float m = smoothstep(0.5, 0.0, d);
  m *= m;
  outColor = vec4(vColor * m * vAlpha, m * vAlpha);
}
`;

function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function buildFormations(n) {
  const halo = new Float32Array(n * 3);
  const terrain = new Float32Array(n * 3);
  const deep = new Float32Array(n * 3);
  const vortex = new Float32Array(n * 3);
  const seed = new Float32Array(n * 3);

  const cols = Math.ceil(Math.sqrt(n * 2.2));
  const rows = Math.ceil(n / cols);
  const ringTilt = 1.18;
  const ringRoll = 0.32;

  for (let i = 0; i < n; i++) {
    const o = i * 3;

    // Halo: a crisp shell, two bright rings, and a wide spiral of galaxy dust,
    // all tilted toward the viewer and centred on the portrait's head.
    const pick = Math.random();
    let hx;
    let hy;
    let hz;
    let dust = 0;
    if (pick < 0.34) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const rr = 1 + gauss() * 0.014;
      const s = Math.sqrt(1 - u * u);
      hx = s * Math.cos(th) * rr;
      hy = u * rr;
      hz = s * Math.sin(th) * rr;
    } else {
      let x;
      let y;
      let z;
      if (pick < 0.64) {
        const th = Math.random() * Math.PI * 2;
        const outer = Math.random() < 0.3;
        const rr = outer ? 1.86 + gauss() * 0.012 : 1.5 + gauss() * 0.03;
        x = Math.cos(th) * rr;
        y = gauss() * (outer ? 0.006 : 0.012);
        z = Math.sin(th) * rr;
      } else {
        dust = 1;
        const arm = Math.random() < 0.5 ? 0 : Math.PI;
        const rr = 1.12 + Math.pow(Math.random(), 1.6) * 1.75;
        const th = arm + rr * 2.3 + gauss() * 0.38;
        x = Math.cos(th) * rr;
        y = gauss() * 0.035;
        z = Math.sin(th) * rr;
      }
      // Tilt toward the viewer, then roll slightly.
      const y1 = y * Math.cos(ringTilt) - z * Math.sin(ringTilt);
      const z1 = y * Math.sin(ringTilt) + z * Math.cos(ringTilt);
      hx = x * Math.cos(ringRoll) - y1 * Math.sin(ringRoll);
      hy = x * Math.sin(ringRoll) + y1 * Math.cos(ringRoll);
      hz = z1;
    }
    halo[o] = hx;
    halo[o + 1] = hy;
    halo[o + 2] = hz;

    // Terrain grid
    const cx = i % cols;
    const cz = Math.floor(i / cols);
    terrain[o] = (cx / (cols - 1)) * 2 - 1 + (Math.random() - 0.5) * 0.004;
    // The terrain is flat, so its y slot carries the halo dust flag to the shader.
    terrain[o + 1] = dust;
    terrain[o + 2] = (cz / Math.max(rows - 1, 1)) * 2 - 1;

    // Deep field
    deep[o] = Math.random() * 2 - 1;
    deep[o + 1] = Math.random() * 2 - 1;
    deep[o + 2] = Math.random() * 2 - 1;

    // Vortex (stored polar: radius, angle, height). A thin photon ring at r = 0.5
    // frames the contact heading; the disk and its two arms spread outward.
    if (Math.random() < 0.16) {
      vortex[o] = 0.5 + gauss() * 0.006;
      vortex[o + 1] = Math.random() * Math.PI * 2;
      vortex[o + 2] = gauss() * 0.004;
    } else {
      const arm = Math.random() < 0.5 ? 0 : Math.PI;
      const r = 0.54 + Math.pow(Math.random(), 1.9) * 1.15;
      vortex[o] = r;
      vortex[o + 1] = arm + r * 3.1 + gauss() * 0.5;
      vortex[o + 2] = gauss() * 0.018 * (1.8 - r);
    }

    seed[o] = Math.random();
    seed[o + 1] = Math.random();
    seed[o + 2] = Math.random();
  }

  return { halo, terrain, deep, vortex, seed };
}

function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function lookAt(eye, target) {
  const [ex, ey, ez] = eye;
  let zx = ex - target[0];
  let zy = ey - target[1];
  let zz = ez - target[2];
  let l = Math.hypot(zx, zy, zz);
  zx /= l;
  zy /= l;
  zz /= l;
  // up = (0,1,0)
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  l = Math.hypot(xx, xy, xz);
  xx /= l;
  xz /= l;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1,
  ]);
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
  }
  return s;
}

export function initField(canvas, { reduced = false } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl) return null;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link failed");
  } catch (err) {
    console.warn("[field] disabled:", err);
    return null;
  }
  gl.useProgram(program);

  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4;
  const count = small ? 11000 : lowPower ? 16000 : 26000;
  const quality = { level: 0, dprCap: 2, draw: count };
  const data = buildFormations(count);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  for (const [name, arr] of [
    ["aHalo", data.halo],
    ["aTerrain", data.terrain],
    ["aDeep", data.deep],
    ["aVortex", data.vortex],
    ["aSeed", data.seed],
  ]) {
    const loc = gl.getAttribLocation(program, name);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  }

  const u = {};
  for (const name of ["uProj", "uView", "uTime", "uW", "uIntro", "uHaloC", "uHaloS", "uVortexC", "uVortexS", "uHalf", "uMouse", "uMouseOn", "uAspect", "uTurb", "uPx"]) {
    u[name] = gl.getUniformLocation(program, name);
  }

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  // Additive blending so dense regions glow.
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  const FOV = (40 * Math.PI) / 180;
  const DIST = 1 / Math.tan(FOV / 2); // world height at z=0 is 2
  const state = {
    w: [1, 0, 0, 0],
    target: [1, 0, 0, 0],
    intro: reduced ? 1 : 0,
    mouse: [0, 0],
    mouseS: [0, 0],
    mouseOn: 0,
    mouseOnS: 0,
    turb: 0,
    cam: [0, 0],
    width: 1,
    height: 1,
    dpr: 1,
    time: 0,
    running: true,
    anchors: { halo: null, vortex: null },
    scenes: [],
    onScene: null,
  };

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75, quality.dprCap);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = state.width / state.height;
    gl.uniformMatrix4fv(u.uProj, false, perspective(FOV, aspect, 0.05, 40));
    gl.uniform1f(u.uAspect, aspect);
    gl.uniform2f(u.uHalf, aspect, 1);
    gl.uniform1f(u.uPx, (canvas.height / 2) * DIST);
  }

  function toWorld(px, py) {
    const aspect = state.width / state.height;
    return [((px / state.width) * 2 - 1) * aspect, -((py / state.height) * 2 - 1)];
  }

  // offsetY is a fraction of the element's height (negative moves the anchor up).
  function anchorFor(el, scaleFn, offsetY = 0) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const [x, y] = toWorld(r.left + r.width / 2, r.top + r.height * (0.5 + offsetY));
    return { c: [x, y, 0], s: scaleFn(r) };
  }

  function sceneTarget() {
    const mid = state.height * 0.5;
    // Bands without a scene (like the ticker) keep whatever was showing.
    let current = lastScene || "halo";
    for (const s of state.scenes) {
      const r = s.el.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) {
        current = s.name;
        break;
      }
    }
    return current;
  }

  let lastScene = "";
  let last = performance.now();
  let lastScroll = window.scrollY;

  // Adaptive quality: if frames run slow for a sustained stretch, drop the
  // resolution and particle count so scrolling stays smooth on weaker GPUs.
  let slowFrames = 0;
  let startedAt = 0;
  function adapt(dt, now) {
    if (!startedAt) startedAt = now;
    if (now - startedAt < 2500 || quality.level >= 2) return;
    slowFrames = dt > 0.026 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames < 75) return;
    slowFrames = 0;
    quality.level += 1;
    quality.dprCap = quality.level === 1 ? 1.25 : 1;
    quality.draw = Math.round(count * (quality.level === 1 ? 0.7 : 0.45));
    resize();
  }

  function frame(now) {
    if (!state.running) return;
    requestAnimationFrame(frame);
    if (document.hidden) return;

    const raw = (now - last) / 1000;
    const dt = Math.min(raw, 0.05);
    adapt(raw, now);
    last = now;
    if (!reduced) state.time += dt;

    const scene = sceneTarget();
    if (scene !== lastScene) {
      lastScene = scene;
      state.target = SCENES.map((s) => (s === scene ? 1 : 0));
      if (state.onScene) state.onScene(scene);
    }
    const ease = reduced ? 1 : 1 - Math.exp(-dt * 1.9);
    for (let i = 0; i < 4; i++) state.w[i] += (state.target[i] - state.w[i]) * ease;

    // Scroll velocity feeds turbulence.
    const sy = window.scrollY;
    const v = Math.abs(sy - lastScroll) / Math.max(dt, 0.001);
    lastScroll = sy;
    const turbTarget = reduced ? 0 : Math.min(v / 2600, 1.4);
    state.turb += (turbTarget - state.turb) * (1 - Math.exp(-dt * (turbTarget > state.turb ? 8 : 2)));

    const me = 1 - Math.exp(-dt * 10);
    state.mouseS[0] += (state.mouse[0] - state.mouseS[0]) * me;
    state.mouseS[1] += (state.mouse[1] - state.mouseS[1]) * me;
    state.mouseOnS += (state.mouseOn - state.mouseOnS) * (1 - Math.exp(-dt * 4));

    const halo = anchorFor(state.anchors.halo, (r) => (r.height / state.height) * 0.6, -0.2);
    // Photon ring (r = 0.5) sits just outside the heading's half-width.
    const vortex = anchorFor(state.anchors.vortex, (r) => ((r.width / state.width) * (state.width / state.height) * 1.08) / 0.5);

    // Gentle camera parallax from the pointer.
    const ce = 1 - Math.exp(-dt * 2.5);
    state.cam[0] += (state.mouseS[0] * 0.12 - state.cam[0]) * ce;
    state.cam[1] += (state.mouseS[1] * 0.08 - state.cam[1]) * ce;

    gl.uniformMatrix4fv(u.uView, false, lookAt([state.cam[0], state.cam[1], DIST], [0, 0, 0]));
    gl.uniform1f(u.uTime, state.time);
    gl.uniform4fv(u.uW, state.w);
    gl.uniform1f(u.uIntro, state.intro);
    if (halo) {
      gl.uniform3fv(u.uHaloC, halo.c);
      gl.uniform1f(u.uHaloS, halo.s);
    }
    if (vortex) {
      gl.uniform3fv(u.uVortexC, vortex.c);
      gl.uniform1f(u.uVortexS, vortex.s);
    }
    gl.uniform2fv(u.uMouse, state.mouseS);
    gl.uniform1f(u.uMouseOn, reduced ? 0 : state.mouseOnS);
    gl.uniform1f(u.uTurb, state.turb);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, quality.draw);
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      state.mouse[0] = (e.clientX / state.width) * 2 - 1;
      state.mouse[1] = -((e.clientY / state.height) * 2 - 1);
      state.mouseOn = 1;
    },
    { passive: true }
  );
  document.addEventListener("pointerleave", () => (state.mouseOn = 0));
  window.addEventListener("blur", () => (state.mouseOn = 0));

  canvas.classList.add("is-ready");
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });

  return {
    state,
    setScenes(list) {
      state.scenes = list;
    },
    setAnchors(anchors) {
      Object.assign(state.anchors, anchors);
    },
    get count() {
      return count;
    },
  };
}
