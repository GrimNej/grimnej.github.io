// Hero portrait: materializes from ASCII "tokens" on load, then a lens under the
// pointer shows the same face the way a model might see it.
//
// The lens only opens over the person (not the transparent background around
// the cut-out), its dark fill is masked to the silhouette so it reads as part
// of the portrait, and it draws on a canvas larger than the photo so the ring
// is never clipped at the photo's edges.

const RAMP = " .:-=+*#%@";
const GLITCH = "01<>/\\{}[]#*+=$?";

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const LOW = hexToRgb("#6d7cff");
const MID = hexToRgb("#6fe3ff");
const HIGH = hexToRgb("#f2f5ff");

function shade(l) {
  const a = l < 0.5 ? LOW : MID;
  const b = l < 0.5 ? MID : HIGH;
  const t = l < 0.5 ? l / 0.5 : (l - 0.5) / 0.5;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function initPortrait(fig, { reduced = false, gsap = null } = {}) {
  const frame = fig.querySelector(".portrait__frame");
  const img = fig.querySelector("[data-portrait-img]");
  const canvas = fig.querySelector("[data-portrait-canvas]");
  const hud = fig.querySelector("[data-hud]");
  const ctx = canvas.getContext("2d");
  const lensLayer = document.createElement("canvas");
  const lctx = lensLayer.getContext("2d");

  let W = 0; // photo box size, in CSS pixels
  let H = 0;
  let pad = 0; // extra room around the photo so the lens ring never clips
  let dpr = 1;
  let cell = 9;
  let cols = 0;
  let rows = 0;
  let lum = null;
  let alpha = null;
  let ascii = null; // pre-rendered glyph layer, photo-sized
  let ok = false;

  const lens = { x: 0, y: 0, tx: 0, ty: 0, r: 0, tr: 0 };
  const intro = { on: false, fade: 0, scan: -1 };
  const pointer = { x: -1, y: -1, known: false, touch: false };
  let lensOn = false;
  let raf = 0;

  function radius() {
    return Math.max(48, Math.min(W * 0.15, 84));
  }

  function sample() {
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !img.naturalWidth) return false;
    W = rect.width;
    H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    pad = Math.ceil(radius() + 24);

    for (const c of [canvas, lensLayer]) {
      c.width = Math.round((W + pad * 2) * dpr);
      c.height = Math.round((H + pad * 2) * dpr);
    }
    Object.assign(canvas.style, {
      left: `${-pad}px`,
      top: `${-pad}px`,
      width: `${W + pad * 2}px`,
      height: `${H + pad * 2}px`,
    });

    cell = W < 300 ? 6.5 : W < 440 ? 8 : 9;
    cols = Math.ceil(W / cell);
    rows = Math.ceil(H / cell);

    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const o = off.getContext("2d", { willReadFrequently: true });
    o.drawImage(img, 0, 0, cols, rows);
    let d;
    try {
      d = o.getImageData(0, 0, cols, rows).data;
    } catch {
      return false; // tainted canvas (e.g. opened from file://)
    }

    lum = new Float32Array(cols * rows);
    alpha = new Float32Array(cols * rows);
    const seen = [];
    for (let i = 0; i < cols * rows; i++) {
      alpha[i] = d[i * 4 + 3] / 255;
      lum[i] = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
      if (alpha[i] > 0.5) seen.push(lum[i]);
    }
    // Stretch contrast between the 4th and 97th percentiles so facial structure
    // survives the reduction to a handful of glyph densities.
    seen.sort((x, y) => x - y);
    const lo = seen[Math.floor(seen.length * 0.04)] ?? 0;
    const hi = seen[Math.floor(seen.length * 0.97)] ?? 1;
    const span = Math.max(hi - lo, 0.05);
    for (let i = 0; i < lum.length; i++) {
      lum[i] = Math.pow(Math.min(1, Math.max(0, (lum[i] - lo) / span)), 1.15);
    }

    ascii = document.createElement("canvas");
    ascii.width = Math.round(W * dpr);
    ascii.height = Math.round(H * dpr);
    const a = ascii.getContext("2d");
    a.setTransform(dpr, 0, 0, dpr, 0, 0);
    a.font = `600 ${cell * 1.08}px "JetBrains Mono", ui-monospace, monospace`;
    a.textAlign = "center";
    a.textBaseline = "middle";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (alpha[i] < 0.25) continue;
        const l = lum[i];
        const ch = RAMP[Math.min(RAMP.length - 1, Math.round(l * (RAMP.length - 1)))];
        if (ch === " ") continue;
        const [r, g, b] = shade(l);
        a.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${(0.22 + l * 0.78) * alpha[i]})`;
        a.fillText(ch, x * cell + cell / 2, y * cell + cell / 2);
      }
    }
    return true;
  }

  // Opacity of the photo at a point in photo coordinates (0 outside it).
  function alphaAt(x, y) {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return 0;
    return alpha[cy * cols + cx];
  }

  function glitchCells(c, count, minRow = 0, cx = -1, cy = -1, rad = 0) {
    c.font = `600 ${cell * 1.08}px "JetBrains Mono", ui-monospace, monospace`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (let n = 0; n < count; n++) {
      let x;
      let y;
      if (rad > 0) {
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * rad;
        x = Math.floor((cx + Math.cos(ang) * rr) / cell);
        y = Math.floor((cy + Math.sin(ang) * rr) / cell);
      } else {
        x = Math.floor(Math.random() * cols);
        y = minRow + Math.floor(Math.random() * Math.max(rows - minRow, 1));
      }
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      if (alpha[y * cols + x] < 0.4) continue;
      c.fillStyle = Math.random() < 0.2 ? "rgba(255,138,76,0.95)" : "rgba(111,227,255,0.95)";
      c.fillText(GLITCH[(Math.random() * GLITCH.length) | 0], x * cell + cell / 2, y * cell + cell / 2);
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!ok) return;
    // Work in photo coordinates; the canvas extends `pad` beyond the photo.
    ctx.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);

    if (intro.on) {
      const top = Math.max(intro.scan, 0);
      ctx.save();
      ctx.globalAlpha = intro.fade;
      ctx.beginPath();
      ctx.rect(0, top, W, H - top);
      ctx.clip();
      ctx.drawImage(ascii, 0, 0, W, H);
      glitchCells(ctx, Math.round(60 * intro.fade), Math.floor(top / cell));
      ctx.restore();
      if (intro.scan > 0 && intro.scan < H) {
        const g = ctx.createLinearGradient(0, intro.scan - 26, 0, intro.scan + 2);
        g.addColorStop(0, "rgba(111,227,255,0)");
        g.addColorStop(1, "rgba(111,227,255,0.35)");
        ctx.fillStyle = g;
        ctx.fillRect(0, intro.scan - 26, W, 28);
        ctx.fillStyle = "rgba(220,250,255,0.95)";
        ctx.fillRect(0, intro.scan - 1, W, 2);
      }
    }

    if (lens.r > 0.6) {
      const { x, y, r } = lens;
      // Fade as the lens shrinks so it never collapses into a stray "+".
      const fade = Math.min(1, r / (radius() * 0.6));

      // Lens interior on its own layer, then masked to the silhouette.
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, lensLayer.width, lensLayer.height);
      lctx.setTransform(dpr, 0, 0, dpr, pad * dpr, pad * dpr);
      lctx.save();
      lctx.beginPath();
      lctx.arc(x, y, r, 0, Math.PI * 2);
      lctx.clip();
      lctx.fillStyle = "rgba(6,7,11,0.94)";
      lctx.fillRect(x - r, y - r, r * 2, r * 2);
      lctx.drawImage(ascii, 0, 0, W, H);
      glitchCells(lctx, 6, 0, x, y, r);
      lctx.fillStyle = "rgba(111,227,255,0.035)";
      for (let sy = y - r; sy < y + r; sy += 4) lctx.fillRect(x - r, sy, r * 2, 1);
      lctx.restore();
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(img, 0, 0, W, H);
      lctx.globalCompositeOperation = "source-over";

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(lensLayer, 0, 0);
      ctx.restore();

      // The reticle itself is drawn whole, on top.
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(111,227,255,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(111,227,255,0.35)";
      ctx.beginPath();
      ctx.arc(x, y, r + 6, -Math.PI * 0.15, Math.PI * 0.35);
      ctx.stroke();
      ctx.strokeStyle = "rgba(111,227,255,0.95)";
      ctx.beginPath();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(x + dx * (r - 8), y + dy * (r - 8));
        ctx.lineTo(x + dx * (r + 3), y + dy * (r + 3));
      }
      ctx.stroke();
      if (r > 44) {
        ctx.font = `600 11px "JetBrains Mono", ui-monospace, monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(111,227,255,0.95)";
        ctx.fillText("TOKEN VIEW", x + r * 0.72 + 6, y - r * 0.72);
      }
      ctx.restore();
    }
  }

  function loop() {
    raf = 0;
    lens.x += (lens.tx - lens.x) * 0.24;
    lens.y += (lens.ty - lens.y) * 0.24;
    lens.r += (lens.tr - lens.r) * 0.2;
    draw();
    if (intro.on || lens.tr > 0 || lens.r > 0.6) raf = requestAnimationFrame(loop);
    else draw();
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function setLensOn(on) {
    if (on === lensOn) return;
    lensOn = on;
    document.dispatchEvent(new CustomEvent("portrait:lens", { detail: on }));
  }

  // Decide from the real pointer position (also re-checked on scroll, so the
  // lens can never be left behind when the page moves under a still cursor).
  function update() {
    if (!ok || intro.on || reduced) return;
    if (!pointer.known) {
      close();
      return;
    }
    const rect = frame.getBoundingClientRect();
    const x = pointer.x - rect.left;
    const y = pointer.y - rect.top;
    const onPerson = x >= 0 && y >= 0 && x < W && y < H * 0.84 && alphaAt(x, y) > 0.45;
    if (!onPerson) {
      close();
      return;
    }
    lens.tx = x;
    lens.ty = y;
    if (lens.tr === 0) {
      lens.x = x;
      lens.y = y;
    }
    lens.tr = radius();
    setLensOn(true);
    kick();
  }

  function close() {
    setLensOn(false);
    if (lens.tr > 0) {
      lens.tr = 0;
      kick();
    }
  }

  if (!reduced) {
    window.addEventListener(
      "pointermove",
      (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.known = true;
        pointer.touch = e.pointerType !== "mouse";
        update();
      },
      { passive: true }
    );
    fig.addEventListener("pointerdown", (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.known = true;
      pointer.touch = e.pointerType !== "mouse";
      update();
    });
    const release = (e) => {
      if (e.pointerType === "mouse") return;
      setTimeout(() => {
        pointer.known = false;
        close();
      }, 650);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    document.documentElement.addEventListener("pointerleave", () => {
      pointer.known = false;
      close();
    });
    window.addEventListener("blur", () => {
      pointer.known = false;
      close();
    });
    let scrollQueued = false;
    window.addEventListener(
      "scroll",
      () => {
        if (scrollQueued) return;
        scrollQueued = true;
        requestAnimationFrame(() => {
          scrollQueued = false;
          if (pointer.touch) close();
          else update();
        });
      },
      { passive: true }
    );
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ok = sample();
      draw();
    }, 150);
  });

  function showHud() {
    if (!hud) return;
    if (!gsap || reduced) {
      hud.style.opacity = 1;
      return;
    }
    gsap.set(hud, { opacity: 1 });
    gsap.from(hud.querySelectorAll(".hud__c"), { opacity: 0, scale: 1.6, duration: 0.9, ease: "expo.out", stagger: 0.06 });
    gsap.from(hud.querySelectorAll(".hud__tag"), { opacity: 0, y: 8, duration: 0.6, ease: "power3.out", stagger: 0.12, delay: 0.25 });
  }

  // Intro: ASCII fades in, then a scan line reveals the photo top to bottom.
  function playIntro() {
    if (!ok || reduced || !gsap) {
      img.style.clipPath = "";
      showHud();
      return Promise.resolve();
    }
    intro.on = true;
    intro.fade = 0;
    intro.scan = -1;
    img.style.clipPath = "inset(0 0 100% 0)";
    kick();
    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onUpdate() {
          const s = Math.max(intro.scan, 0);
          img.style.clipPath = `inset(0 0 ${Math.max(H - s, 0)}px 0)`;
        },
        onComplete() {
          intro.on = false;
          img.style.clipPath = "";
          kick();
          showHud();
          setTimeout(demo, 500);
          resolve();
        },
      });
      tl.to(intro, { fade: 1, duration: 0.6, ease: "power2.out" });
      tl.to(intro, { scan: H + 4, duration: 1.5, ease: "power2.inOut" }, 0.55);
    });
  }

  // Once after the intro, the lens sweeps across the face by itself, so the
  // effect is discoverable without a hint (and on touch screens, without hover).
  let demoed = false;
  function demo() {
    if (demoed || !ok || reduced || !gsap || lens.tr > 0) return;
    demoed = true;
    const path = { t: 0 };
    const r = radius() * 0.92;
    lens.x = lens.tx = W * 0.3;
    lens.y = lens.ty = H * 0.4;
    lens.tr = r;
    kick();
    gsap.to(path, {
      t: 1,
      duration: 2.2,
      ease: "sine.inOut",
      onUpdate() {
        if (lens.tr !== r) return; // the visitor took over
        lens.tx = W * (0.3 + 0.4 * path.t);
        lens.ty = H * (0.4 + Math.sin(path.t * Math.PI) * 0.08);
        kick();
      },
      onComplete() {
        if (lens.tr === r) {
          lens.tr = 0;
          kick();
        }
      },
    });
  }

  function prepare() {
    ok = sample();
    if (ok && !reduced && gsap) img.style.clipPath = "inset(0 0 100% 0)";
  }

  return { prepare, playIntro };
}
