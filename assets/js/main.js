// Entry portal (splash) — runs immediately, script is at end of body so #splash already exists.
(function () {
  var splash = document.getElementById("splash");
  if (!splash) return;

  var alreadyEntered = false;
  try { alreadyEntered = sessionStorage.getItem("mirages-entered") === "1"; } catch (e) {}

  if (alreadyEntered) {
    splash.remove();
    return;
  }

  document.documentElement.classList.add("splash-lock");

  var orbWrap = splash.querySelector(".splash-orb-wrap");
  var orbRect = orbWrap ? orbWrap.getBoundingClientRect() : null;
  var refreshRect = function () { if (orbWrap) orbRect = orbWrap.getBoundingClientRect(); };
  window.addEventListener("resize", refreshRect);

  // Eased follow: the color reacts to where the cursor is heading rather than
  // snapping straight to it, so it reads as fluid instead of flickering between
  // colors on every small movement. Once the eased value has caught up to the
  // target, the loop stops touching the DOM — otherwise it silently keeps
  // forcing a style recalc (and a re-run of the SVG filter) every frame
  // forever after the very first mouse move, even while sitting still.
  var targetX = null, targetY = null;
  var curPx = 30, curPy = 30;
  var loopActive = true;
  var rafScheduled = false;
  function tick() {
    rafScheduled = false;
    if (!loopActive || targetX === null || !orbWrap || !orbRect) return;
    var tPx = ((targetX - orbRect.left) / orbRect.width) * 100;
    var tPy = ((targetY - orbRect.top) / orbRect.height) * 100;
    tPx = Math.max(-20, Math.min(120, tPx));
    tPy = Math.max(-20, Math.min(120, tPy));
    var settled = Math.abs(tPx - curPx) < 0.05 && Math.abs(tPy - curPy) < 0.05;
    if (settled) return;
    curPx += (tPx - curPx) * 0.3;
    curPy += (tPy - curPy) * 0.3;
    orbWrap.style.setProperty("--mx", curPx.toFixed(1) + "%");
    orbWrap.style.setProperty("--my", curPy.toFixed(1) + "%");
    orbWrap.style.setProperty("--mx-num", curPx.toFixed(1));
    requestTick();
  }
  function requestTick() {
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(tick);
    }
  }
  function setPos(clientX, clientY) {
    targetX = clientX;
    targetY = clientY;
    requestTick();
  }
  splash.addEventListener("pointermove", function (e) { setPos(e.clientX, e.clientY); }, { passive: true });
  splash.addEventListener("touchmove", function (e) {
    if (e.touches && e.touches[0]) setPos(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  function enter() {
    if (splash.classList.contains("splash-leaving")) return;
    splash.classList.add("splash-leaving");
    document.documentElement.classList.remove("splash-lock");
    try { sessionStorage.setItem("mirages-entered", "1"); } catch (e) {}
    loopActive = false;
    setTimeout(function () { splash.remove(); }, 950);
  }
  splash.addEventListener("click", enter);
  splash.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); }
  });
})();

document.addEventListener("DOMContentLoaded", function () {
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll reveal (fade-up, scale-in, and staggered groups)
  var revealSelector = ".reveal, .reveal-scale, .reveal-stagger > *";
  var revealEls = document.querySelectorAll(revealSelector);
  document.querySelectorAll(".reveal-stagger").forEach(function (group) {
    // Cap the stagger index: fine for a handful of cards entering together,
    // but on a long list of items (e.g. many paragraphs) each one triggers
    // its own observer entry as it's individually scrolled into view — an
    // uncapped delay would then compound with scroll position and make
    // later items visibly lag behind the reader instead of flowing with it.
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty("--i", Math.min(i, 5));
    });
  });
  if (revealEls.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
    // Safety net: never leave content invisible (e.g. tab backgrounded, odd viewport).
    setTimeout(function () {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    }, 2500);
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // Sticky header reacts to scroll (shrinks + gains a hairline)
  var header = document.querySelector(".site-header");
  if (header) {
    var onHeaderScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 24);
    };
    onHeaderScroll();
    window.addEventListener("scroll", onHeaderScroll, { passive: true });
  }

  // Subtle parallax on the hero mark + wordmark, and background-scrolling patterns.
  // Base positions are measured once (untransformed) and cached: reading the live
  // rect of an already-transformed element would feed its own offset back into the
  // next calculation and make the movement drift further with every scroll event.
  if (!reduceMotion) {
    var parallaxEls = document.querySelectorAll("[data-parallax]");
    var parallaxBgEls = document.querySelectorAll("[data-parallax-bg]");
    if (parallaxEls.length || parallaxBgEls.length) {
      var items = [];
      var bgItems = [];
      var measureParallax = function () {
        items = Array.prototype.map.call(parallaxEls, function (el) {
          el.style.transform = "";
          var rect = el.getBoundingClientRect();
          var parentRect = el.parentElement ? el.parentElement.getBoundingClientRect() : rect;
          // If the element is taller than its (clipping) parent, it has a fixed buffer
          // to move within — clamp to it so the parallax can never expose an empty edge.
          var maxOffset = rect.height > parentRect.height ? (rect.height - parentRect.height) / 2 : Infinity;
          return { el: el, speed: parseFloat(el.dataset.parallax) || 0.15, baseTop: rect.top + window.scrollY, height: rect.height, maxOffset: maxOffset, current: 0 };
        });
        bgItems = Array.prototype.map.call(parallaxBgEls, function (el) {
          el.style.backgroundPosition = "";
          var rect = el.getBoundingClientRect();
          return { el: el, speed: parseFloat(el.dataset.parallaxBg) || 0.4, baseTop: rect.top + window.scrollY, height: rect.height, current: 0 };
        });
      };
      // Eased toward the scroll-driven target rather than snapping to it on every
      // scroll event, so the motion reads as one continuous glide (this depends only
      // on scroll position, so it's identical whether the cursor sits above, below,
      // or off the element entirely). The loop samples window.scrollY itself every
      // frame instead of only reacting to "scroll" events firing — some browsers
      // throttle/coalesce scroll events unpredictably during momentum scrolling,
      // which made this look like it "worked sometimes and not others".
      var ticking = false;
      var lastScrollY = null;
      var updateParallax = function () {
        var vh = window.innerHeight;
        var scrollY = window.scrollY;
        var scrollMoved = scrollY !== lastScrollY;
        lastScrollY = scrollY;
        var settled = true;
        items.forEach(function (item) {
          var top = item.baseTop - scrollY;
          if (top + item.height < 0 || top > vh) return;
          var target = (top - vh / 2) * item.speed;
          if (isFinite(item.maxOffset)) {
            target = Math.max(-item.maxOffset, Math.min(item.maxOffset, target));
          }
          item.current += (target - item.current) * 0.18;
          if (Math.abs(target - item.current) > 0.1) settled = false;
          item.el.style.transform = "translate3d(0," + item.current.toFixed(1) + "px,0)";
        });
        bgItems.forEach(function (item) {
          var top = item.baseTop - scrollY;
          if (top + item.height < 0 || top > vh) return;
          var target = (top - vh / 2) * item.speed;
          item.current += (target - item.current) * 0.18;
          if (Math.abs(target - item.current) > 0.1) settled = false;
          item.el.style.backgroundPosition = "0 " + item.current.toFixed(1) + "px";
        });
        if (!settled || scrollMoved) {
          window.requestAnimationFrame(updateParallax);
        } else {
          ticking = false;
        }
      };
      var requestTick = function () {
        if (!ticking) { window.requestAnimationFrame(updateParallax); ticking = true; }
      };
      var onParallaxResize = function () { measureParallax(); requestTick(); };
      measureParallax();
      requestTick();
      window.addEventListener("scroll", requestTick, { passive: true });
      window.addEventListener("resize", onParallaxResize);
    }
  }

  // Video teaser: click-to-load facade (thumbnail + play button) so the
  // Drive iframe only loads once the visitor actually wants to watch it.
  document.querySelectorAll(".poster-teaser[data-teaser-src]").forEach(function (facade) {
    facade.addEventListener("click", function () {
      var wrap = document.createElement("div");
      wrap.className = "poster-teaser";
      wrap.appendChild(facade.querySelector(".poster-teaser-label"));
      var iframe = document.createElement("iframe");
      iframe.className = "teaser-iframe";
      iframe.src = facade.dataset.teaserSrc + "?autoplay=1";
      iframe.title = facade.dataset.teaserTitle || "Teaser";
      iframe.allow = "autoplay";
      iframe.allowFullscreen = true;
      wrap.appendChild(iframe);
      facade.replaceWith(wrap);
    });
  });

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      nav.classList.toggle("open");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { nav.classList.remove("open"); });
    });
  }

  // Tabs (spectacles page)
  var tabButtons = document.querySelectorAll(".tab-btn");
  var tabPanels = document.querySelectorAll(".tab-panel");
  function activateTab(id) {
    tabButtons.forEach(function (b) { b.classList.toggle("active", b.dataset.tab === id); });
    tabPanels.forEach(function (p) { p.classList.toggle("active", p.id === id); });
  }
  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      activateTab(btn.dataset.tab);
      history.replaceState(null, "", "#" + btn.dataset.tab);
    });
  });
  if (tabButtons.length) {
    var tabIds = Array.prototype.map.call(tabButtons, function (b) { return b.dataset.tab; });
    var hash = window.location.hash.replace("#", "");
    activateTab(tabIds.indexOf(hash) > -1 ? hash : tabButtons[0].dataset.tab);

    // In-page links (e.g. "lire l'histoire complète") that point to another tab id
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      var id = link.getAttribute("href").replace("#", "");
      if (tabIds.indexOf(id) > -1) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          activateTab(id);
          history.replaceState(null, "", "#" + id);
          document.querySelector(".tabs-nav").scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });
  }

  // Lightbox (with prev/next navigation within the photo's own gallery)
  var lightbox = document.querySelector(".lightbox");
  if (lightbox) {
    var lbImg = lightbox.querySelector("img");
    var lbPrev = lightbox.querySelector(".lightbox-prev");
    var lbNext = lightbox.querySelector(".lightbox-next");
    var currentGallery = [];
    var currentIndex = -1;

    function showAt(index) {
      if (!currentGallery.length) return;
      currentIndex = (index + currentGallery.length) % currentGallery.length;
      var img = currentGallery[currentIndex].querySelector("img");
      lbImg.src = img.dataset.full || img.src;
      lbImg.alt = img.alt;
    }

    document.querySelectorAll(".gallery").forEach(function (gallery) {
      var buttons = Array.prototype.slice.call(gallery.querySelectorAll("button"));
      buttons.forEach(function (btn, i) {
        btn.addEventListener("click", function () {
          currentGallery = buttons;
          showAt(i);
          lightbox.classList.add("open");
        });
      });
    });

    lbPrev.addEventListener("click", function () { showAt(currentIndex - 1); });
    lbNext.addEventListener("click", function () { showAt(currentIndex + 1); });

    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox || e.target.classList.contains("lightbox-close")) {
        lightbox.classList.remove("open");
        lbImg.src = "";
      }
    });
    document.addEventListener("keydown", function (e) {
      if (!lightbox.classList.contains("open")) return;
      if (e.key === "Escape") { lightbox.classList.remove("open"); lbImg.src = ""; }
      if (e.key === "ArrowLeft") showAt(currentIndex - 1);
      if (e.key === "ArrowRight") showAt(currentIndex + 1);
    });
  }
});
