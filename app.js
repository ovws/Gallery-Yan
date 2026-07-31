/**
 * 嫣 — virtualized grid (layout-fixed)
 */
(() => {
  "use strict";

  const scroller = document.getElementById("scroller");
  const galleryEl = document.getElementById("gallery");
  const loaderEl = document.getElementById("loader");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbName = document.getElementById("lb-name");

  let images = [];
  let current = 0;
  let viewMode = "large";

  let cols = 1;
  let cellW = 0;
  let cellH = 0;
  let gap = 8;
  let pad = 10;
  let totalRows = 0;
  let scrollRaf = 0;
  let resizeRaf = 0;

  const ROW_BUFFER = 3;
  const ASPECT_H_OVER_W = 4 / 3;
  /** @type {Map<number, HTMLElement>} */
  const mounted = new Map();
  const preloadCache = new Set();

  function assetUrl(src) {
    return String(src || "")
      .replace(/^\//, "")
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
  }

  function thumbOf(item) {
    return (item && (item.thumb || item.src)) || "";
  }

  function fullOf(item) {
    return (item && item.src) || "";
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

  function minColForMode(innerW) {
    if (viewMode === "small") {
      if (innerW < 400) return 96;
      if (innerW < 900) return Math.max(100, innerW * 0.18);
      return 140;
    }
    if (innerW < 500) return 160;
    if (innerW < 900) return Math.max(200, innerW * 0.28);
    return 280;
  }

  function measure() {
    // scroller has padding; clientWidth includes padding box, content width needs subtract
    const cs = getComputedStyle(scroller);
    pad = parseFloat(cs.paddingLeft) || 10;
    gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap")) || 8;

    const innerW = Math.max(120, scroller.clientWidth - pad * 2);
    const minCol = minColForMode(innerW);
    cols = Math.max(1, Math.floor((innerW + gap) / (minCol + gap)));
    cellW = (innerW - gap * (cols - 1)) / cols;
    cellH = cellW * ASPECT_H_OVER_W;
    totalRows = Math.max(1, Math.ceil(images.length / cols));

    const totalH =
      images.length === 0 ? 0 : totalRows * cellH + Math.max(0, totalRows - 1) * gap;

    galleryEl.style.height = `${totalH}px`;
    galleryEl.style.width = `${innerW}px`;
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
    // remount all (names/date differ by mode)
    for (const [, el] of mounted) el.remove();
    mounted.clear();
    measure();
    syncWindow();
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
    if (!images.length || cellH <= 0) return { start: 0, end: -1 };

    const st = scroller.scrollTop;
    const vh = scroller.clientHeight || window.innerHeight;
    const rowH = cellH + gap;

    let startRow = Math.floor(st / rowH) - ROW_BUFFER;
    let endRow = Math.ceil((st + vh) / rowH) + ROW_BUFFER;
    startRow = Math.max(0, startRow);
    endRow = Math.min(totalRows - 1, Math.max(startRow, endRow));

    const start = startRow * cols;
    const end = Math.min(images.length - 1, (endRow + 1) * cols - 1);
    return { start, end };
  }

  function syncWindow() {
    const { start, end } = visibleRange();

    if (end < start) {
      for (const [idx, el] of mounted) {
        el.remove();
        mounted.delete(idx);
      }
      return;
    }

    for (const [idx, el] of mounted) {
      if (idx < start || idx > end) {
        el.remove();
        mounted.delete(idx);
      }
    }

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
      syncWindow();
    });
  }

  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      measure();
      syncWindow();
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
    if (!/^https?:$/.test(location.protocol)) return;
    // bump cache by re-registering; skip if broken cache
    navigator.serviceWorker.getRegistrations().then((regs) => {
      // keep SW but don't block first paint
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  async function init() {
    try {
      // avoid stale force-cache hiding updates
      const res = await fetch("images.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("images.json " + res.status);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) throw new Error("empty list");

      images = data.slice().sort((a, b) => {
        return (b.date || "").localeCompare(a.date || "") || (b.name || "").localeCompare(a.name || "");
      });

      loaderEl.classList.add("hidden");

      // measure after loader hidden (layout stable)
      requestAnimationFrame(() => {
        measure();
        syncWindow();
        // second pass after fonts/layout settle
        requestAnimationFrame(() => {
          measure();
          syncWindow();
        });
      });

      registerSW();
    } catch (err) {
      console.error(err);
      loaderEl.innerHTML =
        '<p style="color:#ffb3c1;font-family:system-ui;padding:2rem;text-align:center">加载失败，请刷新重试</p>';
    }
  }

  init();
})();
