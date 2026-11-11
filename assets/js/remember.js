/* Opt-in history stays on this device. No request or URL carries these details. */
(function () {
  'use strict';
  var core = KJOrdering,
    basket = KJBasket;
  var storage;
  try {
    storage = window.localStorage;
    storage.setItem('kj-muna-probe', '1');
    storage.removeItem('kj-muna-probe');
  } catch (error) {
    return;
  }
  var saved = core.readRemember(storage);
  var data = JSON.parse(document.getElementById('kj-data').textContent);
  var form = document.querySelector('[data-form="order"]');
  var card = document.getElementById('aftur');
  var box = form && form.querySelector('[data-remember]');
  var choice = form && form.querySelector('[data-remember-choice]');
  var touched = {},
    prefilled = {},
    dismissed = false,
    expanded = false;
  var timer, undoAction, cardSignature;
  var names = ['name', 'email', 'phone', 'company', 'kennitala'];
  var weekdays = ['sun.', 'mán.', 'þri.', 'mið.', 'fim.', 'fös.', 'lau.'];
  var months = [
    'jan.',
    'feb.',
    'mars',
    'apr.',
    'maí',
    'jún.',
    'júl.',
    'ágú.',
    'sep.',
    'okt.',
    'nóv.',
    'des.',
  ];
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c];
    });
  }
  function count(n) {
    return n + (n === 1 ? ' vara' : ' vörur');
  }
  function day(value) {
    var date = new Date(value.slice(0, 10) + 'T12:00:00Z');
    return (
      weekdays[date.getUTCDay()] +
      ' ' +
      date.getUTCDate() +
      '. ' +
      months[date.getUTCMonth()]
    );
  }
  function write(value) {
    try {
      if (value) storage.setItem('kj-muna', JSON.stringify(value));
      else storage.removeItem('kj-muna');
      saved = value;
      return true;
    } catch (error) {
      return false;
    }
  }
  var toast = document.createElement('div');
  toast.className = 'remember-toast type-small';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  document.body.appendChild(toast);
  function announce(message, undo) {
    clearTimeout(timer);
    undoAction = undo;
    toast.innerHTML =
      '<span>' +
      esc(message) +
      '</span>' +
      (undo
        ? '<button type="button" data-remember-undo>Afturkalla</button>'
        : '');
    toast.hidden = false;
    timer = setTimeout(function () {
      toast.hidden = true;
      undoAction = null;
    }, 8000);
  }
  function repeat(index) {
    if (!saved || !saved.orders[index]) return;
    var before = basket.all();
    var result = core.mergeRemember(
      before,
      saved.orders[index],
      data.catalogue || [],
      document.documentElement.classList.contains('is-jol') ||
        !!document.querySelector('.order-holidays:not([hidden])'),
    );
    basket.set(result.lines);
    var message =
      result.count === 1
        ? '1 vara komin í pöntunina.'
        : result.count + ' vörur komnar í pöntunina.';
    if (result.skipped.length)
      message +=
        ' ' +
        count(result.skipped.length) +
        (result.skipped.length === 1 ? ' er' : ' eru') +
        ' ekki lengur á listanum: ' +
        result.skipped.join(', ') +
        '.';
    announce(message, function () {
      basket.set(before);
    });
  }
  function prefill() {
    if (!form || form.classList.contains('is-sent')) return;
    names.forEach(function (name) {
      var field = form.querySelector('[name="' + name + '"]');
      if (!field || touched[name]) return;
      if (
        !saved &&
        prefilled[name] !== undefined &&
        field.value === prefilled[name]
      )
        field.value = '';
      if (saved && (!field.value || field.value === prefilled[name])) {
        field.value = saved.contact[name];
        prefilled[name] = field.value;
      }
    });
    var company = form.querySelector('[data-company-toggle]');
    if (!touched.isCompany) {
      company.checked = !!(saved && saved.contact.isCompany);
      // Company change clears fields when closed, so preserve any freshly typed fields.
      var typedCompany = {};
      ['company', 'kennitala'].forEach(function (name) {
        if (touched[name])
          typedCompany[name] = form.querySelector(
            '[name="' + name + '"]',
          ).value;
      });
      company.dispatchEvent(new Event('change', { bubbles: true }));
      Object.keys(typedCompany).forEach(function (name) {
        form.querySelector('[name="' + name + '"]').value = typedCompany[name];
      });
      if (company.checked && saved)
        ['company', 'kennitala'].forEach(function (name) {
          var input = form.querySelector('[name="' + name + '"]');
          if (!touched[name]) {
            input.value = saved.contact[name];
            prefilled[name] = input.value;
          }
        });
    }
    if (!touched.remember) box.checked = !!saved;
    form.querySelector('[data-forget]').hidden = !saved;
    form.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function render() {
    if (card) {
      card.hidden = dismissed || !saved || !saved.orders.length;
      var signature = JSON.stringify([saved, expanded]);
      if (!card.hidden && signature !== cardSignature) {
        cardSignature = signature;
        var last = saved.orders[0];
        var first = saved.contact.name.trim().split(/\s+/)[0];
        card.innerHTML =
          '<button type="button" class="remember-close" data-remember-close aria-label="Loka fyrri pöntunum" title="Loka">' +
          core.icon('x') +
          '</button>' +
          '<h2 class="type-medium">Gaman að sjá þig aftur, ' +
          esc(first) +
          '</h2><p class="type-small">Síðasta pöntun: ' +
          day(last.sentAt) +
          ' · ' +
          count(last.lines.length) +
          '</p><p class="type-small">' +
          last.lines
            .slice(0, 3)
            .map(function (line) {
              return esc(line.n);
            })
            .join(', ') +
          (last.lines.length > 3
            ? ' og ' + (last.lines.length - 3) + ' fleiri'
            : '') +
          '</p>' +
          '<div class="remember-actions"><button type="button" class="btn btn-fill" data-repeat="0">' +
          core.icon('repeat') +
          'Panta það sama</button><button type="button" data-remember-expand aria-expanded="' +
          expanded +
          '" aria-controls="remember-orders">Fyrri pantanir</button></div>' +
          '<div class="remember-history' +
          (expanded ? ' is-open' : '') +
          '" id="remember-orders"' +
          (expanded ? '' : ' inert') +
          '><ul>' +
          saved.orders
            .map(function (order, index) {
              return (
                '<li><span>' +
                day(order.sentAt) +
                ' · ' +
                count(order.lines.length) +
                '</span><button type="button" data-repeat="' +
                index +
                '">' +
                core.icon('repeat') +
                'Panta aftur</button></li>'
              );
            })
            .join('') +
          '</ul></div>';
      }
    }
    // K8: this row always opens the live basket and exists only while it has items.
    var nav = document.querySelector('[data-nav-basket]');
    if (nav) nav.hidden = !basket.all().length;
    document.dispatchEvent(new Event('kj:dropdown-state'));
    document
      .querySelectorAll('.basket-panel [data-basket-empty]')
      .forEach(function (empty) {
        var button = empty.querySelector('[data-repeat]');
        if (button) button.remove();
        if (saved && saved.orders.length)
          empty.insertAdjacentHTML(
            'beforeend',
            '<button type="button" class="btn btn-fill" data-repeat="0">' +
              core.icon('repeat') +
              'Panta það sama og síðast</button>',
          );
      });
    slotChip();
  }
  function slotChip() {
    if (!form || !window.KJPickup || form.classList.contains('is-sent')) return;
    var old = form.querySelector('[data-same-slot]');
    if (old) old.remove();
    var slot = saved && core.nextSlot(saved.slot, KJPickup.options());
    if (!slot) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip same-slot';
    button.dataset.sameSlot = '';
    button.innerHTML =
      core.icon('clock') +
      'Eins og síðast: ' +
      weekdays[saved.slot.weekday] +
      ' kl. ' +
      slot.time;
    button.addEventListener('click', function () {
      KJPickup.select(slot);
    });
    form.querySelector('[data-day-tiles]').before(button);
  }
  document.addEventListener('click', function (event) {
    var repeatButton = event.target.closest('[data-repeat]');
    if (repeatButton) repeat(Number(repeatButton.dataset.repeat));
    if (event.target.closest('[data-remember-undo]') && undoAction) {
      var undo = undoAction;
      undoAction = null;
      toast.hidden = true;
      undo();
    }
    if (event.target.closest('[data-remember-close]')) {
      dismissed = true;
      card.hidden = true;
    }
    if (event.target.closest('[data-remember-expand]')) {
      expanded = !expanded;
      render();
      card
        .querySelector('[data-remember-expand]')
        .focus({ preventScroll: true });
    }
    if (event.target.closest('[data-forget]')) {
      var before = saved;
      if (write(null)) {
        touched.remember = false;
        prefill();
        render();
        announce('Upplýsingunum var eytt af þessu tæki.', function () {
          if (write(before)) {
            prefill();
            render();
          }
        });
      }
    }
  });
  if (form) {
    choice.hidden = false;
    form.addEventListener('input', function (event) {
      if (names.indexOf(event.target.name) >= 0)
        touched[event.target.name] = true;
    });
    form
      .querySelector('[data-company-toggle]')
      .addEventListener('click', function () {
        touched.isCompany = true;
      });
    box.addEventListener('change', function () {
      touched.remember = true;
    });
    document.addEventListener('kj:order-sent', function (event) {
      var detail = event.detail;
      if (!detail) return;
      write(
        core.remember(
          saved,
          detail.contact,
          detail.order,
          detail.remember,
          new Date().toISOString(),
        ),
      );
      render();
    });
    prefill();
  }
  document.addEventListener('kj:order-state', render);
  window.addEventListener('storage', function (event) {
    if (event.key !== 'kj-muna' && event.key !== null) return;
    saved = core.readRemember(storage);
    prefill();
    render();
  });
  render();
  if (card && location.hash === '#aftur' && !card.hidden) {
    card.scrollIntoView();
    try {
      if (sessionStorage.getItem('kj-aftur-focus') === '1')
        card.focus({ preventScroll: true });
      sessionStorage.removeItem('kj-aftur-focus');
    } catch (error) {}
  }
})();
