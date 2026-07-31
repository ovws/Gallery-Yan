/**
 * 嫣 — simple gallery that just works
 * thumbs in list, full image in lightbox
 */
(function () {
  "use strict";

  // kill broken service workers from older deploys
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (r) {
        r.unregister();
      });
    });
    if (window.caches) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) {
          caches.delete(k);
        });
      });
    }
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

  function setMode(small) {
    wall.classList.toggle("wall-small", small);
    wall.classList.toggle("wall-large", !small);
    btnLarge.classList.toggle("on", !small);
    btnSmall.classList.toggle("on", small);
    btnLarge.setAttribute("aria-pressed", small ? "false" : "true");
    btnSmall.setAttribute("aria-pressed", small ? "true" : "false");
  }

  function render() {
    wall.innerHTML = "";
    var frag = document.createDocumentFragment();

    for (var i = 0; i < list.length; i++) {
      (function (i) {
        var item = list[i];
        var t = titleOf(item);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "item";
        btn.setAttribute("aria-label", t || "图片 " + (i + 1));

        var img = document.createElement("img");
        img.src = thumbOf(item);
        img.alt = t || "";
        img.loading = "lazy";
        img.decoding = "async";
        // first screen a bit faster
        if (i < 10) img.fetchPriority = "high";

        btn.appendChild(img);

        if (t) {
          var cap = document.createElement("span");
          cap.className = "cap";
          cap.textContent = t;
          btn.appendChild(cap);
        }

        btn.addEventListener("click", function () {
          openLb(i);
        });

        frag.appendChild(btn);
      })(i);
    }

    wall.appendChild(frag);
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
    // thumb first, then full
    var full = fullOf(item);
    var thumb = thumbOf(item);
    lbImg.src = thumb;
    lbImg.alt = t;
    lbCap.textContent = t;
    var hi = new Image();
    hi.onload = function () {
      if (list[cur] === item) lbImg.src = full;
    };
    hi.src = full;
    // neighbors
    preload(fullOf(list[(cur + 1) % list.length]));
    preload(fullOf(list[(cur - 1 + list.length) % list.length]));
  }

  function preload(url) {
    if (!url) return;
    var im = new Image();
    im.src = url;
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

  fetch("images.json?v=6", { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      if (!Array.isArray(data) || !data.length) throw new Error("empty");
      list = data.slice().sort(function (a, b) {
        return String(b.date || "").localeCompare(String(a.date || ""));
      });
      statusEl.classList.add("hide");
      statusEl.textContent = "";
      render();
    })
    .catch(function (err) {
      console.error(err);
      statusEl.textContent = "加载失败，请强制刷新（Ctrl+F5）后重试";
    });
})();
