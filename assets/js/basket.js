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
  var bin =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 4h12M6 4V2h4v2M4 4l1 10h6l1-10M7 6v6M9 6v6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  var fmt = function (n) {
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(
      n
    );
  };
  var esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
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
          : Math.round(value)
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
  function totalText(lines) {
    var total = estimate(lines);
    if (!lines.length) return '';
    return (
      (total
        ? 'Áætlað verð án vsk.: <strong>' + fmt(total) + ' kr.</strong> '
        : 'Verð í síma. ') +
      'Endanlegt verð miðast við vigt og staðfestingu okkar.'
    );
  }
  function renderLine(line) {
    var item = byKey[line.k] || { n: line.n, l: '', u: line.u };
    var price = linePrice(line);
    var weight = item.u === 'kg' || !item.u;
    var minimum = line.q <= min(line.u);
    var key = esc(line.k),
      name = esc(item.n);
    return (
      '<li class="order-line" data-order-line="' +
      key +
      '"><div class="order-line__inner">' +
      '<p class="order-line__name">' +
      name +
      '</p><p class="order-line__meta type-xsmall">' +
      esc(item.l || '') +
      (typeof item.p === 'number'
        ? ' · ' +
          fmt(item.p) +
          ' ' +
          ({ kg: 'kr/kg', stk: 'kr/stk', pk: 'kr/pk', flat: 'kr' }[item.u] ||
            'kr')
        : ' · Verð í síma') +
      '</p>' +
      '<div class="order-line__bottom"><div class="order-line__qty">' +
      '<button type="button" data-line-minus aria-label="' +
      (minimum ? 'Taka ' + name + ' úr pöntuninni' : 'Minna af ' + name) +
      '">' +
      (minimum ? bin : '−') +
      '</button>' +
      '<input type="number" data-line-amount value="' +
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
        ? '<button type="button" data-line-toggle aria-label="Skipta um einingu fyrir ' +
          name +
          '">' +
          line.u +
          '</button>'
        : '<span>stk.</span>') +
      '<button type="button" data-line-plus aria-label="Meira af ' +
      name +
      '">+</button></div>' +
      (price !== null
        ? '<span class="order-line__price type-xsmall">≈ ' +
          fmt(price) +
          ' kr.</span>'
        : '') +
      '</div><span class="draw-rule is-drawn" aria-hidden="true"></span></div></li>'
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
        Math.max(1, saved.expires - Date.now())
      );
  }
  function render() {
    var lines = Basket.all();
    var fresh = lines
      .filter(function (line) {
        return previous.indexOf(line.k) < 0;
      })
      .map(function (line) {
        return line.k;
      });
    document.querySelectorAll('[data-basket-lines]').forEach(function (host) {
      var html = lines.map(renderLine);
      if (removed)
        html.splice(
          Math.min(removed.index, html.length),
          0,
          '<li class="order-removed type-small">Fjarlægt: ' +
            esc(removed.line.n) +
            '. <button type="button" data-restore-line>Afturkalla</button></li>'
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
            stagger: 0.03,
            ease: 'uiOut'
          }
        );
        added.forEach(function (row) {
          gsap.fromTo(
            row.querySelector('.draw-rule'),
            { scaleX: 0 },
            { scaleX: 1, duration: 0.5, ease: 'luxe' }
          );
        });
      }
    });
    document.querySelectorAll('[data-basket-size]').forEach(function (el) {
      el.textContent = count(lines.length);
      el.hidden = !lines.length;
    });
    // Nothing to finish in an empty order: the drawer offers its links instead.
    document.querySelectorAll('[data-basket-actions] .btn-fill').forEach(function (el) {
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
      el.innerHTML = bin + ' Tæma pöntun';
    });
    document.querySelectorAll('[data-basket-count]').forEach(function (el) {
      el.textContent = lines.length;
      el.hidden = !lines.length;
      var link = el.closest('a');
      if (link)
        link.setAttribute(
          'aria-label',
          'Pantanir, ' + count(lines.length) + ' í pöntun'
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
            opacity: previous.length ? 1 : 0
          },
          {
            scale: 1,
            opacity: 1,
            duration: 0.24,
            ease: 'uiOut',
            overwrite: true
          }
        );
    });
    document.querySelectorAll('[data-basket-preview]').forEach(function (el) {
      el.innerHTML = !lines.length
        ? 'Engin vara komin í pöntunina.'
        : '<p>' +
          count(lines.length) +
          '</p><ul>' +
          lines
            .slice(0, 3)
            .map(function (line) {
              return (
                '<li>' +
                esc(line.n) +
                ', ' +
                String(line.q).replace('.', ',') +
                ' ' +
                (line.u === 'stk' ? 'stk.' : line.u) +
                '</li>'
              );
            })
            .join('') +
          '</ul>' +
          (lines.length > 3
            ? '<p>og ' + (lines.length - 3) + ' fleiri</p>'
            : '');
    });
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
        '<span>Pöntun</span><span class="basket__n"><span class="basket__current">' +
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
            overwrite: true
          }
        );
        gsap.fromTo(
          pill.querySelector('.basket__current'),
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.2 }
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
    var bar = document.querySelector('.phone-order-bar');
    if (bar) {
      bar.hidden = !lines.length;
      bar.querySelector('[data-order-bar-text]').textContent =
        'PÖNTUN · ' +
        count(lines.length) +
        (estimate(lines) ? ' · ≈ ' + fmt(estimate(lines)) + ' kr.' : '');
    }
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
          }
        }
      );
      gsap.to(ghost, {
        opacity: 0,
        duration: 0.18,
        onComplete: function () {
          ghost.remove();
        }
      });
      gsap.fromTo(
        next,
        { opacity: 0 },
        { opacity: 1, duration: 0.18, overwrite: true }
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
      if (line.q <= min(line.u)) {
        removeLine(line, index);
        return;
      }
      line.q = snap(line.u, line.q - step(line.u));
    } else if (control.hasAttribute('data-line-plus')) {
      attr = 'data-line-plus';
      line.q = snap(line.u, line.q + step(line.u));
    } else if (control.hasAttribute('data-line-toggle')) {
      attr = 'data-line-toggle';
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
        }
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
        })
      );
      clearTimeout(removeTimer);
      removeTimer = setTimeout(function () {
        removed = null;
        render();
      }, 5000);
    }
    var rows = Array.from(
      document.querySelectorAll('[data-order-line]')
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
    var control = e.target.closest(
      '[data-line-minus],[data-line-plus],[data-line-toggle]'
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
        preventScroll: true
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
          onComplete: finish
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
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-line-amount]')) changeLine(e, e.target);
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
    true
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
          stagger: 0.03,
          ease: 'uiOut',
          overwrite: true
        }
      );
  });
  document.addEventListener('kj:basket', render);
  readUndo();
  render();
  renderUndo();
})();
