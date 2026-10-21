// Custom cursor. The dot tracks the pointer exactly; the ring follows tightly,
// stretches a little along its direction of travel, and snaps onto the dot
// while a button is held so dragging never feels detached.
//
// [data-cursor] shows a small label beside the pointer, data-cursor-mode="media"
// turns it into a large disc, and [data-cursor-hide] hides the ring but keeps
// the dot (the portrait lens takes over there). Text inputs keep the caret.

export function initCursor(root) {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!root || !fine || reduced) return;

  const dot = root.querySelector(".cursor__dot");
  const ring = root.querySelector(".cursor__ring");
  const label = root.querySelector("[data-cursor-label]");
  document.documentElement.classList.add("has-cursor");

  const pos = { x: -100, y: -100 };
  const ringPos = { x: -100, y: -100 };
  let visible = false;
  let down = false;
  let linked = false;

  function onMove(e) {
    pos.x = e.clientX;
    pos.y = e.clientY;
    if (!visible) {
      visible = true;
      ringPos.x = pos.x;
      ringPos.y = pos.y;
      root.classList.remove("is-hidden");
    }
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  }

  // The ring eases toward the dot on a time basis (same feel at 60 Hz or 144 Hz):
  // fast enough to stay glued to the dot, with just enough smoothing to not feel rigid.
  let lastT = performance.now();
  function tick(now = performance.now()) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    const k = down ? 1 : 1 - Math.exp(-dt * 46);
    const nx = ringPos.x + (pos.x - ringPos.x) * k;
    const ny = ringPos.y + (pos.y - ringPos.y) * k;
    const vx = nx - ringPos.x;
    const vy = ny - ringPos.y;
    ringPos.x = nx;
    ringPos.y = ny;
    const speed = Math.hypot(vx, vy);
    const stretch = down || linked ? 0 : Math.min(speed / 80, 0.28);
    const angle = Math.atan2(vy, vx);
    ring.style.transform = `translate3d(${nx}px, ${ny}px, 0) rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch * 0.45})`;
    label.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
    requestAnimationFrame(tick);
  }

  function onOver(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const hide = t.closest("input, textarea");
    const interactive = t.closest("a, button, label, [data-cursor]");
    const host = t.closest("[data-cursor]");
    const text = host?.dataset.cursor || "";
    linked = Boolean(interactive) && !text;
    root.classList.toggle("is-hidden", Boolean(hide));
    root.classList.toggle("is-link", linked);
    root.classList.toggle("has-label", Boolean(text));
    root.classList.toggle("is-media", Boolean(text) && host.dataset.cursorMode === "media");
    root.classList.toggle("is-ember", Boolean(t.closest(".orb, .mail-link")));
    if (text) label.textContent = text;
  }

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerover", onOver, { passive: true });

  // The portrait tells us when its lens is open; the ring steps aside for it.
  document.addEventListener("portrait:lens", (e) => root.classList.toggle("is-lens", Boolean(e.detail)));

  // Re-check what is under the pointer after the page scrolls, so link and
  // label states never linger over content that has moved away.
  let queued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (queued || !visible) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const el = document.elementFromPoint(pos.x, pos.y);
        if (el) onOver({ target: el });
      });
    },
    { passive: true }
  );
  document.addEventListener("pointerdown", () => {
    down = true;
    root.classList.add("is-down");
  });
  const release = () => {
    down = false;
    root.classList.remove("is-down");
  };
  document.addEventListener("pointerup", release);
  window.addEventListener("blur", release);
  document.documentElement.addEventListener("pointerleave", () => {
    visible = false;
    root.classList.add("is-hidden");
  });
  requestAnimationFrame(tick);
}
