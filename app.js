/**
 * 再看一会儿 — % waterfall + soft gaze
 */
(function () {
  "use strict";

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
  var lbBg = document.getElementById("lb-bg");
  var lbImg = document.getElementById("lb-img");
  var lbCap = document.getElementById("lb-cap");
  var lbX = document.getElementById("lb-x");
  var lbP = document.getElementById("lb-p");
  var lbN = document.getElementById("lb-n");

  var list = [];
  var cur = 0;
  var preloaded = Object.create(null);
  var BOOT = 12;
  var AHEAD = 10;

  // apply site.config.js
  (function applySite() {
    var s = window.SITE || {};
    if (s.title) document.title = s.title;
    var logoText = document.getElementById("logo-text");
    var logo = document.getElementById("logo");
    if (logoText && s.brand) logoText.textContent = s.brand;
    if (logo && s.brand) logo.setAttribute("aria-label", s.brand);
    var meta = document.querySelector('meta[name="description"]');
    if (meta && s.title) meta.setAttribute("content", s.title);
  })();

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

  function dims(item) {
    var w = item.tw || item.w || 3;
    var h = item.th || item.h || 4;
    if (!w || !h) return { w: 3, h: 4 };
    return { w: w, h: h };
  }

  function setMode(small) {
    wall.classList.toggle("is-small", small);
    wall.classList.toggle("is-large", !small);
    btnLarge.classList.toggle("on", !small);
    btnSmall.classList.toggle("on", small);
    btnLarge.setAttribute("aria-pressed", small ? "false" : "true");
    btnSmall.setAttribute("aria-pressed", small ? "true" : "false");
  }

  function preloadUrl(url) {
    if (!url || preloaded[url]) return Promise.resolve(url);
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
    wall.classList.remove("is-focus");
    var frag = document.createDocumentFragment();

    for (var i = 0; i < list.length; i++) {
      (function (i) {
        var item = list[i];
        var t = titleOf(item);
        var d = dims(item);
        var src = thumbOf(item);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "card";
        btn.setAttribute("aria-label", t || "图片 " + (i + 1));
        // 真实比例占位 → 瀑布流高度自然不同，但不抖动
        btn.style.aspectRatio = d.w + " / " + d.h;

        var img = document.createElement("img");
        img.alt = t || "";
        img.width = d.w;
        img.height = d.h;
        img.decoding = "async";
        img.draggable = false;
        // 直接挂真实缩略图，不用透明占位（占位+opacity:0 会像“空白只有字”）
        img.loading = i < BOOT ? "eager" : "lazy";
        if (i < 8) img.fetchPriority = "high";
        img.src = src;

        function showImg() {
          img.classList.add("is-on");
        }
        // 缓存命中时 load 可能已触发，必须检查 complete
        if (img.complete && img.naturalWidth > 0) {
          showImg();
        } else {
          img.addEventListener("load", showImg);
        }
        img.addEventListener("error", function () {
          if (img.dataset.retried) {
            // 仍失败：至少去掉透明，露出卡片底，避免“只有标题”
            showImg();
            return;
          }
          img.dataset.retried = "1";
          img.src = fullOf(item);
        });

        var veil = document.createElement("span");
        veil.className = "veil";
        veil.setAttribute("aria-hidden", "true");

        var glint = document.createElement("span");
        glint.className = "glint";
        glint.setAttribute("aria-hidden", "true");

        btn.appendChild(img);
        btn.appendChild(veil);
        btn.appendChild(glint);

        if (t) {
          var cap = document.createElement("span");
          cap.className = "cap";
          cap.textContent = t;
          btn.appendChild(cap);
        }

        btn.addEventListener("pointerenter", function () {
          wall.classList.add("is-focus");
          var cards = wall.querySelectorAll(".card");
          for (var k = 0; k < cards.length; k++) {
            cards[k].classList.toggle("is-hot", cards[k] === btn);
          }
        });
        btn.addEventListener("pointerleave", function () {
          btn.classList.remove("is-hot");
          if (!wall.querySelector(".card:hover, .card:focus")) {
            wall.classList.remove("is-focus");
            var cards = wall.querySelectorAll(".card.is-hot");
            for (var k = 0; k < cards.length; k++) cards[k].classList.remove("is-hot");
          }
        });

        btn.addEventListener("click", function () {
          openLb(i);
        });

        frag.appendChild(btn);
      })(i);
    }

    wall.appendChild(frag);
    initSpot();
    // 预热后续缩略图（原生 lazy 负责真正下载时机）
    requestAnimationFrame(function () {
      preloadRange(BOOT, AHEAD);
    });
  }

  function initSpot() {
    try {
      if (window.matchMedia("(pointer: coarse)").matches) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch (e) {
      return;
    }
    var x = 50;
    var y = 28;
    var tx = 50;
    var ty = 28;
    var run = false;
    function tick() {
      x += (tx - x) * 0.07;
      y += (ty - y) * 0.07;
      document.documentElement.style.setProperty("--sx", x + "%");
      document.documentElement.style.setProperty("--sy", y + "%");
      if (Math.abs(tx - x) > 0.2 || Math.abs(ty - y) > 0.2) {
        requestAnimationFrame(tick);
      } else {
        run = false;
      }
    }
    window.addEventListener(
      "pointermove",
      function (e) {
        tx = (e.clientX / window.innerWidth) * 100;
        ty = (e.clientY / window.innerHeight) * 100;
        if (!run) {
          run = true;
          requestAnimationFrame(tick);
        }
      },
      { passive: true }
    );
  }

  function openLb(i) {
    cur = i;
    showLb();
    lb.hidden = false;
    document.body.classList.add("lb-open");
  }

  function closeLb() {
    lb.hidden = true;
    document.body.classList.remove("lb-open");
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

  function setMode(small) {
    wall.classList.toggle("is-small", small);
    wall.classList.toggle("is-large", !small);
    btnLarge.classList.toggle("on", !small);
    btnSmall.classList.toggle("on", small);
    btnLarge.setAttribute("aria-pressed", small ? "false" : "true");
    btnSmall.setAttribute("aria-pressed", small ? "true" : "false");
  }

  lbX.addEventListener("click", closeLb);
  if (lbBg) lbBg.addEventListener("click", closeLb);
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

  statusEl.textContent = "再等等…";

  fetch("images.json?v=14", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!Array.isArray(data) || !data.length) throw new Error("empty");
      list = data.slice().sort(function (a, b) {
        return String(b.date || "").localeCompare(String(a.date || ""));
      });
      statusEl.textContent = "再看一会儿…";
      return preloadRange(0, Math.min(BOOT, list.length)).then(function () {
        statusEl.classList.add("hide");
        statusEl.textContent = "";
        setMode(false);
        render();
      });
    })
    .catch(function (err) {
      console.error(err);
      statusEl.textContent = "加载失败，请 Ctrl+F5 强刷";
    });
})();
