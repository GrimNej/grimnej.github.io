import { initField } from "./field.js?v=20261021c";
import { initPortrait } from "./portrait.js?v=20261021c";
import { initCursor } from "./cursor.js?v=20261021c";
import { initGitHub } from "./github.js?v=20261021c";
import { initGrim } from "./mascot.js?v=20261021c";
import { initName } from "./name.js?v=20261021c";

window.__booted = true;

const html = document.documentElement;
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const hasGsap = Boolean(gsap && ScrollTrigger);
if (hasGsap) gsap.registerPlugin(...[ScrollTrigger, SplitText].filter(Boolean));

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Smooth scroll & anchors ---------- */

let lenis = null;
if (!reduced && Lenis) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  if (hasGsap) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => {
      lenis.raf(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
}

function headerOffset() {
  return parseFloat(getComputedStyle(html).getPropertyValue("--header-h")) || 72;
}

function scrollToTarget(target, { focus = true } = {}) {
  const el = target === "#top" ? null : $(target);
  if (target !== "#top" && !el) return;
  const y = el ? el.getBoundingClientRect().top + window.scrollY - headerOffset() + 8 : 0;
  if (lenis) lenis.scrollTo(y, { duration: 1.6 });
  else window.scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
  if (el && focus) {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }
}

document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute("href");
  if (href === "#" || href === "#main") return;
  e.preventDefault();
  closeMenu();
  scrollToTarget(href);
  history.replaceState(null, "", href === "#top" ? window.location.pathname : href);
});

/* ---------- Header and scroll progress ---------- */

// The header slides away while you scroll down and returns as soon as you scroll
// up, so page content never collides with it. A thin ember line tracks progress.
const header = $("[data-header]");
const headerBg = $("[data-header-bg]");
const progressBar = $("[data-progress]");
let headerY = window.scrollY;
function onScrollChrome() {
  const y = window.scrollY;
  const atTop = y < 80;
  if (atTop || y < headerY - 4 || menuOpen) header.classList.remove("is-hidden");
  else if (y > headerY + 4) header.classList.add("is-hidden");
  headerY = y;
  headerBg.classList.toggle("is-on", !atTop && !header.classList.contains("is-hidden"));
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
}
window.addEventListener("scroll", onScrollChrome, { passive: true });
header.addEventListener("focusin", () => {
  header.classList.remove("is-hidden");
  headerBg.classList.toggle("is-on", window.scrollY >= 80);
});

/* ---------- Active nav ---------- */

const navLinks = $$("[data-nav]");
const navIO = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((l) => {
        const on = l.dataset.nav === e.target.id;
        l.classList.toggle("is-active", on);
        if (on) l.setAttribute("aria-current", "true");
        else l.removeAttribute("aria-current");
      });
    }),
  { rootMargin: "-45% 0px -50% 0px" }
);
$$("main > section[id]").forEach((s) => navIO.observe(s));

/* ---------- Mobile menu ---------- */

const menu = $("[data-menu]");
const menuToggle = $("[data-menu-toggle]");
const menuLabel = $("[data-menu-label]");
let menuOpen = false;

function openMenu() {
  menuOpen = true;
  menu.hidden = false;
  menuToggle.setAttribute("aria-expanded", "true");
  menuLabel.textContent = "Close";
  lenis?.stop();
  document.body.style.overflow = "hidden";
  $$("main, .footer, .grim").forEach((n) => (n.inert = true));
  if (hasGsap && !reduced) {
    gsap.fromTo(menu, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.7, ease: "expo.out" });
    gsap.fromTo($$(".menu__nav a", menu), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.06, delay: 0.1 });
  }
  $(".menu__nav a", menu)?.focus();
}

function closeMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  menu.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuLabel.textContent = "Menu";
  lenis?.start();
  document.body.style.overflow = "";
  $$("main, .footer, .grim").forEach((n) => (n.inert = false));
}

menuToggle.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuOpen) {
    closeMenu();
    menuToggle.focus();
  }
});
window.matchMedia("(min-width: 1024px)").addEventListener("change", (e) => e.matches && closeMenu());

/* ---------- Toast & copy ---------- */

const toastEl = $("[data-toast]");
let toastTimer;
function toast(text) {
  toastEl.innerHTML = `<svg class="icon" aria-hidden="true"><use href="assets/img/icons.svg#i-check"/></svg><span></span>`;
  toastEl.querySelector("span").textContent = text;
  requestAnimationFrame(() => toastEl.classList.add("is-on"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2600);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(`Copied ${text}`);
  document.dispatchEvent(new CustomEvent("grim:copied"));
}

$$("[data-copy]").forEach((b) => {
  const label = $("[data-copy-label]", b);
  const original = label?.textContent;
  b.addEventListener("click", async () => {
    await copy(b.dataset.copy);
    const use = $("use", b);
    if (label) label.textContent = "Copied";
    use?.setAttribute("href", "assets/img/icons.svg#i-check");
    setTimeout(() => {
      if (label) label.textContent = original;
      use?.setAttribute("href", "assets/img/icons.svg#i-copy");
    }, 2200);
  });
});

/* ---------- Clock & year ---------- */

const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" });
function tickClock() {
  const now = new Date();
  $$("[data-clock]").forEach((n) => {
    n.textContent = clockFmt.format(now);
    n.dateTime = now.toISOString();
  });
}
tickClock();
setInterval(tickClock, 15000);
$$("[data-year]").forEach((n) => (n.textContent = new Date().getFullYear()));

/* ---------- Text helpers ---------- */

function splitChars(el, cls = "ch") {
  const text = el.textContent;
  el.textContent = "";
  [...text].forEach((c) => {
    const s = document.createElement("span");
    s.className = cls;
    s.textContent = c === " " ? " " : c;
    el.append(s);
  });
  return $$(`.${cls}`, el);
}

function accessibleCopy(el) {
  if (el.dataset.a11y) return;
  el.dataset.a11y = "1";
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = el.textContent;
  el.before(sr);
  el.setAttribute("aria-hidden", "true");
}

const GLYPHS = "!<>-_\\/[]{}=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function scramble(el, duration = 0.9) {
  const final = el.dataset.text ?? el.textContent;
  el.dataset.text = final;
  if (reduced) {
    el.textContent = final;
    return;
  }
  const start = performance.now();
  return new Promise((resolve) => {
    function frame(now) {
      const p = Math.min((now - start) / (duration * 1000), 1);
      let out = "";
      for (let i = 0; i < final.length; i++) {
        const settle = 0.25 + (i / final.length) * 0.75;
        out += final[i] === " " || p >= settle ? final[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else {
        el.textContent = final;
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

$$("[data-roll]").forEach((el) => {
  const t = el.textContent;
  el.textContent = "";
  const a = document.createElement("span");
  a.className = "roll__a";
  a.textContent = t;
  const b = document.createElement("span");
  b.className = "roll__b";
  b.setAttribute("aria-hidden", "true");
  b.textContent = t;
  el.append(a, b);
});

/* ---------- Pointer interactions ---------- */

if (fine && !reduced && hasGsap) {
  $$("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.7, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.7, ease: "power3.out" });
    const label = $(".orb__label", el);
    const lx = label && gsap.quickTo(label, "x", { duration: 0.7, ease: "power3.out" });
    const ly = label && gsap.quickTo(label, "y", { duration: 0.7, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      xTo(dx * 0.32);
      yTo(dy * 0.32);
      lx?.(dx * 0.16);
      ly?.(dy * 0.16);
    });
    el.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
      lx?.(0);
      ly?.(0);
    });
  });

  $$("[data-tilt]").forEach((el) => {
    const inner = el.firstElementChild;
    const img = $("img", inner);
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(inner, { rotationY: px * 10, rotationX: -py * 8, transformPerspective: 1000, duration: 0.8, ease: "power3.out" });
      gsap.to(img, { x: -px * 16, y: -py * 16, duration: 0.8, ease: "power3.out" });
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(inner, { rotationY: 0, rotationX: 0, duration: 1.1, ease: "expo.out" });
      gsap.to(img, { x: 0, y: 0, duration: 1.1, ease: "expo.out" });
    });
  });
}

/* ---------- Project previews: tilt and glare ---------- */

if (fine && !reduced && hasGsap) {
  $$("[data-shot]").forEach((shot) => {
    const glare = document.createElement("span");
    glare.className = "shot__glare";
    glare.setAttribute("aria-hidden", "true");
    shot.append(glare);
    shot.addEventListener("pointermove", (e) => {
      const r = shot.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      gsap.to(shot, { rotationY: (px - 0.5) * 7, rotationX: -(py - 0.5) * 6, transformPerspective: 1400, duration: 0.7, ease: "power3.out" });
      shot.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      shot.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    });
    shot.addEventListener("pointerleave", () => gsap.to(shot, { rotationY: 0, rotationX: 0, duration: 1, ease: "expo.out" }));
  });
}

/* ---------- Project preview views ---------- */

$$("[data-project]").forEach((p) => {
  const buttons = $$("[data-view]", p);
  const imgs = $$("[data-shot] img", p);
  if (buttons.length < 2) return;
  let current = 0;
  let touched = false;
  function show(i) {
    current = i;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.view) === i)));
    imgs.forEach((im, j) => im.classList.toggle("is-active", j === i));
  }
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      touched = true;
      show(Number(b.dataset.view));
    })
  );
  if (reduced) return;
  let timer = null;
  new IntersectionObserver(
    ([e]) => {
      clearInterval(timer);
      if (e.isIntersecting && !touched) timer = setInterval(() => !touched && show((current + 1) % imgs.length), 4800);
    },
    { threshold: 0.5 }
  ).observe(p);
});

/* ---------- Marquees: hero name and the tape bands ---------- */

// Each marquee drifts on its own, follows the scroll direction, and speeds up
// and skews with scroll velocity. Returns the hero marquee's state so the
// intro can give it a launch boost.
const marquee = (() => {
  const roots = $$("[data-marquee]");
  if (!roots.length) return null;
  const items = roots.map((root) => {
    const row = $("[data-marquee-row]", root);
    const set = $(".marquee__set", row);
    const copies = Math.max(3, Math.ceil((window.innerWidth * 2) / Math.max(set.offsetWidth, 1)));
    for (let i = 0; i < copies; i++) row.append(set.cloneNode(true));
    const item = { root, row, set, x: 0, dir: 1, base: Number(root.dataset.direction || 1), boost: 0, skew: 0, width: set.offsetWidth, visible: true };
    new IntersectionObserver(([e]) => (item.visible = e.isIntersecting)).observe(root);
    return item;
  });
  window.addEventListener("resize", () => items.forEach((it) => (it.width = it.set.offsetWidth)));
  if (reduced || !hasGsap) return items[0];
  let prevY = window.scrollY;
  gsap.ticker.add((t, d) => {
    const dt = d / 1000;
    const y = window.scrollY;
    const v = lenis ? lenis.velocity : (y - prevY) / Math.max(dt * 60, 1);
    prevY = y;
    items.forEach((it) => {
      if (!it.visible) return;
      if (v > 0.4) it.dir = 1;
      else if (v < -0.4) it.dir = -1;
      const d2 = it.dir * it.base;
      it.x -= d2 * (70 + Math.min(Math.abs(v) * 26, 900) + it.boost) * dt;
      if (it.x <= -it.width) it.x += it.width;
      if (it.x > 0) it.x -= it.width;
      it.skew += (clamp(-v * 0.55 * it.base, -12, 12) - it.skew) * 0.12;
      it.row.style.transform = `translate3d(${it.x}px,0,0)`;
      it.row.style.setProperty("--skew", `${it.skew.toFixed(2)}deg`);
    });
  });
  return items[0];
})();

/* ---------- "What I build" rows with a cursor-following preview ---------- */

(function rows() {
  const list = $("[data-rows]");
  const float = $("[data-viz-float]");
  if (!list || !float) return;
  const panels = $$("[data-viz-panel]", float);
  const rowsEls = $$(".row", list);

  if (!fine || !hasGsap) {
    rowsEls.forEach((row) => {
      const svg = panels[Number(row.dataset.viz)]?.cloneNode(true);
      if (!svg) return;
      svg.classList.add("is-active");
      const holder = document.createElement("div");
      holder.className = "row__viz";
      holder.setAttribute("aria-hidden", "true");
      holder.append(svg);
      row.append(holder);
    });
    return;
  }

  const pos = { x: 0, y: 0, tx: 0, ty: 0, r: 0, cx: -1, cy: -1 };
  let active = null; // the hovered row, or null
  // Anchored by its left edge just right of the pointer, so the hovered title stays readable.
  gsap.set(float, { xPercent: 0, yPercent: -50, scale: 0.6, opacity: 0, transformOrigin: "0% 50%" });

  function show(row) {
    if (row === active) return;
    panels.forEach((p, i) => p.classList.toggle("is-active", i === Number(row.dataset.viz)));
    if (!active) {
      pos.x = pos.tx;
      pos.y = pos.ty;
    }
    active = row;
    gsap.to(float, { opacity: 1, scale: 1, duration: 0.5, ease: "expo.out", overwrite: "auto" });
  }

  function hide() {
    if (!active) return;
    active = null;
    gsap.to(float, { opacity: 0, scale: 0.6, duration: 0.35, ease: "power3.in", overwrite: "auto" });
  }

  // The source of truth is whatever row is actually under the pointer. This is
  // re-checked on scroll, because pointer enter/leave events are not reliable
  // when the page moves under a still cursor.
  function sync() {
    if (pos.cx < 0) return hide();
    const row = document.elementFromPoint(pos.cx, pos.cy)?.closest?.(".row");
    if (row && list.contains(row)) show(row);
    else hide();
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      pos.cx = e.clientX;
      pos.cy = e.clientY;
      pos.tx = e.clientX + 56;
      pos.ty = e.clientY;
      sync();
    },
    { passive: true }
  );
  let queued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        sync();
      });
    },
    { passive: true }
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pos.cx = -1;
    hide();
  });
  new IntersectionObserver(([e]) => !e.isIntersecting && hide()).observe(list);
  gsap.ticker.add(() => {
    if (!active && Math.abs(pos.r) < 0.05 && gsap.getProperty(float, "opacity") === 0) return;
    const px = pos.x;
    pos.x += (pos.tx - pos.x) * 0.14;
    pos.y += (pos.ty - pos.y) * 0.14;
    pos.r += (clamp((pos.x - px) * 0.6, -14, 14) - pos.r) * 0.15;
    gsap.set(float, { x: pos.x, y: pos.y, rotation: pos.r });
  });
})();

/* ---------- Retrieval motion graphic ---------- */

$$("[data-rag-dots]").forEach((g) => {
  const svg = g.ownerSVGElement;
  const query = $(".viz__query", svg);
  const pts = [];
  const NS = "http://www.w3.org/2000/svg";
  for (let i = 0; i < 30; i++) {
    const c = document.createElementNS(NS, "circle");
    const x = 128 + Math.random() * 172;
    const y = 30 + Math.random() * 130;
    c.setAttribute("cx", x.toFixed(1));
    c.setAttribute("cy", y.toFixed(1));
    c.setAttribute("r", "3.2");
    g.append(c);
    pts.push({ c, x, y });
  }
  function step() {
    const qx = 165 + Math.random() * 110;
    const qy = 55 + Math.random() * 80;
    if (hasGsap && !reduced) gsap.to(query, { attr: { cx: qx, cy: qy }, duration: 0.9, ease: "power3.inOut" });
    else {
      query.setAttribute("cx", qx);
      query.setAttribute("cy", qy);
    }
    const near = [...pts].sort((a, b) => Math.hypot(a.x - qx, a.y - qy) - Math.hypot(b.x - qx, b.y - qy)).slice(0, 4);
    setTimeout(() => pts.forEach((p) => p.c.classList.toggle("is-hit", near.includes(p))), reduced ? 0 : 650);
  }
  step();
  if (!reduced) setInterval(step, 2400);
});

/* ---------- Reveals ---------- */

function initReveals() {
  const items = $$("[data-reveal], [data-clip], .project__media");
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      let i = 0;
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e) => {
          e.target.style.setProperty("--d", `${Math.min(i++ * 0.08, 0.4)}s`);
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
}
initReveals();

function initDecode() {
  const items = $$(".label");
  items.forEach(accessibleCopy);
  if (reduced) return;
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        scramble(e.target, 0.8);
      }),
    { threshold: 0.6 }
  );
  items.forEach((el) => io.observe(el));
}
initDecode();

function initWordLight() {
  $$("[data-words]").forEach((p) => {
    const words = p.textContent.trim().split(/\s+/);
    p.textContent = "";
    words.forEach((w, i) => {
      const s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      p.append(s);
      if (i < words.length - 1) p.append(" ");
    });
    const spans = $$(".w", p);
    if (reduced || !hasGsap) {
      spans.forEach((s) => s.classList.add("is-lit"));
      return;
    }
    ScrollTrigger.create({
      trigger: p,
      start: "top 82%",
      end: "bottom 45%",
      scrub: true,
      onUpdate: (self) => {
        const n = Math.round(self.progress * spans.length);
        spans.forEach((s, i) => s.classList.toggle("is-lit", i < n));
      },
    });
  });
}

function initHeadings() {
  if (!hasGsap || !SplitText || reduced) return;
  $$("[data-split]").forEach((el) => {
    const chars = el.classList.contains("contact__title");
    const split = SplitText.create(el, chars ? { type: "chars", mask: "chars" } : { type: "lines", mask: "lines" });
    gsap.from(chars ? split.chars : split.lines, {
      yPercent: 115,
      rotate: chars ? 0 : 3,
      duration: chars ? 1.3 : 1.2,
      ease: "expo.out",
      stagger: chars ? 0.05 : 0.1,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
      onComplete: () => split.revert(),
    });
  });
}

function initSteps() {
  const wrap = $("[data-steps]");
  if (!wrap) return;
  const fill = $("[data-steps-fill]", wrap).parentElement;
  const steps = $$(".step", wrap);
  if (reduced || !hasGsap) {
    fill.style.setProperty("--fill", 1);
    steps.forEach((s) => s.classList.add("is-on"));
    return;
  }
  ScrollTrigger.create({
    trigger: wrap,
    start: "top 75%",
    end: "bottom 55%",
    scrub: 0.6,
    onUpdate: (self) => {
      const p = self.progress;
      fill.style.setProperty("--fill", p.toFixed(3));
      steps.forEach((s, i) => s.classList.toggle("is-on", p >= (i / (steps.length - 1)) * 0.98 - 0.001));
    },
  });
}

function initStackCards() {
  if (!hasGsap || reduced) return;
  const cards = $$("[data-project]");
  gsap.matchMedia().add("(min-width: 1024px) and (min-height: 760px)", () => {
    cards.forEach((c, i) => c.style.setProperty("--i", i));
    const triggers = cards.slice(0, -1).map((card, i) =>
      ScrollTrigger.create({
        trigger: cards[i + 1],
        start: "top bottom",
        end: () => `top ${headerOffset() + 8 + (i + 1) * 12}px`,
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          card.style.setProperty("--dim", (p * 0.65).toFixed(3));
          card.style.transform = `scale(${(1 - p * 0.06).toFixed(4)}) rotateX(${(p * 4).toFixed(2)}deg)`;
        },
      })
    );
    return () => {
      triggers.forEach((t) => t.kill());
      cards.forEach((c) => {
        c.style.removeProperty("--i");
        c.style.removeProperty("--dim");
        c.style.transform = "";
      });
    };
  });
}

// Desktop only: on stacked layouts the intro sits below the portrait and is read
// mid-scroll, so it must not fade away.
function initHeroScroll() {
  if (!hasGsap || reduced) return;
  gsap.matchMedia().add("(min-width: 1024px) and (min-height: 621px)", () => {
    const st = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
    gsap.to(".portrait", { yPercent: 10, scale: 0.92, ease: "none", scrollTrigger: st });
    gsap.to(".hero__id", { yPercent: -40, opacity: 0.2, ease: "none", scrollTrigger: st });
    gsap.to(".hero__pitch", { yPercent: -60, opacity: 0, ease: "none", scrollTrigger: st });
    gsap.to(".hero__marquee", { yPercent: -60, ease: "none", scrollTrigger: st });
  });
}

function initFooterWord() {
  const a = $("[data-footer-word] span");
  if (!a) return;
  const chars = splitChars(a, "char");
  if (!hasGsap || reduced) return;
  gsap.set(chars, { transition: "none" });
  gsap.from(chars, {
    yPercent: 100,
    duration: 1.3,
    ease: "expo.out",
    stagger: 0.06,
    scrollTrigger: { trigger: a, start: "top 95%", once: true },
    onComplete: () => gsap.set(chars, { clearProps: "all" }),
  });
}

/* ---------- Ball pit (loaded when its section approaches) ---------- */

(function pit() {
  const root = $("[data-pit]");
  if (!root) return;
  const io = new IntersectionObserver(
    async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const { initPit } = await import("./pit.js?v=20261021c");
      initPit(root, { reduced });
    },
    { rootMargin: "600px 0px" }
  );
  io.observe(root);
})();

/* ---------- Boot ---------- */

const field = $("[data-field]") ? initField($("[data-field]"), { reduced }) : null;
if (field) {
  field.setScenes($$("[data-scene]").map((el) => ({ el, name: el.dataset.scene })));
  field.setAnchors({ halo: $("[data-portrait]"), vortex: $("#contact-title") });
  const atmos = $(".atmosphere");
  field.state.onScene = (scene) => atmos.style.setProperty("--warmth", scene === "vortex" ? 1 : 0);
}

const portraitFig = $("[data-portrait]");
const portrait = portraitFig ? initPortrait(portraitFig, { reduced, gsap: hasGsap ? gsap : null }) : null;
initCursor($("[data-cursor-root]"));
const grim = initGrim({ gsap: hasGsap ? gsap : null, reduced, scrollTo: scrollToTarget, copy });

const titleEl = $("[data-scramble]");
if (titleEl) accessibleCopy(titleEl);

// The loading screen stays until everything above the fold is ready: fonts,
// the portrait, every eagerly loaded file, and a first frame of the particle
// field. The GrimNej word fills with real progress, then the curtain lifts.
// A safety timeout lifts it on very slow connections.
async function waitForReady(firstVisit) {
  const pre = $("[data-preloader]");
  const pct = $("[data-preloader-pct]");
  const img = $("[data-portrait-img]");
  const shown = { v: 0 };
  const paint = () => {
    pre?.style.setProperty("--fill", shown.v.toFixed(3));
    if (pct) pct.textContent = Math.round(shown.v * 100);
  };
  let done = 0;
  const steps = [
    document.fonts ? document.fonts.ready : null,
    img?.decode ? img.decode().catch(() => {}) : null,
    document.readyState === "complete" ? null : new Promise((r) => window.addEventListener("load", r, { once: true })),
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  ].map((step) =>
    Promise.resolve(step).then(() => {
      done += 1;
      const target = done / 4;
      if (hasGsap && !reduced) gsap.to(shown, { v: target, duration: 0.6, ease: "power2.out", onUpdate: paint, overwrite: true });
      else {
        shown.v = target;
        paint();
      }
    })
  );
  const started = performance.now();
  await Promise.race([Promise.all(steps), wait(9000)]);
  // Let the fill finish, and give first-time visitors a beat to see the word.
  const minimum = reduced ? 0 : firstVisit ? 1500 : 600;
  await wait(Math.max(0, minimum - (performance.now() - started)));
  if (hasGsap && !reduced) await gsap.to(shown, { v: 1, duration: 0.45, ease: "power2.out", onUpdate: paint, overwrite: true });
  else {
    shown.v = 1;
    paint();
  }
  if (!reduced) await wait(220);
}

async function intro() {
  let firstVisit = true;
  try {
    firstVisit = !sessionStorage.getItem("seen");
    sessionStorage.setItem("seen", "1");
  } catch {
    /* ignore */
  }
  await waitForReady(firstVisit);

  portrait?.prepare();
  const nameFx = initName({ gsap: hasGsap ? gsap : null, fine, reduced });
  const nameChars = nameFx.chars;
  initWordLight();
  initHeadings();
  initSteps();
  initStackCards();
  initFooterWord();
  initHeroScroll();

  $("[data-preloader]")?.classList.add("is-done");
  const name = $(".hero__name");

  if (!hasGsap || reduced) {
    name?.classList.add("is-open");
    if (field) field.state.intro = 1;
    portrait?.playIntro();
    grim?.hello();
    return;
  }

  const tl = gsap.timeline({
    defaults: { ease: "expo.out" },
    onComplete: () => {
      name?.classList.add("is-open");
      nameFx.reveal();
    },
  });
  tl.from(nameChars, { yPercent: 120, rotate: 8, duration: 1.4, stagger: 0.04 }, 0.35)
    .from("[data-hero-in]", { y: 30, opacity: 0, duration: 1.1, ease: "power3.out", stagger: 0.1, clearProps: "transform,opacity" }, 0.7)
    .add(() => scramble(titleEl, 1.1), 0.75)
    .add(() => portrait?.playIntro(), 0.4)
    .from(".hero__marquee", { xPercent: 30, opacity: 0, duration: 1.8 }, 0.6)
    .from(".hero__orb", { scale: 0, rotate: -120, duration: 1.4, ease: "back.out(1.4)" }, 1.1)
    .from(".header", { opacity: 0, duration: 1, clearProps: "opacity" }, 0.6)
    .add(() => grim?.hello(), 1.6);
  if (field) gsap.to(field.state, { intro: 1, duration: 3, ease: "power2.out", delay: 0.3 });
  if (marquee) {
    marquee.boost = 900;
    gsap.to(marquee, { boost: 0, duration: 2.4, ease: "power3.out", delay: 0.6 });
  }

  if (fine && titleEl) titleEl.parentElement.addEventListener("pointerenter", () => scramble(titleEl, 0.7));
}

intro().then(() => hasGsap && ScrollTrigger.refresh());
initGitHub().then(() => hasGsap && ScrollTrigger.refresh());
window.addEventListener("load", () => hasGsap && ScrollTrigger.refresh());

console.log(
  "%cHey, fellow chronically online person.%c\nLike what you see? grim98413@gmail.com",
  "font: 700 14px system-ui; color: #ff6b3d",
  "font: 13px system-ui; color: #a9aebe"
);
