/**
 * 嫣 — virtualized grid gallery (performance-first)
 * Only visible cards are in the DOM. Grid uses thumbs; lightbox uses full images.
 */
(() => {
  "use strict";

  const scroller = document.getElementById("scroller");
  const spacer = document.getElementById("spacer");
  const galleryEl = document.getElementById("gallery");
  const loaderEl = document.getElementById("loader");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbName = document.getElementById("lb-name");

  /** @type {Array<{src:string,thumb?:string,name?:string,date?:string,caption?:string}>} */
  let images = [];
  let current = 0;
  let viewMode = "large";

  // layout metrics
  let cols = 1;
  let cellW = 0;
  let cellH = 0;
  let gap = 8;
  let pad = 10;
  let totalRows = 0;
  let scrollRaf = 0;
  let resizeRaf = 0;

  // virtual window
  const ROW_BUFFER = 2;
  /** @type {Map<number, HTMLElement>} */
  const mounted = new Map();
  const preloadCache = new Set();

  // aspect ratio for uniform cells (portrait-friendly, no reflow)
  const ASPECT = 3 / 4; // w/h → height = width / ASPECT? wait: portrait is taller: h/w = 4/3
  const ASPECT_H_OVER_W = 4 / 3;

  function assetUrl(src) {
    return String(src || "")
      .replace(/^\//, "")
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
  }

  function thumbOf(item) {
    return item.thumb || item.src;
  }

  function fullOf(item) {
    return item.src;
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
    const p = String(dateStr).split("-");
    return p.length >= 3 ? `${p[0]}.${p[1]}.${p[2]}` : "";
  }

  function minColForMode() {
    // match CSS clamps approximately for JS layout
    const w = scroller.clientWidth - pad * 2;
    if (viewMode === "small") {
      if (w < 400) return 96;
      if (w < 900) return Math.max(100, w * 0.18);
      return 140;
    }
    if (w < 500) return 160;
    if (w < 900) return Math.max(200, w * 0.28);
    return 280;
  }

  function measure() {
    const style = getComputedStyle(document.documentElement);
    gap = parseFloat(style.getPropertyValue("--gap")) || 8;
    pad = parseFloat(style.getPropertyValue("--pad")) || 10;

    const innerW = Math.max(0, scroller.clientWidth - pad * 2);
    const minCol = minColForMode();
    cols = Math.max(1, Math.floor((innerW + gap) / (minCol + gap)));
    cellW = (innerW - gap * (cols - 1)) / cols;
    cellH = cellW * ASPECT_H_OVER_W;
    totalRows = Math.ceil(images.length / cols) || 0;

    const totalH = totalRows > 0 ? totalRows * cellH + (totalRows - 1) * gap : 0;
    spacer.style.height = `${totalH}px`;
    galleryEl.style.height = `${totalH}px`;
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
    measure();
    syncWindow(true);
  }

  function createCard(index) {
    const item = images[index];
    const label = displayName(item);
    const date = formatDate(item.date);

    const card = document.createElement("article");
    card.className = "card";
    card.dataset.index = String(index);
    card.tabIndex = 0;
    card.setAttribute("role", "listitem");
    card.setAttribute("aria-label", label);

    const wrap = document.createElement("div");
    wrap.className = "card-img-wrap";

    const img = document.createElement("img");
    img.alt = label;
    img.decoding = "async";
    img.loading = "lazy";
    img.draggable = false;
    img.src = assetUrl(thumbOf(item));

    const nameEl = document.createElement("p");
    nameEl.className = "card-name";
    nameEl.append(document.createTextNode(label));
    if (date && viewMode === "large") {
      const d = document.createElement("span");
      d.className = "card-date";
      d.textContent = date;
      nameEl.appendChild(d);
    }

    wrap.append(img, nameEl);
    card.appendChild(wrap);
    return card;
  }

  function positionCard(card, index) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const x = col * (cellW + gap);
    const y = row * (cellH + gap);
    card.style.width = `${cellW}px`;
    card.style.height = `${cellH}px`;
    card.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function visibleRange() {
    const st = scroller.scrollTop;
    const vh = scroller.clientHeight;
    const rowH = cellH + gap;
    if (rowH <= 0 || !images.length) return { start: 0, end: -1 };

    let startRow = Math.floor(st / rowH) - ROW_BUFFER;
    let endRow = Math.ceil((st + vh) / rowH) + ROW_BUFFER;
    startRow = Math.max(0, startRow);
    endRow = Math.min(totalRows - 1, endRow);

    const start = startRow * cols;
    const end = Math.min(images.length - 1, (endRow + 1) * cols - 1);
    return { start, end };
  }

  function syncWindow(force) {
    const { start, end } = visibleRange();
    if (end < start) {
      // empty
      for (const [idx, el] of mounted) {
        el.remove();
        mounted.delete(idx);
      }
      return;
    }

    // unmount outside window
    for (const [idx, el] of mounted) {
      if (idx < start || idx > end) {
        el.remove();
        mounted.delete(idx);
      } else if (force) {
        positionCard(el, idx);
      }
    }

    // mount missing
    const frag = document.createDocumentFragment();
    let added = false;
    for (let i = start; i <= end; i++) {
      let el = mounted.get(i);
      if (!el) {
        el = createCard(i);
        mounted.set(i, el);
        frag.appendChild(el);
        added = true;
      }
      positionCard(el, i);
    }
    if (added) galleryEl.appendChild(frag);
  }

  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      syncWindow(false);
    });
  }

  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      measure();
      syncWindow(true);
    });
  }

  function preloadUrl(url) {
    if (!url || preloadCache.has(url)) return;
    preloadCache.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }

  function preloadNeighbors() {
    if (!images.length) return;
    for (const d of [1, -1]) {
      const idx = (current + d + images.length) % images.length;
      preloadUrl(assetUrl(fullOf(images[idx])));
    }
  }

  function showLightboxImage() {
    const item = images[current];
    if (!item) return;
    const label = displayName(item);
    const full = assetUrl(fullOf(item));
    const thumb = assetUrl(thumbOf(item));
    lbImg.alt = label;
    if (lbName) lbName.textContent = label;

    // show thumb instantly, upgrade to full
    if (lbImg.dataset.full !== full) {
      lbImg.dataset.full = full;
      lbImg.src = thumb;
      const hi = new Image();
      hi.decoding = "async";
      hi.onload = () => {
        if (lbImg.dataset.full === full) lbImg.src = full;
      };
      hi.src = full;
    }
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
        delete lbImg.dataset.full;
        if (lbName) lbName.textContent = "";
      }
    }, 200);
  }

  function nav(delta) {
    if (!images.length) return;
    current = (current + delta + images.length) % images.length;
    showLightboxImage();
  }

  // events
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  galleryEl.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;
    const idx = Number(card.dataset.index);
    if (Number.isFinite(idx)) openLightbox(idx);
  });

  galleryEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".card");
    if (!card) return;
    e.preventDefault();
    const idx = Number(card.dataset.index);
    if (Number.isFinite(idx)) openLightbox(idx);
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

  scroller.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    // only on http(s) hosts (not file://)
    if (!/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  async function init() {
    try {
      const res = await fetch("images.json", { cache: "force-cache" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      images = data.slice().sort((a, b) => {
        return (b.date || "").localeCompare(a.date || "") || (b.name || "").localeCompare(a.name || "");
      });

      loaderEl.classList.add("hidden");
      measure();
      syncWindow(true);
      registerSW();
    } catch (err) {
      console.error(err);
      loaderEl.innerHTML = "";
    }
  }

  init();
})();
