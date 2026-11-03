/* Kjöthúsið: the enquiry form and the order form.
   Both post JSON to the relay Worker, which renders and sends the email. The
   page says "sent" only when the relay answers with a provider id; anything
   else keeps the customer's input and shows the phone number. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var BASE_PATH = (function () { try { return JSON.parse(document.getElementById('kj-data').textContent).base || '/'; } catch (e) { return '/'; } })();
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
      return payload.kind === 'order' ? Promise.resolve({ preview: true }) : new Promise(function () {});
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
      (bad.matches('input,textarea,select') ? bad : (bad.querySelector('input') || form.querySelector('#picker-search') || bad)).focus();
      bad.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  }

  /* ── enquiry ── */
  document.querySelectorAll('form[data-form="enquiry"]').forEach(function (form) {
    var topic = new URLSearchParams(location.search).get('efni');
    if (topic === 'Jólagjafakassar') {
      var message = form.querySelector('[name="message"]');
      if (message && !message.value) message.value = 'Jólagjafakassar\n\n';
    }
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
  var occasion = null;
  var occasionKey = new URLSearchParams(location.search).get('pontun');
  if (occasionKey === 'jol' || occasionKey === 'aramot') {
    var occasions = [];
    try { occasions = JSON.parse(document.getElementById('kj-occasions').textContent); } catch (e) {}
    occasion = occasions.find(function (o) { return o.key === occasionKey; }) || null;
    if (occasion) {
      if (new URLSearchParams(location.search).get('jol') !== '0') document.documentElement.classList.add('is-jol');
      document.querySelector('.order-head').classList.toggle('order-head--aramot', occasionKey === 'aramot');
      var heading = document.querySelector('.page-head__title');
      heading.textContent = occasionKey === 'jol' ? 'Jólapöntun' : 'Áramótapöntun';
      document.title = heading.textContent + ' | Kjöthúsið';
      var note = document.querySelector('[data-occasion-note="' + occasionKey + '"]');
      if (note) note.hidden = false;
    }
  }

  var catalogue = [];
  try { catalogue = JSON.parse(document.getElementById('kj-catalogue').textContent); } catch (e) {}
  var byKey = {};
  catalogue.forEach(function (c) { c.f = fold(c.n + ' ' + (c.c || '')); byKey[c.k] = c; });

  var lines = []; // { k, q, u }
  var justAdded = null;
  var Basket = window.KJBasket;
  var loadedDeepLinks = false;
  function load() {
    var saved = Basket ? Basket.all() : [];
    lines = saved.map(function (x) {
      var c = byKey[x.k];
      return c ? { k: x.k, q: x.q || defaultQty(c), u: orderUnit(x.u || (c.dq ? c.du : null) || c.u), w: x.w || '' } : null;
    }).filter(Boolean);
    var params = new URLSearchParams(location.search);
    (loadedDeepLinks ? [] : params.getAll('v')).forEach(function (k) {
      if (byKey[k] && !lines.some(function (l) { return l.k === k; })) lines.push({ k: k, q: defaultQty(byKey[k]), u: orderUnit((byKey[k].dq ? byKey[k].du : null) || byKey[k].u) });
    });
    loadedDeepLinks = true;
  }
  function defaultQty(c) { return typeof c.dq === 'number' && c.dq > 0 ? c.dq : 1; }
  // A price unit describes the price; the relay's quantity is kilograms or pieces.
  function orderUnit(u) { return u === 'flat' || u === 'pk' ? 'stk' : u === 'g' ? 'g' : (u || 'kg'); }
  function persist() {
    if (Basket) Basket.set(lines.map(function (l) { return { k: l.k, n: byKey[l.k].n, q: l.q, u: l.u, w: l.w || '' }; }));
  }

  var linesErr = form.querySelector('[data-lines-error]');
  function render() {
    if (lines.length) linesErr.hidden = true;
  }
  document.addEventListener('kj:basket', function () { load(); render(); });

  /* Pick-up day and time. The page is static, so the first possible day is
     worked out here, in Iceland's time, not when the page was built. */
  var pickup = form.querySelector('[data-pickup]');
  function radioGroup(name) {
    var group = form.querySelector('[name="' + name + '"]').closest('fieldset');
    group.id = 'order-' + name;
    Object.defineProperty(group, 'value', {
      get: function () { var checked = group.querySelector('input:checked'); return checked ? checked.value : ''; },
      set: function (value) { group.querySelectorAll('input').forEach(function (input) { input.checked = input.value === value; }); }
    });
    return group;
  }
  var date = radioGroup('date');
  var time = radioGroup('time');
  var occasionDates = [];
  var banned = [];
  try {
    var dayData = JSON.parse(document.getElementById('kj-days').textContent);
    var dayKey = new URLSearchParams(location.search).get('dagur');
    banned = dayData[dayKey] ? dayData[dayKey].dates || [] : [];
  } catch (error) {}

  var notice = Number(pickup.getAttribute('data-notice')) || 1;
  var weekdaysOnly = !occasion && pickup.getAttribute('data-weekdays') === '1';
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
  var visibleDays = 10;
  var dayTilesInitialized = false;
  var tiles = [];
  var preselected = new URLSearchParams(location.search).get('sott') || '';
  function refreshFirstDay() {
    first = firstDay();
    occasionDates = occasion ? KjOccasions.pickupDays(occasion.pickupDays, iso(new Date()), first, false) : [];
    var selected = date.value || preselected;
    tiles = KJOrdering.dayTiles({ today: iso(new Date()), noticeDays: notice, weekdaysOnly: weekdaysOnly, occasionDays: occasion ? occasionDates : null, banned: banned, selected: selected });
    var host = form.querySelector('[data-day-tiles]');
    var old = Array.from(host.querySelectorAll('input')).map(function (input) { return input.value; }).join(',');
    var shown = occasion ? tiles : tiles.slice(0, visibleDays);
    var tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    var tomorrowHint = form.querySelector('[data-tomorrow]');
    if (!tomorrowHint) { tomorrowHint = document.createElement('p'); tomorrowHint.dataset.tomorrow = ''; tomorrowHint.className = 'type-xsmall text-mid-gray'; host.before(tomorrowHint); }
    tomorrowHint.textContent = shown[0] && shown[0].value === iso(tomorrow) ? 'Á morgun' : '';
    if (old !== shown.map(function (day) { return day.value; }).join(',')) {
      host.innerHTML = shown.map(function (day) {
        return '<label class="day-tile is-drawn"><input type="radio" required name="date" value="' + day.value + '" aria-describedby="order-date-hint order-date-err"' + (day.selected ? ' checked' : '') + '><span><small>' + day.weekday + '</small><strong>' + day.date + '</strong><small>' + day.month + '</small></span></label>';
      }).join('');
      if (!dayTilesInitialized && !reduce && window.gsap && window.ScrollTrigger) {
        gsap.fromTo(host.children, { opacity: 0, y: 10 }, {
          opacity: 1, y: 0, duration: .52, stagger: .04, ease: 'luxe',
          scrollTrigger: { trigger: host, start: 'top 90%', once: true, onLeave: function (self) { self.animation.progress(1); } }
        });
      }
    } else if (selected) date.value = selected;
    dayTilesInitialized = true;
    form.querySelector('[data-more-days]').hidden = !!occasion || visibleDays >= tiles.length;
    if (dateHint) dateHint.textContent = occasion ? 'Veldu afhendingardag fyrir ' + (occasion.key === 'jol' ? 'jólin.' : 'áramótin.') : 'Fyrsti mögulegi dagur er ' + dayIs(first) + '.' + (weekdaysOnly ? ' Við afhendum virka daga.' : '');
  }
  refreshFirstDay();
  preselected = '';
  form.querySelector('[data-more-days]').addEventListener('click', function () {
    var old = visibleDays;
    visibleDays += 10;
    refreshFirstDay();
    if (!reduce && window.gsap) gsap.fromTo(Array.from(form.querySelectorAll('.day-tile')).slice(old), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4, stagger: .03, ease: 'luxe' });
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });
  if (occasion) {
    var firstDate = occasionDates[0], lastDate = occasionDates[occasionDates.length - 1];
    var shortDays = ['sun.', 'mán.', 'þri.', 'mið.', 'fim.', 'fös.', 'lau.'];
    function shortDay(day) { var d = new Date(day + 'T12:00:00Z'); return shortDays[d.getUTCDay()] + ' ' + d.getUTCDate() + '.'; }
    if (firstDate) document.querySelector('[data-order-lede]').textContent = 'Sótt ' + shortDay(firstDate) + ' til ' + shortDay(lastDate) + ' ' + MO[new Date(lastDate + 'T12:00:00Z').getUTCMonth()] + '.';
    document.querySelector('[data-ordinary-order]').hidden = false;
    document.querySelectorAll('.order-holidays').forEach(function (row) { row.hidden = true; });
  }

  /* Arriving from a meat day (?dagur=sprengidagur): say so, pick the last
     possible pick-up day before it and leave the day's note. The products came
     in with ?v= above. */
  (function dayPreset() {
    var id = new URLSearchParams(location.search).get('dagur');
    var days = {};
    try { days = JSON.parse(document.getElementById('kj-days').textContent); } catch (e) {}
    var d = id && Object.prototype.hasOwnProperty.call(days, id) && days[id];
    if (!d || occasion) return;
    var t = new Date().toISOString().slice(0, 10);
    var day = (d.dates || []).filter(function (x) { return x >= t; })[0];
    var ban = form.querySelector('[data-dayban]');
    if (ban) { ban.innerHTML = '<span class="dayban__k">' + esc(d.banner) + '</span>' + (day ? '<span class="dayban__d">' + esc(dayIs(day)) + '</span>' : ''); ban.hidden = false; }
    if (day) {
      var p = new Date(day + 'T12:00:00Z');
      do { p.setUTCDate(p.getUTCDate() - 1); } while (weekdaysOnly && isWeekend(p));
      var pick = p.toISOString().slice(0, 10);
      if (pick >= first) date.value = pick;
    }
    var notes = form.querySelector('[name="notes"]');
    if (notes && !notes.value && d.note) notes.value = d.note;
  })();
  window.KJPickup = {
    options: function () { return { today: iso(new Date()), noticeDays: notice, weekdaysOnly: weekdaysOnly, banned: banned, occasionDays: occasion ? occasionDates : null, times: Array.from(form.querySelectorAll('[name="time"]')).map(function (input) { return input.value; }) }; },
    select: function (slot) {
      if (!KJOrdering.dayTiles(this.options()).some(function (day) { return day.value === slot.date; })) return;
      visibleDays = 60;
      refreshFirstDay();
      date.value = slot.date;
      time.value = slot.time;
      date.dispatchEvent(new Event('change', { bubbles: true }));
      time.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshFirstDay(); });
  function checkDate() {
    refreshFirstDay();
    if (!date.value) { setError(date, 'Veldu dag.'); return false; }
    if (banned.indexOf(date.value) >= 0) { setError(date, 'Veldu annan afhendingardag.'); return false; }
    var d = new Date(date.value + 'T12:00:00Z');
    if (isNaN(d)) { setError(date, 'Veldu dag.'); return false; }
    if (occasion && occasionDates.indexOf(date.value) < 0) { setError(date, 'Veldu afhendingardag fyrir þessa hátíð.'); return false; }
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
    var notes;
    try { notes = KJOrdering.mergeNotes(lines.map(function (l) { return { n: byKey[l.k].n, w: l.w }; }), v('notes')); }
    catch (error) { status(form, 'error', 'Óskirnar eru of langar fyrir eina pöntun. Hringdu í ' + PHONE + ' og við hjálpum þér.'); return; }
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
          approx: l.u === 'kg' || l.u === 'g', unitPrice: typeof c.p === 'number' ? c.p : null, priceUnit: c.u || null,
          // The Business Central item number, from Karen's Items export (scripts/bc-items.js).
          // Shown in the order email so staff type the order in without looking it up.
          bcItemNo: c.b || null
        };
      }),
      notes: notes,
      website: v('website'),
      page: location.pathname
    };
    if (occasion) payload.occasion = occasion.key;
    var rememberedLines = Basket.all();
    var rememberChecked = !!(form.querySelector('[data-remember]') && form.querySelector('[data-remember]').checked);
    var rememberedCompany = form.querySelector('[data-company-toggle]').checked;
    send(form, payload).then(function (result) {
      // Device memory receives its own local event, separate from the relay payload.
      document.dispatchEvent(new CustomEvent('kj:order-sent', {
        detail: {
          ref: ref,
          contact: Object.assign({}, payload.customer, { isCompany: rememberedCompany }),
          order: {
            ref: ref, occasion: occasion ? occasion.key : null,
            date: date.value, time: time.value, lines: rememberedLines
          },
          remember: rememberChecked
        }
      }));
      if (Basket) Basket.clear();
      var summary = payload.lines.map(function (l) { return '<li>' + esc(l.name) + ', ' + String(l.qty).replace('.', ',') + ' ' + (l.unit === 'kg' ? 'kg (um það bil)' : l.unit === 'g' ? 'g (um það bil)' : 'stk.') + '</li>'; }).join('');
      form.classList.add('is-sent');
      // The sent view is the order slip, stamped. Its button saves the pick-up to the calendar.
      var when = dayAcc(payload.fulfilment.date) + ' klukkan ' + payload.fulfilment.time;
      form.innerHTML = '<div class="sent">' +
        '<div class="slip slip--sent"><span class="stamp" aria-hidden="true">Móttekið</span>' +
        '<p class="slip__head"><img src="' + BASE_PATH + 'assets/img/crest.svg" alt="" width="398" height="244" class="slip__crest"><span class="slip__title">Pöntunarmiði</span><span class="slip__sub type-xsmall">' + esc(ref) + '</span></p>' +
        KJOrdering.icon('circle-check') + '<h2 class="type-header uppercase text-black sent__title">Pöntunin er komin til okkar</h2>' +
        (result && result.preview ? '<p class="type-small"><strong>Þetta er forskoðun og ekkert var sent.</strong> Á opnaða vefnum fer pöntunin beint til Kjöthússins í tölvupósti. Í síma ' + PHONE + ' er alltaf hægt að panta.</p>' : '') + '<p class="type-medium">Við hringjum og staðfestum. Þú vildir sækja hana ' + esc(when) + '. Við höfum samband í síma ' + esc(payload.customer.phone) + ' til að staðfesta.</p>' +
        '<ul class="slip__lines type-small">' + summary + '</ul>' +
        '<div class="sent__actions"><button type="button" class="chip chip--fill" data-pickup-remind aria-label="Setja afhendinguna í dagatalið"' + (window.KjRemind ? '' : ' hidden') + ' aria-expanded="false"><svg class="chip__icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-width="1.2"/></svg>Í dagatalið</button></div>' +
        '<p class="type-small">Spurningar? Hringdu í <a href="tel:+3545578833">' + PHONE + '</a>.</p></div></div>';
      var pr = form.querySelector('[data-pickup-remind]');
      if (pr && window.KjRemind) pr.addEventListener('click', function () {
        window.KjRemind.open(pr, {
          uid: 'pontun-' + ref + '@kjothusid.is',
          title: 'Sækja pöntun hjá Kjöthúsinu',
          description: 'Pöntun ' + ref + '\n' + payload.lines.map(function (l) { return '- ' + l.name + ', ' + String(l.qty).replace('.', ',') + ' ' + (l.unit === 'kg' ? 'kg' : l.unit === 'g' ? 'g' : 'stk.'); }).join('\n') + '\n\nSími 557 8833',
          location: 'Kjöthúsið, Smiðjuvegi 24D, 200 Kópavogi',
          url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Kjöthúsið, Smiðjuvegur 24D, 200 Kópavogur'),
          date: payload.fulfilment.date,
          time: payload.fulfilment.time,
          durationMinutes: 15,
          alarms: [{ minutesBefore: 60 }]
        }, 'kjothusid-pontun-' + ref + '.ics');
      });
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
