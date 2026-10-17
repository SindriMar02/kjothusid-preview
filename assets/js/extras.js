/* The fun layer (17 Oct): "Minna mig á" for the meat days and the monthly
   offer, the calendar menu they share, and the offer's
   "gildir í X daga enn". Everything runs here, in the visitor's browser: no
   account, nothing stored on a server. The calendar files come from KjCal
   (calendar.js); without it the reminder buttons stay hidden. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE_IO = 'cubic-bezier(.77,0,.175,1)';
  var EASE_OUT = 'cubic-bezier(.23,1,.32,1)';
  var todayIso = function () { return new Date().toISOString().slice(0, 10); };
  var here = function (path) { return location.origin + path; };
  var LOCATION = 'Kjöthúsið, Smiðjuvegi 24D, 200 Kópavogi';

  /* ── calendar menu ─────────────────────────────────────────────────────── */
  var Cal = window.KjCal;
  if (Cal) document.querySelectorAll('[data-remind]').forEach(function (b) { b.hidden = false; });

  var menu = null, opener = null, current = null;
  function buildMenu() {
    menu = document.createElement('div');
    menu.className = 'calmenu';
    menu.id = 'kj-calendar';
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-labelledby', 'kj-calendar-title');
    menu.hidden = true;
    menu.innerHTML =
      '<p id="kj-calendar-title" class="calmenu__title type-xsmall">Setja í dagatalið</p>' +
      '<button type="button" class="calmenu__item" data-cal="ics">iPhone, Mac og Outlook <span class="calmenu__hint">.ics</span></button>' +
      '<a class="calmenu__item" data-cal="google" target="_blank" rel="noopener">Google dagatal <span class="calmenu__hint">opnast í nýjum flipa</span></a>' +
      '<a class="calmenu__item" data-cal="outlook" target="_blank" rel="noopener">Outlook.com <span class="calmenu__hint">opnast í nýjum flipa</span></a>' +
      '<p class="calmenu__note type-xsmall">Áminningar fylgja .ics-skránni. Veldu áminningu í Google dagatali eða Outlook.com.</p>' +
      '<p class="calmenu__note type-xsmall" data-cal-recurrence hidden>Outlook.com vistar aðeins fyrsta viðburðinn. Veldu .ics fyrir mánaðarlega endurtekningu.</p>';
    document.body.appendChild(menu);
    menu.addEventListener('click', function (e) {
      var it = e.target.closest('[data-cal]');
      if (!it || !current) return;
      if (it.getAttribute('data-cal') === 'ics') { e.preventDefault(); Cal.download(current.event, current.file); }
      close(true);
    });
    menu.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll('[data-cal]'));
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Tab' && (e.shiftKey && i === 0 || !e.shiftKey && i === items.length - 1)) {
        // This shared panel lives at the end of body. Resume the trigger's
        // natural tab order rather than wrapping to the start of the page.
        close(true);
        if (e.shiftKey) e.preventDefault();
      }
    });
    menu.addEventListener('focusout', function (e) {
      if (!menu.contains(e.relatedTarget)) close(false);
    });
  }
  function open(btn, ev, file) {
    if (!menu) buildMenu();
    if (opener === btn && !menu.hidden) { close(true); return; }
    if (opener) opener.setAttribute('aria-expanded', 'false');
    opener = btn; current = { event: ev, file: file };
    menu.querySelector('[data-cal="google"]').href = Cal.googleUrl(ev);
    menu.querySelector('[data-cal="outlook"]').href = Cal.outlookUrl(ev);
    menu.querySelector('[data-cal-recurrence]').hidden = !ev.rrule;
    menu.hidden = false;
    // Keep every choice reachable at both viewport edges, including below a
    // button near the bottom. Scroll only the panel on short viewports.
    var r = btn.getBoundingClientRect();
    var w = menu.offsetWidth;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    var right = r.left + w > vw - 8;
    var left = right ? r.right - w : r.left;
    var above = r.bottom + 6 + menu.offsetHeight > vh - 8;
    var top = above ? r.top - menu.offsetHeight - 6 : r.bottom + 6;
    menu.style.left = (Math.max(8, Math.min(left, vw - w - 8)) + window.scrollX) + 'px';
    menu.style.top = (Math.max(8, Math.min(top, vh - menu.offsetHeight - 8)) + window.scrollY) + 'px';
    menu.style.setProperty('--calmenu-origin', (above ? 'bottom ' : 'top ') + (right ? 'right' : 'left'));
    menu.classList.add('is-entering');
    requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.remove('is-entering'); }); });
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-controls', menu.id);
    var first = menu.querySelector('[data-cal]');
    if (first) first.focus({ preventScroll: true });
  }
  function close(refocus) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    if (opener) { opener.setAttribute('aria-expanded', 'false'); if (refocus) opener.focus({ preventScroll: true }); }
    opener = null; current = null;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
  document.addEventListener('click', function (e) {
    if (menu && !menu.hidden && !menu.contains(e.target) && !opener.contains(e.target)) close(menu.contains(document.activeElement));
  });
  window.addEventListener('resize', function () { close(menu && menu.contains(document.activeElement)); });
  window.addEventListener('scroll', function (e) {
    if (menu && !menu.contains(e.target)) close(menu.contains(document.activeElement));
  }, { capture: true, passive: true });
  // The order form's "save the pick-up" button uses the same menu.
  window.KjRemind = Cal ? { open: open } : null;

  /* ── what each reminder puts in the calendar ───────────────────────────── */
  function nextDate(dates) {
    var t = todayIso();
    return (dates || '').split(',').filter(function (d) { return d >= t; })[0];
  }
  var EVENTS = {
    day: function (btn) {
      var card = btn.closest('[data-day-id]');
      var id = card.getAttribute('data-day-id');
      var date = nextDate(card.getAttribute('data-dates'));
      if (!date) return null;
      var order = card.querySelector('[data-day-order]');
      var orderUrl = order ? order.href : here('/');
      var reminderDays = Number(card.getAttribute('data-remind-days') || '3');
      if (!Number.isSafeInteger(reminderDays) || reminderDays < 0) reminderDays = 3;
      return {
        file: id + '-' + date.slice(0, 4) + '.ics',
        event: {
          uid: id + '-' + date.slice(0, 4) + '@kjothusid.is',
          title: card.getAttribute('data-day-name') + ' · Kjöthúsið',
          description: (card.getAttribute('data-remind-text') || '') + '\n\nPantaðu fyrir daginn: ' + orderUrl,
          url: orderUrl,
          date: date,
          alarms: [{ daysBefore: reminderDays, at: '10:00' }]
        }
      };
    },
    offer: function () {
      var now = new Date();
      var d = new Date(todayIso() + 'T09:00:00Z');
      d.setUTCDate(1);
      if (d <= now) d.setUTCMonth(d.getUTCMonth() + 1);
      var url = document.querySelector('a[href$="manadartilbod/"]');
      url = url ? url.href : here('/');
      return {
        file: 'manadartilbod-kjothusid.ics',
        event: {
          uid: 'manadartilbod@kjothusid.is',
          title: 'Nýtt mánaðartilboð · Kjöthúsið',
          description: 'Nýr tilboðslisti er kominn hjá Kjöthúsinu.\n\n' + url,
          url: url,
          date: d.toISOString().slice(0, 10),
          time: '09:00',
          durationMinutes: 15,
          rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
          alarms: [{ minutesBefore: 0 }]
        }
      };
    }
  };
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remind]');
    if (!btn || !Cal) return;
    var make = EVENTS[btn.getAttribute('data-remind')];
    var made = make && make(btn);
    if (made) open(btn, made.event, made.file);
  });

  /* ── "gildir í X daga enn" on the monthly offer ────────────────────────── */
  document.querySelectorAll('[data-valid-to]').forEach(function (el) {
    var to = el.getAttribute('data-valid-to');
    var left = Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(todayIso() + 'T12:00:00Z')) / 86400000);
    if (left < 0) { el.hidden = true; return; }
    el.textContent = left === 0 ? 'Síðasti dagur tilboðsins' : 'Gildir í ' + left + ' ' + (left % 10 === 1 && left % 100 !== 11 ? 'dag' : 'daga') + ' enn';
    el.hidden = false;
  });

  /* The fridge card: the print button only exists where printing does. */
  document.querySelectorAll('[data-print]').forEach(function (b) {
    if (!window.print) return;
    b.hidden = false;
    b.addEventListener('click', function () { window.print(); });
  });

})();
