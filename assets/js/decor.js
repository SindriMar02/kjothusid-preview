/* Christmas decor: a holiday order page (?pontun=jol / aramot) gets its own dark head with
   snowfall. The string lights and hanging baubles came out on Karen's request (10 Nov, K1:
   "jólaborðinn með kúlunum eitthvað off ... hvort snjórinn sé bara nóg"); snow carries the season. */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('is-jol')) return;
  var occasion = new URLSearchParams(location.search).get('pontun');
  var orderHead = document.querySelector('.order-head');
  if (!orderHead || (occasion !== 'jol' && occasion !== 'aramot')) return;
  orderHead.classList.add('order-head--occasion');
  var kicker = orderHead.querySelector('.uppercase');
  kicker.classList.add('jol-kicker');
  kicker.textContent = 'Hátíðirnar 2026';
  var snow = document.createElement('div');
  snow.className = 'hero__snow-layer';
  snow.dataset.snow = '';
  snow.dataset.snowDesktop = '50';
  snow.dataset.snowPhone = '25';
  snow.setAttribute('aria-hidden', 'true');
  orderHead.prepend(snow);
})();
