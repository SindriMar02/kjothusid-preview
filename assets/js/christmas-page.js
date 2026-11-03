/* A quiet arrival for the number; the shared draw primitives own the calendar. */
(function () {
  'use strict';
  var number = document.querySelector('[data-jol-days]');
  if (!number || !number.textContent || !window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var value = { days: 0 }, target = Number(number.textContent);
  gsap.to(value, { days: target, duration: 1.2, ease: 'luxe', onUpdate: function () { number.textContent = Math.round(value.days); } });
})();
