// Toggles the hamburger menu open and closed on mobile
function toggleMenu() {
  const menu = document.querySelector(".menu-links");
  const icon = document.querySelector(".hamburger-icon");
  menu.classList.toggle("open");
  icon.classList.toggle("open");
}

// Fade-in on scroll using IntersectionObserver
const fadeElements = document.querySelectorAll(".fade-in");
const fadeObserver = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        // stop observing once visible
        fadeObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

fadeElements.forEach(function (el) {
  fadeObserver.observe(el);
});