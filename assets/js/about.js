// About. On large screens it is a pinned scene: the photo starts as a small
// card with "About me" over it, the two words split apart (leaving echo
// trails) while the card opens to fill the screen, then the copy settles in
// and the statement lights up word by word as you keep scrolling. Everywhere
// else it is a plain section and the statement lights up as it passes.

export function initAbout({ gsap, ScrollTrigger, reduced }) {
  const root = document.querySelector("[data-about]");
  if (!root) return;
  const statement = root.querySelector("[data-words]");

  // Wrap each word so it can light up on its own.
  const words = statement.textContent.trim().split(/\s+/);
  statement.textContent = "";
  words.forEach((w, i) => {
    const s = document.createElement("span");
    s.className = "w";
    s.textContent = w;
    statement.append(s);
    if (i < words.length - 1) statement.append(" ");
  });
  const spans = [...statement.querySelectorAll(".w")];
  const light = (p) => {
    const n = Math.round(p * spans.length);
    spans.forEach((s, i) => s.classList.toggle("is-lit", i < n));
  };

  if (reduced || !gsap || !ScrollTrigger) {
    light(1);
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 1024px) and (min-height: 700px)", () => {
    root.classList.add("is-scene");
    const stage = root.querySelector("[data-about-stage]");
    const card = root.querySelector("[data-about-card]");
    const img = root.querySelector("[data-about-photo] img");
    const inside = root.querySelector("[data-about-inside]");
    const [wordA, wordB] = root.querySelectorAll("[data-about-word]");
    const hud = root.querySelector("[data-about-hud]");
    const sweep = root.querySelector("[data-about-sweep]");
    root.querySelector(".about__title").classList.add("echo");
    img.loading = "eager";

    // The card starts as a portrait in the middle of the panel, with the photo
    // shrunk around the face so the face fills it.
    const frame = () => {
      const w = card.clientWidth;
      const h = card.clientHeight;
      const iw = img.clientWidth; // the photo starts at the card's left edge
      const ih = img.clientHeight;
      const cw = Math.min(Math.max(w * 0.21, 240), 340);
      const ch = Math.min(cw * 1.28, h * 0.62);
      const s = Math.max(iw, ih) / 1000; // object-fit: cover on the square photo
      const fx = (iw - 1000 * s) * 0.3 + 390 * s; // the face, inside the img box (object-position 30% 28%)
      const fy = (ih - 1000 * s) * 0.28 + 360 * s;
      // Never so small that the card shows past the edges of the photo.
      const k = Math.max(cw / (520 * s), cw / 2 / fx, ch / 2 / fy, cw / 2 / (iw - fx), ch / 2 / (ih - fy));
      return { w, h, cw, ch, fx, fy, k };
    };
    const small = () => {
      const f = frame();
      const x = (f.w - f.cw) / 2;
      const y = (f.h - f.ch) / 2;
      return `inset(${y}px ${x}px ${y}px ${x}px round 10px)`;
    };
    const origin = () => `${frame().fx}px ${frame().fy}px`;
    // The brackets sit on the small card, then on the corners of the open panel.
    const hudAt = (open) => {
      const f = frame();
      const x = open ? 18 : (f.w - f.cw) / 2;
      const y = open ? 18 : (f.h - f.ch) / 2;
      return { top: card.offsetTop + y, bottom: card.offsetTop + y, left: card.offsetLeft + x, right: card.offsetLeft + x };
    };
    const spread = () => card.clientWidth * 0.36;

    gsap.set(inside, { autoAlpha: 0, y: 40 });
    gsap.set(card, { "--shade": 0 });
    gsap.set(img, { "--fade": 1 });
    light(0);

    const proxy = { p: 0 };
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: () => `+=${window.innerHeight * 2.6}`,
        pin: stage,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    tl.fromTo(card, { clipPath: small }, { clipPath: "inset(0px 0px 0px 0px round 8px)", duration: 1, ease: "power2.inOut" }, 0)
      .fromTo(
        img,
        { scale: () => frame().k, x: () => frame().w / 2 - frame().fx, y: () => frame().h / 2 - frame().fy, transformOrigin: origin },
        { scale: 1, x: 0, y: 0, transformOrigin: origin, duration: 1, ease: "power2.inOut" },
        0
      )
      .fromTo(wordA, { x: 0 }, { x: () => -spread(), duration: 1, ease: "power2.in" }, 0)
      .fromTo(wordB, { x: 0 }, { x: () => spread(), duration: 1, ease: "power2.in" }, 0)
      // The words trail ghost copies behind them while they move.
      .fromTo(wordA, { "--ex": 0, "--ea": 0 }, { "--ex": 0.09, "--ea": 1, duration: 0.6 }, 0.1)
      .fromTo(wordB, { "--ex": 0, "--ea": 0 }, { "--ex": -0.09, "--ea": 1, duration: 0.6 }, 0.1)
      .to([wordA, wordB], { opacity: 0, duration: 0.4 }, 0.6)
      .fromTo(hud, { top: () => hudAt(false).top, bottom: () => hudAt(false).bottom, left: () => hudAt(false).left, right: () => hudAt(false).right },
        { top: () => hudAt(true).top, bottom: () => hudAt(true).bottom, left: () => hudAt(true).left, right: () => hudAt(true).right, duration: 1, ease: "power2.inOut" }, 0)
      .to(hud, { opacity: 0.55, duration: 0.3 }, 0.8)
      .fromTo(sweep, { backgroundPosition: "130% 0%" }, { backgroundPosition: "-30% 0%", duration: 0.9, ease: "power1.inOut" }, 0.15)
      .to(img, { "--fade": 0, duration: 0.5 }, 0.55)
      .to(card, { "--shade": 1, duration: 0.4 }, 0.75)
      .to(inside, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" }, 0.9)
      .to(proxy, { p: 1, duration: 1.1, onUpdate: () => light(proxy.p) }, 1.25)
      .to({}, { duration: 0.25 });

    return () => {
      root.classList.remove("is-scene");
      root.querySelector(".about__title").classList.remove("echo");
      gsap.set([card, img, inside, wordA, wordB, hud, sweep], { clearProps: "all" });
    };
  });

  mm.add("not all and (min-width: 1024px) and (min-height: 700px)", () => {
    const st = ScrollTrigger.create({
      trigger: statement,
      start: "top 82%",
      end: "bottom 45%",
      scrub: true,
      onUpdate: (self) => light(self.progress),
    });
    return () => st.kill();
  });
}
