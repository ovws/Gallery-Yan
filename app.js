/**
 * Velvet Gallery — image showcase
 */
(() => {
  "use strict";

  const galleryEl = document.getElementById("gallery");
  const emptyEl = document.getElementById("empty");
  const loaderEl = document.getElementById("loader");
  const countEl = document.getElementById("count");
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const yearEl = document.getElementById("year");

  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbCaption = document.getElementById("lb-caption");
  const lbDate = document.getElementById("lb-date");
  const lbIndex = document.getElementById("lb-index");

  let allImages = [];
  let filtered = [];
  let currentIndex = 0;

  yearEl.textContent = new Date().getFullYear();

  /** Encode path segments (safe for spaces / unicode if any remain) */
  function encodePath(path) {
    return path
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
  }

  /** Prefer relative paths so Vercel / local / subpath all work */
  function assetUrl(src) {
    return encodePath(src.replace(/^\//, ""));
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${y}.${m}.${d}`;
  }

  function debounce(fn, ms = 180) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function applyFilters() {
    const q = (searchEl.value || "").trim().toLowerCase();
    const sort = sortEl.value;

    filtered = allImages.filter((img) => {
      if (!q) return true;
      const hay = `${img.caption || ""} ${img.name || ""} ${img.date || ""}`.toLowerCase();
      return hay.includes(q);
    });

    filtered.sort((a, b) => {
      if (sort === "date-desc") {
        return (b.date || "").localeCompare(a.date || "") || b.name.localeCompare(a.name);
      }
      if (sort === "date-asc") {
        return (a.date || "").localeCompare(b.date || "") || a.name.localeCompare(b.name);
      }
      return (a.caption || a.name).localeCompare(b.caption || b.name, "zh");
    });

    renderGallery();
  }

  function renderGallery() {
    galleryEl.innerHTML = "";
    countEl.textContent = `${filtered.length} 张`;

    if (!filtered.length) {
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    const frag = document.createDocumentFragment();

    filtered.forEach((img, i) => {
      const card = document.createElement("article");
      card.className = "card";
      card.style.animationDelay = `${Math.min(i * 0.03, 0.6)}s`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute(
        "aria-label",
        img.caption ? `查看：${img.caption}` : `查看图片 ${i + 1}`
      );

      const wrap = document.createElement("div");
      wrap.className = "card-img-wrap";

      const image = document.createElement("img");
      image.src = assetUrl(img.src);
      image.alt = img.caption || "影像";
      image.loading = "lazy";
      image.decoding = "async";

      const veil = document.createElement("div");
      veil.className = "card-veil";

      const shine = document.createElement("div");
      shine.className = "card-shine";

      const info = document.createElement("div");
      info.className = "card-info";

      if (img.caption) {
        const cap = document.createElement("p");
        cap.className = "card-caption";
        cap.textContent = img.caption;
        info.appendChild(cap);
      }

      if (img.date) {
        const date = document.createElement("p");
        date.className = "card-date";
        date.textContent = formatDate(img.date);
        info.appendChild(date);
      }

      wrap.append(image, veil, shine, info);
      card.appendChild(wrap);

      const open = () => openLightbox(i);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });

      frag.appendChild(card);
    });

    galleryEl.appendChild(frag);
  }

  function openLightbox(index) {
    currentIndex = index;
    updateLightbox();
    lightbox.hidden = false;
    // force reflow for transition
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
      }
    }, 350);
  }

  function updateLightbox() {
    const img = filtered[currentIndex];
    if (!img) return;
    lbImg.src = assetUrl(img.src);
    lbImg.alt = img.caption || "影像";
    lbCaption.textContent = img.caption || "";
    lbDate.textContent = img.date ? formatDate(img.date) : "";
    lbIndex.textContent = `${currentIndex + 1} / ${filtered.length}`;
  }

  function navLightbox(delta) {
    if (!filtered.length) return;
    currentIndex = (currentIndex + delta + filtered.length) % filtered.length;
    updateLightbox();
  }

  // View toggle
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      const view = btn.dataset.view;
      galleryEl.classList.remove("masonry", "grid");
      galleryEl.classList.add(view);
    });
  });

  // Lightbox controls
  lightbox.querySelector(".lb-backdrop").addEventListener("click", closeLightbox);
  lightbox.querySelector(".lb-close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".lb-prev").addEventListener("click", () => navLightbox(-1));
  lightbox.querySelector(".lb-next").addEventListener("click", () => navLightbox(1));

  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navLightbox(-1);
    if (e.key === "ArrowRight") navLightbox(1);
  });

  // Touch swipe
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
      if (Math.abs(dx) > 50) navLightbox(dx > 0 ? -1 : 1);
      touchX = null;
    },
    { passive: true }
  );

  searchEl.addEventListener("input", debounce(applyFilters));
  sortEl.addEventListener("change", applyFilters);

  // Boot
  async function init() {
    try {
      const res = await fetch("images.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allImages = await res.json();
      loaderEl.classList.add("hidden");
      applyFilters();
    } catch (err) {
      loaderEl.innerHTML = `<p>加载失败：${err.message}</p><p style="margin-top:0.5rem;font-size:0.8rem">请通过本地服务器打开（不要用 file://）</p>`;
      console.error(err);
    }
  }

  init();
})();
