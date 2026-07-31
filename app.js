/**
 * 嫣 — full-width image gallery
 * 大图 / 小图 via CSS column-width (continuous reflow on resize & zoom)
 */
(() => {
  "use strict";

  const galleryEl = document.getElementById("gallery");
  const loaderEl = document.getElementById("loader");
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbName = document.getElementById("lb-name");

  let images = [];
  let current = 0;
  let viewMode = "large";

  function assetUrl(src) {
    return src
      .replace(/^\//, "")
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/");
  }

  /** 展示用文件名：优先 caption（从原文件名解析的文案），否则清理 name */
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

  function render() {
    galleryEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    images.forEach((item, i) => {
      const label = displayName(item);
      const card = document.createElement("article");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", label);
      card.style.animationDelay = `${Math.min(i * 0.012, 0.6)}s`;

      const wrap = document.createElement("div");
      wrap.className = "card-img-wrap";

      const img = document.createElement("img");
      img.src = assetUrl(item.src);
      img.alt = label;
      img.loading = "lazy";
      img.decoding = "async";

      const veil = document.createElement("div");
      veil.className = "card-veil";

      const nameEl = document.createElement("p");
      nameEl.className = "card-name";
      nameEl.textContent = label;
      nameEl.title = label;

      wrap.append(img, veil, nameEl);
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

  function showLightboxImage() {
    const item = images[current];
    if (!item) return;
    const label = displayName(item);
    lbImg.src = assetUrl(item.src);
    lbImg.alt = label;
    if (lbName) lbName.textContent = label;
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
    try {
      const res = await fetch("images.json");
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
