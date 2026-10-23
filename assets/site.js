/* @nylejoness guides: shared behaviour */
(function () {
  "use strict";

  var SOCIALS = [
    { name: "TikTok", url: "https://www.tiktok.com/@nylejoness" },
    { name: "Instagram", url: "https://www.instagram.com/nylejoness/" },
    { name: "YouTube", url: "https://www.youtube.com/@nylejoness" }
  ];

  // Storage that never throws (private mode, blocked cookies, previews)
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };
  window.NJGuides = { store: store, socials: SOCIALS };

  // Follow badge
  function initFollow() {
    if (document.querySelector(".follow")) return;
    var wrap = document.createElement("div");
    wrap.className = "follow";
    var menu = document.createElement("div");
    menu.className = "follow-menu";
    menu.id = "follow-menu";
    menu.hidden = true;
    SOCIALS.forEach(function (s) {
      var a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = s.name;
      menu.appendChild(a);
    });
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "follow-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "follow-menu");
    btn.textContent = "Follow @nylejoness";
    function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      if (open) { var first = menu.querySelector("a"); if (first) first.focus(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { close(); btn.focus(); }
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) close();
    });
    wrap.appendChild(menu);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    // Hide while scrolling down through content so it never sits over text.
    // Shown at the top, on scroll up, at the page end, or while focused or open.
    var lastY = window.pageYOffset, ticking = false;
    function nearEnd() {
      return window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 120;
    }
    function onScroll() {
      var y = window.pageYOffset;
      var keep = !menu.hidden || wrap.contains(document.activeElement);
      var tuck = !keep && y > 80 && y > lastY && !nearEnd();
      if (y < lastY - 4 || nearEnd() || y <= 80 || keep) tuck = false;
      if (Math.abs(y - lastY) > 4 || tuck === false) wrap.classList.toggle("is-tucked", tuck);
      lastY = y;
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
    }, { passive: true });
    btn.addEventListener("focus", function () { wrap.classList.remove("is-tucked"); });
  }

  // Copy buttons: <button data-copy="text">
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  function initCopy() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-copy]") : null;
      if (!btn) return;
      var original = btn.getAttribute("data-label") || btn.textContent;
      btn.setAttribute("data-label", original);
      copyText(btn.getAttribute("data-copy")).then(function () {
        btn.textContent = "Copied";
      }, function () {
        btn.textContent = "Copy failed";
      }).then(function () {
        setTimeout(function () { btn.textContent = original; }, 1800);
      });
    });
  }

  // Checklists: <ul data-checklist="key"> with checkboxes, plus [data-checklist-count] and [data-checklist-reset]
  function initChecklists() {
    document.querySelectorAll("[data-checklist]").forEach(function (list) {
      var key = "nj-checklist-" + list.getAttribute("data-checklist");
      var boxes = Array.prototype.slice.call(list.querySelectorAll('input[type="checkbox"]'));
      var scope = list.closest("[data-checklist-scope]") || document;
      var counter = scope.querySelector("[data-checklist-count]");
      var bar = scope.querySelector("[data-checklist-bar]");
      var reset = scope.querySelector("[data-checklist-reset]");
      var saved = {};
      try { saved = JSON.parse(store.get(key) || "{}") || {}; } catch (e) { saved = {}; }
      boxes.forEach(function (b) { b.checked = !!saved[b.value]; });

      function update() {
        var done = boxes.filter(function (b) { return b.checked; }).length;
        if (counter) counter.textContent = done + " of " + boxes.length + " done";
        if (bar) bar.style.width = (boxes.length ? (done / boxes.length) * 100 : 0) + "%";
        var state = {};
        boxes.forEach(function (b) { if (b.checked) state[b.value] = true; });
        store.set(key, JSON.stringify(state));
      }
      boxes.forEach(function (b) { b.addEventListener("change", update); });
      if (reset) reset.addEventListener("click", function () {
        boxes.forEach(function (b) { b.checked = false; });
        store.remove(key);
        update();
      });
      update();
    });
  }

  // Accordions: optional single-open groups via [data-accordion="single"]
  function initAccordions() {
    document.querySelectorAll('[data-accordion="single"]').forEach(function (group) {
      var items = group.querySelectorAll("details");
      items.forEach(function (item) {
        item.addEventListener("toggle", function () {
          if (!item.open) return;
          items.forEach(function (d) { if (d !== item && d.open) d.open = false; });
        });
      });
    });
  }

  function init() { initFollow(); initCopy(); initChecklists(); initAccordions(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
