(() => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     Photo blob pointer tilt
     --------------------------------------------------------- */
  const stage = document.getElementById("photoStage");
  const blob = document.getElementById("photoBlob");

  if (stage && blob && !reduceMotion && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const MAX_TILT = 8;

    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      const rotateY = x * MAX_TILT * 2;
      const rotateX = y * -MAX_TILT * 2;
      blob.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    stage.addEventListener("pointerleave", () => {
      blob.style.transform = "rotateX(0deg) rotateY(0deg)";
    });
  }

  /* ---------------------------------------------------------
     Contact sheet — a <dialog> that slides up from the bottom.
     showModal()/close() drive the CSS transition; native focus
     trap + Escape-to-close come for free from <dialog>.
     --------------------------------------------------------- */
  const contactCta = document.getElementById("contactCta");
  const contactSheet = document.getElementById("contact");
  const sheetClose = document.getElementById("sheetClose");
  const sheetPanel = document.getElementById("sheetPanel");

  // The bird's resting spot is pinned to the sheet panel's actual
  // rendered height (measured live), not its CSS max-height ceiling —
  // the panel's real content is much shorter than that ceiling, so
  // guessing from CSS alone left the bird stranded well above the
  // sheet's real top edge.
  function alignBirdToPanel() {
    if (!sheetPanel) return;
    const height = sheetPanel.offsetHeight;
    contactSheet.style.setProperty("--sheet-panel-height", `${height}px`);
  }

  if (contactCta && contactSheet) {
    contactCta.addEventListener("click", () => {
      contactSheet.showModal();
      alignBirdToPanel();
    });

    if (sheetClose) {
      sheetClose.addEventListener("click", () => contactSheet.close());
    }

    // Click on the backdrop (the dialog element itself, outside its
    // content box) closes it.
    contactSheet.addEventListener("click", (event) => {
      if (event.target === contactSheet) contactSheet.close();
    });

    // Preserve the work.html "Contact" link (index.html#contact),
    // which used to scroll to an always-visible section.
    if (window.location.hash === "#contact") {
      contactSheet.showModal();
      alignBirdToPanel();
    }
  }

  /* ---------------------------------------------------------
     Copy-to-clipboard — any button with data-copy="value"
     (email address, demo username/password, etc).
     --------------------------------------------------------- */
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const temp = document.createElement("textarea");
        temp.value = value;
        temp.style.position = "fixed";
        temp.style.opacity = "0";
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
      }
      btn.classList.add("copied");
      window.clearTimeout(btn._copyTimer);
      btn._copyTimer = window.setTimeout(() => btn.classList.remove("copied"), 1600);
    });
  });

  /* ---------------------------------------------------------
     Repo grid rendering (work.html only) — own repos and starred
     repos render into one unified grid; the "Starred" badge/owner
     line still distinguishes repos that aren't Ahmad's own work.
     --------------------------------------------------------- */
  const reposGrid = document.getElementById("reposGrid");
  const template = document.getElementById("repoCardTemplate");

  if (reposGrid && template) {
    fetch("data/repos.json")
      .then((res) => res.json())
      .then((data) => {
        const combined = [
          ...(data.own || []).map((repo) => ({ ...repo, starred: false })),
          ...(data.starred || []).map((repo) => ({ ...repo, starred: true })),
        ];
        renderRepos(reposGrid, combined);
        observeCards();
      })
      .catch((err) => {
        console.error("Could not load repo data:", err);
        reposGrid.innerHTML =
          '<li class="repo-card clay"><p class="repo-desc">Couldn’t load projects right now — please check back shortly.</p></li>';
      });
  }

  function formatCount(n) {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
  }

  function renderRepos(grid, repos) {
    const fragment = document.createDocumentFragment();

    repos.forEach((repo, index) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.style.setProperty("--i", index);
      const starred = !!repo.starred;

      node.querySelector(".repo-name").textContent = repo.name;

      const tag = node.querySelector(".starred-tag");
      if (starred) {
        tag.hidden = false;
      } else {
        tag.remove();
      }

      const ownerEl = node.querySelector(".repo-owner");
      if (starred && repo.owner) {
        ownerEl.hidden = false;
        ownerEl.textContent = `by ${repo.owner}`;
      } else {
        ownerEl.remove();
      }

      node.querySelector(".repo-desc").textContent =
        repo.description || "No description yet.";

      if (repo.language) {
        const langChip = node.querySelector(".lang-chip");
        langChip.hidden = false;
        langChip.querySelector(".lang-dot").style.background = repo.languageColor || "var(--muted)";
        langChip.querySelector(".lang-name").textContent = repo.language;
      } else {
        node.querySelector(".lang-chip").remove();
      }

      if (starred && typeof repo.stars === "number") {
        const starStat = node.querySelector(".stat-stars");
        starStat.hidden = false;
        starStat.querySelector(".stat-stars-value").textContent = formatCount(repo.stars);
      } else {
        node.querySelector(".stat-stars").remove();
      }

      if (starred && repo.forks) {
        const forkStat = node.querySelector(".stat-forks");
        forkStat.hidden = false;
        forkStat.querySelector(".stat-forks-value").textContent = formatCount(repo.forks);
      } else {
        node.querySelector(".stat-forks").remove();
      }

      const repoLink = node.querySelector(".repo-link-repo");
      repoLink.href = repo.url;

      const demoLink = node.querySelector(".repo-link-demo");
      if (repo.homepage) {
        demoLink.hidden = false;
        demoLink.href = repo.homepage;
      } else {
        demoLink.remove();
      }

      fragment.appendChild(node);
    });

    grid.innerHTML = "";
    grid.appendChild(fragment);
  }

  /* ---------------------------------------------------------
     Featured project slideshows — autoplay, dot navigation,
     pause on hover/focus/offscreen, reduced-motion aware.
     --------------------------------------------------------- */
  document.querySelectorAll(".project-slideshow").forEach((el) => {
    const slides = [...el.querySelectorAll(".slide")];
    const dotsContainer = el.querySelector(".slideshow-dots");
    if (slides.length === 0) return;

    if (slides.length === 1) {
      if (dotsContainer) dotsContainer.hidden = true;
      return;
    }

    const interval = Number(el.dataset.autoplay) || 4500;
    let index = Math.max(0, slides.findIndex((s) => s.classList.contains("is-active")));
    let timer = null;

    const dots = slides.map((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = i === index ? "dot is-active" : "dot";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-selected", i === index ? "true" : "false");
      dot.setAttribute("aria-label", `Show screenshot ${i + 1} of ${slides.length}`);
      dot.addEventListener("click", () => {
        goTo(i);
        restart();
      });
      dotsContainer.appendChild(dot);
      return dot;
    });

    function goTo(next) {
      slides[index].classList.remove("is-active");
      dots[index].classList.remove("is-active");
      dots[index].setAttribute("aria-selected", "false");
      index = (next + slides.length) % slides.length;
      slides[index].classList.add("is-active");
      dots[index].classList.add("is-active");
      dots[index].setAttribute("aria-selected", "true");
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      if (reduceMotion) return;
      stop();
      timer = window.setInterval(() => goTo(index + 1), interval);
    }

    function restart() {
      stop();
      start();
    }

    el.addEventListener("mouseenter", stop);
    el.addEventListener("mouseleave", start);
    el.addEventListener("focusin", stop);
    el.addEventListener("focusout", start);

    if ("IntersectionObserver" in window) {
      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
        },
        { threshold: 0.25 }
      );
      visibilityObserver.observe(el);
    } else {
      start();
    }
  });

  function observeCards() {
    const cards = document.querySelectorAll(".repo-card");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      cards.forEach((card) => card.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    cards.forEach((card) => observer.observe(card));
  }

  /* ---------------------------------------------------------
     Scroll-following bird (work.html only) — travels continuously
     down the left margin in direct proportion to scroll position
     through the featured-projects region (no per-project snapping),
     and flaps faster the faster you scroll, decaying back to an
     idle flap rate when scrolling stops. Wide viewports only: below
     1440px there's no usable left margin for it to live in (also
     enforced in CSS as a hard fallback).
     --------------------------------------------------------- */
  const workBird = document.getElementById("workBird");
  const featuredProjects = [...document.querySelectorAll(".featured-project")];

  if (
    workBird &&
    featuredProjects.length > 1 &&
    !reduceMotion &&
    window.matchMedia("(min-width: 1440px)").matches
  ) {
    const TRAVEL_TOP_VH = 12;
    const TRAVEL_BOTTOM_VH = 88;
    const IDLE_FLAP_MS = 420;
    const FAST_FLAP_MS = 90;
    const VELOCITY_TO_MS = 65; // ms shaved off per px/ms of scroll speed
    const IDLE_DELAY_MS = 200;

    let zoneStart = 0;
    let zoneEnd = 0;
    let ticking = false;
    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let idleTimer = null;

    function measureZone() {
      const first = featuredProjects[0];
      const last = featuredProjects[featuredProjects.length - 1];
      const viewportH = window.innerHeight;
      // progress 0 = project 1's top just entering the viewport;
      // progress 1 = last project's bottom just leaving the viewport.
      zoneStart = first.offsetTop - viewportH;
      zoneEnd = last.offsetTop + last.offsetHeight;
    }

    function setFlapDuration(ms) {
      workBird.style.setProperty("--flap-duration", `${ms}ms`);
    }

    function updateBird() {
      ticking = false;
      const scrollY = window.scrollY;

      const buffer = window.innerHeight * 0.3;
      const inZone = scrollY >= zoneStart - buffer && scrollY <= zoneEnd + buffer;
      workBird.classList.toggle("is-visible", inZone);

      if (inZone) {
        const progress = Math.min(Math.max((scrollY - zoneStart) / (zoneEnd - zoneStart), 0), 1);
        const topVh = TRAVEL_TOP_VH + (TRAVEL_BOTTOM_VH - TRAVEL_TOP_VH) * progress;
        workBird.style.top = `${topVh}vh`;
      }

      // Flap speed tracks scroll velocity (px/ms), sampled once per
      // frame so it reflects real scroll speed rather than raw event
      // noise; eases back to idle shortly after scrolling stops.
      const now = performance.now();
      const dt = Math.max(now - lastTime, 1);
      const velocity = Math.abs(scrollY - lastScrollY) / dt;
      lastScrollY = scrollY;
      lastTime = now;

      const flapMs = Math.min(
        IDLE_FLAP_MS,
        Math.max(FAST_FLAP_MS, IDLE_FLAP_MS - velocity * VELOCITY_TO_MS)
      );
      setFlapDuration(flapMs);

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setFlapDuration(IDLE_FLAP_MS), IDLE_DELAY_MS);
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateBird);
      }
    }

    measureZone();
    updateBird();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      measureZone();
      updateBird();
    });
  }
})();
