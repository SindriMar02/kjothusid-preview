/* A static publish must not freeze the Christmas look on or off for a year. */
(function (root) {
  'use strict';

  function inWindow(from, to, today, search) {
    var override = new URLSearchParams(search || '').get('jol');
    if (override === '1') return true;
    if (override === '0') return false;
    if (!from || !to) return false;
    var day = (today || new Date().toISOString().slice(0, 10)).slice(5, 10);
    return from <= to ? day >= from && day <= to : day >= from || day <= to;
  }

  function overrideSearch(root) {
    var search = root.location.search;
    try {
      var asked = new URLSearchParams(search).get('jol');
      if (asked === '1' || asked === '0') root.sessionStorage.setItem('kj-jol', asked);
      else if (root.sessionStorage.getItem('kj-jol')) search = '?jol=' + root.sessionStorage.getItem('kj-jol');
    } catch (e) {}
    return search;
  }

  function applyTheme(root, from, to, always) {
    var search = overrideSearch(root);
    var on = always || inWindow(from, to, null, search);
    root.document.documentElement.classList.toggle('is-jol', on);
  }

  // Days to aðfangadagur, then to gamlárskvöld; greetings on the days themselves.
  // Icelandic counts take the singular after 1, 21, 31 (not 11).
  function countdown(today) {
    var day = (today || new Date().toISOString().slice(0, 10));
    var md = day.slice(5, 10);
    function days(n, what) { return { num: n, label: (n % 10 === 1 && n % 100 !== 11 ? 'dagur til ' : 'dagar til ') + what }; }
    if (md >= '12-24' && md <= '12-26') return { num: null, label: 'Gleðileg jól' };
    if (md >= '12-27' && md <= '12-30') return days(31 - Number(md.slice(3)), 'áramóta');
    if (md === '12-31') return { num: null, label: 'Gleðilegt nýtt ár' };
    var year = Number(day.slice(0, 4));
    if (md > '12-26') year += 1;
    var n = Math.round((Date.UTC(year, 11, 24) - Date.parse(day + 'T00:00:00Z')) / 864e5);
    return days(n, 'jóla');
  }

  root.KjChristmas = { inWindow: inWindow, overrideSearch: overrideSearch, applyTheme: applyTheme, countdown: countdown };
  if (!root.document) return;
  var html = root.document.documentElement;
  applyTheme(root, html.dataset.jolFrom, html.dataset.jolTo, html.dataset.jolAlways === 'true');
  var search = overrideSearch(root);
  document.querySelectorAll('[data-jol-band]').forEach(function (band) { band.hidden = !html.classList.contains('is-jol'); });
  document.querySelectorAll('.season--jol').forEach(function (band) { band.dataset.navTheme = html.classList.contains('is-jol') ? 'dark' : 'light'; });
  document.querySelectorAll('[data-christmas]').forEach(function (element) {
    element.hidden = !inWindow(element.dataset.from, element.dataset.to, null, search);
  });

  // December takeover of the hero, before motion.js splits the heading.
  if (html.classList.contains('is-jol')) {
    document.querySelectorAll('[data-jol-lines]').forEach(function (heading) {
      heading.replaceChildren();
      heading.dataset.jolLines.split('|').forEach(function (line, i) {
        if (i) heading.appendChild(document.createElement('br'));
        heading.appendChild(document.createTextNode(line));
      });
    });
    document.querySelectorAll('[data-jol-text]').forEach(function (p) {
      if (p.dataset.jolText) p.textContent = p.dataset.jolText;
    });
  }
  var count = countdown();
  document.querySelectorAll('[data-jol-countdown]').forEach(function (el) {
    el.textContent = count.num === null ? count.label : count.num + ' ' + count.label;
  });
  document.querySelectorAll('[data-jol-days]').forEach(function (el) { el.textContent = count.num === null ? '' : String(count.num); });
  document.querySelectorAll('[data-jol-days-label]').forEach(function (el) { el.textContent = count.label; });
})(globalThis);
