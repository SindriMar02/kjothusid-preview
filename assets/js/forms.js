/* Kjöthúsið: the enquiry form and the order form.
   Both post JSON to the relay Worker, which renders and sends the email. The
   page says "sent" only when the relay answers with a provider id; anything
   else keeps the customer's input and shows the phone number. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHONE = '557 8833';
  var UNIT = { kg: 'kr/kg', stk: 'kr/stk', pk: 'kr/pk', flat: 'kr' };
  var fmt = function (n) { return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n); };
  var fold = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ö/g, 'o');
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function makeRef() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    var rand = (crypto && crypto.getRandomValues) ? Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(2)), function (b) { return b.toString(16).padStart(2, '0'); }).join('').toUpperCase() : Math.random().toString(16).slice(2, 6).toUpperCase();
    return 'KJ-' + String(d.getUTCFullYear()).slice(2) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' + rand;
  }

  /* ── field errors ── */
  function setError(input, msg) {
    var field = input.closest('.field');
    var err = field && field.querySelector('.field__error');
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) {
      err.textContent = msg || '';
      err.hidden = !msg;
      var ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (msg && ids.indexOf(err.id) < 0) input.setAttribute('aria-describedby', ids.concat(err.id).join(' '));
    }
  }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function checkContact(form) {
    var set = form.querySelector('[data-one-of]');
    if (!set) return true;
    var email = set.querySelector('[name="email"]'), phone = set.querySelector('[name="phone"]');
    var e = email.value.trim(), p = phone.value.trim();
    var msg = set.querySelector('[data-one-of-error]');
    var ok = true;
    setError(email, ''); setError(phone, '');
    if (!e && !p) {
      msg.hidden = false; ok = false;
      email.setAttribute('aria-invalid', 'true'); phone.setAttribute('aria-invalid', 'true');
    } else {
      msg.hidden = true;
      if (e && !EMAIL.test(e)) { setError(email, 'Þetta lítur ekki út eins og netfang.'); ok = false; }
      if (p && p.replace(/\D/g, '').length < 7) { setError(phone, 'Símanúmerið þarf að vera að minnsta kosti 7 tölustafir.'); ok = false; }
    }
    return ok;
  }
  function required(input, msg) {
    var ok = !!input.value.trim();
    setError(input, ok ? '' : msg);
    return ok;
  }

  function status(form, kind, html) {
    var box = form.querySelector('[data-form-status]');
    box.className = 'form__status type-small' + (kind ? ' is-' + kind : '');
    box.innerHTML = html;
  }

  /* One JSON POST. A response without ok:true and an id is a failure, whatever the status code.
     On the preview ("demo") nothing is sent and the form says exactly that. */
  function send(form, payload) {
    var url = form.getAttribute('data-endpoint');
    if (url === 'demo') {
      status(form, 'demo', '<strong>Þetta er forskoðun og ekkert var sent.</strong> Á opnaða vefnum fer ' + (payload.kind === 'order' ? 'pöntunin' : 'fyrirspurnin') + ' beint til Kjöthússins í tölvupósti. Í síma ' + PHONE + ' er alltaf hægt að panta.');
      return new Promise(function () {});
    }
    var btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    status(form, 'busy', 'Sendi…');
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; }); })
      .then(function (r) {
        if (r.res.ok && r.body && r.body.ok && r.body.id) return r.body;
        var reason = r.body && r.body.reason;
        throw new Error(reason || 'http-' + r.res.status);
      })
      .finally(function () { btn.disabled = false; btn.removeAttribute('aria-busy'); });
  }
  function failMessage(err) {
    var why = {
      'rate-limited': 'Of margar sendingar á stuttum tíma. Reyndu aftur eftir smá stund.',
      'bad-order': 'Eitthvað í forminu var ekki rétt fyllt út.',
      'not-configured': 'Formið er ekki komið í samband enn.'
    }[err && err.message] || 'Sendingin tókst ekki.';
    return why + ' Ekkert glataðist: reyndu aftur, eða hringdu í <a href="tel:+3545578833">' + PHONE + '</a>.';
  }
  function focusFirstError(form) {
    var bad = form.querySelector('[aria-invalid="true"], [data-lines-error]:not([hidden])');
    if (bad) {
      (bad.matches('input,textarea,select') ? bad : (form.querySelector('#picker-search') || bad)).focus();
      bad.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  /* ── enquiry ── */
  document.querySelectorAll('form[data-form="enquiry"]').forEach(function (form) {
    var ref = null;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = required(form.querySelector('[name="name"]'), 'Settu inn nafn.');
      ok = required(form.querySelector('[name="message"]'), 'Skrifaðu fyrirspurnina.') && ok;
      ok = checkContact(form) && ok;
      if (!ok) { status(form, 'error', 'Lagaðu það sem er merkt hér að ofan.'); focusFirstError(form); return; }
      ref = ref || makeRef();
      var v = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
      var type = form.querySelector('[name="customerType"]:checked');
      send(form, {
        kind: 'enquiry', ref: ref, customerType: type ? type.value : '', name: v('name'), company: v('company'),
        email: v('email'), phone: v('phone'), message: v('message'), website: v('website'), page: location.pathname
      }).then(function () {
        form.classList.add('is-sent');
        status(form, 'ok', '<strong>Takk, fyrirspurnin er komin til okkar.</strong> Við svörum eins fljótt og við getum. Tilvísun: ' + esc(ref) + '.');
        form.querySelectorAll('input:not([type=radio]), textarea').forEach(function (el) { el.value = ''; });
        ref = null;
      }).catch(function (err) { status(form, 'error', failMessage(err)); });
    });
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') {
        if (e.target.name === 'email' || e.target.name === 'phone') checkContact(form); else setError(e.target, '');
      }
    });
  });

  /* ── order ── */
  var form = document.querySelector('form[data-form="order"]');
  if (!form) return;
  var catalogue = [];
  try { catalogue = JSON.parse(document.getElementById('kj-catalogue').textContent); } catch (e) {}
  var byKey = {};
  catalogue.forEach(function (c) { c.f = fold(c.n + ' ' + (c.c || '')); byKey[c.k] = c; });

  var lines = []; // { k, q, u }
  var justAdded = null;
  var Basket = window.KJBasket;
  function load() {
    var saved = Basket ? Basket.all() : [];
    lines = saved.map(function (x) {
      var c = byKey[x.k];
      return c ? { k: x.k, q: x.q || defaultQty(c), u: orderUnit(x.u || c.u) } : null;
    }).filter(Boolean);
    var params = new URLSearchParams(location.search);
    params.getAll('v').forEach(function (k) {
      if (byKey[k] && !lines.some(function (l) { return l.k === k; })) lines.push({ k: k, q: defaultQty(byKey[k]), u: orderUnit(byKey[k].u) });
    });
  }
  function defaultQty(c) { return c.u === 'kg' ? 1 : 1; }
  // A price unit describes the price; the relay's quantity is kilograms or pieces.
  function orderUnit(u) { return u === 'flat' || u === 'pk' ? 'stk' : (u || 'kg'); }
  function persist() {
    if (Basket) Basket.set(lines.map(function (l) { return { k: l.k, n: byKey[l.k].n, q: l.q, u: l.u }; }));
  }

  var listEl = form.querySelector('[data-lines-list]');
  var emptyEl = form.querySelector('[data-lines-empty]');
  var totalEl = form.querySelector('[data-lines-total]');
  var linesErr = form.querySelector('[data-lines-error]');

  function unitLabel(u) { return u === 'kg' ? 'kg' : 'stk.'; }
  function render() {
    emptyEl.hidden = lines.length > 0;
    listEl.innerHTML = lines.map(function (l, i) {
      var c = byKey[l.k];
      var priced = typeof c.p === 'number';
      var fixedUnit = c.u === 'kg' || c.u === 'stk' || c.u === 'flat' || c.u === 'pk';
      var unitCtl = fixedUnit
        ? '<span class="oline__unit">' + unitLabel(l.u) + '</span>'
        : '<select class="oline__unit-select" data-line-unit="' + i + '" aria-label="Eining fyrir ' + esc(c.n) + '"><option value="kg"' + (l.u === 'kg' ? ' selected' : '') + '>kg</option><option value="stk"' + (l.u === 'stk' ? ' selected' : '') + '>stk.</option></select>';
      return '<li class="oline' + (l.k === justAdded ? ' is-new' : '') + '">' +
        '<div class="oline__name"><span class="type-small text-black">' + esc(c.n) + '</span>' +
        '<span class="type-xsmall text-mid-gray">' + esc(c.l || '') + (priced ? ' · ' + fmt(c.p) + ' ' + UNIT[c.u] : ' · Verð í síma') + '</span></div>' +
        '<div class="oline__qty">' +
        '<button type="button" class="oline__step" data-line-step="' + i + '" data-d="-1" aria-label="Minna af ' + esc(c.n) + '">−</button>' +
        '<input class="oline__input" type="number" inputmode="decimal" min="0.5" step="' + (l.u === 'kg' ? '0.5' : '1') + '" value="' + l.q + '" data-line-q="' + i + '" aria-label="Magn af ' + esc(c.n) + '">' +
        '<button type="button" class="oline__step" data-line-step="' + i + '" data-d="1" aria-label="Meira af ' + esc(c.n) + '">+</button>' +
        unitCtl +
        '</div>' +
        (l.u === 'kg' ? '<p class="oline__approx type-xsmall text-mid-gray">Um það bil. Endanleg þyngd ræðst við vigtun.</p>' : '') +
        '<button type="button" class="oline__remove type-xsmall" data-line-remove="' + i + '">Fjarlægja</button>' +
        '</li>';
    }).join('');
    var est = 0, missing = 0;
    lines.forEach(function (l) {
      var c = byKey[l.k];
      if (typeof c.p === 'number') est += c.p * l.q; else missing++;
    });
    if (lines.length && est) {
      totalEl.hidden = false;
      totalEl.innerHTML = 'Áætlað verð án vsk.: <strong>' + fmt(est) + ' kr.</strong>' +
        (missing ? ' Án ' + missing + (missing === 1 ? ' vöru' : ' vara') + ' sem verð vantar fyrir.' : '') +
        ' Endanlegt verð miðast við vigt og staðfestingu okkar.';
    } else totalEl.hidden = true;
    if (lines.length) linesErr.hidden = true;
  }
  function add(k) {
    if (!byKey[k]) return;
    if (lines.some(function (l) { return l.k === k; })) return;
    lines.push({ k: k, q: defaultQty(byKey[k]), u: orderUnit(byKey[k].u) });
    justAdded = k;
    persist(); render();
    justAdded = null;
  }
  listEl.addEventListener('click', function (e) {
    var step = e.target.closest('[data-line-step]');
    if (step) {
      var l = lines[+step.getAttribute('data-line-step')];
      var inc = l.u === 'kg' ? 0.5 : 1;
      l.q = Math.max(inc, Math.round((l.q + inc * +step.getAttribute('data-d')) * 2) / 2);
      persist(); render();
      var again = listEl.querySelector('[data-line-step="' + step.getAttribute('data-line-step') + '"][data-d="' + step.getAttribute('data-d') + '"]');
      if (again) again.focus();
      return;
    }
    var rm = e.target.closest('[data-line-remove]');
    if (rm) {
      lines.splice(+rm.getAttribute('data-line-remove'), 1);
      persist(); render();
      search.focus();
    }
  });
  listEl.addEventListener('change', function (e) {
    var q = e.target.closest('[data-line-q]');
    if (q) {
      var l = lines[+q.getAttribute('data-line-q')];
      var v = parseFloat(String(q.value).replace(',', '.'));
      l.q = isFinite(v) && v > 0 ? Math.round(v * 2) / 2 : l.q;
      persist(); render();
    }
    var u = e.target.closest('[data-line-unit]');
    if (u) { lines[+u.getAttribute('data-line-unit')].u = u.value; persist(); render(); }
  });
  document.addEventListener('kj:basket', function () { load(); render(); });

  /* the picker: a combobox over every orderable product */
  var search = form.querySelector('#picker-search');
  var box = form.querySelector('#picker-list');
  var active = -1, results = [];
  function openList(q) {
    var f = fold(q).trim();
    results = !f ? [] : catalogue.filter(function (c) {
      return f.split(/\s+/).every(function (w) { return c.f.indexOf(w) >= 0; });
    }).slice(0, 12);
    active = results.length ? 0 : -1;
    box.innerHTML = results.length
      ? results.map(function (c, i) {
          var inBasket = lines.some(function (l) { return l.k === c.k; });
          return '<li role="option" id="opt-' + i + '" class="picker__opt' + (i === active ? ' is-active' : '') + '" aria-selected="' + (i === active) + '" data-k="' + esc(c.k) + '">' +
            '<span class="type-small text-black">' + esc(c.n) + (inBasket ? ' <span class="text-mid-gray">(komið)</span>' : '') + '</span>' +
            '<span class="type-xsmall text-mid-gray">' + esc(c.c || '') + (typeof c.p === 'number' ? ' · ' + fmt(c.p) + ' ' + UNIT[c.u] : '') + '</span></li>';
        }).join('')
      : (f ? '<li class="picker__none type-small text-mid-gray" role="option" aria-disabled="true">Ekkert fannst. Skrifaðu það í athugasemdir eða hringdu í ' + PHONE + '.</li>' : '');
    box.hidden = !f;
    search.setAttribute('aria-expanded', f ? 'true' : 'false');
    search.setAttribute('aria-activedescendant', active >= 0 ? 'opt-' + active : '');
  }
  function move(d) {
    if (!results.length) return;
    active = (active + d + results.length) % results.length;
    box.querySelectorAll('.picker__opt').forEach(function (o, i) {
      o.classList.toggle('is-active', i === active);
      o.setAttribute('aria-selected', i === active ? 'true' : 'false');
      if (i === active) o.scrollIntoView({ block: 'nearest' });
    });
    search.setAttribute('aria-activedescendant', 'opt-' + active);
  }
  function choose(k) {
    add(k);
    search.value = '';
    openList('');
    search.focus();
  }
  search.addEventListener('input', function () { openList(search.value); });
  search.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) choose(results[active].k); }
    else if (e.key === 'Escape') { search.value = ''; openList(''); }
  });
  box.addEventListener('mousedown', function (e) { e.preventDefault(); });
  box.addEventListener('click', function (e) {
    var o = e.target.closest('[data-k]');
    if (o) choose(o.getAttribute('data-k'));
  });
  search.addEventListener('blur', function () { setTimeout(function () { box.hidden = true; search.setAttribute('aria-expanded', 'false'); }, 120); });

  /* Pick-up day and time. The page is static, so the first possible day is
     worked out here, in Iceland's time, not when the page was built. */
  var pickup = form.querySelector('[data-pickup]');
  var date = form.querySelector('[name="date"]');
  var time = form.querySelector('[name="time"]');
  var notice = Number(pickup.getAttribute('data-notice')) || 1;
  var weekdaysOnly = pickup.getAttribute('data-weekdays') === '1';
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var isWeekend = function (d) { return d.getUTCDay() === 0 || d.getUTCDay() === 6; };
  function firstDay() {
    var d = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00Z');
    var left = notice;
    while (left > 0 || (weekdaysOnly && isWeekend(d))) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (!(weekdaysOnly && isWeekend(d))) left--;
    }
    return iso(d);
  }
  var WD = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
  var MO = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  /* Our own names: not every browser ships Icelandic dates and would fall back to English. */
  var dayIs = function (iso) { var d = new Date(iso + 'T12:00:00Z'); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + '.\u00a0' + MO[d.getUTCMonth()]; };
  /* "sækja hana mánudaginn 19. október": the day in the accusative. */
  var WD_ACC = ['sunnudaginn', 'mánudaginn', 'þriðjudaginn', 'miðvikudaginn', 'fimmtudaginn', 'föstudaginn', 'laugardaginn'];
  var dayAcc = function (iso) { var d = new Date(iso + 'T12:00:00Z'); return WD_ACC[d.getUTCDay()] + ' ' + d.getUTCDate() + '.\u00a0' + MO[d.getUTCMonth()]; };
  var DAY = { format: function (d) { return dayIs(d.toISOString().slice(0, 10)); } };
  var first;
  var dateHint = document.getElementById('order-date-hint');
  function refreshFirstDay() {
    first = firstDay();
    date.min = first;
    if (dateHint) dateHint.textContent = 'Fyrsti mögulegi dagur er ' + DAY.format(new Date(first + 'T12:00:00Z')) + '.' + (weekdaysOnly ? ' Við afhendum virka daga.' : '');
  }
  refreshFirstDay();
  date.addEventListener('focus', refreshFirstDay);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshFirstDay(); });
  function checkDate() {
    refreshFirstDay();
    if (!date.value) { setError(date, 'Veldu dag.'); return false; }
    var d = new Date(date.value + 'T12:00:00Z');
    if (isNaN(d)) { setError(date, 'Veldu dag.'); return false; }
    if (date.value < first) { setError(date, 'Við þurfum dags fyrirvara. Fyrsti mögulegi dagur er ' + DAY.format(new Date(first + 'T12:00:00Z')) + '.'); return false; }
    if (weekdaysOnly && isWeekend(d)) { setError(date, 'Við afhendum aðeins virka daga. Veldu mánudag til föstudags.'); return false; }
    setError(date, '');
    return true;
  }
  date.addEventListener('change', checkDate);
  time.addEventListener('change', function () { if (time.value) setError(time, ''); });

  function checkEmailPhone() {
    var email = form.querySelector('[name="email"]'), phone = form.querySelector('[name="phone"]');
    var ok = required(email, 'Settu inn netfang.');
    if (ok && !EMAIL.test(email.value.trim())) { setError(email, 'Þetta lítur ekki út eins og netfang.'); ok = false; }
    var okP = required(phone, 'Settu inn símanúmer.');
    if (okP && phone.value.replace(/\D/g, '').length < 7) { setError(phone, 'Símanúmerið þarf að vera að minnsta kosti 7 tölustafir.'); okP = false; }
    if (okP && /[^\d\s+()-]/.test(phone.value.trim())) { setError(phone, 'Notaðu aðeins tölustafi, bil, +, bandstrik eða sviga í símanúmerinu.'); okP = false; }
    return ok && okP;
  }

  var ref = null;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    var linesMessage = !lines.length ? 'Veldu að minnsta kosti eina vöru.' : lines.length > 80 ? 'Hámark er 80 vörur í hverri pöntun.' : lines.some(function (l) { return !isFinite(l.q) || l.q <= 0 || l.q > 10000 || Math.round(l.q * 2) !== l.q * 2; }) ? 'Magn þarf að vera frá 0,5 til 10.000 í hálfum eða heilum einingum.' : '';
    linesErr.hidden = !linesMessage;
    if (linesMessage) { linesErr.textContent = linesMessage; ok = false; }
    ok = checkDate() && ok;
    ok = required(time, 'Veldu klukkan hvað þú sækir.') && ok;
    ok = required(form.querySelector('[name="name"]'), 'Settu inn fullt nafn.') && ok;
    ok = checkEmailPhone() && ok;
    if (!ok) { status(form, 'error', 'Lagaðu það sem er merkt hér að ofan.'); focusFirstError(form); return; }

    ref = ref || makeRef();
    var v = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
    var payload = {
      kind: 'order',
      ref: ref,
      customer: { name: v('name'), company: v('company'), kennitala: v('kennitala'), email: v('email'), phone: v('phone') },
      fulfilment: { type: 'pickup', date: date.value, time: time.value, place: '' },
      lines: lines.map(function (l) {
        var c = byKey[l.k];
        var parts = l.k.split(':');
        return {
          key: l.k, source: parts[0], name: c.n, list: c.l || '', qty: l.q, unit: l.u,
          approx: l.u === 'kg', unitPrice: typeof c.p === 'number' ? c.p : null, priceUnit: c.u || null,
          // The Business Central item number, from Karen's Items export (scripts/bc-items.js).
          // Shown in the order email so staff type the order in without looking it up.
          bcItemNo: c.b || null
        };
      }),
      notes: v('notes'),
      website: v('website'),
      page: location.pathname
    };
    send(form, payload).then(function () {
      if (Basket) Basket.clear();
      var summary = payload.lines.map(function (l) { return '<li>' + esc(l.name) + ', ' + String(l.qty).replace('.', ',') + ' ' + (l.unit === 'kg' ? 'kg (um það bil)' : 'stk.') + '</li>'; }).join('');
      form.classList.add('is-sent');
      form.innerHTML = '<div class="sent"><h2 class="type-header uppercase text-black">Takk fyrir pöntunina</h2>' +
        '<p class="type-medium">Pöntunin er komin til okkar. Þú vildir sækja hana ' + esc(dayAcc(payload.fulfilment.date)) + ' klukkan ' + esc(payload.fulfilment.time) + '. Við höfum samband í síma ' + esc(payload.customer.phone) + ' til að staðfesta.</p>' +
        '<p class="type-small text-mid-gray">Tilvísun: ' + esc(ref) + '</p><ul class="plainlist type-small">' + summary + '</ul>' +
        '<p class="type-small">Spurningar? Hringdu í <a href="tel:+3545578833">' + PHONE + '</a>.</p></div>';
      window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 120, behavior: reduce ? 'auto' : 'smooth' });
    }).catch(function (err) { status(form, 'error', failMessage(err)); });
  });
  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.name !== 'date') setError(e.target, '');
  });

  /* Lines persist on their own; typed details do not, so leaving with them unsent asks first. */
  var sent = false;
  form.addEventListener('submit', function () { setTimeout(function () { sent = form.classList.contains('is-sent'); }, 0); });
  window.addEventListener('beforeunload', function (e) {
    if (sent || form.classList.contains('is-sent')) return;
    var typed = ['name', 'phone', 'email', 'notes'].some(function (n) { var el = form.querySelector('[name="' + n + '"]'); return el && el.value.trim(); });
    if (typed) { e.preventDefault(); e.returnValue = ''; }
  });

  load(); render(); persist();
})();
