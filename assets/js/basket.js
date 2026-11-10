/* One order-line renderer, used by the counter's slip and the site-wide drawer. */
(function () {
  'use strict';
  var Basket = window.KJBasket;
  if (!Basket) return;
  var data = JSON.parse(document.getElementById('kj-data').textContent);
  var catalogue = data.catalogue || [];
  var byKey = {};
  catalogue.forEach(function (item) {
    byKey[item.k] = item;
  });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var previous = [];
  var removed = null,
    removeTimer,
    undoTimer;
  var saved = null;
  var undoKey = 'kj-pontun-undo';
  var icon = KJOrdering.icon;
  var bin = icon('trash');
  var writingWish = false;
  var fmt = function (n) {
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(
      n,
    );
  };
  var esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c];
    });
  };
  function count(n) {
    return n + (n === 1 ? ' vara' : ' vörur');
  }
  function min(unit) {
    return unit === 'kg' ? 0.1 : unit === 'g' ? 10 : 1;
  }
  function step(unit) {
    return unit === 'kg' ? 0.5 : unit === 'g' ? 100 : 1;
  }
  function snap(unit, value) {
    return Math.max(
      min(unit),
      unit === 'kg'
        ? Math.round(value * 10) / 10
        : unit === 'g'
          ? Math.round(value / 10) * 10
          : Math.round(value),
    );
  }
  function linePrice(line) {
    var item = byKey[line.k];
    return item && typeof item.p === 'number'
      ? item.p * (line.u === 'g' && item.u === 'kg' ? line.q / 1000 : line.q)
      : null;
  }
  function estimate(lines) {
    return lines.reduce(function (sum, line) {
      return sum + (linePrice(line) || 0);
    }, 0);
  }
  // One short line; the fine print opens from the (i) so it never pushes the products away.
  var noteOpen = false;
  function totalText(lines) {
    var total = estimate(lines);
    if (!lines.length) return '';
    return (
      '<span class="total-line">' +
      (total
        ? 'Áætlað <strong>' + fmt(total) + ' kr.</strong> án vsk.'
        : 'Verð í síma') +
      '<button type="button" class="total-info" data-total-info aria-expanded="' +
      noteOpen +
      '" aria-label="Um verðið" title="Um verðið">' +
      icon('help-circle') +
      '</button></span><span class="total-note type-xsmall"' +
      (noteOpen ? '' : ' hidden') +
      '>Endanlegt verð miðast við vigt og staðfestingu okkar.</span>'
    );
  }
  document.addEventListener('click', function (e) {
    var info = e.target.closest('[data-total-info]');
    if (!info) return;
    noteOpen = !noteOpen;
    document.querySelectorAll('[data-total-info]').forEach(function (b) {
      b.setAttribute('aria-expanded', String(noteOpen));
      var note = b.closest('[data-basket-total]').querySelector('.total-note');
      if (note) note.hidden = !noteOpen;
    });
  });
  // One ticket line at a time shows its − / + box; the rest show only the amount chip.
  var editKey = null;
  function amountText(line) {
    return String(line.q).replace('.', ',') + ' ' + (line.u === 'stk' ? 'stk.' : line.u);
  }
  function setEdit(key) {
    editKey = key;
    document.querySelectorAll('[data-order-line]').forEach(function (row) {
      var on = row.dataset.orderLine === editKey;
      row.classList.toggle('is-editing', on);
      var area = row.querySelector('.order-line__edit');
      if (area) area.inert = !on;
      var chip = row.querySelector('[data-line-edit]');
      if (chip) chip.setAttribute('aria-expanded', String(on));
    });
  }
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-line-edit]');
    if (chip) {
      var row = chip.closest('[data-order-line]');
      setEdit(editKey === row.dataset.orderLine ? null : row.dataset.orderLine);
      // keyboard opens go straight to the amount; a tap or click moves no focus
      if (editKey && e.detail === 0) {
        var input = row.querySelector('[data-line-amount]');
        if (input) input.focus();
      }
      return;
    }
    if (editKey && !e.target.closest('[data-order-line]')) setEdit(null);
  });
  // Esc folds an open line first (capture, so the drawer/sheet stays open for that press).
  window.addEventListener(
    'keydown',
    function (e) {
      if (e.key !== 'Escape' || !editKey) return;
      var open = document.activeElement && document.activeElement.closest('[data-order-line]');
      e.stopPropagation();
      setEdit(null);
      var chip = open && open.querySelector('[data-line-edit]');
      if (chip) chip.focus();
    },
    true,
  );
  function renderLine(line, surface) {
    var item = byKey[line.k] || { n: line.n, l: '', u: line.u };
    var price = linePrice(line);
    var weight = item.u === 'kg' || !item.u;
    var minimum = line.q <= min(line.u);
    var key = esc(line.k),
      name = esc(item.n);
    return (
      '<li class="order-line' +
      (editKey === line.k ? ' is-editing' : '') +
      '" data-order-line="' +
      key +
      '"><div class="order-line__inner">' +
      '<div class="order-line__top"><p class="order-line__name">' +
      name +
      '</p>' +
      // the amount as a small chip; a tap opens the − / + box under the line (Sindri 11-03)
      '<button type="button" class="line-amount" data-line-edit aria-expanded="' +
      (editKey === line.k) +
      '" aria-controls="edit-' +
      surface +
      '-' +
      key +
      '" aria-label="Breyta magni af ' +
      name +
      ', núna ' +
      amountText(line) +
      '" title="Breyta magni">' +
      amountText(line) +
      icon('chevron-down') +
      '</button>' +
      '<span class="order-line__price type-xsmall">' +
      (price === null ? 'Verð í síma' : '≈ ' + fmt(price) + ' kr.') +
      '</span>' +
      '<button type="button" class="line-remove" data-line-remove aria-label="Taka ' +
      name +
      ' úr pöntuninni" title="Fjarlægja">' +
      bin +
      '</button></div>' +
      '<div class="order-line__edit" id="edit-' +
      surface +
      '-' +
      key +
      '"' +
      (editKey === line.k ? '' : ' inert') +
      '><div class="order-line__bottom"><div class="order-line__qty">' +
      '<button type="button" data-line-minus aria-label="Minna af ' +
      name +
      '" title="Minnka magn"' +
      (minimum ? ' disabled' : '') +
      '>' +
      icon('minus') +
      '</button>' +
      '<label class="amount-value"><input type="number" data-line-amount value="' +
      line.q +
      '" min="' +
      min(line.u) +
      '" step="' +
      min(line.u) +
      '" inputmode="' +
      (line.u === 'kg' ? 'decimal' : 'numeric') +
      '" aria-label="Magn af ' +
      name +
      '">' +
      (weight
        ? '</label>' + KJOrdering.units(line.u, 'data-line-toggle', name)
        : '<span class="unit-word">stk.</span></label>') +
      '<button type="button" data-line-plus aria-label="Meira af ' +
      name +
      '" title="Auka magn">' +
      icon('plus') +
      '</button></div></div></div>' +
      // A note on every line, always in view (Karen 10 Nov, K5: "athugasemd við hvert og eitt
      // item"); her own prompts show under it while it has focus.
      '<label class="line-note"><input type="text" data-wish-input maxlength="300" enterkeyhint="done" autocomplete="off" aria-label="Athugasemd við ' +
      name +
      '" aria-describedby="note-' +
      surface +
      '-' +
      key +
      '" placeholder="Athugasemd: krydd, pökkun, skurður" value="' +
      esc(line.w || '') +
      '"><span class="line-note__hint type-xsmall" id="note-' +
      surface +
      '-' +
      key +
      '">Til dæmis: á að marinera eða krydda? Hvernig á að vakúmpakka? Sérstakur skurður eða þykkt sneiða?</span></label>' +
      '<span class="draw-rule is-drawn" aria-hidden="true"></span></div></li>'
    );
  }

  function readUndo() {
    try {
      saved = JSON.parse(sessionStorage.getItem(undoKey));
    } catch (e) {
      saved = null;
    }
    if (!KJOrdering.restore(saved, Date.now())) {
      saved = null;
      try {
        sessionStorage.removeItem(undoKey);
      } catch (e) {}
    }
  }
  function renderUndo() {
    document.querySelectorAll('[data-basket-foot]').forEach(function (foot) {
      var old = foot.querySelector('[data-order-undo]');
      if (old) old.remove();
      if (!saved) return;
      var bar = document.createElement('div');
      bar.className = 'order-undo';
      bar.dataset.orderUndo = '';
      bar.innerHTML =
        '<p class="type-small">Pöntunin var tæmd. <button type="button" data-restore-order>Afturkalla</button></p><span aria-hidden="true"></span>';
      foot.prepend(bar);
    });
    clearTimeout(undoTimer);
    if (saved)
      undoTimer = setTimeout(
        function () {
          readUndo();
          renderUndo();
        },
        Math.max(1, saved.expires - Date.now()),
      );
  }
  /* ── the order bar on phones (Sindri 11-03) ──
     One bar at the bottom of every page under 48rem while the basket has items. Its second
     line says what just happened (1.8 s), then what is next on the order page, else the
     estimate. Tapping it grows it into the order sheet (motion.js, sheet mode). */
  var barEl = null,
    barTimer = null,
    barPrimed = false,
    previousLines = {};
  function stepDone(n) {
    var step = document.querySelector('.order-progress [data-progress="' + n + '"]');
    return !!(step && step.classList.contains('is-complete'));
  }
  function nextStep() {
    if (!document.querySelector('.order-progress')) return '';
    if (!stepDone(2)) return 'Næst: veldu dag og tíma';
    if (!stepDone(3)) return 'Næst: nafn, netfang og sími';
    return 'Allt tilbúið: sendu pöntunina';
  }
  function barSteady(lines) {
    return (
      nextStep() ||
      (estimate(lines) ? '≈ ' + fmt(estimate(lines)) + ' kr.' : 'Verð í síma')
    );
  }
  // What changed since the last render, in words (raw text, set with textContent).
  function barChange(lines) {
    var now = {};
    lines.forEach(function (line) {
      now[line.k] = line;
    });
    var added = lines.filter(function (line) {
      return !previousLines[line.k];
    });
    var gone = Object.keys(previousLines).filter(function (k) {
      return !now[k];
    });
    var changed = lines.filter(function (line) {
      var was = previousLines[line.k];
      return was && (was.q !== line.q || was.u !== line.u || was.w !== (line.w || ''));
    });
    var message = '';
    if (added.length > 1) message = added.length + ' vörur komnar í pöntunina';
    else if (added.length) message = added[0].n + ' komið í pöntunina';
    else if (gone.length && lines.length) message = 'Fjarlægt: ' + previousLines[gone[0]].n;
    else if (changed.length)
      message =
        (previousLines[changed[0].k].w !== (changed[0].w || '') ? 'Athugasemd vistuð: ' : 'Magn uppfært: ') +
        changed[0].n;
    previousLines = {};
    lines.forEach(function (line) {
      previousLines[line.k] = { q: line.q, u: line.u, w: line.w || '', n: line.n };
    });
    return message;
  }
  // On the order page the sheet's main button is the next step, not a link back to the page.
  function sheetPrimary() {
    var button = document.querySelector('[data-panel="basket"] [data-basket-actions] > .btn');
    if (!button || document.body.dataset.page !== 'order') return;
    var step = !stepDone(2) ? 2 : !stepDone(3) ? 3 : 4;
    button.textContent = step === 2 ? 'Veldu tíma' : step === 3 ? 'Þínar upplýsingar' : 'Senda pöntun';
    button.setAttribute('href', step === 2 ? '#afhending' : '#thu');
    button.setAttribute('data-modal-close', '');
    button.toggleAttribute('data-sheet-submit', step === 4);
  }
  function renderBar(lines) {
    var message = barChange(lines);
    if (!barPrimed) {
      barPrimed = true;
      message = '';
    }
    if (!barEl) {
      barEl = document.createElement('button');
      barEl.type = 'button';
      barEl.className = 'order-bar';
      barEl.hidden = true;
      barEl.dataset.modalOpen = 'basket';
      barEl.setAttribute('aria-haspopup', 'dialog');
      barEl.setAttribute('aria-controls', 'basket');
      barEl.innerHTML =
        '<span class="order-bar__icon">' +
        icon('shopping-bag') +
        '<span class="order-bar__n"></span></span>' +
        '<span class="order-bar__text"><span class="order-bar__title"></span><span class="order-bar__line"></span></span>' +
        '<span class="order-bar__go">Skoða' +
        icon('chevron-right') +
        '</span><span class="sr-only" role="status" aria-live="polite"></span>';
      document.body.appendChild(barEl);
    }
    var wasHidden = barEl.hidden;
    barEl.hidden = !lines.length;
    document.body.classList.toggle('has-order-bar', !!lines.length);
    barEl.querySelector('.order-bar__n').textContent = lines.length;
    barEl.querySelector('.order-bar__title').textContent = 'Pöntunarmiði · ' + count(lines.length);
    var line = barEl.querySelector('.order-bar__line');
    if (message) {
      clearTimeout(barTimer);
      line.innerHTML = icon('check') + '<span></span>';
      line.lastChild.textContent = message;
      line.classList.add('is-event');
      barEl.querySelector('[role="status"]').textContent = message + '.';
      barTimer = setTimeout(function () {
        line.classList.remove('is-event');
        line.textContent = barSteady(Basket.all());
      }, 1800);
    } else if (!line.classList.contains('is-event')) line.textContent = barSteady(lines);
    sheetPrimary();
    if (!reduce && window.gsap && lines.length) {
      if (wasHidden) gsap.fromTo(barEl, { yPercent: 100 }, { yPercent: 0, duration: 0.3, ease: 'luxe' });
      else if (message)
        gsap.fromTo(barEl.querySelector('.order-bar__icon'), { scale: 1.15 }, { scale: 1, duration: 0.24, ease: 'luxe' });
    }
  }
  // Form progress changes the "next" line and the sheet's button; read after ordering.js updates.
  ['input', 'change'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      if (!e.target.closest || !e.target.closest('#pontun')) return;
      setTimeout(function () {
        var line = barEl && barEl.querySelector('.order-bar__line');
        if (line && !line.classList.contains('is-event')) line.textContent = barSteady(Basket.all());
        sheetPrimary();
      }, 0);
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-sheet-submit]')) return;
    var form = document.getElementById('pontun');
    // the sheet closes first (data-modal-close), then the form sends as if Senda was pressed
    if (form && form.requestSubmit) setTimeout(function () { form.requestSubmit(); }, 380);
  });

  function render() {
    if (writingWish) return;
    var lines = Basket.all();
    var fresh = lines
      .filter(function (line) {
        return previous.indexOf(line.k) < 0;
      })
      .map(function (line) {
        return line.k;
      });
    document.querySelectorAll('[data-basket-lines]').forEach(function (host) {
      var html = lines.map(function (line) {
        return renderLine(
          line,
          host.closest('.basket-panel') ? 'drawer' : 'slip',
        );
      });
      if (removed)
        html.splice(
          Math.min(removed.index, html.length),
          0,
          '<li class="order-removed type-small">Fjarlægt: ' +
            esc(removed.line.n) +
            '. <button type="button" data-restore-line>Afturkalla</button></li>',
        );
      host.innerHTML = html.join('');
      if (!reduce && window.gsap) {
        var added = Array.from(host.children).filter(function (row) {
          return fresh.indexOf(row.dataset.orderLine) >= 0;
        });
        gsap.fromTo(
          added,
          { gridTemplateRows: '0fr', opacity: 0 },
          {
            gridTemplateRows: '1fr',
            opacity: 1,
            duration: 0.24,
            stagger: 0.04,
            ease: 'uiOut',
          },
        );
        added.forEach(function (row) {
          gsap.fromTo(
            row.querySelector('.draw-rule'),
            { scaleX: 0 },
            { scaleX: 1, duration: 0.5, ease: 'luxe' },
          );
        });
      }
    });
    document.querySelectorAll('[data-basket-size]').forEach(function (el) {
      el.textContent = count(lines.length);
      el.hidden = !lines.length;
    });
    // Nothing to finish in an empty order: the drawer offers its links instead.
    document
      .querySelectorAll('[data-basket-actions] .btn-fill')
      .forEach(function (el) {
        el.hidden = !lines.length;
      });
    document.querySelectorAll('[data-basket-empty]').forEach(function (el) {
      el.hidden = !!lines.length;
    });
    document.querySelectorAll('[data-basket-total]').forEach(function (el) {
      el.innerHTML = totalText(lines);
    });
    document.querySelectorAll('[data-empty-order]').forEach(function (el) {
      el.hidden = !lines.length;
      el.innerHTML = bin;
    });
    document.querySelectorAll('[data-basket-count]').forEach(function (el) {
      el.textContent = lines.length;
      el.hidden = !lines.length;
      var link = el.closest('a');
      if (link)
        link.setAttribute(
          'aria-label',
          'Pantanir, ' + count(lines.length) + ' í pöntun',
        );
      if (
        lines.length &&
        previous.length !== lines.length &&
        !reduce &&
        window.gsap
      )
        gsap.fromTo(
          el,
          {
            scale: previous.length ? 1.18 : 0.6,
            opacity: previous.length ? 1 : 0,
          },
          {
            scale: 1,
            opacity: 1,
            duration: 0.24,
            ease: 'uiOut',
            overwrite: true,
          },
        );
    });
    document.querySelectorAll('[data-nav-basket]').forEach(function (el) {
      el.hidden = !lines.length;
    });
    document.querySelectorAll('[data-nav-basket-count]').forEach(function (el) {
      el.textContent = count(lines.length);
    });
    document.dispatchEvent(new Event('kj:dropdown-state'));
    var pill = document.querySelector('.basket');
    if (!pill && document.body.dataset.page !== 'order') {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'basket';
      pill.dataset.modalOpen = 'basket';
      pill.setAttribute('aria-haspopup', 'dialog');
      pill.setAttribute('aria-controls', 'basket');
      document.body.appendChild(pill);
    }
    if (pill) {
      pill.hidden = !lines.length;
      pill.innerHTML =
        icon('shopping-bag') +
        '<span class="sr-only">Pöntun</span><span class="basket__n"><span class="basket__current">' +
        lines.length +
        '</span>' +
        (previous.length && !reduce && previous.length !== lines.length
          ? '<span class="basket__old" aria-hidden="true">' +
            previous.length +
            '</span>'
          : '') +
        '</span>' +
        (estimate(lines)
          ? '<span class="basket__estimate">≈ ' +
            fmt(estimate(lines)) +
            ' kr.</span>'
          : '');
      if (
        lines.length &&
        previous.length !== lines.length &&
        !reduce &&
        window.gsap
      ) {
        gsap.fromTo(
          pill,
          previous.length ? { scale: 1.06 } : { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: previous.length ? 0.24 : 0.3,
            ease: 'luxe',
            overwrite: true,
          },
        );
        gsap.fromTo(
          pill.querySelector('.basket__current'),
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.2 },
        );
        var oldCount = pill.querySelector('.basket__old');
        if (oldCount) gsap.to(oldCount, { y: -16, opacity: 0, duration: 0.2 });
      }
    }
    document.querySelectorAll('[data-order-summary]').forEach(function (el) {
      el.innerHTML = lines
        .map(function (line) {
          return (
            '<li>' +
            esc(line.n) +
            ', ' +
            String(line.q).replace('.', ',') +
            ' ' +
            esc(line.u) +
            '</li>'
          );
        })
        .join('');
    });
    document.querySelectorAll('[data-summary-total]').forEach(function (el) {
      el.innerHTML = totalText(lines);
    });
    renderBar(lines);
    previous = lines.map(function (line) {
      return line.k;
    });
    document.dispatchEvent(new Event('kj:order-state'));
  }
  // A short-lived inert copy lets the outgoing actions fade while the real
  // controls change in place. It never participates in focus or basket events.
  function footTransition(foot, surface) {
    if (reduce || !window.gsap) return function () {};
    var height = foot.getBoundingClientRect().height;
    var ghost = surface.cloneNode(true);
    ghost.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        if (attr.name.indexOf('data-') === 0 || attr.name === 'id')
          el.removeAttribute(attr.name);
      });
    });
    Array.from(ghost.attributes).forEach(function (attr) {
      if (attr.name.indexOf('data-') === 0 || attr.name === 'id')
        ghost.removeAttribute(attr.name);
    });
    ghost.inert = true;
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.position = 'absolute';
    ghost.style.top = surface.offsetTop + 'px';
    ghost.style.left = surface.offsetLeft + 'px';
    ghost.style.width = surface.getBoundingClientRect().width + 'px';
    ghost.style.pointerEvents = 'none';
    foot.appendChild(ghost);
    return function (next) {
      var previousHeight = foot.style.height;
      foot.style.height = 'auto';
      ghost.style.display = 'none';
      var target = foot.getBoundingClientRect().height;
      ghost.style.display = '';
      foot.style.height = previousHeight;
      gsap.fromTo(
        foot,
        { height: height },
        {
          height: target,
          duration: 0.18,
          ease: 'uiOut',
          overwrite: true,
          onComplete: function () {
            foot.style.height = '';
          },
        },
      );
      gsap.to(ghost, {
        opacity: 0,
        duration: 0.18,
        onComplete: function () {
          ghost.remove();
        },
      });
      gsap.fromTo(
        next,
        { opacity: 0 },
        { opacity: 1, duration: 0.18, overwrite: true },
      );
    };
  }
  function cancelConfirm(restoreFocus) {
    document.querySelectorAll('[data-empty-confirm]').forEach(function (row) {
      var foot = row.closest('[data-basket-foot]');
      var actions = foot.querySelector('[data-basket-actions]');
      var transition = footTransition(foot, row);
      var trigger = foot.querySelector('[data-empty-order]');
      row.remove();
      actions.hidden = false;
      transition(actions);
      if (restoreFocus === true && trigger)
        setTimeout(function () {
          trigger.focus({ preventScroll: true });
        }, 0);
    });
    document
      .querySelectorAll('[data-basket-actions]')
      .forEach(function (actions) {
        actions.hidden = false;
      });
  }
  function changeLine(event, control) {
    var row = control.closest('[data-order-line]');
    var lines = Basket.all(),
      index = lines.findIndex(function (line) {
        return line.k === row.dataset.orderLine;
      });
    if (index < 0) return;
    var line = lines[index],
      attr;
    if (control.hasAttribute('data-line-minus')) {
      attr = 'data-line-minus';
      if (line.q <= min(line.u)) return;
      line.q = snap(line.u, line.q - step(line.u));
    } else if (control.hasAttribute('data-line-plus')) {
      attr = 'data-line-plus';
      line.q = snap(line.u, line.q + step(line.u));
    } else if (control.hasAttribute('data-line-toggle')) {
      attr = 'data-line-toggle';
      if (line.u === control.dataset.lineToggle) return;
      line.q =
        line.u === 'kg' ? Math.round(line.q * 1000) : snap('kg', line.q / 1000);
      line.u = line.u === 'kg' ? 'g' : 'kg';
    } else {
      attr = 'data-line-amount';
      var value = parseFloat(control.value);
      if (!(value > 0)) return;
      line.q = snap(line.u, value);
    }
    var host = row.parentElement;
    Basket.set(lines);
    if (event.detail === 0 || event.type === 'change') {
      var again = Array.from(host.querySelectorAll('[data-order-line]')).find(
        function (el) {
          return el.dataset.orderLine === line.k;
        },
      );
      if (again)
        again.querySelector('[' + attr + ']').focus({ preventScroll: true });
    }
  }
  function removeLine(line, index) {
    function finish() {
      removed = { line: Object.assign({}, line), index: index };
      Basket.set(
        Basket.all().filter(function (item) {
          return item.k !== line.k;
        }),
      );
      clearTimeout(removeTimer);
      removeTimer = setTimeout(function () {
        removed = null;
        render();
      }, 5000);
    }
    var rows = Array.from(
      document.querySelectorAll('[data-order-line]'),
    ).filter(function (row) {
      return row.dataset.orderLine === line.k;
    });
    if (reduce || !window.gsap) {
      finish();
      return;
    }
    gsap
      .timeline({ onComplete: finish })
      .to(rows, { opacity: 0, x: 12, duration: 0.2 })
      .to(rows, { gridTemplateRows: '0fr', duration: 0.2 });
  }
  document.addEventListener('click', function (e) {
    var remove = e.target.closest('[data-line-remove]');
    if (remove) {
      var all = Basket.all();
      var at = all.findIndex(function (line) {
        return line.k === remove.closest('[data-order-line]').dataset.orderLine;
      });
      if (at >= 0) removeLine(all[at], at);
      return;
    }
    var control = e.target.closest(
      '[data-line-minus],[data-line-plus],[data-line-toggle]',
    );
    if (control) {
      changeLine(e, control);
      return;
    }
    if (e.target.closest('[data-empty-order]')) {
      var foot = e.target.closest('[data-basket-foot]');
      cancelConfirm();
      var actions = foot.querySelector('[data-basket-actions]');
      var transition = footTransition(foot, actions);
      actions.hidden = true;
      var row = document.createElement('div');
      row.className = 'empty-confirm';
      row.dataset.emptyConfirm = '';
      row.tabIndex = -1;
      row.innerHTML =
        '<p class="type-small">Tæma alla pöntunina? ' +
        count(Basket.all().length) +
        ' fara úr pöntuninni.</p><button type="button" class="btn empty-confirm__yes" data-confirm-empty>Tæma</button><button type="button" class="btn btn-outline" data-cancel-empty>Hætta við</button>';
      foot.appendChild(row);
      (e.detail === 0 ? row.querySelector('[data-cancel-empty]') : row).focus({
        preventScroll: true,
      });
      transition(row);
    }
    if (e.target.closest('[data-cancel-empty]')) cancelConfirm(e.detail === 0);
    if (e.target.closest('[data-confirm-empty]')) {
      saved = KJOrdering.snapshot(Basket.all(), Date.now());
      try {
        sessionStorage.setItem(undoKey, JSON.stringify(saved));
      } catch (error) {}
      var finish = function () {
        removed = null;
        clearTimeout(removeTimer);
        cancelConfirm();
        Basket.clear();
        renderUndo();
        Basket.say('Pöntunin var tæmd.');
      };
      var rows = document.querySelectorAll('[data-basket-lines] .order-line');
      if (!reduce && window.gsap && rows.length)
        gsap.to(rows, {
          opacity: 0,
          x: 16,
          duration: 0.2,
          stagger: { each: Math.min(0.04, 0.3 / rows.length), from: 'end' },
          onComplete: finish,
        });
      else finish();
    }
    if (e.target.closest('[data-restore-order]')) {
      readUndo();
      var restored = KJOrdering.restore(saved, Date.now());
      if (restored) {
        saved = null;
        try {
          sessionStorage.removeItem(undoKey);
        } catch (error) {}
        Basket.set(restored);
        renderUndo();
        Basket.say('Pöntunin er komin aftur.');
      }
    }
    if (e.target.closest('[data-restore-line]') && removed) {
      var lines = Basket.all();
      if (
        !lines.some(function (line) {
          return line.k === removed.line.k;
        })
      )
        lines.splice(removed.index, 0, removed.line);
      removed = null;
      clearTimeout(removeTimer);
      Basket.set(lines);
    }
  });
  document.addEventListener('input', function (e) {
    if (!e.target.matches('[data-wish-input]')) return;
    var key = e.target.closest('[data-order-line]').dataset.orderLine;
    var lines = Basket.all();
    lines.forEach(function (line) {
      if (line.k === key) line.w = e.target.value.slice(0, 300);
    });
    writingWish = true;
    Basket.set(lines);
    writingWish = false;
    document.querySelectorAll('[data-order-line]').forEach(function (row) {
      if (row.dataset.orderLine !== key) return;
      var input = row.querySelector('[data-wish-input]');
      if (input !== e.target) input.value = e.target.value;
    });
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-line-amount]')) changeLine(e, e.target);
  });
  /* The note sits inside the order form, so Enter would send the whole order mid-sentence.
     Enter (the keyboard's ✓, enterkeyhint="done") only closes the note; it is already saved. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing || !e.target.matches('[data-wish-input]')) return;
    e.preventDefault();
    e.target.blur();
  });
  document.addEventListener(
    'keydown',
    function (e) {
      if (
        e.key === 'Escape' &&
        document.querySelector('[data-empty-confirm]')
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancelConfirm(true);
      }
    },
    true,
  );
  document.addEventListener('shift-modal:close', cancelConfirm);
  document.addEventListener('shift-modal:open', function (e) {
    if (e.detail.id !== 'basket') return;
    readUndo();
    renderUndo();
    var rows = document.querySelectorAll('.basket-panel .order-line');
    if (!reduce && window.gsap)
      gsap.fromTo(
        rows,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          delay: 0.12,
          duration: 0.35,
          stagger: 0.04,
          ease: 'uiOut',
          overwrite: true,
        },
      );
  });
  document.addEventListener('kj:basket', render);
  readUndo();
  render();
  renderUndo();
})();
