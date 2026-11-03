/* The product counter, scroll-spy, pickup sentence and slip's next action. */
(function () {
  'use strict';
  var form = document.querySelector('[data-form="order"]');
  if (!form) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var catalogue = JSON.parse(
    document.getElementById('kj-catalogue').textContent
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
  var active = null;
  function spy() {
    var top =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--top-chrome'
        )
      ) || 100;
    var slip = form.querySelector('[data-order-slip]');
    if (slip && slip.getClientRects().length) {
      // The height it has once pinned, so all lines show at the top of the page too
      // (its foot may sit below the fold until the page scrolls).
      var available = innerHeight - (top + 24) - 24;
      slip.style.setProperty(
        '--slip-available',
        Math.max(240, available) + 'px'
      );
    }
    var shown = categories.filter(function (category) {
      return !category.hidden;
    });
    var current = shown[0];
    shown.forEach(function (category) {
      if (category.getBoundingClientRect().top <= top + 180) current = category;
    });
    if (!current || active === current.dataset.counterCategory) return;
    active = current.dataset.counterCategory;
    links.forEach(function (link) {
      var on = link.dataset.categoryLink === active;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      if (on && link.closest('.order-rail__links')) {
        var bar = form.querySelector('.order-rail__bar');
        bar.style.height = link.offsetHeight + 'px';
        bar.style.transform = 'translateY(' + link.offsetTop + 'px)';
      }
      if (
        on &&
        link.closest('.order-chips') &&
        matchMedia('(max-width: 63.999rem)').matches
      ) {
        var host = link.parentElement;
        host.scrollTo({
          left: link.offsetLeft - host.offsetLeft - 44,
          behavior: reduce ? 'auto' : 'smooth'
        });
      }
    });
  }
  // Observe the reading line rather than running catalogue measurements on every frame.
  var categoryObserver, headObserver;
  function observeCategories() {
    if (categoryObserver) categoryObserver.disconnect();
    if (headObserver) headObserver.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var chrome =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--top-chrome'
        )
      ) || 100;
    var readingLine = Math.min(innerHeight - 1, chrome + 180);
    categoryObserver = new IntersectionObserver(spy, {
      rootMargin:
        '-' +
        readingLine +
        'px 0px -' +
        Math.max(0, innerHeight - readingLine - 1) +
        'px 0px'
    });
    categories.forEach(function (category) {
      categoryObserver.observe(category);
    });
    headObserver = new IntersectionObserver(spy, {
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
    });
    headObserver.observe(document.querySelector('.order-head'));
  }
  observeCategories();
  window.addEventListener(
    'resize',
    function () {
      observeCategories();
      spy();
    },
    { passive: true }
  );
  function value(name) {
    var el = form.querySelector(
      '[name="' +
        name +
        '"]' +
        (name === 'date' || name === 'time' ? ':checked' : '')
    );
    return el ? el.value.trim() : '';
  }
  function state() {
    var lines = KJBasket.all();
    var pickup = value('date') && value('time');
    var contact =
      value('name') &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value('email')) &&
      value('phone').replace(/\D/g, '').length >= 7;
    var button = form.querySelector('[data-slip-submit]');
    if (!button) return;
    button.disabled = !lines.length;
    button.textContent = !lines.length
      ? 'Veldu vörur'
      : !pickup
        ? 'Velja dag og tíma'
        : !contact
          ? 'Fylla inn upplýsingar'
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
        'des.'
      ];
      sentence.innerHTML =
        'Sótt <a href="#afhending">' +
        weekdays[date.getUTCDay()] +
        ' ' +
        date.getUTCDate() +
        '. ' +
        months[date.getUTCMonth()] +
        '</a> kl. <a href="#order-time">' +
        value('time') +
        '</a>';
    }
    form.querySelectorAll('[data-step]').forEach(function (marker) {
      var complete =
        marker.dataset.step === '1'
          ? !!lines.length
          : marker.dataset.step === '2'
            ? !!pickup
            : !!contact;
      marker.classList.toggle('is-complete', complete);
      marker.setAttribute(
        'aria-label',
        marker.textContent.replace('✓', '').trim() + (complete ? ', lokið' : '')
      );
    });
  }
  form.addEventListener('click', function (e) {
    var button = e.target.closest('[data-slip-submit]');
    if (!button || button.type === 'submit') return;
    var target = document.getElementById(button.dataset.next);
    target.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start'
    });
    if (e.detail === 0) {
      var field =
        target.id === 'afhending'
          ? target.querySelector(
              value('date') ? '[name="time"]' : '[name="date"]'
            )
          : target.querySelector('input');
      if (target.id === 'thu')
        field =
          Array.from(target.querySelectorAll('input[required]')).find(
            function (input) {
              return !input.value || !input.checkValidity();
            }
          ) || field;
      if (field) field.focus({ preventScroll: true });
    }
  });
  form.addEventListener('input', state);
  form.addEventListener('change', state);
  document.addEventListener('kj:order-state', state);
  var bar = document.querySelector('.phone-order-bar');
  // Out of #page: the drawer shoves #page with a transform, and a transformed ancestor
  // would pin this "fixed" bar to the end of the page instead of the screen.
  if (bar && bar.parentNode !== document.body) document.body.appendChild(bar);
  if (bar && 'IntersectionObserver' in window)
    new IntersectionObserver(
      function (entries) {
        bar.classList.toggle('is-covered', entries[0].isIntersecting);
      },
      { threshold: 0.1 }
    ).observe(form.querySelector('.order-end'));
  state();
  spy();
})();
