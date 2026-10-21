// Hero name effects.
//
// - Each letter is its own span so it can swell (weight and width), turn ember
//   near the pointer, and hop when the pointer crosses it.
// - A light streak sweeps across both words after the intro and every few
//   seconds, and follows the pointer like a flashlight while you hover the name.
//   Each letter paints the same word-wide gradient (offset by its position in
//   the word), so the streak and the "Neupane" fill read as one continuous surface.
// - Fast pointer movement over the name splits it into ember and cyan fringes.

export function initName({ gsap = null, fine = false, reduced = false } = {}) {
  const name = document.querySelector(".hero__name");
  const words = [...document.querySelectorAll("[data-name]")];
  const none = { chars: [], reveal() {} };
  if (!name || !words.length) return none;

  const chars = [];
  words.forEach((word) => {
    const text = word.textContent;
    word.textContent = "";
    [...text].forEach((c) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = c === " " ? " " : c;
      word.append(s);
      chars.push(s);
    });
  });

  // Each letter needs to know where it sits inside its word for the shared gradient.
  function measure() {
    words.forEach((word) => {
      const wr = word.getBoundingClientRect();
      word.style.setProperty("--ww", `${wr.width.toFixed(1)}px`);
      word.querySelectorAll(".ch").forEach((c) => {
        c.style.setProperty("--l", `${(c.getBoundingClientRect().left - wr.left).toFixed(1)}px`);
      });
    });
  }
  measure();
  window.addEventListener("resize", measure);
  document.fonts?.ready.then(measure);

  if (reduced || !gsap) return { chars, reveal() {} };

  /* ---------- Light streak ---------- */

  // `light.x` is the streak centre in viewport pixels.
  const light = { x: -9999 };
  let hovering = false;
  let lastPainted = null;
  function paintLight() {
    if (light.x === lastPainted) return;
    lastPainted = light.x;
    words.forEach((word) => {
      const wr = word.getBoundingClientRect();
      const ww = wr.width;
      // The streak layer is 3 word-widths wide with its centre at 1.5 widths.
      word.style.setProperty("--sheen", `${(light.x - wr.left - ww * 1.5).toFixed(1)}px`);
    });
  }
  gsap.ticker.add(paintLight);

  function nameBounds() {
    const r = name.getBoundingClientRect();
    return { left: r.left, right: r.right };
  }

  function sweep(duration = 1.5) {
    if (hovering) return;
    const { left, right } = nameBounds();
    gsap.fromTo(light, { x: left - 260 }, { x: right + 260, duration, ease: "power2.inOut", overwrite: true });
  }

  let sweepTimer = 0;
  function scheduleSweeps() {
    clearInterval(sweepTimer);
    sweepTimer = setInterval(() => sweep(1.6), 6500);
  }

  /* ---------- Pointer: proximity, flashlight, hops, fringes ---------- */

  const hero = document.querySelector(".hero");
  const lightTo = gsap.quickTo(light, "x", { duration: 0.45, ease: "power3.out" });
  let px = -9999;
  let py = -9999;
  let lastMove = { x: 0, y: 0, t: 0 };
  const split = { v: 0 };
  let pending = false;

  function update() {
    pending = false;
    chars.forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
      const f = Math.max(0, 1 - d / 280);
      const e = f * f * (3 - 2 * f);
      c.style.setProperty("--w", Math.round(840 + 60 * e));
      c.style.setProperty("--s", (120 + 5 * e).toFixed(1));
      c.classList.toggle("is-hot", e > 0.8);
    });
  }

  function onMove(e) {
    px = e.clientX;
    py = e.clientY;
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
    const r = name.getBoundingClientRect();
    const near = px > r.left - 60 && px < r.right + 60 && py > r.top - 40 && py < r.bottom + 40;
    if (near) {
      hovering = true;
      lightTo(px);
      const now = performance.now();
      const dt = Math.max(now - lastMove.t, 1);
      const speed = Math.hypot(px - lastMove.x, py - lastMove.y) / dt; // px per ms
      lastMove = { x: px, y: py, t: now };
      const target = Math.min(speed * 2.2, 7);
      if (target > split.v) gsap.to(split, { v: target, duration: 0.08, overwrite: true, onComplete: () => gsap.to(split, { v: 0, duration: 0.6, ease: "power3.out" }) });
    } else if (hovering) {
      hovering = false;
      const { right } = nameBounds();
      gsap.to(light, { x: right + 300, duration: 0.9, ease: "power2.in", overwrite: true });
    }
  }

  gsap.ticker.add(() => name.style.setProperty("--split", `${split.v.toFixed(2)}px`));

  if (fine) {
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", () => {
      px = py = -9999;
      requestAnimationFrame(update);
      if (hovering) {
        hovering = false;
        gsap.to(light, { x: nameBounds().right + 300, duration: 0.9, ease: "power2.in", overwrite: true });
      }
    });

    chars.forEach((c, i) => {
      c.addEventListener("pointerenter", () => {
        if (!name.classList.contains("is-open")) return;
        [-1, 0, 1].forEach((k) => {
          const n = chars[i + k];
          if (!n || n.parentElement !== c.parentElement) return;
          gsap.fromTo(
            n,
            { yPercent: 0 },
            { yPercent: k === 0 ? -16 : -7, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1, delay: Math.abs(k) * 0.05, overwrite: "auto" }
          );
        });
      });
    });
  }

  return {
    chars,
    // Called by the intro once the letters have landed.
    reveal() {
      measure();
      sweep(1.8);
      scheduleSweeps();
    },
  };
}
