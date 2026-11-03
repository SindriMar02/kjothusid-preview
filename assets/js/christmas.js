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

  root.KjChristmas = { inWindow: inWindow };
  if (!root.document) return;
  // ?jol=1 / ?jol=0 holds for the rest of the visit, so a preview link shows
  // the Christmas look on every page the visitor opens from it.
  var search = location.search;
  try {
    var asked = new URLSearchParams(search).get('jol');
    if (asked === '1' || asked === '0') sessionStorage.setItem('kj-jol', asked);
    else if (sessionStorage.getItem('kj-jol')) search = '?jol=' + sessionStorage.getItem('kj-jol');
  } catch (e) {}
  document.querySelectorAll('[data-christmas]').forEach(function (element) {
    element.hidden = !inWindow(element.dataset.from, element.dataset.to, null, search);
  });
})(globalThis);
