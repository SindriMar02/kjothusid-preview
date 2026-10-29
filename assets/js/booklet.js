/* The booklet viewer (Karen, 23 Oct). The page holds every page of the booklet
   in reading order, grouped as the printed sheet opens (cover, inside, back);
   here that becomes a flip view: one view at a time, centred, swipe, arrows,
   keys, a map of the pages. A view never makes a page smaller than reads
   comfortably: a sheet wider than the screen is split into pieces. "Allar síður
   í röð" goes back to the plain column, and the choice is remembered. */
(function () {
  'use strict';
  var root = document.querySelector('[data-booklet]');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var track = root.querySelector('[data-bk-track]');
  var bar = root.querySelector('[data-bk-bar]');
  var count = root.querySelector('[data-bk-count]');
  var nextLabel = root.querySelector('[data-bk-next]');
  var modeBtn = root.querySelector('[data-bk-mode]');
  var total = Number(root.getAttribute('data-total'));
  var sheets = JSON.parse(root.getAttribute('data-spreads'));
  var panels = [];
  root.querySelectorAll('[data-bk-panel]').forEach(function (el) { panels[Number(el.getAttribute('data-bk-panel'))] = el; });
  var thumbs = [];
  root.querySelectorAll('.bk__thumb').forEach(function (el) { thumbs[Number(el.getAttribute('data-bk-go'))] = el; });
  // On a touch screen the page map is a position indicator, its thumbnails too small to aim at.
  if (window.matchMedia('(pointer: coarse)').matches) {
    root.querySelector('.bk__map').setAttribute('aria-hidden', 'true');
    thumbs.forEach(function (t) { t.tabIndex = -1; });
  }

  /* Page width per zoom step: [narrowest a page may get, widest it may grow]. */
  var ZOOM = [[260, 360], [340, 520], [460, 700], [600, 960]];
  var zoom = Number(read('kj-bk-zoom', 1));
  if (!(zoom >= 0 && zoom < ZOOM.length)) zoom = 1;
  var groups = [];
  var views = [];
  var current = 0;
  var selected = 0;
  var target = null;
  var lastKey = '';

  function read(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function label(from, to) { return (from === to ? 'Síða ' + from : 'Síður ' + from + ' til ' + to) + ' af ' + total; }
  function first(g) { return groups[g][0]; }
  function groupOf(i) { for (var g = 0; g < groups.length; g++) if (groups[g].indexOf(i) >= 0) return g; return 0; }
  function stacked() { return root.classList.contains('is-stack'); }
  // the fixed header, notice strip included (site.js keeps it current)
  function chrome() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-chrome')) || 0; }

  /* Balanced pieces of at most k pages: four pages on a screen for three = 2 + 2. */
  function chunk(s, k) {
    var parts = Math.ceil(s.length / k), size = Math.ceil(s.length / parts), out = [];
    for (var i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
    return out;
  }

  function layout() {
    var w = root.clientWidth;
    var phone = w < 768;
    var avail = w - (phone ? 40 : 96);
    // a phone on its side shows pages side by side like the open leaflet, not one page blown up
    var z = phone ? (w > window.innerHeight ? ZOOM[1] : [avail, avail]) : ZOOM[zoom];
    var k = Math.max(1, Math.floor(avail / z[0]));
    var keep = selected;
    groups = [];
    sheets.forEach(function (s) { chunk(s, k).forEach(function (g) { groups.push(g); }); });
    var widest = Math.max.apply(null, groups.map(function (g) { return g.length; }));
    var pw = Math.floor(Math.min(z[1], avail / widest));
    root.style.setProperty('--bk-pw', pw + 'px');
    panels.forEach(function (p) { var img = p.querySelector('img'); if (img) img.sizes = (stacked() ? p.clientWidth : pw) + 'px'; });
    var key = JSON.stringify(groups);
    if (key !== lastKey) { lastKey = key; rebuild(); }
    root.querySelectorAll('[data-bk-zoom]').forEach(function (b) {
      var d = Number(b.getAttribute('data-bk-zoom'));
      b.disabled = zoom + d < 0 || zoom + d >= ZOOM.length;
    });
    current = groupOf(keep);
    jump(current, true);
    mark(current);
  }

  /* One element per view; the pages move into it (they keep their loaded images). */
  function rebuild() {
    var frag = document.createDocumentFragment();
    var old = [].slice.call(track.querySelectorAll('.bk__spread'));
    views = groups.map(function (g, gi) {
      var d = document.createElement('div');
      d.className = 'bk__spread';
      d.setAttribute('data-bk-spread', gi);
      d.setAttribute('role', 'group');
      d.setAttribute('aria-label', label(g[0] + 1, g[g.length - 1] + 1));
      g.forEach(function (i) { d.appendChild(panels[i]); });
      frag.appendChild(d);
      return d;
    });
    old.forEach(function (d) { d.remove(); });
    track.appendChild(frag);
  }

  function centre(gi) { var v = views[gi]; return v.offsetLeft + v.offsetWidth / 2 - track.clientWidth / 2; }
  var scrollReset = 0;
  function restoreScroller() {
    cancelAnimationFrame(scrollReset);
    track.style.overflowX = '';
  }
  function jump(gi, instant) {
    if (stacked() || !views[gi]) return;
    restoreScroller();
    if (instant || reduce) {
      // iOS can restore a stale async snap offset after a hash/resize jump.
      // Commit the new position before returning the layer to touch scrolling.
      track.style.overflowX = 'hidden';
      void track.offsetWidth;
      scrollReset = requestAnimationFrame(function () {
        scrollReset = requestAnimationFrame(restoreScroller);
      });
    }
    target = instant || reduce ? null : gi;
    track.scrollTo({ left: centre(gi), behavior: instant || reduce ? 'auto' : 'smooth' });
  }

  /* After a flip the new page starts at its top, under the bar, like turning a real page. */
  function toTop(force) {
    var v = stacked() ? panels[first(current)] : views[current];
    if (!v) return;
    var y = v.getBoundingClientRect().top - chrome() - bar.offsetHeight - 16;
    // a short way glides; a long way (read to the bottom of a tall page) jumps, so it never drifts diagonally with the slide
    if (y < -8 || (force && Math.abs(y) > 8)) window.scrollTo({ top: window.scrollY + y, behavior: reduce || Math.abs(y) > window.innerHeight * 0.6 ? 'auto' : 'smooth' });
  }

  function mark(gi, push) {
    current = gi;
    var g = groups[gi];
    views.forEach(function (v, i) { v.classList.toggle('is-on', i === gi); });
    thumbs.forEach(function (t, i) {
      var on = g.indexOf(i) >= 0;
      t.classList.toggle('is-on', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    count.textContent = label(g[0] + 1, g[g.length - 1] + 1);
    var map = root.querySelector('.bk__map');
    if (map.scrollWidth > map.clientWidth) map.scrollLeft += thumbs[g[0]].getBoundingClientRect().left - map.getBoundingClientRect().left - map.clientWidth / 2;
    root.querySelectorAll('[data-bk-step="-1"]').forEach(function (b) { b.disabled = gi === 0; });
    var last = gi === groups.length - 1;
    root.querySelectorAll('[data-bk-bar] [data-bk-step="1"]').forEach(function (b) { b.disabled = last; });
    if (nextLabel) nextLabel.textContent = last ? 'Aftur á forsíðu' : 'Næsta: ' + thumbs[first(gi + 1)].getAttribute('data-tip');
    // the next and the previous view load before they are needed
    [gi - 1, gi, gi + 1].forEach(function (x) {
      if (groups[x]) groups[x].forEach(function (i) { var img = panels[i].querySelector('img'); if (img && img.loading === 'lazy') img.loading = 'eager'; });
    });
    var hash = selected > 0 ? '#sida-' + (selected + 1) : '';
    if (location.hash !== hash) history[push ? 'pushState' : 'replaceState'](null, '', location.pathname + location.search + hash);
  }

  function go(gi, opts) {
    opts = opts || {};
    gi = Math.max(0, Math.min(groups.length - 1, gi));
    selected = first(gi);
    if (stacked()) {
      current = gi;
      var p = panels[first(gi)];
      window.scrollTo({ top: window.scrollY + p.getBoundingClientRect().top - chrome() - bar.offsetHeight - 16, behavior: reduce ? 'auto' : 'smooth' });
      mark(gi, opts.history === true);
      return;
    }
    mark(gi, opts.history === true);
    jump(gi);
    toTop(opts.force);
  }

  /* A swipe or a trackpad: follow the view in the middle; when it settles, bring its top into view. */
  var raf = 0, settle = 0, swiped = false;
  track.addEventListener('scroll', function () {
    if (stacked()) return;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      var mid = track.scrollLeft + track.clientWidth / 2, best = current, d = Infinity;
      views.forEach(function (v, i) { var dd = Math.abs(v.offsetLeft + v.offsetWidth / 2 - mid); if (dd < d) { d = dd; best = i; } });
      if (target === null && best !== current) { swiped = true; selected = first(best); mark(best); }
    });
    clearTimeout(settle);
    settle = setTimeout(function () { target = null; if (Math.abs(track.scrollLeft - centre(current)) > 1) jump(current, true); if (swiped) { swiped = false; toTop(); } }, 160);
  }, { passive: true });
  track.addEventListener('touchstart', function () { restoreScroller(); target = null; }, { passive: true });
  track.addEventListener('wheel', function () { restoreScroller(); target = null; }, { passive: true });
  // Lenis smooths the page's vertical wheel; a sideways swipe on the pages is the track's own.
  track.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.lenisStopPropagation = true; }, { passive: true });

  root.addEventListener('click', function (e) {
    var step = e.target.closest('[data-bk-step]');
    if (step) {
      var d = Number(step.getAttribute('data-bk-step'));
      var last = current === groups.length - 1;
      go(d > 0 && last && step.closest('[data-bk-foot]') ? 0 : current + d, { force: !!step.closest('[data-bk-foot]') });
      return;
    }
    var z = e.target.closest('[data-bk-zoom]');
    if (z) { zoom = Math.max(0, Math.min(ZOOM.length - 1, zoom + Number(z.getAttribute('data-bk-zoom')))); store('kj-bk-zoom', zoom); layout(); toTop(); return; }
    if (e.target.closest('[data-bk-mode]')) { setMode(!stacked()); return; }
    var view = e.target.closest('.bk__spread');
    if (view && !stacked() && !view.classList.contains('is-on')) go(views.indexOf(view));
  });

  // the map, and "Síða 3" in the contents under the viewer
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-bk-go]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(groupOf(Number(a.getAttribute('data-bk-go'))), { force: true });
  });

  document.addEventListener('keydown', function (e) {
    if (stacked() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable="true"], [data-panel], dialog')) return;
    if (document.querySelector('[data-panel][aria-hidden="false"], dialog[open]')) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); go(current + (k === 'ArrowRight' ? 1 : -1)); }
    else if ((k === 'Home' || k === 'End') && root.contains(t)) { e.preventDefault(); go(k === 'Home' ? 0 : groups.length - 1); }
  });

  function setMode(stack) {
    var keep = selected;
    root.classList.toggle('is-stack', stack);
    modeBtn.setAttribute('aria-pressed', String(stack));
    modeBtn.setAttribute('aria-label', stack ? 'Fletta bæklingnum' : 'Sjá allar síðurnar hverja undir annarri');
    modeBtn.setAttribute('data-tip', stack ? 'Fletta' : 'Allar síður í röð');
    store('kj-bk-mode', stack ? 'stack' : 'flip');
    if (stack) {
      panels.forEach(function (p) { p.querySelector('img').sizes = p.clientWidth + 'px'; });
      var p = panels[keep];
      window.scrollTo({ top: window.scrollY + p.getBoundingClientRect().top - chrome() - bar.offsetHeight - 16, behavior: 'auto' });
    } else {
      layout();
      selected = keep;
      current = groupOf(keep);
      jump(current, true);
      mark(current);
      toTop(true);
    }
  }

  // in the column, the map follows the page you are reading
  var seen = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
    if (!stacked()) return;
    entries.forEach(function (en) { if (en.isIntersecting) { selected = Number(en.target.getAttribute('data-bk-panel')); mark(groupOf(selected)); } });
  }, { rootMargin: '-45% 0px -50% 0px' });
  if (seen) panels.forEach(function (p) { seen.observe(p); });

  var rs = 0;
  if ('ResizeObserver' in window) new ResizeObserver(function () {
    cancelAnimationFrame(rs);
    rs = requestAnimationFrame(function () { layout(); });
  }).observe(root);

  // start: the remembered mode, the page in the address (#sida-5), or the cover
  var start = /^#sida-(\d+)$/.exec(location.hash);
  if (read('kj-bk-mode', 'flip') === 'stack') {
    root.classList.add('is-stack');
    modeBtn.setAttribute('aria-pressed', 'true');
    modeBtn.setAttribute('aria-label', 'Fletta bæklingnum');
    modeBtn.setAttribute('data-tip', 'Fletta');
  }
  layout();
  if (start) {
    var i = Math.max(0, Math.min(total - 1, Number(start[1]) - 1));
    selected = i;
    current = groupOf(i);
    if (stacked()) { mark(current); panels[i].scrollIntoView({ block: 'start' }); }
    else { jump(current, true); mark(current); requestAnimationFrame(function () { toTop(true); }); }
  }
  function fromHash() {
    var match = /^#sida-(\d+)$/.exec(location.hash);
    selected = match ? Math.max(0, Math.min(total - 1, Number(match[1]) - 1)) : 0;
    current = groupOf(selected);
    jump(current, true);
    mark(current);
    if (stacked()) panels[selected].scrollIntoView({ block: 'start' });
    else toTop(true);
  }
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('popstate', fromHash);
})();
