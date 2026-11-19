/* The menu's smart parts (Sindri 17 Nov: "the hamburger menu should be smarter and more user friendly").
 *
 * 1. Open now? From the CMS hours in #kj-data, in Iceland time (= UTC all year). A public holiday or a day
 *    whose hours still wait on the shop (aðfangadagur) never gets an "open"/"closed" claim: the bar then
 *    shows the plain weekly hours. 31 Dec is closed (Karen 10 Nov).
 * 2. Product search over the whole range in #kj-data. Forgiving: "lambalaeri", "lambalæri" and "Lamba læri"
 *    all find Lambalæri. A hit opens its category page with ?vara=<row key>, which lights the row up.
 * 3. The "Panta og sækja" tile says how many items are in the order when there are any.
 * Pointer opens leave focus on the panel (focus-guard rule): the search never pops the phone keyboard
 * by itself. */
(function () {
  var dataEl = document.getElementById('kj-data');
  var data = {};
  try { data = JSON.parse(dataEl ? dataEl.textContent : '{}'); } catch (e) { data = {}; }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var base = data.base || '/';

  /* ---------- 1. open now ---------- */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAG = ['sunnudag', 'mánudag', 'þriðjudag', 'miðvikudag', 'fimmtudag', 'föstudag', 'laugardag'];
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var md = function (d) { return pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
  var addDays = function (d, n) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n)); };
  function easter(y) { // anonymous Gregorian algorithm
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31);
    return new Date(Date.UTC(y, mo - 1, ((h + l - 7 * m + 114) % 31) + 1));
  }
  function holidays(y) { // Icelandic public holidays + aðfangadagur (its hours wait on Karen)
    var e = easter(y), out = {};
    ['01-01', '05-01', '06-17', '12-24', '12-25', '12-26'].forEach(function (s) { out[s] = 1; });
    [-3, -2, 1, 39, 50].forEach(function (n) { out[md(addDays(e, n))] = 1; });
    var apr = new Date(Date.UTC(y, 3, 19)); while (apr.getUTCDay() !== 4) apr = addDays(apr, 1); out[md(apr)] = 1; // sumardagurinn fyrsti
    var aug = new Date(Date.UTC(y, 7, 1)); while (aug.getUTCDay() !== 1) aug = addDays(aug, 1); out[md(aug)] = 1; // frídagur verslunarmanna
    return out;
  }
  var hm = function (s) { return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)); };
  var clock = function (s) { return String(Number(s.slice(0, 2))) + (s.slice(3, 5) === '00' ? '' : ':' + s.slice(3, 5)); };
  function iso(d) { return d.toISOString().slice(0, 10); }
  function hoursOn(d) { // {opens, closes} | 'closed' | 'unknown'
    var hol = holidays(d.getUTCFullYear());
    var sp = (data.special || {})[iso(d)]; // Karen's holiday hours (K24) win over the week
    if (sp) return sp;
    if ((data.closed || []).indexOf(md(d)) > -1) return 'closed';
    if (hol[md(d)]) return 'unknown';
    var day = DAYS[d.getUTCDay()];
    var h = (data.hours || []).filter(function (x) { return x.days && x.days.indexOf(day) > -1; })[0];
    return h ? { opens: h.opens, closes: h.closes } : 'closed';
  }
  function status(now) {
    if (!data.hours || !data.hours.length) return null;
    var today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    var mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    var h = hoursOn(today);
    if (h === 'unknown') return null;
    if (h !== 'closed') {
      if (mins >= hm(h.opens) && mins < hm(h.closes)) {
        var left = hm(h.closes) - mins;
        return { open: true, text: left <= 60 ? 'Opið · lokar eftir ' + left + ' mín.' : 'Opið núna · til ' + clock(h.closes), short: left <= 60 ? 'Lokar kl. ' + clock(h.closes) : 'Opið til ' + clock(h.closes) };
      }
      if (mins < hm(h.opens)) return { open: false, text: 'Lokað · opnar kl. ' + clock(h.opens), short: 'Opnar kl. ' + clock(h.opens) };
    }
    if ((data.closed || []).indexOf(md(today)) > -1 || (data.special || {})[iso(today)] === 'closed') return { open: false, text: 'Lokað í dag', short: 'Lokað í dag' };
    for (var n = 1; n <= 10; n++) {
      var d = addDays(today, n), x = hoursOn(d);
      if (x === 'unknown') return { open: false, text: 'Lokað núna', short: 'Lokað' };
      if (x !== 'closed') return { open: false, text: 'Lokað · opnar ' + (n === 1 ? 'á morgun' : 'á ' + DAG[d.getUTCDay()]) + ' kl. ' + clock(x.opens), short: 'Lokað' };
    }
    return { open: false, text: 'Lokað núna', short: 'Lokað' };
  }
  var statusEl = document.querySelector('[data-mega-status]');
  var statusText = document.querySelector('[data-mega-status-text]');
  var statusShort = document.querySelector('[data-mega-status-short]');
  var fallback = statusText ? statusText.textContent : '';
  function paintStatus() {
    if (!statusEl) return;
    var s = status(new Date());
    statusEl.dataset.state = s ? (s.open ? 'open' : 'closed') : 'plain';
    statusText.textContent = s ? s.text : fallback;
    statusShort.textContent = s ? s.short : 'Opnunartímar';
    statusEl.setAttribute('aria-label', (s ? s.text + '. ' : '') + 'Opnunartímar og staðsetning');
  }
  paintStatus();
  window.kjOpenStatus = status; // tests

  /* ---------- 2. search ---------- */
  var input = document.querySelector('[data-mega-search]');
  var results = document.querySelector('[data-mega-results]');
  var clear = document.querySelector('[data-mega-clear]');
  var said = document.querySelector('[data-mega-said]');
  var fold = function (s) {
    return String(s || '').toLowerCase().replace(/æ/g, 'ae').replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/ö/g, 'o')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  };
  var index = [];
  var cats = data.categories || {};
  Object.keys(cats).forEach(function (c) {
    var slug = (data.slugs || {})[c];
    if (!slug) return;
    index.push({ cat: true, n: c, c: c, href: base + 'voruurval/' + slug + '/', meta: 'Vöruflokkur · ' + cats[c].length + (cats[c].length === 1 ? ' vara' : ' vörur'), f: fold(c) });
    cats[c].forEach(function (r) {
      var price = typeof r.p === 'number' ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(r.p) + ' ' + ({ kg: 'kr/kg', stk: 'kr/stk', pk: 'kr/pk' }[r.u] || 'kr') : 'Verð í síma';
      index.push({ n: r.n, c: c, href: base + 'voruurval/' + slug + '/?vara=' + encodeURIComponent(r.k), meta: c + ' · ' + price, f: fold(r.n + ' ' + (r.d || '')), fn: fold(r.n) });
    });
  });
  function score(it, q, words) {
    var name = it.fn || it.f, glued = name.replace(/ /g, '');
    for (var i = 0; i < words.length; i++) if (it.f.indexOf(words[i]) < 0 && glued.indexOf(words[i]) < 0) return 0;
    var s = 1;
    if (name.indexOf(q) === 0 || glued.indexOf(q.replace(/ /g, '')) === 0) s += 4;
    else if ((' ' + name).indexOf(' ' + words[0]) > -1) s += 2;
    if (it.cat) s += 3;
    return s - name.length / 200;
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
  var LIMIT = 8;
  function run() {
    var raw = input.value, q = fold(raw);
    clear.hidden = !raw;
    if (q.length < 2) { results.hidden = true; results.innerHTML = ''; said.textContent = ''; return; }
    var words = q.split(' ');
    var hits = index.map(function (it) { return { it: it, s: score(it, q, words) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; });
    var total = hits.length;
    hits = hits.slice(0, LIMIT);
    results.hidden = false;
    if (!hits.length) {
      results.innerHTML = '<p class="mega__none type-small">Ekkert fannst á vefnum. Spurðu okkur í síma <a href="tel:+354' + String(data.phone || '').replace(/\D/g, '') + '">' + esc(data.phone || '') + '</a>.</p>';
      said.textContent = 'Ekkert fannst';
      return;
    }
    results.innerHTML = hits.map(function (x) {
      return '<a class="mega__hit" href="' + esc(x.it.href) + '" data-modal-close><span class="mega__hit-name">' + esc(x.it.n) + '</span><span class="mega__hit-meta">' + esc(x.it.meta) + '</span></a>';
    }).join('') + (total > LIMIT ? '<p class="mega__more type-xsmall">' + (total - LIMIT) + ' í viðbót: skrifaðu meira til að þrengja.</p>' : '');
    said.textContent = total + (total === 1 ? ' niðurstaða' : ' niðurstöður');
  }
  if (input && results) {
    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { e.stopPropagation(); input.value = ''; run(); return; }
      if (e.key === 'ArrowDown') { var f = results.querySelector('a'); if (f) { e.preventDefault(); f.focus(); } }
      if (e.key === 'Enter') { var a = results.querySelector('a.mega__hit'); if (a) { e.preventDefault(); a.click(); } }
    });
    results.addEventListener('keydown', function (e) {
      var list = Array.prototype.slice.call(results.querySelectorAll('a.mega__hit'));
      var i = list.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowDown' && list[i + 1]) { e.preventDefault(); list[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (list[i - 1] || input).focus(); }
    });
    clear.addEventListener('click', function () { input.value = ''; run(); input.focus(); });
    input.closest('form, [role="search"]').addEventListener('submit', function (e) { e.preventDefault(); });
  }

  /* ---------- 3. order tile + open/close housekeeping ---------- */
  var basketSub = document.querySelector('[data-mega-basket]');
  var tick = null;
  document.addEventListener('shift-modal:open', function (e) {
    if (!e.detail || e.detail.id !== 'mega') return;
    paintStatus();
    tick = setInterval(paintStatus, 30000);
    if (basketSub) {
      var nav = document.querySelector('[data-nav-basket]');
      var cnt = document.querySelector('[data-nav-basket-count]');
      basketSub.textContent = nav && !nav.hidden && cnt && cnt.textContent ? cnt.textContent + ' í pöntun' : 'Veldu dag og tíma';
    }
  });
  document.addEventListener('shift-modal:close', function (e) {
    if (!e.detail || e.detail.id !== 'mega') return;
    clearInterval(tick);
    if (input && input.value) { input.value = ''; run(); }
  });

  /* ---------- 4. ?vara=<row key>: light up the product a search hit points to ---------- */
  var key = new URLSearchParams(location.search).get('vara');
  if (key) {
    var target = null;
    document.querySelectorAll('[data-buy]').forEach(function (el) { if (!target && el.getAttribute('data-buy') === key) target = el; });
    var row = target && target.closest('.prices__row, li');
    if (row) {
      row.classList.add('is-found');
      var go = function () {
        var head = document.querySelector('.site-header');
        var y = row.getBoundingClientRect().top + window.scrollY - (innerHeight / 2) + row.offsetHeight / 2;
        if (head) y = Math.min(y, row.getBoundingClientRect().top + window.scrollY - head.offsetHeight - 16);
        if (window.kjLenis) window.kjLenis.scrollTo(Math.max(0, y), { immediate: reduce });
        else window.scrollTo({ top: Math.max(0, y), behavior: reduce ? 'auto' : 'smooth' });
      };
      setTimeout(go, 350);
      setTimeout(function () { row.classList.remove('is-found'); }, 6000);
    }
  }
})();

/* K24 holiday hours: a page is static, so days that have passed since it was built are hidden here
   (a past line on the contact page, the FAQ list and the footer link once the last day is over). Runs on load,
   when the tab is shown again and at the next UTC midnight, so a tab left open overnight follows too. */
(function () {
  if (!document.querySelector('[data-hol-to],[data-hol-until]')) return;
  function today() { var n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())).toISOString().slice(0, 10); }
  function hide() {
    var t = today();
    Array.prototype.forEach.call(document.querySelectorAll('[data-hol-to]'), function (li) { li.hidden = li.getAttribute('data-hol-to') < t; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-hol-until]'), function (el) { el.hidden = el.getAttribute('data-hol-until') < t; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-hol-block]'), function (b) { b.hidden = !b.querySelector('[data-hol-to]:not([hidden])'); });
  }
  function atMidnight() {
    var n = new Date(), next = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
    setTimeout(function () { hide(); atMidnight(); }, Math.max(1000, next - n.getTime() + 1000));
  }
  hide();
  atMidnight();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) hide(); });
})();
