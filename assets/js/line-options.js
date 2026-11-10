/* The order line's extras (Sindri 10 Nov, design 2 of 3; Karen's K5 questions as choices).
   Each pill on a line (Krydd, Vakúm, Skurður, Athugasemd) opens one small list that floats
   above the page. It lives outside the order form, so Enter in the note can never send the
   order, and outside the slip's scroll box, so nothing clips it. A choice is saved at once
   to the order (KJBasket) and the line re-renders with the choice on its pill.
   Focus: a tap moves focus to the list itself (no ring, focus-guard); the keyboard lands on
   the chosen item. Esc and a tap outside close it; focus returns to the pill. */
(function () {
  'use strict';
  var Basket = window.KJBasket;
  var core = window.KJOrdering;
  if (!Basket || !core) return;
  var data = {};
  try {
    data = JSON.parse(document.getElementById('kj-data').textContent);
  } catch (e) {}
  var catalogue = data.catalogue || [];
  var byKey = {};
  catalogue.forEach(function (item) {
    byKey[item.k] = item;
  });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var icon = core.icon;
  var QUESTIONS = {
    krydd: 'Á að krydda eða marinera?',
    vakum: 'Hvernig viltu fá það vakúmpakkað?',
    skurdur: 'Sérstakur skurður eða þykkt?',
  };
  var NONE = { krydd: 'Nei takk', vakum: 'Ekki vakúmpakkað', skurdur: 'Eins og venjulega' };

  var pop = document.createElement('div');
  pop.className = 'opt-pop';
  pop.id = 'opt-pop';
  pop.tabIndex = -1;
  pop.hidden = true;
  document.body.appendChild(pop);

  var state = null; // { key, group, surface, pill }
  var closeTimer = 0;

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lineOf(key) {
    return Basket.all().find(function (line) {
      return line.k === key;
    });
  }
  function save(key, change) {
    var lines = Basket.all();
    lines.forEach(function (line) {
      if (line.k === key) change(line);
    });
    Basket.set(lines);
  }
  // The pill may have been re-rendered by the save; find it again on the same surface.
  function currentPill() {
    if (!state) return null;
    if (state.pill && state.pill.isConnected) return state.pill;
    var scope = state.surface && state.surface.isConnected ? state.surface : document;
    var rows = scope.querySelectorAll('[data-order-line]');
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].dataset.orderLine === state.key) {
        state.pill = rows[i].querySelector('[data-opt="' + state.group + '"]');
        return state.pill;
      }
    }
    return null;
  }

  function choiceRows(group, o, item) {
    var current = group === 'krydd' ? o.krydd : group === 'vakum' ? o.vakum : o.skurdur;
    var values =
      group === 'krydd'
        ? core.kryddChoices(catalogue)
        : group === 'vakum'
          ? Object.keys(core.PACKS)
          : Object.keys(core.CUTS);
    var rows = [{ value: '', label: NONE[group] }].concat(
      values.map(function (value) {
        return { value: value, label: group === 'vakum' ? core.PACKS[value] : value };
      }),
    );
    return rows
      .map(function (row) {
        var on = (current || '') === row.value;
        return (
          '<button type="button" class="opt-pop__item" role="radio" aria-checked="' +
          on +
          '" data-value="' +
          esc(row.value) +
          '"><span>' +
          esc(row.label) +
          '</span>' +
          icon('check') +
          '</button>'
        );
      })
      .join('');
  }
  function build() {
    var line = lineOf(state.key);
    var item = byKey[state.key] || { n: line ? line.n : '', c: '' };
    var o = core.cleanOptions(line && line.o, item.c, catalogue);
    if (state.group === 'note') {
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', 'Athugasemd við ' + item.n);
      pop.innerHTML =
        '<p class="opt-pop__q" id="opt-pop-q">Athugasemd við ' +
        esc(item.n) +
        '</p><textarea class="opt-pop__note" data-opt-note rows="3" maxlength="300" enterkeyhint="done" aria-labelledby="opt-pop-q" placeholder="Til dæmis: fituhreinsað, fjórar sneiðar í poka">' +
        esc((line && line.w) || '') +
        '</textarea><button type="button" class="opt-pop__done" data-opt-done>Lokið</button>';
      return;
    }
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', QUESTIONS[state.group] + ' ' + item.n);
    var html =
      '<p class="opt-pop__q" id="opt-pop-q">' +
      QUESTIONS[state.group] +
      '</p><div role="radiogroup" aria-labelledby="opt-pop-q">' +
      choiceRows(state.group, o, item) +
      '</div>';
    if (state.group === 'skurdur' && o.skurdur) {
      html +=
        '<div class="opt-pop__thick"><span>Þykkt</span><span class="opt-pop__step"><button type="button" data-opt-cm="-0.5" aria-label="Þynnra"' +
        (o.cm <= 0.5 ? ' disabled' : '') +
        '>' +
        icon('minus') +
        '</button><output aria-live="polite">' +
        core.cmText(o.cm) +
        '</output><button type="button" data-opt-cm="0.5" aria-label="Þykkara"' +
        (o.cm >= 6 ? ' disabled' : '') +
        '>' +
        icon('plus') +
        '</button></span></div><button type="button" class="opt-pop__done" data-opt-done>Lokið</button>';
    }
    pop.innerHTML = html;
  }
  // Below the pill when it fits, above it otherwise; always inside the visible screen, which
  // on a phone with the keyboard up is the visual viewport, not the layout viewport.
  function place() {
    var pill = currentPill();
    if (!state || !pill) return;
    var r = pill.getBoundingClientRect();
    var vv = window.visualViewport;
    var top0 = vv ? vv.offsetTop : 0;
    var left0 = vv ? vv.offsetLeft : 0;
    var vh = vv ? vv.height : innerHeight;
    var vw = vv ? vv.width : innerWidth;
    var w = Math.min(state.group === 'note' ? 340 : 280, vw - 16);
    pop.style.width = w + 'px';
    pop.style.maxHeight = Math.max(120, vh - 16) + 'px';
    var h = pop.offsetHeight;
    var left = Math.max(left0 + 8, Math.min(r.left, left0 + vw - w - 8));
    var below = r.bottom + 6;
    var up = below + h > top0 + vh - 8 && r.top - 6 - h >= top0 + 8;
    var top = up ? r.top - 6 - h : Math.min(below, top0 + vh - h - 8);
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(Math.max(top0 + 8, top)) + 'px';
    pop.classList.toggle('is-up', up);
  }
  function setExpanded(on) {
    var pill = currentPill();
    if (pill) pill.setAttribute('aria-expanded', String(on));
  }
  function open(pill, byKeyboard) {
    clearTimeout(closeTimer);
    if (state) setExpanded(false);
    var row = pill.closest('[data-order-line]');
    state = {
      key: row.dataset.orderLine,
      group: pill.dataset.opt,
      surface: pill.closest('[data-panel], form, [data-basket-lines]') || document,
      pill: pill,
    };
    build();
    pop.hidden = false;
    place();
    setExpanded(true);
    void pop.offsetWidth;
    pop.classList.add('is-open');
    var note = pop.querySelector('[data-opt-note]');
    if (note) {
      // A tap on "Athugasemd" means "let me write": the field takes focus (and the keyboard).
      note.focus({ preventScroll: true });
      note.setSelectionRange(note.value.length, note.value.length);
    } else if (byKeyboard) {
      var at = pop.querySelector('[aria-checked="true"]') || pop.querySelector('.opt-pop__item');
      if (at) at.focus();
    } else pop.focus({ preventScroll: true });
  }
  function close(returnFocus) {
    if (!state) return;
    flushNote();
    var pill = currentPill();
    if (state.noteChanged) {
      var noted = lineOf(state.key);
      if (noted && Basket.say) Basket.say('Athugasemd vistuð: ' + noted.n);
    }
    setExpanded(false);
    state = null;
    pop.classList.remove('is-open');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(
      function () {
        if (!state) pop.hidden = true;
      },
      reduce ? 0 : 160,
    );
    if (returnFocus && pill) pill.focus({ preventScroll: true });
    else if (pop.contains(document.activeElement)) document.activeElement.blur();
  }

  document.addEventListener('click', function (e) {
    var pill = e.target.closest('[data-opt]');
    if (pill && pill.closest('[data-order-line]')) {
      var same = state && state.pill === pill;
      if (same) close(e.detail === 0);
      else open(pill, e.detail === 0);
      return;
    }
    if (!state || !pop.contains(e.target)) return;
    var choice = e.target.closest('.opt-pop__item');
    var step = e.target.closest('[data-opt-cm]');
    var keyboard = e.detail === 0;
    if (choice) {
      var group = state.group;
      var value = choice.dataset.value;
      save(state.key, function (line) {
        var o = Object.assign({}, line.o || {});
        if (!value) {
          delete o[group];
          if (group === 'skurdur') delete o.cm;
        } else {
          o[group] = value;
          if (group === 'skurdur') o.cm = core.CUTS[value];
        }
        line.o = o;
      });
      // A cut stays open so its thickness can be set; every other choice closes the list.
      if (group === 'skurdur' && value) {
        build();
        place();
        if (keyboard) {
          var plus = pop.querySelector('[data-opt-cm="0.5"]');
          if (plus) plus.focus();
        } else pop.focus({ preventScroll: true });
      } else close(keyboard);
      return;
    }
    if (step) {
      var delta = Number(step.dataset.optCm);
      save(state.key, function (line) {
        var o = Object.assign({}, line.o || {});
        o.cm = Math.min(6, Math.max(0.5, (Number(o.cm) || core.CUTS[o.skurdur] || 1) + delta));
        line.o = o;
      });
      var focusAt = keyboard ? step.dataset.optCm : null;
      build();
      place();
      if (focusAt) {
        var again = pop.querySelector('[data-opt-cm="' + focusAt + '"]:not([disabled])') || pop.querySelector('[data-opt-done]');
        if (again) again.focus();
      } else pop.focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('[data-opt-done]')) close(keyboard);
  });
  var noteTimer = 0;
  var pendingNote = null; // { key, text }
  function flushNote() {
    clearTimeout(noteTimer);
    if (!pendingNote) return;
    var p = pendingNote;
    pendingNote = null;
    save(p.key, function (line) {
      line.w = p.text;
    });
  }
  document.addEventListener('input', function (e) {
    if (!state || !e.target.matches('[data-opt-note]')) return;
    state.noteChanged = true;
    pendingNote = { key: state.key, text: e.target.value.slice(0, 300) };
    clearTimeout(noteTimer);
    noteTimer = setTimeout(flushNote, 200);
  });
  // A tap outside closes the list (the pill's own click toggles it, so it is left alone).
  document.addEventListener(
    'pointerdown',
    function (e) {
      if (!state || pop.contains(e.target)) return;
      var pill = e.target.closest('[data-opt]');
      if (pill && pill === currentPill()) return;
      close(false);
    },
    true,
  );
  document.addEventListener(
    'keydown',
    function (e) {
      if (!state) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      }
      // The note's ✓ / Enter only closes it (Shift+Enter is a new line); it is saved already.
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.matches('[data-opt-note]')) {
        e.preventDefault();
        // A phone keyboard's ✓ just closes; focus goes back to the pill only for a real keyboard.
        close(!matchMedia('(pointer: coarse)').matches);
        return;
      }
      if (e.key === 'Tab' && pop.contains(document.activeElement)) {
        e.stopPropagation();
        var stops = Array.prototype.filter.call(pop.querySelectorAll('button:not([disabled]), textarea'), function (el) {
          return el.getClientRects().length;
        });
        var here = stops.indexOf(document.activeElement);
        var leaving = !stops.length || (e.shiftKey ? here <= 0 : here === stops.length - 1);
        if (document.activeElement === pop && !e.shiftKey && stops.length) {
          e.preventDefault();
          stops[0].focus();
        } else if (leaving) {
          e.preventDefault();
          close(true);
        }
        return;
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && pop.contains(document.activeElement)) {
        var items = Array.prototype.slice.call(pop.querySelectorAll('.opt-pop__item'));
        if (!items.length) return;
        e.preventDefault();
        var at = items.indexOf(document.activeElement);
        var next = e.key === 'ArrowDown' ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
        items[at < 0 ? 0 : next].focus();
      }
    },
    true,
  );
  // Leaving the list with Tab closes it.
  pop.addEventListener('focusout', function (e) {
    if (state && e.relatedTarget && !pop.contains(e.relatedTarget)) close(false);
  });
  var frame = 0;
  function follow() {
    if (!state || frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      if (!currentPill()) close(false);
      else {
        setExpanded(true);
        place();
      }
    });
  }
  addEventListener('scroll', follow, true);
  addEventListener('resize', follow);
  if (window.visualViewport) {
    visualViewport.addEventListener('resize', follow);
    visualViewport.addEventListener('scroll', follow);
  }
  document.addEventListener('kj:basket', follow);
  // A sheet or drawer closing takes its lines with it.
  document.addEventListener('shift-modal:close', function () {
    close(false);
  });
})();
