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

  root.KjChristmas = { inWindow: inWindow, overrideSearch: overrideSearch, applyTheme: applyTheme };
  if (!root.document) return;
  var html = root.document.documentElement;
  applyTheme(root, html.dataset.jolFrom, html.dataset.jolTo, html.dataset.jolAlways === 'true');
  var search = overrideSearch(root);
  document.querySelectorAll('[data-jol-band]').forEach(function (band) { band.hidden = !html.classList.contains('is-jol'); });
  document.querySelectorAll('.season--jol').forEach(function (band) { band.dataset.navTheme = html.classList.contains('is-jol') ? 'dark' : 'light'; });
  document.querySelectorAll('[data-christmas]').forEach(function (element) {
    element.hidden = !inWindow(element.dataset.from, element.dataset.to, null, search);
  });
})(globalThis);
