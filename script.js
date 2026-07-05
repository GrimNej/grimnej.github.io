const body = document.body;
document.documentElement.classList.add("motion-ready");
const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navPanel = document.querySelector("[data-nav-panel]");
const revealElements = document.querySelectorAll(".reveal");
const year = document.querySelector("[data-year]");
const marqueeTrack = document.querySelector(".marquee-band div");
const projectOrbit = document.querySelector("[data-project-orbit]");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (marqueeTrack) {
  marqueeTrack.innerHTML += marqueeTrack.innerHTML;
}

function closeNavigation() {
  if (!navToggle || !navPanel) {
    return;
  }

  navToggle.setAttribute("aria-expanded", "false");
  navToggle.setAttribute("aria-label", "Open menu");
  navPanel.classList.remove("is-open");
  body.classList.remove("nav-open");
}

if (navToggle && navPanel) {
  navToggle.addEventListener("click", function () {
    const isOpen = navToggle.getAttribute("aria-expanded") === "true";

    navToggle.setAttribute("aria-expanded", String(!isOpen));
    navToggle.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
    navPanel.classList.toggle("is-open", !isOpen);
    body.classList.toggle("nav-open", !isOpen);
  });

  navPanel.addEventListener("click", function (event) {
    if (event.target instanceof HTMLAnchorElement) {
      closeNavigation();
    }
  });

  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeNavigation();
    }
  });
}

function updateHeaderState() {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 8);
}

updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });

function scrollToHashTarget() {
  if (!window.location.hash || window.location.hash.length <= 1) {
    return;
  }

  const targetId = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById(targetId);

  if (target) {
    const targetTop = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, targetTop - 96) });
  }
}

window.addEventListener("hashchange", function () {
  window.setTimeout(scrollToHashTarget, 0);
});

window.addEventListener("load", function () {
  scrollToHashTarget();
  window.setTimeout(scrollToHashTarget, 250);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scrollToHashTarget);
  }
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
  );

  revealElements.forEach(function (element) {
    revealObserver.observe(element);
  });
} else {
  revealElements.forEach(function (element) {
    element.classList.add("is-visible");
  });
}

if (projectOrbit) {
  const stage = projectOrbit.querySelector("[data-orbit-stage]");
  const nodes = Array.from(projectOrbit.querySelectorAll("[data-orbit-node]"));
  const title = projectOrbit.querySelector("[data-orbit-title]");
  const tag = projectOrbit.querySelector("[data-orbit-tag]");
  const brief = projectOrbit.querySelector("[data-orbit-brief]");
  const link = projectOrbit.querySelector("[data-orbit-link]");
  const previous = projectOrbit.querySelector("[data-orbit-prev]");
  const next = projectOrbit.querySelector("[data-orbit-next]");

  if (stage && nodes.length && title && tag && brief && link) {
    let rotation = 0;
    let activeIndex = 0;
    let dragStartX = 0;
    let dragStartRotation = 0;
    let isDragging = false;
    let hasMoved = false;

    function normalizeIndex(index) {
      return ((index % nodes.length) + nodes.length) % nodes.length;
    }

    function shortestAngle(angle) {
      return Math.atan2(Math.sin(angle), Math.cos(angle));
    }

    function fitPanelTitle() {
      title.style.fontSize = "";

      const computed = window.getComputedStyle(title);
      let size = parseFloat(computed.fontSize);
      const minSize = 28;
      let attempts = 0;

      while (
        attempts < 18 &&
        size > minSize &&
        (title.scrollWidth > title.clientWidth || title.scrollHeight > title.clientHeight * 1.35)
      ) {
        size -= 1.5;
        title.style.fontSize = size + "px";
        attempts += 1;
      }
    }

    function setPanel(index) {
      const node = nodes[index];
      if (!node) {
        return;
      }

      title.classList.remove("is-changing");
      void title.offsetWidth;
      title.classList.add("is-changing");
      title.textContent = node.dataset.title || "";
      tag.textContent = node.dataset.tag || "";
      brief.textContent = node.dataset.brief || "";
      link.href = node.dataset.link || "#";
      link.textContent = node.dataset.title === "AI News" ? "Open live site" : "Open project";
      window.requestAnimationFrame(fitPanelTitle);
    }

    function updateOrbit() {
      const rect = stage.getBoundingClientRect();
      const radiusX = Math.min(rect.width * 0.35, 330);
      const radiusY = Math.min(rect.height * 0.12, 72);
      let nearestIndex = 0;
      let nearestDepth = -Infinity;

      nodes.forEach(function (node, index) {
        const baseAngle = (index / nodes.length) * Math.PI * 2;
        const angle = baseAngle + rotation;
        const x = Math.sin(angle) * radiusX;
        const depth = Math.cos(angle);
        const y = depth * radiusY;
        const scale = 0.72 + ((depth + 1) / 2) * 0.32;
        const opacity = 0.48 + ((depth + 1) / 2) * 0.52;

        node.style.transform =
          "translate(-50%, -50%) translate3d(" +
          x.toFixed(2) +
          "px, " +
          y.toFixed(2) +
          "px, 0) scale(" +
          scale.toFixed(3) +
          ")";
        node.style.opacity = opacity.toFixed(3);
        node.style.zIndex = String(Math.round((depth + 1) * 100));

        if (depth > nearestDepth) {
          nearestDepth = depth;
          nearestIndex = index;
        }
      });

      if (nearestIndex !== activeIndex) {
        nodes[activeIndex].classList.remove("is-active");
        activeIndex = nearestIndex;
        nodes[activeIndex].classList.add("is-active");
        setPanel(activeIndex);
      }
    }

    function focusProject(index) {
      const targetIndex = normalizeIndex(index);
      const baseAngle = (targetIndex / nodes.length) * Math.PI * 2;
      const targetRotation = -baseAngle;
      rotation += shortestAngle(targetRotation - rotation);
      updateOrbit();
    }

    nodes.forEach(function (node, index) {
      node.addEventListener("click", function () {
        if (hasMoved) {
          return;
        }

        focusProject(index);
      });
    });

    if (previous) {
      previous.addEventListener("click", function () {
        focusProject(activeIndex - 1);
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        focusProject(activeIndex + 1);
      });
    }

    stage.addEventListener("pointerdown", function (event) {
      isDragging = true;
      hasMoved = false;
      dragStartX = event.clientX;
      dragStartRotation = rotation;
      stage.classList.add("is-dragging");
      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener("pointermove", function (event) {
      if (!isDragging) {
        return;
      }

      const deltaX = event.clientX - dragStartX;
      if (Math.abs(deltaX) > 4) {
        hasMoved = true;
      }

      rotation = dragStartRotation + deltaX / 155;
      updateOrbit();
    });

    function stopDragging(event) {
      if (!isDragging) {
        return;
      }

      isDragging = false;
      stage.classList.remove("is-dragging");

      if (stage.hasPointerCapture(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }

      window.setTimeout(function () {
        hasMoved = false;
      }, 0);
    }

    stage.addEventListener("pointerup", stopDragging);
    stage.addEventListener("pointercancel", stopDragging);

    window.addEventListener("resize", function () {
      updateOrbit();
      fitPanelTitle();
    });
    nodes[activeIndex].classList.add("is-active");
    setPanel(activeIndex);
    updateOrbit();
  }
}
