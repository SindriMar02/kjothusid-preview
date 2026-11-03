/* Christmas decorations, only in Christmas mode: a string of fairy lights along the top of
   the spruce bands and hanging baubles on gold threads. Built from geometry at runtime so
   the lights fit any width; everything is aria-hidden and ignores the pointer. */
(function () {
  'use strict';

  if (!document.documentElement.classList.contains('is-jol')) return;
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#e2392d', '#f2c14e', '#4fa36f', '#fff1cf'];

  function el(name, attrs) {
    var node = document.createElementNS(NS, name);
    for (var key in attrs) node.setAttribute(key, attrs[key]);
    return node;
  }

  // One sagging wire per span, two bulbs on each sag; colours cycle, twinkle offsets vary.
  function lights(host) {
    var width = host.clientWidth;
    if (!width) return;
    var phone = width < 768;
    var spans = Math.max(2, Math.round(width / (phone ? 84 : 120)));
    var span = width / spans, sag = phone ? 10 : 14, top = 1, height = sag * 2 + 22;
    var svg = el('svg', { width: width, height: height, viewBox: '0 0 ' + width + ' ' + height, 'aria-hidden': 'true', focusable: 'false' });
    var d = 'M0 ' + top;
    for (var i = 0; i < spans; i++) d += ' Q' + (i * span + span / 2) + ' ' + (top + sag * 2) + ' ' + (i + 1) * span + ' ' + top;
    svg.appendChild(el('path', { d: d, class: 'jol-lights__wire' }));
    var n = 0;
    for (var s = 0; s < spans; s++) {
      [0.3, 0.7].forEach(function (t) {
        var x = s * span + span * t;
        var y = (1 - t) * (1 - t) * top + 2 * (1 - t) * t * (top + sag * 2) + t * t * top;
        var g = el('g', { class: 'jol-bulb', style: '--c:' + COLORS[n % 4] + ';animation-delay:' + (-((n * 0.73) % 3.2)).toFixed(2) + 's', transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' });
        g.appendChild(el('circle', { class: 'jol-bulb__glow', cx: 0, cy: 9, r: 9 }));
        g.appendChild(el('rect', { class: 'jol-bulb__cap', x: -2.2, y: 0, width: 4.4, height: 4.5, rx: 1 }));
        g.appendChild(el('ellipse', { class: 'jol-bulb__glass', cx: 0, cy: 9.5, rx: 3.6, ry: 5.4 }));
        svg.appendChild(g);
        n++;
      });
    }
    host.replaceChildren(svg);
    // The wire draws itself in; each bulb lights up after the wire passes it.
    var wire = svg.querySelector('.jol-lights__wire');
    var length = wire.getTotalLength ? wire.getTotalLength() : width * 1.1;
    wire.style.setProperty('--len', length.toFixed(0));
    svg.querySelectorAll('.jol-bulb').forEach(function (bulb, i, all) {
      bulb.style.transitionDelay = (0.25 + 1.3 * i / all.length).toFixed(2) + 's';
    });
  }

  // data-jol-baubles="x%:thread px:colour, ...", colours red | gold | silver.
  function baubles(host) {
    var phone = matchMedia('(max-width: 47.999rem)').matches;
    host.replaceChildren();
    host.dataset.jolBaubles.split(',').forEach(function (spec, i) {
      var part = spec.trim().split(':');
      if (phone && i % 2) return;
      var b = document.createElement('span');
      b.className = 'jol-bauble jol-bauble--' + part[2];
      b.style.left = part[0] + '%';
      b.style.setProperty('--thread', (phone ? Number(part[1]) * 0.6 : Number(part[1])) + 'px');
      b.style.animationDelay = (-(i * 1.3)).toFixed(1) + 's';
      b.style.setProperty('--draw-delay', (0.35 + i * 0.14).toFixed(2) + 's');
      b.style.setProperty('--size', [54, 44, 60, 48][i % 4] * (phone ? 0.8 : 1) + 'px');
      host.appendChild(b);
    });
  }

  function build() {
    document.querySelectorAll('[data-jol-lights]').forEach(lights);
    document.querySelectorAll('[data-jol-baubles]').forEach(baubles);
  }
  build();

  // Draw each decoration in once, when its band scrolls into view. Under reduced motion
  // (or without IntersectionObserver) everything is simply there.
  var hosts = document.querySelectorAll('[data-jol-lights],[data-jol-baubles],.jol-ribbon');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    hosts.forEach(function (h) { h.classList.add('is-drawn'); });
  } else {
    document.documentElement.classList.add('jol-draw');
    // Observe each band once; when it arrives, mark all of its decorations.
    var bands = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll('[data-jol-lights],[data-jol-baubles],.jol-ribbon').forEach(function (h) { h.classList.add('is-drawn'); });
        bands.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    var unique = [];
    hosts.forEach(function (h) { var band = h.closest('section, footer, .gift-boxes') || h; if (unique.indexOf(band) < 0) unique.push(band); });
    unique.forEach(function (band) { bands.observe(band); });
  }
  var timer;
  window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(build, 150); }, { passive: true });
})();
