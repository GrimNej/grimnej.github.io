// How it goes. On large screens the three steps become a pinned horizontal
// track: the panels slide past while two rows of giant ghost words drift
// behind them at their own speeds, and the step titles smear (echo trails)
// with the speed of the scroll. Everywhere else the steps stay a list, and a
// rail fills as you read down it. Either way, each step lights up (and its
// graphic starts looping) once the rail reaches it.

export function initProcess({ gsap, ScrollTrigger, lenis, reduced }) {
  const root = document.querySelector("[data-process]");
  const list = root?.querySelector("[data-steps]");
  if (!root || !list) return;
  const fill = list.querySelector("[data-steps-fill]").parentElement;
  const steps = [...list.querySelectorAll(".step")];
  const mark = (p) => {
    fill.style.setProperty("--fill", p.toFixed(3));
    steps.forEach((s, i) => s.classList.toggle("is-on", p >= (i / (steps.length - 1)) * 0.98 - 0.001));
  };

  if (reduced || !gsap || !ScrollTrigger) {
    mark(1);
    return;
  }

  const mm = gsap.matchMedia();

  mm.add("(min-width: 1024px) and (min-height: 700px)", () => {
    root.classList.add("is-track");
    const stage = root.querySelector("[data-process-stage]");
    const rows = root.querySelectorAll("[data-process-row]");
    // How far the strip travels: until the last step's right edge meets the page grid.
    const dist = () => {
      const wrap = list.parentElement;
      const pad = parseFloat(getComputedStyle(wrap).paddingLeft) || 0;
      return Math.max(0, list.scrollWidth - (wrap.clientWidth - pad * 2));
    };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: stage,
        start: "top top",
        end: () => `+=${dist() + window.innerHeight * 0.6}`,
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => mark(self.progress),
      },
    });
    tl.to(list, { x: () => -dist(), duration: 1 }, 0)
      .fromTo(rows[0], { xPercent: 0 }, { xPercent: -28, duration: 1 }, 0)
      .fromTo(rows[1], { xPercent: -30 }, { xPercent: -4, duration: 1 }, 0);

    // The titles trail ghost copies behind them, as long as the track is moving.
    const smear = { x: 0, a: 0 };
    const tick = () => {
      const v = lenis && tl.scrollTrigger.isActive ? lenis.velocity : 0;
      smear.x += (Math.max(-0.08, Math.min(0.08, v * 0.003)) - smear.x) * 0.14;
      smear.a += (Math.min(Math.abs(v) / 24, 1) - smear.a) * 0.14;
      if (Math.abs(smear.x) < 0.001 && smear.a < 0.01) {
        if (list.style.getPropertyValue("--ea") !== "0") {
          list.style.setProperty("--ex", "0");
          list.style.setProperty("--ea", "0");
        }
        return;
      }
      list.style.setProperty("--ex", smear.x.toFixed(4));
      list.style.setProperty("--ea", smear.a.toFixed(3));
    };
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      root.classList.remove("is-track");
      gsap.set([list, ...rows], { clearProps: "all" });
    };
  });

  mm.add("not all and (min-width: 1024px) and (min-height: 700px)", () => {
    const st = ScrollTrigger.create({
      trigger: list,
      start: "top 75%",
      end: "bottom 55%",
      scrub: 0.6,
      onUpdate: (self) => mark(self.progress),
    });
    return () => st.kill();
  });
}
