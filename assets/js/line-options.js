/* One floating S1 note panel outside forms and scroll boxes. Pointer opens on the
   panel; keyboard opens on the field. Escape, outside tap and Enter close it. */
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

  function build() {
    var line = lineOf(state.key);
    var item = byKey[state.key] || { n: line ? line.n : '', c: '' };
    var examples = data.lineNoteExamples || {};
    var key = ['Svínakjöt', 'Folaldakjöt', 'Kjúklingur'].indexOf(item.c) >= 0 ? 'raw' : item.c;
    var notes = examples[key] || examples.default || [];
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Athugasemd við ' + item.n);
    pop.innerHTML = '<p class="opt-pop__q" id="opt-pop-q">Athugasemd við ' + esc(item.n) +
      '</p><div class="opt-pop__examples" id="opt-pop-examples"><p>' + esc(data.giftForm.noteExampleLabel) + '</p>' +
      notes.map(function (note) { return '<p>' + esc(note) + '</p>'; }).join('') +
      '</div><textarea class="opt-pop__note" data-opt-note rows="3" maxlength="300" enterkeyhint="done" aria-labelledby="opt-pop-q" aria-describedby="opt-pop-examples">' +
      esc((line && line.w) || '') + '</textarea><button type="button" class="opt-pop__done" data-opt-done>Lokið</button>';
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
    if (note && byKeyboard) {
      // Keyboard opens on the first control. Pointer opens on the container.
      note.focus({ preventScroll: true });
      note.setSelectionRange(note.value.length, note.value.length);
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
    if (pill && pill.dataset.opt === 'note' && pill.closest('[data-order-line]')) {
      var same = state && state.pill === pill;
      if (same) close(e.detail === 0);
      else open(pill, e.detail === 0);
      return;
    }
    if (!state || !pop.contains(e.target)) return;
    var keyboard = e.detail === 0;
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
