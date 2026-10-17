/* Kjöthúsið : motion layer, ported 1:1 from the CO'COON system (auw.studio)
   by way of the Heiðmörk and Eimverk builds. Production changes from the
   approved prototype: price rows are server rendered, the category panel reads
   #kj-data, paths respect the site base, and the fixed element is the
   .site-header (notice strip + navbar) rather than the navbar alone. Constants below are the
   reference's own (theme.js, lines 4894-4934); the UI block retimes
   interactive motion only, as the motion review required. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- reference constants, verbatim ---- */
  var EASE = { DEFAULT: 'power3.out', SMOOTH: 'power2.inOut', SNAP: 'power4.out', LUXE: 'luxe' };
  var DUR  = { FAST: .4, MEDIUM: .6, DEFAULT: .8, SLOW: 1.2 };
  var STAG = { MICRO: .02, TIGHT: .04, DEFAULT: .1, RELAXED: .2 };
  var DELAY_INTRO = .3;
  var DIST = { Y: '3.75rem', X: '2.5rem' };
  var TRIG_START = 'top 85%';
  var PARA = { SPEED: .15, MAX: .4, REVEAL: .3 };
  var ABOVE_MOBILE = '(min-width: 48rem)';

  if (typeof gsap === 'undefined') { document.querySelectorAll('[data-reveal]').forEach(function(n){n.style.opacity=1;}); }

  /* ================= Kjöthúsið data =================
     Cut names, locations and uses follow Kjötbókin (kjotbokin.is/nautakjot).
     Pieces that no Icelandic source splits are merged under one name rather
     than invented; the drawing is the client's own. */
  var CUTS = {
    hals: ['Háls', 'Vöðvaríkur hluti framan við bóginn. Mest nýttur í hakk og gúllas.'],
    bogur: ['Bógur', 'Stór vöðvahluti ofan við framfótinn. Góður í gúllas, pottrétti og bógsteik.'],
    framhryggur: ['Framhryggur', 'Fremri hluti hryggjarins, aftan við bóginn. Nýttur í hryggsneiðar og pottrétti.'],
    spjaldhryggur: ['Spjaldhryggur', 'Miðja hryggjarins. Þaðan koma hryggvöðvi og steikur á borð við T-bone.'],
    mjadmasteik: ['Mjaðmasteik', 'Aftast á hryggnum, framan við malirnar. Meyr steikarbiti.'],
    laeri: ['Læri', 'Aftasti hluti skrokksins. Þaðan koma meðal annars ytralæri, innralæri og þríhyrningur.'],
    klumpur: ['Klumpur', 'Vöðvi framan á lærinu, ofan við hnéð.'],
    bringa: ['Bringa', 'Neðsti hluti framparts, milli framfótanna. Hentar í súpur og hægeldun.'],
    sida: ['Síða', 'Löng og þunn kviðarsneið aftan við bringuna. Notuð í hakk og pönnusteikur.'],
    framskanki: ['Framskanki', 'Neðri hluti framfótar. Sinaríkt kjöt fyrir súpur og hægeldun.'],
    skanki: ['Skanki', 'Neðsti hluti afturfótar. Skorinn í skankasneiðar.']
  };
  /* bull.svg has no ids, so the regions are matched by path order. */
  var CUT_BY_PATH = ['laeri','skanki','klumpur','sida','mjadmasteik','sida','framhryggur','bogur','spjaldhryggur','bringa','bringa','framskanki','hals','framskanki'];

  var DATA = (function () {
    try { return JSON.parse(document.getElementById('kj-data').textContent); } catch (e) { return {}; }
  })();
  var BASE = DATA.base || '/';
  var CATEGORY_COPY = {
    'Nautakjöt': 'Hakk, gúllas, snitsel og steikur. Segðu okkur í hvað á að nota kjötið og við skerum það eftir því.',
    'Lambakjöt': 'Læri, hryggur og bitar fyrir pönnuna. Ræðum skurð, magn og pökkun.',
    'Svínakjöt': 'Hnakki, kótilettur, hamborgarhryggur og fleiri bitar.',
    'Unnar kjötvörur': 'Bollur, fars, bjúgu og aðrar unnar vörur, tilbúnar í ofninn eða á pönnuna.'
  };
  var CATEGORY_IMAGE = {
    'Nautakjöt': ['patties-800.webp', 800, 800],
    'Lambakjöt': ['fillet-800.webp', 800, 696],
    'Svínakjöt': ['steaks-800.webp', 800, 532],
    'Unnar kjötvörur': ['bowl-800.webp', 800, 600]
  };

  var UNIT = { kg: 'kr/kg', stk: 'kr/stk', pk: 'kr/pk', flat: 'kr' };
  function priceLabel(p) {
    if (typeof p.p !== 'number') return 'Verð í síma';
    return new Intl.NumberFormat('de-DE').format(p.p) + ' ' + (UNIT[p.u] || 'kr');
  }
  function byCategory(cat) {
    return (DATA.categories && DATA.categories[cat]) || [];
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  if (typeof gsap === 'undefined') { buildCutMap(); return; }
  gsap.registerPlugin(ScrollTrigger);
  /* iOS fires resize as the URL bar collapses, which is as the fling starts. A
     refresh there writes scroll and WebKit cancels the momentum dead. */
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* CustomEase is a paid plugin; register the reference's "luxe" curve
     (0.16, 1, 0.3, 1) as an equivalent solved cubic bezier. */
  (function registerLuxe() {
    function bez(x1, y1, x2, y2) {
      function A(a, b) { return 1 - 3 * b + 3 * a; }
      function B(a, b) { return 3 * b - 6 * a; }
      function C(a) { return 3 * a; }
      function calc(t, a, b) { return ((A(a, b) * t + B(a, b)) * t + C(a)) * t; }
      function slope(t, a, b) { return 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a); }
      return function (x) {
        var t = x;
        for (var i = 0; i < 5; i++) {
          var s = slope(t, x1, x2);
          if (s === 0) break;
          t -= (calc(t, x1, x2) - x) / s;
        }
        return calc(t, y1, y2);
      };
    }
    gsap.registerEase('luxe', bez(0.16, 1, 0.3, 1));
    gsap.registerEase('uiOut', bez(0.23, 1, 0.32, 1));
    gsap.registerEase('uiDrawer', bez(0.32, 0.72, 0, 1));
  })();

  /* ================= UI timing (motion review) =================
     The reference constants above stay as the record of the source system and
     still drive the marketing motion. These replace them on interactive UI
     only, where the review found the reference's timing outside the bar. */
  var UI = { OUT: 'uiOut', DRAWER: 'uiDrawer', UNDERLINE: .18, PANEL: .35, TOGGLE: .16, STAGGER: .05 };

  /* ---- viewport unit vars (reference writes these on resize) ---- */
  var root = document.documentElement;
  function setVH() {
    root.style.setProperty('--dvh', (window.innerHeight * .01) + 'px');
    root.style.setProperty('--svh', (root.clientHeight * .01) + 'px');
    root.style.setProperty('--lvh', '1vh');
  }
  setVH();
  /* On a phone the URL bar collapses continuously DURING a scroll and fires
     resize on every step. Re-running this mid-fling re-lays out everything
     sized in these vars, which WebKit answers by cancelling the momentum. Only
     a real width change is a resize on touch. */
  function onResize(fn) {
    var lastW = window.innerWidth; // per handler: a shared one lets the first
    return function () {           // wrapper swallow every later wrapper's call
      if (isTouchPointer() && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      fn();
    };
  }
  function isTouchPointer() {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }
  window.addEventListener('resize', onResize(setVH), false);

  var rem = parseFloat(getComputedStyle(root).fontSize) || 16;
  function toPx(v) { return parseFloat(v) * rem; }

  /* ---- Lenis: reference config exactly (lerp .1, smoothWheel only). NEVER
     mounted on a touch device. iOS Safari only collapses its bottom toolbar to
     the floating pill for a natively scrolled document, and Lenis's rAF loop
     also fights iOS momentum for the scroll position every frame. Guard on the
     pointer, not on width: a narrow desktop window still gets the damped feel. */
  var lenis = null;
  var isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (!reduce && !isTouch && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: .1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ================= cocoon-link underline ================= */
  function bindLinks(scope) {
    (scope || document).querySelectorAll('.link').forEach(function (wrap) {
      if (wrap.dataset.linkBound) return;
      var line = wrap.querySelector('.link__line');
      var anchor = wrap.querySelector('.link__anchor') || wrap.querySelector('a,button');
      if (!line || !anchor) return;
      wrap.dataset.linkBound = '1';
      gsap.set(line, { x: 0, xPercent: -101 });
      if (reduce) return;
      var enter = function () {
        if (gsap.getProperty(line, 'xPercent') >= 100) gsap.set(line, { xPercent: -101 });
        gsap.to(line, { xPercent: 0, duration: UI.UNDERLINE, ease: UI.OUT, overwrite: true });
      };
      var leave = function () {
        gsap.to(line, { xPercent: 101, duration: UI.UNDERLINE, ease: UI.OUT, overwrite: true });
      };
      anchor.addEventListener('mouseenter', enter);
      anchor.addEventListener('focus', enter);
      anchor.addEventListener('mouseleave', leave);
      anchor.addEventListener('blur', leave);
      anchor.addEventListener('click', leave);
    });
  }
  bindLinks(document);

  /* ================= nav theme, section-scoped ================= */
  (function navTheme() {
    var navbar = document.querySelector('.navbar');
    var page = document.getElementById('page');
    if (!navbar || !page || !('IntersectionObserver' in window)) return;
    var states = new Map(), sections = [], io = null;

    function centre() {
      var r = navbar.getBoundingClientRect();
      return Math.round(r.top + r.height / 2);
    }
    function apply() {
      var theme = 'light';
      sections.forEach(function (s) { if (states.get(s)) theme = s.dataset.navTheme || theme; });
      if (navbar.getAttribute('data-nav-theme') !== theme) navbar.setAttribute('data-nav-theme', theme);
    }
    function build() {
      if (io) io.disconnect();
      var c = centre(), vh = window.innerHeight || 0;
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { states.set(e.target, e.isIntersecting); });
        apply();
      }, { rootMargin: '-' + c + 'px 0px -' + Math.max(0, vh - c - 1) + 'px 0px', threshold: 0 });
      states.clear();
      sections = Array.prototype.slice.call(page.querySelectorAll('[data-nav-theme]'));
      sections.forEach(function (s) { io.observe(s); });
    }
    build();
    window.addEventListener('resize', onResize(function () { requestAnimationFrame(build); }), { passive: true });

    /* Transparent over the hero, with a real ground below it. */
    var hero = page.querySelector('.hero');
    if (hero) {
      var c2 = centre(), vh2 = window.innerHeight || 0;
      var solidIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          navbar.setAttribute('data-nav-solid', e.isIntersecting ? 'off' : 'on');
        });
      }, { rootMargin: '-' + c2 + 'px 0px -' + Math.max(0, vh2 - c2 - 1) + 'px 0px', threshold: 0 });
      solidIO.observe(hero);
    }
  })();

  /* ================= parallax ================= */
  var mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference) and ' + ABOVE_MOBILE, function () {
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var raw = parseFloat(el.dataset.parallaxSpeed);
      var speed = isNaN(raw) ? PARA.SPEED : gsap.utils.clamp(-PARA.MAX, PARA.MAX, raw);
      if (!speed) return;
      var container = el.closest('[data-parallax-container]') || el.parentElement || el;
      gsap.fromTo(el,
        { y: function () { return -speed * container.offsetHeight; } },
        {
          y: function () { return speed * container.offsetHeight; },
          ease: 'none',
          scrollTrigger: { trigger: container, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true }
        });
    });
  });

  /* ================= hero intro ================= */
  (function hero() {
    var heading = document.querySelector('[data-hero-heading]');
    var media = document.querySelector('.hero__media');
    var fades = document.querySelectorAll('[data-hero-fade]');
    if (reduce) { gsap.set([media].concat(Array.prototype.slice.call(fades)).filter(Boolean), { autoAlpha: 1 }); return; }

    var lines = [];
    if (heading) {
      var html = heading.innerHTML.split(/<br\s*\/?>/i).map(function (s) { return s.trim(); });
      heading.innerHTML = '';
      lines = html.map(function (t) {
        var outer = document.createElement('span'); outer.className = 'line';
        var inner = document.createElement('span'); inner.innerHTML = t;
        outer.appendChild(inner); heading.appendChild(outer);
        return inner;
      });
      gsap.set(lines, { yPercent: 150 }); // below the widened clip (see .line in site.css)
    }
    gsap.set(fades, { autoAlpha: 0, y: toPx(DIST.Y) });

    var tl = gsap.timeline({ defaults: { ease: EASE.DEFAULT, duration: DUR.DEFAULT } });
    if (media) tl.from(media, { scale: 1.06, duration: DUR.SLOW }, 0);
    if (lines.length) tl.to(lines, { yPercent: 0, stagger: UI.STAGGER }, 0);
    tl.to(fades, { autoAlpha: 1, y: 0, stagger: UI.STAGGER }, '<+=' + STAG.RELAXED);
  })();

  /* ================= page heads (subpages) =================
     The hero's split-line rise on each subpage title, shorter and without the
     image scale, so every page opens the same way the home page does. */
  (function pageHead() {
    var heading = document.querySelector('[data-split-heading]');
    if (!heading) return;
    var fades = document.querySelectorAll('[data-head-fade]');
    var done = function () { root.classList.add('motion-done'); };
    if (reduce) { done(); return; }
    var parts = heading.innerHTML.split(/<br\s*\/?>/i).map(function (t) { return t.trim(); });
    heading.innerHTML = '';
    var lines = parts.map(function (t) {
      var outer = document.createElement('span'); outer.className = 'line';
      var inner = document.createElement('span'); inner.innerHTML = t;
      outer.appendChild(inner); heading.appendChild(outer);
      return inner;
    });
    gsap.set(lines, { yPercent: 150 }); // below the widened clip (see .line in site.css)
    gsap.set(fades, { autoAlpha: 0, y: 12 });
    done();
    // Shorter than the hero (.8 s): this plays on every subpage, and the
    // intro text should be readable within half a second.
    var tl = gsap.timeline({ defaults: { ease: EASE.LUXE, duration: .55 } });
    tl.to(lines, { yPercent: 0, stagger: UI.STAGGER }, 0);
    tl.to(fades, { autoAlpha: 1, y: 0, stagger: UI.STAGGER, duration: .35, ease: UI.OUT, clearProps: 'transform,opacity,visibility' }, .12);
  })();

  /* ================= footer ================= */
  (function footer() {
    var foot = document.querySelector('.footer');
    if (!foot) return;
    mm.add('(prefers-reduced-motion: no-preference) and ' + ABOVE_MOBILE, function () {
      gsap.fromTo(foot, { yPercent: -PARA.REVEAL * 100 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: foot.parentElement || foot, start: 'top bottom', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true }
      });
    });
  })();

  /* ================= nav toggle (burger to X) ================= */
  (function navToggle() {
    var OFFSET = '0.25rem', ROT = 45, PANEL = 'mega';
    var button = document.querySelector('.navbar__burger');
    if (!button) return;
    var lines = button.querySelectorAll('.navbar__burger-line');
    if (lines.length !== 2) return;
    var top = lines[0], bottom = lines[1];

    gsap.set(top, { y: '-' + OFFSET, rotation: 0 });
    gsap.set(bottom, { y: OFFSET, rotation: 0 });

    function setState(isOpen) {
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      var a = isOpen ? { y: 0, rotation: ROT } : { y: '-' + OFFSET, rotation: 0 };
      var b = isOpen ? { y: 0, rotation: -ROT } : { y: OFFSET, rotation: 0 };
      if (reduce) { gsap.set(top, a); gsap.set(bottom, b); return; }
      gsap.to(top, Object.assign({}, a, { duration: UI.TOGGLE, ease: UI.OUT, overwrite: true }));
      gsap.to(bottom, Object.assign({}, b, { duration: UI.TOGGLE, ease: UI.OUT, overwrite: true }));
    }

    document.addEventListener('shift-modal:open', function (e) {
      if (!e.detail || e.detail.id === PANEL) setState(true);
    });
    document.addEventListener('shift-modal:close', function (e) {
      if (!e.detail || e.detail.id === PANEL) setState(false);
    });
  })();

  /* ================= category panel ================= */
  (function categoryPanel() {
    var panel = document.querySelector('[data-panel="category"]');
    if (!panel) return;
    var img = panel.querySelector('[data-cat-image]');
    var name = panel.querySelector('[data-cat-name]');
    var copy = panel.querySelector('[data-cat-copy]');
    var prices = panel.querySelector('[data-cat-prices]');
    var more = panel.querySelector('[data-cat-more]');
    var scroller = panel.querySelector('.product__scroll');

    function fill(cat) {
      var items = byCategory(cat);
      var pic = CATEGORY_IMAGE[cat] || CATEGORY_IMAGE['Nautakjöt'];
      img.src = BASE + 'assets/img/' + pic[0]; img.width = pic[1]; img.height = pic[2]; img.alt = '';
      name.textContent = cat;
      copy.innerHTML = '<p>' + esc(CATEGORY_COPY[cat] || '') + '</p>' +
        (items.length ? '' : '<p>Engin vara í þessum flokki er á verðlistum núna. Hringdu í 557 8833 eða skoðaðu flokkinn.</p>');
      prices.innerHTML = items.map(function (p) {
        return '<div class="product__spec"><dt>' + esc(p.n) + '</dt><dd>' + esc(priceLabel(p)) + '</dd></div>';
      }).join('');
      var slug = DATA.slugs && DATA.slugs[cat];
      if (more) more.href = BASE + 'voruurval/' + (slug ? slug + '/' : '');
      if (scroller) scroller.scrollTop = 0;
    }
    /* Capture phase, so the panel is filled before the modal opens it. */
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-category]');
      if (c) fill(c.getAttribute('data-category'));
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var c = e.target.closest && e.target.closest('[data-category][role="button"]');
      if (c) { e.preventDefault(); c.click(); }
    });
  })();

  /* ================= the cut map =================
     Kjöthúsið's own bull drawing, made hoverable. The only module on this page
     that is not part of the reference system. */
  function buildCutMap() {
    var host = document.querySelector('[data-cut-map]');
    if (!host) return;
    var svgHost = host.querySelector('[data-cut-svg]');
    var tag = host.querySelector('[data-cut-tag]');
    var nameEl = document.querySelector('[data-cut-name]');
    var noteEl = document.querySelector('[data-cut-note]');
    var listEl = document.querySelector('[data-cut-list]');
    var defaults = { name: nameEl ? nameEl.textContent : '', note: noteEl ? noteEl.textContent : '' };
    var paths = [];
    var active = null;

    if (listEl) {
      listEl.innerHTML = Object.keys(CUTS).map(function (key) {
        return '<li><button type="button" class="cuts__list-btn" data-cut="' + key + '">' + esc(CUTS[key][0]) + '</button></li>';
      }).join('');
      listEl.addEventListener('pointerover', function (e) {
        if (!isMouse(e)) return;
        var b = e.target.closest('[data-cut]'); if (b) show(b.getAttribute('data-cut'));
      });
      listEl.addEventListener('focusin', function (e) {
        var b = e.target.closest('[data-cut]'); if (b) show(b.getAttribute('data-cut'));
      });
      listEl.addEventListener('pointerleave', function (e) { if (isMouse(e)) show(null); });
      /* A finger has no hover: the pointerleave above fires the instant it lifts,
         so a touch could only ever make the highlight flash. Tap LATCHES, and
         tapping the same cut again clears it. */
      listEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cut]'); if (!b) return;
        var key = b.getAttribute('data-cut');
        show(key === active ? null : key);
      });
    }

    /* A touch pointer reports 'touch'; a mouse reports 'mouse'. Older WebKit
       sends plain mouse events with no pointerType at all, so treat those as a
       mouse rather than swallowing them. */
    function isMouse(e) { return !e.pointerType || e.pointerType === 'mouse'; }

    function show(key) {
      active = key && CUTS[key] ? key : null;
      host.classList.toggle('is-active', Boolean(active));
      paths.forEach(function (p) {
        p.classList.toggle('is-on', Boolean(active) && p.dataset.cut === active);
      });
      if (listEl) {
        listEl.querySelectorAll('[data-cut]').forEach(function (b) {
          b.classList.toggle('is-on', b.getAttribute('data-cut') === active);
        });
      }
      if (nameEl) nameEl.textContent = active ? CUTS[active][0] : defaults.name;
      if (noteEl) noteEl.textContent = active ? CUTS[active][1] : defaults.note;
      if (tag) {
        tag.textContent = active ? CUTS[active][0] : '';
        tag.classList.toggle('is-on', Boolean(active));
        /* Place from whichever region owns the cut, so selecting from the LIST
           puts the tag on the drawing too instead of leaving it where the last
           hover dropped it. */
        if (active) {
          var owner = null;
          for (var i = 0; i < paths.length; i++) {
            if (paths[i].dataset.cut === active) { owner = paths[i]; break; }
          }
          if (owner) place(owner);
        }
      }
    }

    function place(path) {
      if (!tag) return;
      var box = host.getBoundingClientRect();
      var r = path.getBoundingClientRect();
      tag.style.transform = 'translate(' + (r.left - box.left + r.width / 2) + 'px,' + (r.top - box.top + r.height / 2) + 'px)';
    }

    fetch(BASE + 'assets/img/bull.svg')
      .then(function (r) { return r.text(); })
      .then(function (text) {
        svgHost.innerHTML = text;
        paths = Array.prototype.slice.call(svgHost.querySelectorAll('path'));
        paths.forEach(function (p, i) {
          var key = CUT_BY_PATH[i];
          p.dataset.cut = CUTS[key] ? key : '';
        });
        host.addEventListener('pointerover', function (e) {
          if (!isMouse(e)) return;
          var p = e.target.closest && e.target.closest('path');
          if (!p || !p.dataset.cut) return;
          show(p.dataset.cut);
        });
        host.addEventListener('pointerleave', function (e) { if (isMouse(e)) show(null); });
        /* Same latch as the list: on a phone the drawing is the primary control. */
        host.addEventListener('click', function (e) {
          var p = e.target.closest && e.target.closest('path');
          if (!p || !p.dataset.cut) return;
          show(p.dataset.cut === active ? null : p.dataset.cut);
        });
      })
      .catch(function () {});
  }
  buildCutMap();

  /* ================= shift modal (panel + page shove) ================= */
  (function modal() {
    var page = document.getElementById('page');
    var overlay = document.querySelector('[data-overlay]');
    var navbar = document.querySelector('.site-header');
    var openId = null, lastFocus = null, openedAt = 0;

    function panelFor(id) { return document.querySelector('[data-panel="' + id + '"]'); }

    function open(id) {
      if (!id || openId === id) return;
      var panel = panelFor(id);
      if (!panel || !page) return;
      openId = id; lastFocus = document.activeElement; openedAt = performance.now();
      document.body.classList.add('is-modal-open');
      if (overlay) overlay.classList.add('is-active');
      var axis = panel.getAttribute('data-axis') || 'x';
      root.dataset.modal = id; root.dataset.modalAxis = axis;
      if (lenis) lenis.stop();

      var r = panel.getBoundingClientRect();
      var to = axis === 'y' ? { y: r.height } : { x: -r.width };
      var d = reduce ? 0 : UI.PANEL, ez = UI.DRAWER;
      gsap.to(page, Object.assign({}, to, { duration: d, ease: ez }));
      gsap.to(panel, axis === 'y' ? { y: 0, duration: d, ease: ez } : { x: 0, duration: d, ease: ez });
      if (navbar && axis === 'x') gsap.to(navbar, { x: -r.width, duration: d, ease: ez });
      if (overlay) gsap.to(overlay, { opacity: 1, duration: d, ease: ez });
      panel.setAttribute('aria-hidden', 'false');
      panel.inert = false;
      var f = panel.querySelector('button, [href], input, [tabindex]');
      if (f) f.focus();
      megaIntro(panel);
      document.dispatchEvent(new CustomEvent('shift-modal:open', { detail: { id: id } }));
    }

    function close() {
      if (!openId || !page) return;
      var closedId = openId;
      var panel = panelFor(openId);
      var axis = (panel && panel.getAttribute('data-axis')) || 'x';
      var d = reduce ? 0 : UI.PANEL, ez = UI.DRAWER;
      openId = null;
      gsap.to(page, {
        x: 0, y: 0, duration: d, ease: ez,
        onComplete: function () {
          document.body.classList.remove('is-modal-open');
          if (lenis) lenis.start();
        }
      });
      if (navbar) gsap.to(navbar, { x: 0, duration: d, ease: ez });
      if (panel) gsap.to(panel, axis === 'y' ? { y: '-100%', duration: d, ease: ez } : { x: '100%', duration: d, ease: ez });
      if (overlay) gsap.to(overlay, {
        opacity: 0, duration: d, ease: ez,
        onComplete: function () { overlay.classList.remove('is-active'); }
      });
      if (panel) { panel.setAttribute('aria-hidden', 'true'); panel.inert = true; }
      if (lastFocus) lastFocus.focus();
      delete root.dataset.modal; delete root.dataset.modalAxis;
      document.dispatchEvent(new CustomEvent('shift-modal:close', { detail: { id: closedId } }));
    }

    function megaIntro(panel) {
      if (reduce || !panel.classList.contains('mega')) return;
      var bar = panel.querySelector('.mega__bar');
      var grid = panel.querySelector('[data-mega-grid]');
      var lines = panel.querySelectorAll('[data-mega-line]');
      var splits = panel.querySelectorAll('[data-mega-split]');
      var links = panel.querySelectorAll('[data-mega-link]');
      gsap.set(links, { pointerEvents: 'none' });
      var tl = gsap.timeline({
        delay: DELAY_INTRO,
        defaults: { ease: EASE.LUXE, duration: DUR.DEFAULT },
        onComplete: function () { gsap.set(links, { pointerEvents: 'auto' }); }
      });
      if (bar) tl.fromTo(bar, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }, 0);
      if (grid) tl.fromTo(grid, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }, 0);
      if (lines.length) tl.fromTo(lines, { scaleY: 0 }, { scaleY: 1 }, 0);
      if (splits.length) tl.from(splits, { yPercent: 100, opacity: 0, stagger: STAG.MICRO }, 0);
    }

    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-modal-open]');
      if (o) { e.preventDefault(); open(o.getAttribute('data-modal-open')); return; }
      var closer = e.target.closest('[data-modal-close]');
      if (closer) {
        if (!closer.matches('a[href]')) e.preventDefault();
        close();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab' || !openId) return;
      var panel = panelFor(openId);
      var items = Array.prototype.filter.call(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'), function (el) { return el.getClientRects().length && !el.closest('[hidden]'); });
      var first = items[0], last = items[items.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (!panel.contains(document.activeElement) || (e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    });
    if (overlay) overlay.addEventListener('click', close);

    window.addEventListener('wheel', function (e) {
      if (!openId) return;
      if (performance.now() - openedAt < 350) return;
      if (Math.abs(e.deltaY) < 4) return;
      if (window.matchMedia('(min-width: 64rem)').matches) close();
    }, { passive: true });
  })();

  /* ================= scroll reveals ================= */
  if (!reduce) {
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      gsap.fromTo(el, { autoAlpha: 0, y: toPx(DIST.Y) }, {
        autoAlpha: 1, y: 0, duration: DUR.DEFAULT, ease: EASE.LUXE,
        scrollTrigger: { trigger: el, start: TRIG_START, once: true }
      });
    });
  } else {
    document.querySelectorAll('[data-reveal]').forEach(function (n) { n.style.opacity = 1; });
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
