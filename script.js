const body = document.body;
document.documentElement.classList.add("motion-ready");
const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navPanel = document.querySelector("[data-nav-panel]");
const revealElements = document.querySelectorAll(".reveal");
const year = document.querySelector("[data-year]");
const marqueeTrack = document.querySelector(".marquee-band div");

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
