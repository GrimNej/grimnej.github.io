// "Ball knowledge": every tool in the stack as a ball in a physics pit.
// Balls drop in when the section appears; grab one to drag and throw it, or
// brush past them with the pointer. A small custom 2D engine (gravity, circle
// collisions, rolling) keeps this dependency-free.

import { TOOLS } from "./tools.js?v=20261021b";

const GRAVITY = 2600;
const BOUNCE = 0.42;
const WALL_BOUNCE = 0.5;
const SUBSTEPS = 4;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

export function initPit(root, { reduced = false } = {}) {
  const canvas = root.querySelector("[data-pit-canvas]");
  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let dpr = 1;
  let balls = [];
  let running = false;
  let visible = false;
  let started = false;
  let raf = 0;
  let last = 0;

  const pointer = { x: -9999, y: -9999, px: -9999, py: -9999, inside: false };
  let grabbed = null;
  let hovered = null;

  function scaleFor(width) {
    return Math.max(0.52, Math.min(width / 1400, 1));
  }

  function build() {
    const s = scaleFor(W);
    balls = TOOLS.map((t, i) => {
      const r = (t.tier === 1 ? 56 : t.tier === 2 ? 43 : 37) * s;
      return {
        ...t,
        rgb: hexToRgb(t.color),
        icon: t.path ? new Path2D(t.path) : null,
        r,
        m: r * r,
        x: r + Math.random() * Math.max(W - 2 * r, 1),
        y: -r - Math.random() * H * 1.6 - i * 6,
        vx: (Math.random() - 0.5) * 120,
        vy: 0,
        a: Math.random() * Math.PI * 2,
      };
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const oldW = W;
    const oldH = H;
    W = rect.width;
    H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!balls.length) build();
    else if (oldW) {
      const k = scaleFor(W) / scaleFor(oldW);
      balls.forEach((b) => {
        b.x *= W / oldW;
        b.y *= H / oldH;
        b.r *= k;
        b.m = b.r * b.r;
      });
    }
    draw();
  }

  function step(dt) {
    for (const b of balls) {
      if (b === grabbed) {
        b.vx = (pointer.x - b.x) * 22;
        b.vy = (pointer.y - b.y) * 22;
      } else {
        b.vy += GRAVITY * dt;
        b.vx *= 0.9995;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < b.r) {
        b.x = b.r;
        b.vx = Math.abs(b.vx) * WALL_BOUNCE;
      } else if (b.x > W - b.r) {
        b.x = W - b.r;
        b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      }
      if (b.y > H - b.r) {
        b.y = H - b.r;
        b.vy = -Math.abs(b.vy) * WALL_BOUNCE;
        b.vx *= 0.985;
        if (Math.abs(b.vy) < 40) b.vy = 0;
      }
      if (b.y < -H * 2) b.y = -H * 2;
      b.a += (b.vx / b.r) * dt;
    }

    // Circle collisions with positional correction and an impulse.
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const ia = a === grabbed ? 0 : 1 / a.m;
        const ib = b === grabbed ? 0 : 1 / b.m;
        const sum = ia + ib || 1;
        const overlap = rr - d;
        a.x -= nx * overlap * (ia / sum);
        a.y -= ny * overlap * (ia / sum);
        b.x += nx * overlap * (ib / sum);
        b.y += ny * overlap * (ib / sum);
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const jmp = (-(1 + BOUNCE) * vn) / sum;
          a.vx -= jmp * nx * ia;
          a.vy -= jmp * ny * ia;
          b.vx += jmp * nx * ib;
          b.vy += jmp * ny * ib;
        }
      }
    }
  }

  function brush(dt) {
    if (!pointer.inside || grabbed) return;
    const mvx = pointer.x - pointer.px;
    const mvy = pointer.y - pointer.py;
    const speed = Math.hypot(mvx, mvy);
    if (speed < 0.5) return;
    for (const b of balls) {
      const dx = b.x - pointer.x;
      const dy = b.y - pointer.y;
      const d = Math.hypot(dx, dy);
      if (d < b.r + 26) {
        b.vx += (mvx / Math.max(dt, 0.001)) * 0.08 + (dx / (d || 1)) * 120;
        b.vy += (mvy / Math.max(dt, 0.001)) * 0.08 + (dy / (d || 1)) * 120;
      }
    }
  }

  function drawBall(b) {
    const { x, y, r } = b;
    const hot = b === hovered || b === grabbed;
    const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
    g.addColorStop(0, "#2d3348");
    g.addColorStop(0.55, "#141722");
    g.addColorStop(1, "#08090d");
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = hot ? 2.5 : 1.4;
    ctx.strokeStyle = `rgba(${b.rgb}, ${hot ? 1 : 0.45})`;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(b.a);
    if (b.icon) {
      const size = r * 0.98;
      const k = size / 24;
      ctx.translate(-size / 2, -size / 2);
      ctx.scale(k, k);
      ctx.fillStyle = `rgb(${b.rgb})`;
      ctx.fill(b.icon);
    } else {
      let fs = r * 0.4;
      ctx.font = `800 ${fs}px "Mona Sans", system-ui, sans-serif`;
      while (ctx.measureText(b.name).width > r * 1.6 && fs > 8) {
        fs -= 1;
        ctx.font = `800 ${fs}px "Mona Sans", system-ui, sans-serif`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#eceef4";
      ctx.fillText(b.name, 0, 1);
    }
    ctx.restore();
  }

  function drawLabel(b) {
    ctx.font = `700 13px "Mona Sans", system-ui, sans-serif`;
    const w = ctx.measureText(b.name).width + 20;
    let lx = b.x - w / 2;
    let ly = b.y - b.r - 34;
    if (ly < 6) ly = b.y + b.r + 8;
    lx = Math.max(4, Math.min(lx, W - w - 4));
    ctx.fillStyle = "#eceef4";
    ctx.beginPath();
    ctx.roundRect(lx, ly, w, 26, 13);
    ctx.fill();
    ctx.fillStyle = "#07080b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.name, lx + w / 2, ly + 13.5);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of balls) if (b !== grabbed) drawBall(b);
    if (grabbed) drawBall(grabbed);
    const labelled = grabbed || hovered;
    if (labelled) drawLabel(labelled);
  }

  function frame(t) {
    raf = 0;
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 1 / 30);
    last = t;
    brush(dt);
    for (let i = 0; i < SUBSTEPS; i++) step(dt / SUBSTEPS);
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // Settle instantly (used for reduced motion): simulate offscreen, then draw.
  function settle() {
    for (let i = 0; i < 900; i++) step(1 / 240);
    draw();
  }

  /* ---------- Pointer ---------- */

  function local(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function hit(x, y) {
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (Math.hypot(b.x - x, b.y - y) <= b.r) return b;
    }
    return null;
  }

  function grab(b) {
    grabbed = b;
    root.classList.add("is-played");
    canvas.style.cursor = "grabbing";
    start();
  }

  function release() {
    if (!grabbed) return;
    const max = 3200;
    grabbed.vx = Math.max(-max, Math.min(max, grabbed.vx));
    grabbed.vy = Math.max(-max, Math.min(max, grabbed.vy));
    if (Math.hypot(grabbed.vx, grabbed.vy) > 900) document.dispatchEvent(new CustomEvent("pit:throw"));
    grabbed = null;
    canvas.style.cursor = "";
    if (reduced) setTimeout(stop, 2500);
  }

  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    [pointer.x, pointer.y] = local(e);
    pointer.inside = true;
    if (!grabbed) hovered = hit(pointer.x, pointer.y);
    if (!running) draw();
  });
  canvas.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch") return;
    pointer.inside = false;
    hovered = null;
    if (!running) draw();
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    [pointer.x, pointer.y] = local(e);
    const b = hit(pointer.x, pointer.y);
    if (b) {
      canvas.setPointerCapture(e.pointerId);
      grab(b);
    }
  });
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // Touch: only claim the gesture when it starts on a ball, so the page still scrolls.
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.touches[0];
      [pointer.x, pointer.y] = local(t);
      const b = hit(pointer.x, pointer.y);
      if (!b) return;
      e.preventDefault();
      grab(b);
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (!grabbed) return;
      e.preventDefault();
      [pointer.x, pointer.y] = local(e.touches[0]);
    },
    { passive: false }
  );
  canvas.addEventListener("touchend", release);
  canvas.addEventListener("touchcancel", release);

  window.addEventListener(
    "scroll",
    () => {
      if (!hovered || grabbed) return;
      hovered = null;
      pointer.inside = false;
      if (!running) draw();
    },
    { passive: true }
  );

  /* ---------- Lifecycle ---------- */

  resize();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !started) {
        started = true;
        if (reduced) settle();
        else start();
      } else if (visible && !reduced) start();
      else if (!visible) stop();
    },
    { threshold: 0.15 }
  ).observe(root);
}
