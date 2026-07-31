/**
 * 嫣 — full-width gallery (performance-tuned)
 */
(() => {
  "use strict";

  const galleryEl = document.getElementById("gallery");
  const loaderEl = document.getElementById("loader");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbName = document.getElementById("lb-name");
  const floatersEl = document.getElementById("floaters");
  const cursorGlow = document.getElementById("cursor-glow");
  const scrollProgress = document.getElementById("scroll-progress");

  const TONES = ["tone-rose", "tone-gold", "tone-peach", ""];
  const EAGER_COUNT = 8;
  const BATCH = 24;

  let images = [];
  let current = 0;
  let viewMode = "large";
  let reducedMotion = false;

  try {
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) {}

  function assetUrl(src) {
    return String(src || "")
      .replace(/^\//, "")
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
  }

  function displayName(item) {
    if (item.caption && String(item.caption).trim()) {
      return String(item.caption).replace(/\s+/g, " ").trim();
    }
    let n = item.name || item.src || "";
    n = n.replace(/^.*[\\/]/, "");
    n = n.replace(/\.(jpe?g|png|webp|gif)$/i, "");
    n = n.replace(/^sad_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/, "");
    n = n.replace(/_\d+_\d+$/, "");
    n = n.replace(/#/g, " #").replace(/\s+/g, " ").trim();
    return n || "未命名";
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const parts = String(dateStr).split("-");
    if (parts.length < 3) return "";
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }

  function setView(mode) {
    viewMode = mode === "small" ? "small" : "large";
    galleryEl.classList.toggle("view-large", viewMode === "large");
    galleryEl.classList.toggle("view-small", viewMode === "small");
    document.querySelectorAll(".view-btn").forEach((btn) => {
      const on = btn.dataset.view === viewMode;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function spawnFloaters() {
    if (!floatersEl || reducedMotion) return;
    // fewer particles = less paint
    const symbols = ["♡", "✿", "✦", "❀"];
    const n = window.innerWidth < 700 ? 5 : 8;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.textContent = symbols[i % symbols.length];
      s.style.left = `${8 + Math.random() * 84}%`;
      s.style.fontSize = `${0.7 + Math.random() * 0.7}rem`;
      s.style.animationDuration = `${16 + Math.random() * 14}s`;
      s.style.animationDelay = `${-Math.random() * 18}s`;
      s.style.color = i % 2 === 0 ? "#ffb3c1" : "#ff7aa2";
      frag.appendChild(s);
    }
    floatersEl.appendChild(frag);
  }

  /** Cursor glow: rAF only while pointer is moving */
  function initCursorGlow() {
    if (!cursorGlow || window.matchMedia("(pointer: coarse)").matches || reducedMotion) {
      if (cursorGlow) cursorGlow.style.display = "none";
      return;
    }
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let active = false;

    const tick = () => {
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      cursorGlow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) {
        raf = requestAnimationFrame(tick);
      } else {
        active = false;
        raf = 0;
      }
    };

    window.addEventListener(
      "pointermove",
      (e) => {
        tx = e.clientX;
        ty = e.clientY;
        if (!active) {
          active = true;
          raf = requestAnimationFrame(tick);
        }
      },
      { passive: true }
    );
  }

  function initScrollProgress() {
    if (!scrollProgress) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      scrollProgress.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    update();
  }

  function createCard(item, i) {
    const label = displayName(item);
    const date = formatDate(item.date);
    const tone = TONES[i % TONES.length];

    const card = document.createElement("article");
    card.className = "card" + (tone ? ` ${tone}` : "");
    card.dataset.index = String(i);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", label);
    if (!reducedMotion && i < 16) {
      card.style.animationDelay = `${i * 0.02}s`;
    } else {
      card.classList.add("card-static");
    }

    const wrap = document.createElement("div");
    wrap.className = "card-img-wrap";

    const img = document.createElement("img");
    img.alt = label;
    img.decoding = "async";
    img.draggable = false;
    if (i < EAGER_COUNT) {
      img.loading = "eager";
      img.fetchPriority = "high";
      img.src = assetUrl(item.src);
    } else {
      img.loading = "lazy";
      // defer src via data attribute — IO assigns when near viewport
      img.dataset.src = assetUrl(item.src);
    }

    const veil = document.createElement("div");
    veil.className = "card-veil";
    veil.setAttribute("aria-hidden", "true");

    const shine = document.createElement("div");
    shine.className = "card-shine";
    shine.setAttribute("aria-hidden", "true");

    const nameEl = document.createElement("p");
    nameEl.className = "card-name";
    nameEl.append(document.createTextNode(label));
    if (date) {
      const d = document.createElement("span");
      d.className = "card-date";
      d.textContent = date;
      nameEl.appendChild(d);
    }
    nameEl.title = label;

    wrap.append(img, veil, shine, nameEl);
    card.appendChild(wrap);
    return card;
  }

  /** Lazy-assign img.src for near-viewport cards */
  function observeLazyImages(root) {
    const lazy = root.querySelectorAll("img[data-src]");
    if (!lazy.length) return;

    if (!("IntersectionObserver" in window)) {
      lazy.forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute("data-src");
      });
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
          }
          io.unobserve(img);
        }
      },
      { rootMargin: "400px 0px", threshold: 0.01 }
    );

    lazy.forEach((img) => io.observe(img));
  }

  /** Render in batches to avoid long main-thread blocks */
  function render() {
    galleryEl.innerHTML = "";
    let i = 0;

    const next = () => {
      const frag = document.createDocumentFragment();
      const end = Math.min(i + BATCH, images.length);
      for (; i < end; i++) {
        frag.appendChild(createCard(images[i], i));
      }
      galleryEl.appendChild(frag);

      if (i < images.length) {
        requestAnimationFrame(next);
      } else {
        observeLazyImages(galleryEl);
      }
    };

    next();
  }

  /** Event delegation — one listener for all cards */
  function initGalleryEvents() {
    galleryEl.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card || !galleryEl.contains(card)) return;
      const idx = Number(card.dataset.index);
      if (Number.isFinite(idx)) openLightbox(idx);
    });

    galleryEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const card = e.target.closest(".card");
      if (!card || !galleryEl.contains(card)) return;
      e.preventDefault();
      const idx = Number(card.dataset.index);
      if (Number.isFinite(idx)) openLightbox(idx);
    });
  }

  function preloadNeighbors() {
    if (!images.length) return;
    const idxs = [
      (current + 1) % images.length,
      (current - 1 + images.length) % images.length,
    ];
    for (const idx of idxs) {
      const src = assetUrl(images[idx].src);
      const pre = new Image();
      pre.decoding = "async";
      pre.src = src;
    }
  }

  function showLightboxImage() {
    const item = images[current];
    if (!item) return;
    const label = displayName(item);
    lbImg.src = assetUrl(item.src);
    lbImg.alt = label;
    if (lbName) lbName.textContent = label;
    preloadNeighbors();
  }

  function openLightbox(index) {
    current = index;
    showLightboxImage();
    lightbox.hidden = false;
    void lightbox.offsetWidth;
    lightbox.classList.add("open");
    document.body.classList.add("lb-open");
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    document.body.classList.remove("lb-open");
    setTimeout(() => {
      if (!lightbox.classList.contains("open")) {
        lightbox.hidden = true;
        lbImg.removeAttribute("src");
        if (lbName) lbName.textContent = "";
      }
    }, 280);
  }

  function nav(delta) {
    if (!images.length) return;
    current = (current + delta + images.length) % images.length;
    showLightboxImage();
  }

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  lightbox.querySelector(".lb-backdrop").addEventListener("click", closeLightbox);
  lightbox.querySelector(".lb-close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".lb-prev").addEventListener("click", () => nav(-1));
  lightbox.querySelector(".lb-next").addEventListener("click", () => nav(1));

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") nav(-1);
    if (e.key === "ArrowRight") nav(1);
  });

  let touchX = null;
  lightbox.addEventListener(
    "touchstart",
    (e) => {
      touchX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );
  lightbox.addEventListener(
    "touchend",
    (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].screenX - touchX;
      if (Math.abs(dx) > 48) nav(dx > 0 ? -1 : 1);
      touchX = null;
    },
    { passive: true }
  );

  async function init() {
    setView("large");
    initGalleryEvents();
    spawnFloaters();
    initCursorGlow();
    initScrollProgress();
    try {
      const res = await fetch("images.json", { cache: "force-cache" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      images = data.slice().sort((a, b) => {
        return (b.date || "").localeCompare(a.date || "") || (b.name || "").localeCompare(a.name || "");
      });
      loaderEl.classList.add("hidden");
      render();
    } catch (err) {
      console.error(err);
      loaderEl.innerHTML = "";
    }
  }

  init();
})();
