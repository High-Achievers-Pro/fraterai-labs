function init() {
  document.documentElement.classList.add("js");

  // Reveal on scroll
  const els = Array.from(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    for (const el of els) io.observe(el);
  } else {
    for (const el of els) el.classList.add("is-visible");
  }

  // Active nav link based on current page URL
  const navLinks = Array.from(document.querySelectorAll(".nav a"));
  const currentPath = window.location.pathname;
  
  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto") || link.classList.contains("btn")) return;
    
    if (currentPath.endsWith(href) || (href === "index.html" && currentPath.endsWith("/"))) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });

  // Scroll progress bar
  const progressBar = document.getElementById("scrollProgress");
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      progressBar.style.width = scrolled + "%";
    }, {passive: true});
  }
}

// The page markup is injected into DOM after load. Wait for the custom event.
window.addEventListener("ha:ready", init, { once: true });

// Fallback: if markup is already present (no injection), run on DOM ready.
if (!document.querySelector("#app")) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}

