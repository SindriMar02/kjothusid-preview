/* The product counter, scroll-spy, pickup sentence and slip's next action. */
(function () {
  'use strict';
  var form = document.querySelector('[data-form="order"]');
  if (!form) return;
  var icon = KJOrdering.icon;
  var progress = document.querySelector('.order-progress');
  var sent = false;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var catalogue = JSON.parse(
    document.getElementById('kj-catalogue').textContent,
  );
  var byKey = {};
  catalogue.forEach(function (item) {
    byKey[item.k] = item;
  });
  var search = document.getElementById('picker-search');
  var clear = document.querySelector('[data-search-clear]');
  var empty = document.querySelector('[data-search-empty]');
  var categories = Array.from(form.querySelectorAll('[data-counter-category]'));
  var links = form.querySelectorAll('[data-category-link]');
  var seasonal =
    document.documentElement.classList.contains('is-jol') ||
    !!document.querySelector('.order-holidays:not([hidden])');
  if (seasonal) {
    var christmas = categories.find(function (category) {
      return category.querySelector('h2').textContent === 'Jólavörur';
    });
    if (christmas) {
      christmas.parentElement.prepend(christmas);
      var slug = christmas.dataset.counterCategory;
      form
        .querySelectorAll('.order-rail__links,.order-chips > div')
        .forEach(function (host) {
          var link = Array.from(host.querySelectorAll('a')).find(function (a) {
            return a.dataset.categoryLink === slug;
          });
          if (link) host.prepend(link);
        });
      categories = Array.from(form.querySelectorAll('[data-counter-category]'));
    }
  }
  function filter() {
    var query = KJOrdering.fold(search.value).trim(),
      found = 0;
    categories.forEach(function (category) {
      var visible = 0;
      category.querySelectorAll('[data-counter-key]').forEach(function (row) {
        var item = byKey[row.dataset.counterKey];
        var text = KJOrdering.fold(item.n + ' ' + item.c);
        row.hidden = !query.split(/\s+/).every(function (word) {
          return text.indexOf(word) >= 0;
        });
        if (!row.hidden) {
          visible++;
          found++;
        }
        // Once a user filters, rows remain settled rather than replaying their arrival.
        row.classList.add('is-drawn');
        if (window.gsap) gsap.set(row, { opacity: 1, y: 0 });
      });
      category.hidden = !visible;
    });
    clear.hidden = !search.value;
    empty.hidden = !!found;
    empty.textContent =
      'Engin vara fannst fyrir „' +
      search.value +
      '“. Hringdu í ' +
      JSON.parse(document.getElementById('kj-data').textContent).phone +
      ' og við finnum hana.';
    if (window.ScrollTrigger) ScrollTrigger.refresh();
    spy();
  }
  search.addEventListener('input', filter);
  clear.addEventListener('click', function () {
    search.value = '';
    filter();
    form.classList.remove('search-open');
    search.focus();
  });
  form
    .querySelector('[data-search-toggle]')
    .addEventListener('click', function () {
      form.classList.toggle('search-open');
      search.focus();
    });
  var active = null,
    jumping = false,
    settleTimer;
  function offset() {
    var chrome =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--top-chrome',
        ),
      ) || 100;
    var searchHeight = form
      .querySelector('.counter-search')
      .getBoundingClientRect().height;
    var space =
      chrome + progress.getBoundingClientRect().height + searchHeight + 16;
    document.documentElement.style.setProperty(
      '--category-offset',
      space + 'px',
    );
    return space;
  }
  function mark(slug) {
    active = slug;
    links.forEach(function (link) {
      var on = link.dataset.categoryLink === slug;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      if (on && link.closest('.order-rail__links')) {
        var bar = form.querySelector('.order-rail__bar');
        bar.style.height = link.offsetHeight + 'px';
        bar.style.transform = 'translateY(' + link.offsetTop + 'px)';
        // Scroll only the rail. scrollIntoView would also move the document.
        var rail = link.closest('.order-rail__sticky');
        var r = rail.getBoundingClientRect(),
          l = link.getBoundingClientRect();
        if (l.top < r.top) rail.scrollTop += l.top - r.top;
        if (l.bottom > r.bottom) rail.scrollTop += l.bottom - r.bottom;
      }
      if (on && link.closest('.order-chips')) {
        var host = link.parentElement;
        var left = Math.max(0, link.offsetLeft - host.offsetLeft - 44);
        host.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
        // iOS Safari once left the strip at its far end with the active chip out of view (11-04,
        // not reproducible): once the smooth scroll has had time, bring the chip back, unless
        // the visitor has touched the strip since.
        clearTimeout(host.kjChipFix);
        if (!host.kjChipTouch) {
          host.kjChipTouch = true;
          host.addEventListener('touchstart', function () { clearTimeout(host.kjChipFix); }, { passive: true });
        }
        host.kjChipFix = setTimeout(function () {
          if (!link.classList.contains('is-active')) return;
          var h = host.getBoundingClientRect(),
            c = link.getBoundingClientRect();
          if (c.right <= h.left || c.left >= h.right) host.scrollLeft = left;
        }, 900);
      }
    });
  }
  function spy() {
    if (sent) return;
    var reading = offset();
    updateCurrent();
    if (jumping) return;
    var shown = categories.filter(function (category) {
      return !category.hidden;
    });
    var current = shown[0];
    shown.forEach(function (category) {
      if (
        category.querySelector('h2').getBoundingClientRect().top <=
        reading + 1
      )
        current = category;
    });
    if (current && active !== current.dataset.counterCategory)
      mark(current.dataset.counterCategory);
  }
  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var target = document.getElementById(link.hash.slice(1));
      jumping = true;
      mark(link.dataset.categoryLink);
      var space = offset();
      function settled() {
        jumping = false;
        spy();
      }
      clearTimeout(settleTimer);
      if (window.kjLenis && !reduce) {
        window.kjLenis.scrollTo(target, {
          offset: -space,
          onComplete: settled,
        });
      } else {
        window.scrollTo({
          top: scrollY + target.getBoundingClientRect().top - space,
          behavior: reduce ? 'auto' : 'smooth',
        });
      }
      settleTimer = setTimeout(settled, reduce ? 50 : 1600);
    });
  });
  window.addEventListener('resize', spy, { passive: true });
  if (window.ResizeObserver) {
    var chromeObserver = new ResizeObserver(spy);
    [
      document.querySelector('header'),
      progress,
      form.querySelector('.counter-search'),
    ]
      .filter(Boolean)
      .forEach(function (node) {
        chromeObserver.observe(node);
      });
  }
  function value(name) {
    var el = form.querySelector(
      '[name="' +
        name +
        '"]' +
        (name === 'date' || name === 'time' ? ':checked' : ''),
    );
    return el ? el.value.trim() : '';
  }
  function state() {
    if (sent) return;
    var lines = KJBasket.all();
    var pickup = value('date') && value('time');
    var contact =
      value('name') &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email')) &&
      value('phone').replace(/\D/g, '').length >= 7 &&
      !/[^\d\s+()-]/.test(value('phone'));
    var button = form.querySelector('[data-slip-submit]');
    if (!button) return;
    button.disabled = !lines.length;
    button.textContent = !lines.length
      ? 'Veldu vörur'
      : !pickup
        ? 'Veldu tíma'
        : !contact
          ? 'Þínar upplýsingar'
          : 'Senda pöntun';
    button.type = lines.length && pickup && contact ? 'submit' : 'button';
    button.setAttribute('form', 'pontun');
    button.dataset.next = !pickup ? 'afhending' : 'thu';
    var sentence = form.querySelector('[data-slip-pickup]');
    if (pickup) {
      var date = new Date(value('date') + 'T12:00:00Z');
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
      sentence.innerHTML =
        '<a href="#afhending">' +
        icon('calendar') +
        weekdays[date.getUTCDay()] +
        ' ' +
        date.getUTCDate() +
        '. ' +
        months[date.getUTCMonth()] +
        '</a> <a href="#afhending">' +
        icon('clock') +
        value('time') +
        '</a>';
    }
    // Before a choice the main button is the one way to pick a time (Sindri 11-03: two
    // "Veldu dag og tíma" in one slip); once chosen, this row shows the day and time.
    document.querySelectorAll('[data-slip-pickup]').forEach(function (el) {
      el.hidden = !pickup;
      if (pickup) el.innerHTML = sentence.innerHTML;
    });
    var completed = KJOrdering.done(
      lines,
      value('date'),
      value('time'),
      value('name'),
      value('email'),
      value('phone'),
      sent,
    );
    progress
      .querySelectorAll('[data-progress]')
      .forEach(function (step, index) {
        step.classList.toggle('is-complete', completed[index]);
        step.classList.toggle(
          'is-joined',
          !!(completed[index] && completed[index + 1]),
        );
        if (index === 0)
          step.querySelector('.order-progress__label').textContent =
            'Vörur' + (lines.length ? ' ' + lines.length : '');
      });
    ['name', 'email', 'phone'].forEach(function (name) {
      var input = form.querySelector('[name="' + name + '"]');
      var valid =
        name === 'phone'
          ? value(name).replace(/\D/g, '').length >= 7 &&
            !/[^\d\s+()-]/.test(value(name))
          : name === 'email'
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value(name))
            : !!value(name);
      input.closest('.field__control').classList.toggle('is-valid', valid);
    });
  }
  form.addEventListener('click', function (e) {
    var button = e.target.closest('[data-slip-submit]');
    if (!button || button.type === 'submit') return;
    var target = document.getElementById(button.dataset.next);
    target.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    });
    if (e.detail === 0) {
      var field =
        target.id === 'afhending'
          ? target.querySelector(
              value('date') ? '[name="time"]' : '[name="date"]',
            )
          : target.querySelector('input');
      if (target.id === 'thu')
        field =
          Array.from(target.querySelectorAll('input[required]')).find(
            function (input) {
              return !input.value || !input.checkValidity();
            },
          ) || field;
      if (field) field.focus({ preventScroll: true });
    }
  });
  function updateCurrent() {
    if (sent) return;
    var line = progress.getBoundingClientRect().bottom + 120;
    var current = 1;
    ['afhending', 'thu'].forEach(function (id, index) {
      if (document.getElementById(id).getBoundingClientRect().top <= line)
        current = index + 2;
    });
    progress.querySelectorAll('[data-progress]').forEach(function (step) {
      var on = Number(step.dataset.progress) === current;
      step.classList.toggle('is-current', on);
      if (on) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  }
  var scrollQueued = false;
  window.addEventListener(
    'scroll',
    function () {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(function () {
        scrollQueued = false;
        spy();
      });
    },
    { passive: true },
  );
  progress.addEventListener('click', function (event) {
    var step = event.target.closest('[data-step-target]');
    if (!step || sent) return;
    var target = document.getElementById(step.dataset.stepTarget);
    target.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    });
    if (event.detail === 0) {
      var first = Array.from(target.querySelectorAll('input,button')).find(
        function (control) {
          return control.getClientRects().length;
        },
      );
      if (first) first.focus({ preventScroll: true });
    }
  });
  var companyToggle = form.querySelector('[data-company-toggle]');
  companyToggle.addEventListener('change', function () {
    var fields = document.getElementById('company-fields');
    fields.inert = !companyToggle.checked;
    fields.classList.toggle('is-open', companyToggle.checked);
    companyToggle.setAttribute('aria-expanded', String(companyToggle.checked));
    fields.querySelectorAll('input').forEach(function (input) {
      input.disabled = !companyToggle.checked;
      if (!companyToggle.checked) input.value = '';
    });
  });
  companyToggle.dispatchEvent(new Event('change'));
  document.addEventListener('kj:order-sent', function () {
    sent = true;
    progress.querySelectorAll('[data-progress]').forEach(function (step) {
      step.classList.add('is-complete');
      step.classList.toggle('is-joined', step.dataset.progress !== '4');
      step.classList.toggle('is-current', step.dataset.progress === '4');
      if (step.dataset.progress === '4')
        step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
  });
  form.addEventListener('input', state);
  form.addEventListener('change', state);
  document.addEventListener('kj:order-state', state);
  state();
  spy();
})();
