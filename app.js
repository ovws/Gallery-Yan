/**
 * 嫣 — gallery with reserved aspect-ratio + progressive preload
 * Pre-reserves space via tw/th so the wall does not jump while images load.
 */
(function () {
  "use strict";

  // drop legacy service workers / caches that could serve broken assets
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) {
        r.unregister();
      });
    });
  }
  if (window.caches) {
    caches.keys().then(function (keys) {
      keys.forEach(function (k) {
        caches.delete(k);
      });
    });
  }

  var wall = document.getElementById("wall");
  var statusEl = document.getElementById("status");
  var btnLarge = document.getElementById("btn-large");
  var btnSmall = document.getElementById("btn-small");
  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lb-img");
  var lbCap = document.getElementById("lb-cap");
  var lbX = document.getElementById("lb-x");
  var lbP = document.getElementById("lb-p");
  var lbN = document.getElementById("lb-n");

  var list = [];
  var cur = 0;
  var preloaded = Object.create(null);

  /** how many thumbs to fully preload before revealing wall */
  var BOOT_PRELOAD = 12;
  /** keep this many items ahead preloading while scrolling */
  var AHEAD = 8;

  function enc(src) {
    return String(src || "")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
  }

  function titleOf(item) {
    if (item.caption) return String(item.caption).replace(/\s+/g, " ").trim();
    var n = item.name || item.src || "";
    n = n.replace(/^.*[\\/]/, "").replace(/\.(jpe?g|png|webp|gif)$/i, "");
    n = n.replace(/^sad_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/, "");
    n = n.replace(/_\d+_\d+$/, "");
    n = n.replace(/#/g, " #").replace(/\s+/g, " ").trim();
    return n;
  }

  function thumbOf(item) {
    return enc(item.thumb || item.src);
  }

  function fullOf(item) {
    return enc(item.src);
  }

  /** Prefer thumb size; fall back to original; last resort 3:4 */
  function dims(item) {
    var w = item.tw || item.w || 3;
    var h = item.th || item.h || 4;
    if (!w || !h) {
      w = 3;
      h = 4;
    }
    return { w: w, h: h };
  }

  function setMode(small) {
    wall.classList.toggle("wall-small", small);
    wall.classList.toggle("wall-large", !small);
    btnLarge.classList.toggle("on", !small);
    btnSmall.classList.toggle("on", small);
    btnLarge.setAttribute("aria-pressed", small ? "false" : "true");
    btnSmall.setAttribute("aria-pressed", small ? "true" : "false");
  }

  function preloadUrl(url) {
    if (!url || preloaded[url]) {
      return Promise.resolve(url);
    }
    return new Promise(function (resolve) {
      var im = new Image();
      im.decoding = "async";
      im.onload = im.onerror = function () {
        preloaded[url] = true;
        resolve(url);
      };
      im.src = url;
    });
  }

  function preloadRange(from, count) {
    var jobs = [];
    for (var i = from; i < from + count && i < list.length; i++) {
      jobs.push(preloadUrl(thumbOf(list[i])));
    }
    return Promise.all(jobs);
  }

  function render() {
    wall.innerHTML = "";
    var frag = document.createDocumentFragment();

    for (var i = 0; i < list.length; i++) {
      (function (i) {
        var item = list[i];
        var t = titleOf(item);
        var d = dims(item);
        var src = thumbOf(item);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item";
        btn.setAttribute("aria-label", t || "图片 " + (i + 1));
        // reserve space immediately — prevents column reflow / screen jump
        btn.style.aspectRatio = d.w + " / " + d.h;

        var img = document.createElement("img");
        img.alt = t || "";
        img.width = d.w;
        img.height = d.h;
        img.decoding = "async";
        img.draggable = false;

        // already preloaded boot set → show immediately; others lazy
        if (i < BOOT_PRELOAD || preloaded[src]) {
          img.src = src;
          img.className = "ready";
          if (i < 8) img.fetchPriority = "high";
        } else {
          img.loading = "lazy";
          img.dataset.src = src;
          // transparent 1x1 keeps layout stable; real src set by IO
          img.src =
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
        }

        img.addEventListener("load", function onLoad() {
          if (img.dataset.src) return; // still placeholder
          img.classList.add("ready");
        });

        btn.appendChild(img);

        var shade = document.createElement("span");
        shade.className = "shade";
        shade.setAttribute("aria-hidden", "true");
        btn.appendChild(shade);

        var glint = document.createElement("span");
        glint.className = "glint";
        glint.setAttribute("aria-hidden", "true");
        btn.appendChild(glint);

        if (t) {
          var cap = document.createElement("span");
          cap.className = "cap";
          cap.textContent = t;
          btn.appendChild(cap);
        }

        btn.addEventListener("pointerenter", function () {
          setGaze(btn);
        });
        btn.addEventListener("pointerleave", function () {
          clearGaze(btn);
        });
        btn.addEventListener("focus", function () {
          setGaze(btn);
        });
        btn.addEventListener("blur", function () {
          clearGaze(btn);
        });

        btn.addEventListener("click", function () {
          openLb(i);
        });

        frag.appendChild(btn);
      })(i);
    }

    wall.appendChild(frag);
    observeLazy();
    initSpotlight();
    requestAnimationFrame(function () {
      preloadRange(BOOT_PRELOAD, AHEAD);
    });
  }

  /** 暧昧核心：注视一张时，其它退后 */
  function setGaze(btn) {
    wall.classList.add("is-gazing");
    var items = wall.querySelectorAll(".item");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("is-near", items[i] === btn);
    }
  }

  function clearGaze(btn) {
    if (btn) btn.classList.remove("is-near");
    // 若焦点还在别的卡片上，不取消整体注视
    var still = wall.querySelector(".item:hover, .item:focus");
    if (still) {
      setGaze(still);
      return;
    }
    wall.classList.remove("is-gazing");
    var items = wall.querySelectorAll(".item.is-near");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove("is-near");
    }
  }

  /** 暖光跟着指针慢慢走 */
  function initSpotlight() {
    var spot = document.getElementById("room-spot");
    if (!spot) return;
    try {
      if (window.matchMedia("(pointer: coarse)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch (e) {}

    var x = window.innerWidth * 0.5;
    var y = window.innerHeight * 0.35;
    var tx = x;
    var ty = y;
    var running = false;

    function tick() {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      document.documentElement.style.setProperty(
        "--sx",
        (x / window.innerWidth) * 100 + "%"
      );
      document.documentElement.style.setProperty(
        "--sy",
        (y / window.innerHeight) * 100 + "%"
      );
      if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) {
        requestAnimationFrame(tick);
      } else {
        running = false;
      }
    }

    window.addEventListener(
      "pointermove",
      function (e) {
        tx = e.clientX;
        ty = e.clientY;
        if (!running) {
          running = true;
          requestAnimationFrame(tick);
        }
      },
      { passive: true }
    );
  }

  function observeLazy() {
    var nodes = wall.querySelectorAll("img[data-src]");
    if (!nodes.length) return;

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (img) {
        img.src = img.dataset.src;
        delete img.dataset.src;
        img.classList.add("ready");
      });
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          var src = img.dataset.src;
          if (!src) return;

          // preload then swap once ready — no half-drawn flash / reflow
          preloadUrl(src).then(function () {
            if (img.dataset.src !== src) return;
            img.src = src;
            delete img.dataset.src;
            img.classList.add("ready");
          });

          // also preload a few ahead of this index for smoother scroll
          var btn = img.closest(".item");
          if (btn && btn.parentNode) {
            var idx = Array.prototype.indexOf.call(btn.parentNode.children, btn);
            if (idx >= 0) preloadRange(idx + 1, AHEAD);
          }

          io.unobserve(img);
        });
      },
      { rootMargin: "800px 0px", threshold: 0.01 }
    );

    nodes.forEach(function (img) {
      io.observe(img);
    });
  }

  function openLb(i) {
    cur = i;
    showLb();
    lb.hidden = false;
    document.body.classList.add("lb-on");
  }

  function closeLb() {
    lb.hidden = true;
    document.body.classList.remove("lb-on");
    lbImg.removeAttribute("src");
  }

  function showLb() {
    var item = list[cur];
    if (!item) return;
    var t = titleOf(item);
    var full = fullOf(item);
    var thumb = thumbOf(item);
    lbImg.alt = t;
    lbCap.textContent = t;
    lbImg.src = thumb;
    preloadUrl(full).then(function () {
      if (list[cur] === item) lbImg.src = full;
    });
    preloadUrl(fullOf(list[(cur + 1) % list.length]));
    preloadUrl(fullOf(list[(cur - 1 + list.length) % list.length]));
  }

  function nav(d) {
    if (!list.length) return;
    cur = (cur + d + list.length) % list.length;
    showLb();
  }

  btnLarge.addEventListener("click", function () {
    setMode(false);
  });
  btnSmall.addEventListener("click", function () {
    setMode(true);
  });

  lbX.addEventListener("click", closeLb);
  var lbDim = document.getElementById("lb-dim");
  if (lbDim) {
    lbDim.addEventListener("click", closeLb);
  }
  lb.addEventListener("click", function (e) {
    if (e.target === lb) closeLb();
  });
  lbP.addEventListener("click", function (e) {
    e.stopPropagation();
    nav(-1);
  });
  lbN.addEventListener("click", function (e) {
    e.stopPropagation();
    nav(1);
  });

  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") nav(-1);
    if (e.key === "ArrowRight") nav(1);
  });

  statusEl.textContent = "准备图片…";

  fetch("images.json?v=9", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!Array.isArray(data) || !data.length) throw new Error("empty");
      list = data.slice().sort(function (a, b) {
        return String(b.date || "").localeCompare(String(a.date || ""));
      });

      statusEl.textContent = "预加载首屏…";
      // reserve structure after boot preload so first paint is stable
      return preloadRange(0, Math.min(BOOT_PRELOAD, list.length)).then(function () {
        statusEl.classList.add("hide");
        statusEl.textContent = "";
        render();
      });
    })
    .catch(function (err) {
      console.error(err);
      statusEl.textContent = "加载失败，请 Ctrl+F5 强制刷新后重试";
    });
})();
