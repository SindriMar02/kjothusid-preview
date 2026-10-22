/* Kjöthúsið: site behaviour that is not motion.
   - notices and the pop-up appear and disappear by their own dates, between builds
   - at most one pop-up, shown once per visitor until a new one is published
   - the order basket: + on any price row puts the product on the order
   - tag filters on the price lists
   Every storage access is guarded: private windows and blocked storage must
   still get a working page. */
(function () {
  'use strict';
  var root = document.documentElement;
  var DATA = {};
  try { DATA = JSON.parse(document.getElementById('kj-data').textContent); } catch (e) {}
  var BASE = DATA.base || '/';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
    return null;
  }
  var now = Date.now();
  function live(el) {
    var s = el.getAttribute('data-start'), e = el.getAttribute('data-end');
    return (!s || Date.parse(s) <= now) && (!e || Date.parse(e) > now);
  }

  /* ── the header's height, for anchors and the hero offset ── */
  var header = document.querySelector('[data-site-header]');
  function chrome() {
    if (!header) return;
    root.style.setProperty('--top-chrome', header.offsetHeight + 'px');
    var n = header.querySelector('.notice:not([hidden])');
    root.style.setProperty('--notice-h', (n ? n.offsetHeight : 0) + 'px');
  }

  /* ── notices: newest live one, unless this visitor closed it ── */
  var closed = store('kj-notices-closed') || [];
  var notices = Array.prototype.slice.call(document.querySelectorAll('[data-notice]'));
  var shown = null;
  notices
    .filter(live)
    .sort(function (a, b) { return Date.parse(b.getAttribute('data-start') || 0) - Date.parse(a.getAttribute('data-start') || 0); })
    .forEach(function (n) {
      if (!shown && closed.indexOf(n.getAttribute('data-notice')) < 0) shown = n;
    });
  notices.forEach(function (n) { n.hidden = n !== shown; });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-notice-close]');
    if (!btn) return;
    var n = btn.closest('[data-notice]');
    n.hidden = true;
    closed.push(n.getAttribute('data-notice'));
    store('kj-notices-closed', closed.slice(-20));
    chrome();
  });
  chrome();
  window.addEventListener('resize', chrome, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(chrome);

  /* ── the pop-up: one, the newest live, once per publish ── */
  (function popup() {
    var all = Array.prototype.slice.call(document.querySelectorAll('dialog[data-popup]')).filter(live);
    if (!all.length || typeof HTMLDialogElement === 'undefined') return;
    all.sort(function (a, b) { return Date.parse(b.getAttribute('data-start') || 0) - Date.parse(a.getAttribute('data-start') || 0); });
    var d = all[0];
    var id = d.getAttribute('data-popup') + '@' + d.getAttribute('data-rev');
    var seen = store('kj-popups-seen') || [];
    if (seen.indexOf(id) >= 0) return;
    if (document.body.dataset.page === 'order') return; // never interrupt an order
    function close() {
      if (!d.open) return;
      seen.push(id);
      store('kj-popups-seen', seen.slice(-20));
      if (reduce) { d.close(); return; }
      d.classList.add('is-closing');
      setTimeout(function () { d.classList.remove('is-closing'); d.close(); }, 160);
    }
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-popup-close]')) close();
    });
    d.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    setTimeout(function () { if (!document.querySelector('[data-panel][aria-hidden="false"]')) d.showModal(); }, reduce ? 0 : 1400);
  })();

  /* ── the order basket ── */
  var KEY = 'kj-pontun';
  var basket = store(KEY) || [];
  var pill = null;
  var toast = document.createElement('p');
  toast.className = 'toast type-small';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  var toastTimer;
  function say(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2600);
  }
  function renderPill() {
    if (document.body.dataset.page === 'order') return;
    if (!basket.length) { if (pill) pill.hidden = true; return; }
    if (!pill) {
      pill = document.createElement('a');
      pill.className = 'basket';
      pill.href = BASE + 'pantanir/';
      document.body.appendChild(pill);
    }
    pill.hidden = false;
    pill.innerHTML = '<span>Pöntun</span><span class="basket__n">' + basket.length + '</span>';
    pill.setAttribute('aria-label', 'Pöntun, ' + basket.length + (basket.length === 1 ? ' vara' : ' vörur'));
  }
  window.KJBasket = {
    all: function () { return basket.slice(); },
    set: function (items) { basket = items.slice(); store(KEY, basket); renderPill(); },
    clear: function () { basket = []; store(KEY, null); renderPill(); }
  };
  /* ── the amount control in the row (Karen, 22 Oct) ──
     The plus puts the product on the order with its default amount (set per
     product in the studio, else 1 kg or 1 stk.) and becomes − amount + right
     in the row, with g/kg on weight rows. Minus below the minimum takes the
     product off again and the plus returns. Focus moves only on keyboard
     clicks (e.detail === 0): a tapped control must never paint a ring. */
  var MIN = { kg: 0.1, g: 10, stk: 1 };
  var STEP = { kg: 0.5, g: 100, stk: 1 };
  function snap(u, v) {
    if (u === 'kg') return Math.round(v * 10) / 10;
    if (u === 'g') return Math.round(v / 10) * 10;
    return Math.round(v);
  }
  function find(k) { for (var i = 0; i < basket.length; i++) if (basket[i].k === k) return basket[i]; return null; }
  function defaults(wrap) {
    var base = wrap.getAttribute('data-buy-unit') === 'kg' ? 'kg' : 'stk';
    var dq = parseFloat(wrap.getAttribute('data-buy-dq'));
    var du = wrap.getAttribute('data-buy-du');
    if (dq > 0 && (du === 'g' || du === 'kg' || du === 'stk')) return { q: dq, u: du };
    return { q: 1, u: base };
  }
  function setItem(k, n, q, u) {
    var item = find(k);
    if (q === null) basket = basket.filter(function (x) { return x.k !== k; });
    else if (item) { item.q = q; item.u = u; item.n = n; }
    else basket.push({ k: k, n: n, q: q, u: u });
    store(KEY, basket.length ? basket : null);
    renderPill();
    if (document.body.dataset.page === 'order') document.dispatchEvent(new CustomEvent('kj:basket'));
  }
  function renderBuy(wrap) {
    var k = wrap.getAttribute('data-buy'), n = wrap.getAttribute('data-buy-name');
    var item = find(k);
    var plus = wrap.querySelector('[data-order-add]');
    var ctl = wrap.querySelector('.buy__ctl');
    if (!item) { if (ctl) ctl.remove(); plus.hidden = false; plus.classList.remove('is-added'); wrap.classList.remove('is-on'); return; }
    plus.hidden = true; wrap.classList.add('is-on');
    var weight = wrap.getAttribute('data-buy-unit') === 'kg';
    var u = item.u === 'g' || item.u === 'kg' || item.u === 'stk' ? item.u : (weight ? 'kg' : 'stk');
    var html = '<button type="button" class="buy__step" data-buy-step="-1" aria-label="Minna af ' + n + '">−</button>' +
      '<input class="buy__q" type="number" inputmode="' + (u === 'kg' ? 'decimal' : 'numeric') + '" min="' + MIN[u] + '" step="' + (u === 'kg' ? '0.1' : u === 'g' ? '10' : '1') + '" value="' + item.q + '" data-buy-q aria-label="Magn af ' + n + (u === 'kg' ? ' í kílóum' : u === 'g' ? ' í grömmum' : '') + '">' +
      (weight
        ? '<button type="button" class="buy__unit" data-buy-toggle aria-label="Skipta um einingu, núna ' + (u === 'kg' ? 'kíló' : 'grömm') + '">' + (u === 'kg' ? 'kg' : 'g') + '</button>'
        : '<span class="buy__unit buy__unit--fixed">stk.</span>') +
      '<button type="button" class="buy__step" data-buy-step="1" aria-label="Meira af ' + n + '">+</button>';
    if (!ctl) { ctl = document.createElement('span'); ctl.className = 'buy__ctl'; wrap.appendChild(ctl); }
    ctl.innerHTML = html;
  }
  function renderAllBuys() { document.querySelectorAll('[data-buy]').forEach(renderBuy); }
  var escK = function (k) { return window.CSS && CSS.escape ? CSS.escape(k) : k; };
  document.addEventListener('click', function (e) {
    var wrap = e.target.closest('[data-buy]');
    var b = e.target.closest('[data-order-add]');
    var kb = e.detail === 0;
    if (b) {
      var k = b.getAttribute('data-order-add'), n = b.getAttribute('data-order-name');
      if (find(k)) { say(n + ' er þegar í pöntuninni.'); return; }
      if (wrap) {
        var d = defaults(wrap);
        setItem(k, n, d.q, d.u);
        renderBuy(wrap);
        var pl = wrap.querySelector('[data-buy-step="1"]');
        if (pl && kb) pl.focus();
      } else {
        // a button outside a row (the boxes): on the order with one of it, said out loud
        setItem(k, n, 1, 'stk');
        say(n + ' komið í pöntunina.');
        b.classList.add('is-added');
      }
      return;
    }
    if (!wrap) return;
    var step = e.target.closest('[data-buy-step]');
    if (step) {
      var it = find(wrap.getAttribute('data-buy'));
      if (!it) return;
      var dir = step.getAttribute('data-buy-step');
      var next = snap(it.u, it.q + STEP[it.u] * +dir);
      if (next < MIN[it.u]) {
        setItem(it.k, it.n, null);
        renderBuy(wrap);
        var p = wrap.querySelector('[data-order-add]');
        if (p && kb) p.focus();
        return;
      }
      setItem(it.k, it.n, next, it.u);
      renderBuy(wrap);
      var again = wrap.querySelector('[data-buy-step="' + dir + '"]');
      if (again && kb) again.focus();
      return;
    }
    var tog = e.target.closest('[data-buy-toggle]');
    if (tog) {
      var cur = find(wrap.getAttribute('data-buy'));
      if (!cur) return;
      // the amount survives the switch: 0,5 kg is 500 g and back
      if (cur.u === 'kg') setItem(cur.k, cur.n, Math.max(MIN.g, Math.round(cur.q * 1000)), 'g');
      else setItem(cur.k, cur.n, Math.max(MIN.kg, snap('kg', cur.q / 1000)), 'kg');
      renderBuy(wrap);
      var t2 = wrap.querySelector('[data-buy-toggle]');
      if (t2 && kb) t2.focus();
    }
  });
  document.addEventListener('change', function (e) {
    var q = e.target.closest('[data-buy-q]');
    if (!q) return;
    var wrap = q.closest('[data-buy]');
    var it = find(wrap.getAttribute('data-buy'));
    if (!it) return;
    var v = parseFloat(String(q.value).replace(',', '.'));
    if (!isFinite(v) || v <= 0) { setItem(it.k, it.n, null); renderBuy(wrap); return; }
    setItem(it.k, it.n, Math.max(MIN[it.u], snap(it.u, v)), it.u);
    renderBuy(wrap);
  });
  renderAllBuys();
  basket.forEach(function (x) {
    document.querySelectorAll('[data-order-add="' + escK(x.k) + '"]').forEach(function (b) { if (!b.closest('[data-buy]')) b.classList.add('is-added'); });
  });
  renderPill();

  /* ── tag filter on price lists ── */
  document.querySelectorAll('[data-pricelist]').forEach(function (list) {
    var bar = list.querySelector('[data-filter]');
    if (!bar) return;
    bar.hidden = false;
    var empty = list.querySelector('[data-filter-empty]');
    // The filter lives in the URL (?merki=Sértilboð), so a filtered list can be shared.
    var initial = new URLSearchParams(location.search).get('merki');
    if (initial) {
      var start = bar.querySelector('[data-filter-tag="' + (window.CSS && CSS.escape ? CSS.escape(initial) : initial) + '"]');
      if (start) {
        bar.querySelectorAll('[data-filter-tag]').forEach(function (c) { c.setAttribute('aria-pressed', c === start ? 'true' : 'false'); });
        apply(initial);
      }
    }
    bar.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter-tag]');
      if (!chip) return;
      var tag = chip.getAttribute('data-filter-tag');
      bar.querySelectorAll('[data-filter-tag]').forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      if (document.startViewTransition && !reduce) document.startViewTransition(function () { apply(tag); });
      else apply(tag);
      var url = new URL(location.href);
      if (tag) url.searchParams.set('merki', tag); else url.searchParams.delete('merki');
      history.replaceState(null, '', url);
    });
    function apply(tag) {
      var any = false;
      list.querySelectorAll('[data-group]').forEach(function (g) {
        var visible = 0;
        g.querySelectorAll('.prices__row').forEach(function (row) {
          var on = !tag || (row.getAttribute('data-tags') || '').split('|').indexOf(tag) >= 0;
          row.hidden = !on;
          if (on) visible++;
        });
        g.hidden = !visible;
        if (visible) any = true;
      });
      if (empty) empty.hidden = any;
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }
  });
})();

/* Kjötdagarnir: the page carries the next few dates of each day, the browser
   counts down to the first one that has not passed (Iceland = UTC, no DST)
   and keeps the soonest day first, so the static page stays right between builds. */
(function () {
  'use strict';
  var cells = document.querySelectorAll('[data-day]');
  if (!cells.length) return;
  var WD = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
  var MO = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  /* Our own names: not every browser ships Icelandic dates and would fall back to English. */
  var dayIs = function (iso) { var d = new Date(iso + 'T12:00:00Z'); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + '.\u00a0' + MO[d.getUTCMonth()]; };
  var dagar = function (n) { return n % 10 === 1 && n % 100 !== 11 ? 'dagur' : 'dagar'; };
  var between = function (a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); };
  function updateDays() {
    var today = new Date().toISOString().slice(0, 10);
    cells.forEach(function (el) {
      var next = (el.getAttribute('data-dates') || '').split(',').filter(function (d) { return d >= today; })[0];
      if (!next) return;
      var left = between(today, next);
      el.setAttribute('data-left', String(left));
      var n = el.querySelector('[data-count-n]'), u = el.querySelector('[data-count-u]'), when = el.querySelector('[data-day-date]');
      if (n) n.textContent = left === 0 ? 'Í dag' : String(left);
      if (u) { u.textContent = left === 0 ? '' : dagar(left); u.hidden = left === 0; }
      if (when) when.textContent = dayIs(next);
    });
    document.querySelectorAll('[data-days]').forEach(function (list) {
      var items = Array.prototype.slice.call(list.children);
      items.sort(function (a, b) { return Number(a.getAttribute('data-left') || 1e9) - Number(b.getAttribute('data-left') || 1e9); });
      items.forEach(function (li) { list.appendChild(li); });
      var show = Number(list.getAttribute('data-show') || 0);
      var all = list.hasAttribute('data-expanded');
      items.forEach(function (li, i) { li.hidden = !!show && !all && i >= show; });
    });
    var next = document.querySelector('[data-days] > [data-day]');
    var quick = document.querySelector('.quick__cell[data-day]');
    if (next && quick) {
      quick.setAttribute('data-dates', next.getAttribute('data-dates'));
      quick.querySelector('[data-next-name]').textContent = next.getAttribute('data-day-name');
      quick.querySelector('[data-count]').innerHTML = next.querySelector('[data-count]').innerHTML;
      quick.querySelector('[data-day-date]').textContent = next.querySelector('[data-day-date]').textContent;
    }
  }
  document.querySelectorAll('[data-days-more]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var list = document.getElementById(btn.getAttribute('aria-controls'));
      if (!list) return;
      var open = !list.hasAttribute('data-expanded');
      if (open) list.setAttribute('data-expanded', ''); else list.removeAttribute('data-expanded');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = btn.getAttribute(open ? 'data-label-less' : 'data-label-more');
      updateDays();
      if (!open) list.scrollIntoView({ block: 'nearest' });
    });
  });
  updateDays();
  // Refresh a tab left open over midnight, including one restored from sleep.
  setInterval(updateDays, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) updateDays(); });
})();
