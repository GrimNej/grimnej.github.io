// Selected work as one continuous object. On large screens with WebGL, the
// project banners rise into a curved ribbon that twists like a strip of film,
// fly into a hexagonal ring, then fold into a reel that the page scroll turns,
// one project per notch. Dragging the ribbon or the reel scrolls the page, so
// there is only ever one position to keep in sync. The articles in .projects
// stay the source of truth, and the layout for phones, short screens, reduced
// motion, and browsers without WebGL2.

const ASPECT = 2.8; // card width / height; the banners are 2.8 to 2.9 wide
const SEG = 48; // columns per card mesh, enough for a smooth bend
const TAU = Math.PI * 2;

// The scroll timeline, in viewport heights after the scene pins.
function timeline(n) {
  const t = {
    ribbonEnd: 1.25, // the ribbon slides from the first card to the last
    ringIn: [1.25, 1.95], // the cards fly into the ring
    reelIn: [2.25, 2.8], // the ring folds into the reel
    step: 0.5, // one project per notch of the reel
  };
  t.reelStart = t.reelIn[1];
  t.reelEnd = t.reelStart + t.step * (n - 1);
  t.total = t.reelEnd + 0.35;
  return t;
}

const VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 aUV;

uniform mat4 uProj;
uniform mat4 uModel;
uniform vec2 uSize;
uniform float uRibbonX;
uniform float uRadius;
uniform float uTwist;
uniform float uHalfW;
uniform float uLift;
uniform float uMix;

out vec2 vUV;

void main() {
  vUV = aUV;
  vec2 l = aUV - 0.5;

  // Ribbon: the strip wraps around the inside of a wide cylinder, so the cards
  // swing toward the camera as they leave the centre, and twists into an S.
  float x = uRibbonX + l.x * uSize.x;
  float a = x / uRadius;
  vec3 r = vec3(sin(a) * uRadius, l.y * uSize.y + uLift, (1.0 - cos(a)) * uRadius);
  float k = min(abs(x) / uHalfW, 2.0);
  r.y += sign(x) * k * k * uTwist;

  // Ring and reel: a flat card placed by its model matrix.
  vec3 m = (uModel * vec4(l, 0.0, 1.0)).xyz;

  gl_Position = uProj * vec4(mix(r, m, uMix), 1.0);
}`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uTex;
uniform vec2 uShift;
uniform float uAlpha;
uniform float uShade;
uniform vec2 uPx;

out vec4 outColor;

float box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  // Chromatic split while the strip is moving fast: ember and ice fringes.
  float red = texture(uTex, vUV + uShift).r;
  vec4 mid = texture(uTex, vUV);
  float blue = texture(uTex, vUV - uShift).b;
  vec3 c = vec3(red, mid.g, blue) * uShade;

  // Rounded corners with a hairline edge, like the cards in the fallback.
  float d = box((vUV - 0.5) * uPx, uPx * 0.5, 7.0);
  float edge = 1.0 - smoothstep(0.0, 1.4, abs(d + 0.9));
  c = mix(c, vec3(0.92, 0.93, 0.97), edge * 0.22);
  float a = clamp(0.5 - d, 0.0, 1.0) * uAlpha;
  outColor = vec4(c * a, a);
}`;

/* ---------- Small matrix kit (column-major, like WebGL) ---------- */

function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
const translate = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const scale = (x, y) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}
function rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
// Card i starts a shared transition a little after card i - 1.
const stagger = (t, i, n, s = 0.07) => clamp((t - i * s) / (1 - (n - 1) * s), 0, 1);

/* ---------- GL setup ---------- */

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function program(gl) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  ["uProj", "uModel", "uSize", "uRibbonX", "uRadius", "uTwist", "uHalfW", "uLift", "uMix", "uTex", "uShift", "uAlpha", "uShade", "uPx"].forEach(
    (n) => (u[n] = gl.getUniformLocation(p, n))
  );
  return { p, u };
}

function stripMesh(gl, prog) {
  const uv = [];
  for (let i = 0; i <= SEG; i++) uv.push(i / SEG, 0, i / SEG, 1);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aUV");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { vao, count: (SEG + 1) * 2 };
}

// Each banner is cropped to the card shape on a 2D canvas, with the project's
// accent tick on the top edge, then uploaded. SVG banners rasterise crisply here.
const TEX_W = 1400;
const TEX_H = Math.round(TEX_W / ASPECT);

function paintCard(img, natural, accent, focusY) {
  const cv = document.createElement("canvas");
  cv.width = TEX_W;
  cv.height = TEX_H;
  const g = cv.getContext("2d");
  g.fillStyle = "#0a0b10";
  g.fillRect(0, 0, TEX_W, TEX_H);
  if (img) {
    const ar = natural.w / natural.h;
    let w = TEX_W, h = TEX_W / ar;
    if (h < TEX_H) {
      h = TEX_H;
      w = TEX_H * ar;
    }
    g.drawImage(img, (TEX_W - w) / 2, (TEX_H - h) * focusY, w, h);
  }
  g.fillStyle = accent;
  g.fillRect(0, 0, Math.round(TEX_W * 0.1), 7);
  return cv;
}

function upload(gl, tex, source, aniso) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
}

/* ---------- Reading the projects ---------- */

function readProjects(articles) {
  return articles.map((art, i) => {
    const img = art.querySelector("[data-shot] img");
    const shot = art.querySelector("[data-shot]");
    const links = art.querySelector(".project__links");
    return {
      no: String(i + 1).padStart(2, "0"),
      title: art.querySelector(".project__title")?.textContent.trim() ?? "",
      tag: art.querySelector(".project__tag")?.textContent.trim() ?? "",
      desc: art.querySelector(".project__desc")?.textContent.trim() ?? "",
      stack: art.querySelector(".project__stack")?.textContent.trim() ?? "",
      note: art.querySelector(".project__note")?.textContent.trim() ?? "",
      accent: art.style.getPropertyValue("--accent").trim() || "#8b9cff",
      src: img?.getAttribute("src"),
      natural: { w: Number(img?.getAttribute("width")) || 1280, h: Number(img?.getAttribute("height")) || 440 },
      href: shot?.getAttribute("href") ?? "#work",
      cursor: shot?.dataset.cursor ?? "Open",
      label: shot?.getAttribute("aria-label") ?? "",
      links: links ? links.cloneNode(true) : null,
    };
  });
}

/* ---------- The scene ---------- */

export function initReel({ gsap, ScrollTrigger, lenis, reduced }) {
  const root = document.querySelector("[data-reel]");
  const work = root?.closest(".work");
  const articles = [...document.querySelectorAll("[data-project]")];
  if (!root || !gsap || !ScrollTrigger || reduced || articles.length < 3) return false;

  const canvas = root.querySelector("[data-reel-canvas]");
  const gl = canvas.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) return false;

  let prog, mesh;
  try {
    prog = program(gl);
    mesh = stripMesh(gl, prog.p);
  } catch (err) {
    console.warn("Reel disabled:", err);
    return false;
  }

  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  const projects = readProjects(articles);
  const N = projects.length;
  const T = timeline(N);
  const textures = projects.map((p) => {
    const tex = gl.createTexture();
    upload(gl, tex, paintCard(null, p.natural, p.accent, 0.5), aniso);
    return tex;
  });

  // Banners load as the section approaches. The SVG ones animate in, so they
  // are painted once on arrival and again when they have settled.
  let texturesLoaded = false;
  function loadTextures() {
    if (texturesLoaded) return;
    texturesLoaded = true;
    projects.forEach((p, i) => {
      if (!p.src) return;
      const img = new Image();
      img.decoding = "async";
      img.src = p.src;
      const paint = () => {
        upload(gl, textures[i], paintCard(img, p.natural, p.accent, p.src.includes("captionman") ? 0.47 : 0.5), aniso);
        needsDraw = true;
      };
      img
        .decode()
        .then(() => {
          paint();
          if (p.src.endsWith(".svg")) setTimeout(paint, 2200);
        })
        .catch(() => {});
    });
  }

  /* DOM overlay */

  const pin = root.querySelector("[data-reel-pin]");
  const capCount = root.querySelector("[data-reel-cap-count]");
  const capTitle = root.querySelector("[data-reel-cap-title]");
  const capTag = root.querySelector("[data-reel-cap-tag]");
  const caption = root.querySelector("[data-reel-caption]");
  const hit = root.querySelector("[data-reel-hit]");
  const indexList = root.querySelector("[data-reel-index]");
  const detail = root.querySelector("[data-reel-detail]");
  const meta = root.querySelector("[data-reel-meta]");
  const hint = root.querySelector("[data-reel-hint]");
  const count = root.querySelector("[data-reel-count]");
  const ticks = projects.map(() => root.querySelector("[data-reel-ticks]").appendChild(document.createElement("li")));
  hit.draggable = false;

  const indexButtons = projects.map((p, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span class="reel__index-no">${p.no}</span><span class="reel__index-name"></span>`;
    b.querySelector(".reel__index-name").textContent = p.title;
    b.addEventListener("click", () => scrollToProject(i));
    li.append(b);
    indexList.append(li);
    return b;
  });

  function swap(el) {
    el.classList.remove("is-swap");
    void el.offsetWidth;
    el.classList.add("is-swap");
  }

  let capShown = -1;
  function showCaption(i) {
    if (i === capShown) return;
    capShown = i;
    const p = projects[i];
    capCount.textContent = `${p.no} / ${String(N).padStart(2, "0")}`;
    capTitle.textContent = p.title;
    capTag.textContent = p.tag;
    swap(caption);
  }

  let detailShown = -1;
  function showDetail(i) {
    if (i === detailShown) return;
    detailShown = i;
    const p = projects[i];
    detail.innerHTML = `
      <p class="reel__no"><span></span> / ${String(N).padStart(2, "0")}</p>
      <h3 class="reel__title"></h3>
      <p class="reel__tag"></p>
      <p class="reel__desc"></p>`;
    detail.style.setProperty("--accent", p.accent);
    detail.querySelector(".reel__no span").textContent = p.no;
    detail.querySelector(".reel__title").textContent = p.title;
    detail.querySelector(".reel__tag").textContent = p.tag;
    detail.querySelector(".reel__desc").textContent = p.desc;
    meta.innerHTML = `<p class="reel__stack"></p>${p.note ? '<p class="reel__note"></p>' : ""}`;
    meta.style.setProperty("--accent", p.accent);
    meta.querySelector(".reel__stack").textContent = p.stack;
    if (p.note) meta.querySelector(".reel__note").textContent = p.note;
    if (p.links) meta.append(p.links.cloneNode(true));
    indexButtons.forEach((b, j) => {
      if (j === i) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    swap(detail);
    swap(meta);
  }

  // The counter, the ticks and the light follow whichever card is in focus.
  let focusShown = -1;
  function showFocus(i) {
    if (i === focusShown) return;
    focusShown = i;
    count.textContent = `${projects[i].no} / ${String(N).padStart(2, "0")}`;
    ticks.forEach((t, j) => t.classList.toggle("is-on", j === i));
    pin.style.setProperty("--glow", projects[i].accent);
  }

  function aimHit(i) {
    const p = projects[i];
    if (hit.dataset.i === String(i)) return;
    hit.dataset.i = String(i);
    hit.href = p.href;
    hit.dataset.cursor = p.cursor;
    hit.setAttribute("aria-label", p.label || p.title);
  }

  /* Layout, in CSS px with the origin at the screen centre and y up */

  const L = {};
  function layout() {
    const w = pin.clientWidth;
    const h = pin.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    L.w = w;
    L.h = h;
    L.dist = h * 1.55;
    L.proj = mul(perspective(2 * Math.atan(h / 2 / L.dist), w / h, 10, L.dist * 4), translate(0, 0, -L.dist));

    L.rw = clamp(w * 0.38, 380, 660);
    L.rh = L.rw / ASPECT;
    L.gap = L.rw * 1.07;
    L.radius = w * 1.15;
    L.ry = h * 0.07;
    L.twist = L.rh * 0.62;

    L.gw = clamp(Math.min(w * 0.2, h * 0.36), 220, 360);
    L.gh = L.gw / ASPECT;
    L.apothem = (L.gw / (2 * Math.tan(Math.PI / N))) * 1.1;

    L.lw = clamp(w * 0.34, 360, 620);
    L.lh = L.lw / ASPECT;
    L.lr = L.lh * 1.75;
    L.ly = h * 0.03;

    pin.style.setProperty("--cap-y", `${h / 2 - L.ry + L.rh / 2 + 28}px`);
    pin.style.setProperty("--card-w", `${L.lw}px`);
    pin.style.setProperty("--card-cy", `${h / 2 - L.ly}px`);
    pin.style.setProperty("--orbit", `${L.apothem * 1.6}px`);
    pin.style.setProperty("--col", `${detail.clientWidth}px`);
    needsDraw = true;
  }

  /* Scroll state */

  const S = { enter: 0, u: 0, rib: 0, idx: 0, spin: 0, vRib: 0, vIdx: 0, lastRib: 0, lastIdx: 0, last: performance.now() };
  let st = null;
  let enterSt = null;
  let needsDraw = true;
  let visible = false;
  let dragging = false;

  const posAt = (u) => (st ? st.start + u * L.h : 0);
  function scrollToU(u, opts = {}) {
    const y = posAt(u);
    if (lenis) lenis.scrollTo(y, { duration: 1.2, ...opts });
    else window.scrollTo({ top: y, behavior: "smooth" });
  }
  function scrollToProject(i) {
    scrollToU(T.reelStart + i * T.step);
  }

  // Settle onto the nearest card once the scroll comes to rest inside the
  // ribbon or the reel, the way a physical reel clicks into a notch.
  let snapTimer = 0;
  function trySnap() {
    if (!st || dragging || !st.isActive) return;
    if (lenis && Math.abs(lenis.velocity) > 0.15) return;
    const u = S.u;
    let target = null;
    if (u > 0.01 && u < T.ribbonEnd - 0.01) {
      const per = T.ribbonEnd / (N - 1);
      target = Math.round(u / per) * per;
    } else if (u > T.reelStart - 0.18 && u < T.reelEnd + 0.12) {
      target = T.reelStart + clamp(Math.round((u - T.reelStart) / T.step), 0, N - 1) * T.step;
    }
    if (target !== null && Math.abs(target - u) * L.h > 3) scrollToU(target, { duration: 0.8, easing: outExpo });
  }
  if (lenis)
    lenis.on("scroll", () => {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(trySnap, 170);
    });

  /* Dragging scrolls the page */

  let drag = null;
  let dragged = false;
  function mode() {
    const ring = clamp((S.u - T.ringIn[0]) / (T.ringIn[1] - T.ringIn[0]), 0, 1);
    const reel = clamp((S.u - T.reelIn[0]) / (T.reelIn[1] - T.reelIn[0]), 0, 1);
    if (ring === 0 && S.enter > 0.98) return "ribbon";
    if (reel === 1) return "reel";
    return null;
  }

  pin.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0 || !st) return;
    if (e.target.closest("button, a:not([data-reel-hit])")) return;
    const m = mode();
    if (!m) return;
    drag = { m, x: e.clientX, y: e.clientY, moved: 0, v: 0, t: performance.now() };
    dragged = false;
    dragging = true;
    pin.setPointerCapture(e.pointerId);
    pin.classList.add("is-dragging");
  });

  pin.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.moved > 6) dragged = true;
    const delta = drag.m === "ribbon" ? (-dx / L.gap) * (T.ribbonEnd / (N - 1)) * L.h : (-dy / (L.lr * 0.87)) * T.step * L.h;
    const now = performance.now();
    drag.v = delta / Math.max(now - drag.t, 1);
    drag.t = now;
    scrollBy(delta);
  });

  function endDrag(e) {
    if (!drag) return;
    if (pin.hasPointerCapture?.(e.pointerId)) pin.releasePointerCapture(e.pointerId);
    if (dragged) scrollBy(clamp(drag.v * 140, -L.h * 0.6, L.h * 0.6));
    drag = null;
    dragging = false;
    pin.classList.remove("is-dragging");
    clearTimeout(snapTimer);
    snapTimer = setTimeout(trySnap, 260);
  }
  pin.addEventListener("pointerup", endDrag);
  pin.addEventListener("pointercancel", endDrag);
  hit.addEventListener(
    "click",
    (e) => {
      if (!dragged) return;
      e.preventDefault();
      e.stopPropagation();
      dragged = false;
    },
    true
  );

  function scrollBy(delta) {
    if (!st) return;
    const lo = st.start;
    const hi = st.start + T.total * L.h;
    if (lenis) lenis.scrollTo(clamp(lenis.targetScroll + delta, lo, hi), { lerp: 0.16 });
    else window.scrollTo(0, clamp(window.scrollY + delta, lo, hi));
  }

  /* Drawing */

  const order = [...Array(N).keys()];
  const cards = projects.map(() => ({ z: 0, model: null, mix: 0, ribbonX: 0, lift: 0, alpha: 1, shade: 1, w: 0, h: 0 }));
  let lastVars = "";

  function draw(now) {
    const dt = Math.min((now - S.last) / 1000, 0.05) || 0.016;
    S.last = now;

    const enter = S.enter;
    const u = S.u;
    S.rib = clamp(u / T.ribbonEnd, 0, 1) * (N - 1);
    const ring = clamp((u - T.ringIn[0]) / (T.ringIn[1] - T.ringIn[0]), 0, 1);
    const reel = clamp((u - T.reelIn[0]) / (T.reelIn[1] - T.reelIn[0]), 0, 1);
    S.idx = clamp((u - T.reelStart) / T.step, 0, N - 1);

    // Velocities drive the bend and the colour split.
    const vr = (S.rib - S.lastRib) / dt;
    const vi = (S.idx - S.lastIdx) / dt;
    S.lastRib = S.rib;
    S.lastIdx = S.idx;
    S.vRib += (vr - S.vRib) * 0.2;
    S.vIdx += (vi - S.vIdx) * 0.2;
    // The ring turns with the scroll and drifts on its own.
    if (ring > 0 && reel < 1) S.spin += dt * 0.12;
    const spin = S.spin + (u - T.ringIn[0]) * 0.9;

    const tw = L.twist * outExpo(enter) * (1 + clamp(Math.abs(S.vRib) * 0.12, 0, 0.8));
    const radius = L.radius / (1 + clamp(Math.abs(S.vRib) * 0.08, 0, 0.5));
    const g = -0.34; // the ring leans back

    for (let i = 0; i < N; i++) {
      const c = cards[i];
      // Ribbon
      const x = (i - S.rib) * L.gap;
      const rise = outExpo(clamp(enter * 1.5 - Math.abs(i - S.rib) * 0.12, 0, 1));
      c.ribbonX = x;
      c.lift = L.ry - (1 - rise) * L.h * 0.85;
      const ribbonShade = 1 - 0.32 * Math.min(Math.abs(x) / L.gap, 1.5) / 1.5;

      // Ring
      const theta = spin + (i * TAU) / N + Math.PI / 2;
      const fy = L.apothem * Math.sin(theta);
      const ringP = [L.apothem * Math.cos(theta), fy * Math.cos(g), fy * Math.sin(g)];
      const ringA = [g, wrapPi(theta - Math.PI / 2), 0.36];

      // Reel
      const phi = wrapPi(((i - S.idx) * TAU) / N);
      const reelP = [0, -L.lr * Math.sin(phi) + L.ly, L.lr * Math.cos(phi) - L.lr];
      const reelA = [phi, 0, 0];

      const m = inOut(stagger(reel, i, N));
      const p = [lerp(ringP[0], reelP[0], m), lerp(ringP[1], reelP[1], m), lerp(ringP[2], reelP[2], m)];
      const a = [lerp(ringA[0], reelA[0], m), lerp(ringA[1], reelA[1], m), lerp(ringA[2], reelA[2], m)];
      c.w = lerp(L.gw, L.lw, m);
      c.h = lerp(L.gh, L.lh, m);
      c.model = mul(mul(mul(mul(translate(p[0], p[1], p[2]), rotX(a[0])), rotZ(a[1])), rotX(a[2])), scale(c.w, c.h));

      c.mix = inOut(stagger(ring, i, N));
      // Only the card in front and its two neighbours; the back of the drum stays hidden.
      const reelAlpha = clamp((1.95 - Math.abs(phi)) / 0.3, 0, 1);
      const reelShade = 0.38 + 0.62 * Math.max(Math.cos(phi), 0);
      c.alpha = lerp(1, reelAlpha, m) * clamp(enter * 3, 0, 1);
      c.shade = lerp(lerp(ribbonShade, 0.94, c.mix), reelShade, m);

      const ribbonZ = (1 - Math.cos(x / L.radius)) * L.radius;
      c.z = lerp(ribbonZ, p[2], c.mix);
      if (c.mix === 0) {
        c.w = L.rw;
        c.h = L.rh;
      }
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(prog.p);
    gl.bindVertexArray(mesh.vao);
    gl.uniformMatrix4fv(prog.u.uProj, false, L.proj);
    gl.uniform1f(prog.u.uRadius, radius);
    gl.uniform1f(prog.u.uTwist, tw);
    gl.uniform1f(prog.u.uHalfW, L.w / 2);
    gl.uniform1i(prog.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    const sx = clamp(S.vRib * 0.0016, -0.012, 0.012) * (1 - ring);
    const sy = clamp(S.vIdx * -0.004, -0.01, 0.01) * reel;

    order.sort((a, b) => cards[a].z - cards[b].z);
    for (const i of order) {
      const c = cards[i];
      if (c.alpha <= 0.002) continue;
      gl.uniformMatrix4fv(prog.u.uModel, false, c.model);
      gl.uniform2f(prog.u.uSize, L.rw, L.rh);
      gl.uniform1f(prog.u.uRibbonX, c.ribbonX);
      gl.uniform1f(prog.u.uLift, c.lift);
      gl.uniform1f(prog.u.uMix, c.mix);
      gl.uniform2f(prog.u.uShift, sx, sy);
      gl.uniform1f(prog.u.uAlpha, c.alpha);
      gl.uniform1f(prog.u.uShade, c.shade);
      gl.uniform2f(prog.u.uPx, c.w, c.h);
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, mesh.count);
    }

    // Overlay: what is showing, and where the click target sits.
    const ci = Math.round(S.rib);
    const ri = Math.round(S.idx);
    showCaption(ci);
    showDetail(ri);
    if (ring < 0.5) showFocus(ci);
    else if (reel > 0.5) showFocus(ri);
    const capOn = clamp(enter * 2 - 1, 0, 1) * (1 - clamp(ring * 3, 0, 1));
    const ringOn = clamp(ring * 2 - 1, 0, 1) * (1 - clamp(reel * 2.5, 0, 1));
    const reelOn = clamp(reel * 1.6 - 0.6, 0, 1);
    const chrome = clamp(enter * 2 - 1, 0, 1);
    const spinDeg = ((-spin * 180) / Math.PI) % 360;
    const vars = `${capOn.toFixed(3)}|${ringOn.toFixed(3)}|${reelOn.toFixed(3)}|${chrome.toFixed(3)}|${u.toFixed(4)}|${ringOn ? spinDeg.toFixed(2) : ""}`;
    if (vars !== lastVars) {
      lastVars = vars;
      pin.style.setProperty("--cap", capOn.toFixed(3));
      pin.style.setProperty("--ring", ringOn.toFixed(3));
      pin.style.setProperty("--reel", reelOn.toFixed(3));
      pin.style.setProperty("--chrome", chrome.toFixed(3));
      pin.style.setProperty("--g", (u + enter).toFixed(4));
      if (ringOn) pin.style.setProperty("--spin", `${spinDeg.toFixed(2)}deg`);
      root.classList.toggle("is-reel-on", reelOn > 0.5);
    }

    const m = mode();
    const settledRibbon = m === "ribbon" && Math.abs(S.rib - ci) < 0.18;
    const settledReel = m === "reel" && Math.abs(S.idx - ri) < 0.18;
    if (settledRibbon || settledReel) {
      aimHit(settledRibbon ? ci : ri);
      const w = settledRibbon ? L.rw : L.lw;
      const h = settledRibbon ? L.rh : L.lh;
      const cy = settledRibbon ? L.ry : L.ly;
      hit.style.cssText = `left:${(L.w - w) / 2}px;top:${L.h / 2 - cy - h / 2}px;width:${w}px;height:${h}px`;
      hit.classList.add("is-on");
    } else hit.classList.remove("is-on");

    const label = m === "ribbon" ? "Drag" : m === "reel" ? "Drag" : "";
    if (pin.dataset.cursor !== label) {
      if (label) pin.dataset.cursor = label;
      else delete pin.dataset.cursor;
    }
    const hintText = m === "ribbon" ? "Drag the ribbon, or keep scrolling" : m === "reel" ? "Scroll or drag the reel" : "Keep scrolling";
    if (hint.textContent !== hintText) hint.textContent = hintText;

    const moving = Math.abs(S.vRib) > 0.01 || Math.abs(S.vIdx) > 0.01 || (ring > 0 && reel < 1);
    needsDraw = moving;
  }

  function tick() {
    if (!visible) return;
    if (needsDraw || st?.isActive || enterSt?.isActive) draw(performance.now());
  }

  /* Lifecycle: the scene exists only while the media query matches */

  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      if (visible) needsDraw = true;
    },
    { rootMargin: "200px 0px" }
  );
  const early = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      early.disconnect();
      loadTextures();
    },
    { rootMargin: "250% 0px" }
  );

  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px) and (min-height: 700px)", () => {
    root.hidden = false;
    work.classList.add("is-reel");
    layout();
    enterSt = ScrollTrigger.create({
      trigger: root,
      start: "top bottom",
      end: "top top",
      onUpdate: (self) => {
        S.enter = self.progress;
        needsDraw = true;
      },
      onLeave: () => (S.enter = 1),
    });
    st = ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: () => `+=${T.total * window.innerHeight}`,
      pin: pin,
      anticipatePin: 1,
      onUpdate: (self) => {
        S.u = self.progress * T.total;
        needsDraw = true;
      },
      onRefresh: () => layout(),
    });
    io.observe(root);
    early.observe(root);
    gsap.ticker.add(tick);
    window.addEventListener("resize", layout);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", layout);
      io.disconnect();
      st.kill();
      enterSt.kill();
      st = enterSt = null;
      root.hidden = true;
      work.classList.remove("is-reel");
    };
  });

  return true;
}
