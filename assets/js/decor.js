/* String lights and hanging baubles only: no fir or spruce images (Sindri 11-04: "just have the
   lights and bulbs and hanging christmas tree things"). The wire hangs in swags from hooks on the
   top edge of each surface; the baubles hang on gold threads from the same edge. */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('is-jol')) return;
  var NS = 'http://www.w3.org/2000/svg';
  var data = document.getElementById('kj-data');
  var base = data ? JSON.parse(data.textContent).base : '/';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animate = window.gsap && !reduce;
  function svg(name, attrs) {
    var node = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });
    return node;
  }
  function image(file, host) {
    var img = document.createElement('img');
    img.src = base + 'assets/img/jol/' + file + '.webp';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.loading = host.closest('.jol-head') ? 'eager' : 'lazy';
    return img;
  }
  var occasion = new URLSearchParams(location.search).get('pontun');
  var orderHead = document.querySelector('.order-head');
  if (orderHead && (occasion === 'jol' || occasion === 'aramot')) {
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
  }
  // Remove the old standalone strings. Decorations are built once per surface.
  document
    .querySelectorAll(
      '.jol-decor,[data-jol-lights],[data-jol-baubles]',
    )
    .forEach(function (node) {
      node.remove();
    });
  // Every surface carries the lights and a random set of baubles; the cream page heads get fewer,
  // smaller ones that stay inside the band, so they never meet the text below.
  var surfaces = document.querySelectorAll(
    '.hero,.season--jol,.jol-head,.jol-gifts,.order-head--occasion,.footer,.page-head,.order-head:not(.order-head--occasion)',
  );
  surfaces.forEach(function (surface) {
    var cream = surface.matches('.page-head,.order-head:not(.order-head--occasion)');
    surface.classList.add('jol-surface');
    if (cream) surface.classList.add('jol-surface--cream');
    var layer = document.createElement('div');
    layer.className = 'jol-decor';
    layer.setAttribute('aria-hidden', 'true');
    var light = document.createElement('div');
    light.className = 'jol-lights';
    light.dataset.jolLights = '';
    var bauble = document.createElement('div');
    bauble.className = 'jol-baubles';
    bauble.dataset.jolBaubles = cream
      ? 'cream'
      : surface.matches('.jol-head')
        ? 'head'
        : surface.matches('.hero')
          ? 'hero'
          : 'band';
    layer.append(light, bauble);
    surface.prepend(layer);
  });
  document
    .querySelectorAll('.order-holidays:not([hidden])')
    .forEach(function (surface) {
      var light = document.createElement('div');
      light.className = 'jol-lights jol-lights--short';
      light.dataset.jolLights = 'short';
      light.setAttribute('aria-hidden', 'true');
      surface.prepend(light);
    });
  // Matches --garland-depth in ordering.css (the band the lights and baubles hang in).
  function depth(host) {
    if (host && host.closest('.jol-surface--cream'))
      return innerWidth < 768 ? 52 : innerWidth <= 1000 ? 64 : 76;
    return innerWidth < 768 ? 76 : innerWidth <= 1000 ? 110 : 130;
  }
  function lights(host) {
    var width = host.clientWidth;
    if (!width) return;
    host.replaceChildren();
    var short = host.dataset.jolLights === 'short';
    var n = short ? 8 : innerWidth < 768 ? 8 : innerWidth <= 1000 ? 12 : host.closest('.jol-surface--cream') ? 16 : 20;
    var d = short ? 48 : depth(host);
    // k swags between k + 1 hooks on the top edge; each swag is a parabola (one quadratic curve),
    // so a bulb sits exactly on the wire and tilts with it.
    var k = short || innerWidth < 768 ? 2 : innerWidth <= 1000 ? 3 : 4;
    var top = 3;
    var sag = short ? 10 : Math.round((d - 34) * (host.closest('.jol-surface--cream') ? 0.7 : 0.6));
    var span = width / k;
    function f(x) {
      var t = (x % span) / span;
      return t;
    }
    function y(x) {
      var t = f(x);
      return top + 4 * sag * t * (1 - t);
    }
    function tilt(x) {
      var slope = (4 * sag * (1 - 2 * f(x))) / span;
      return Math.atan(slope) * (180 / Math.PI) * 0.7;
    }
    var wire = svg('svg', {
      width: width,
      height: d,
      viewBox: '0 0 ' + width + ' ' + d,
      'aria-hidden': 'true',
    });
    var path = 'M0 ' + top;
    for (var j = 0; j < k; j++)
      path += ' Q' + (j + 0.5) * span + ' ' + (top + 2 * sag) + ' ' + (j + 1) * span + ' ' + top;
    wire.appendChild(
      svg('path', { d: path, class: 'jol-lights__wire', pathLength: 1 }),
    );
    for (var h = 1; h < k; h++)
      wire.appendChild(svg('circle', { cx: h * span, cy: top, r: 2, class: 'jol-lights__hook' }));
    host.appendChild(wire);
    var colors = ['warm', 'red', 'warm', 'amber', 'warm', 'green'];
    var glows = {
      warm: '#ffd9a0',
      red: '#ff6a5a',
      amber: '#ffb347',
      green: '#8fe39a',
    };
    for (var i = 0; i < n; i++) {
      var at = (width * (i + 0.5)) / n;
      var bulb = document.createElement('span');
      bulb.className = 'jol-bulb';
      bulb.style.left = at + 'px';
      bulb.style.top = y(at) + 'px';
      bulb.style.setProperty('--angle', tilt(at).toFixed(1) + 'deg');
      bulb.style.setProperty('--bulb-delay', 0.5 + (i / n) * 1.4 + 's');
      bulb.style.setProperty('--glow', glows[colors[i % 6]]);
      bulb.style.setProperty('--period', 2.6 + (i % 4) * 0.4 + 's');
      bulb.style.setProperty('--phase', -i * 0.3 + 's');
      var glow = document.createElement('span');
      glow.className = 'jol-bulb__glow';
      bulb.append(glow, image('bulb-' + colors[i % 6], host));
      host.appendChild(bulb);
    }
  }
  // Baubles hang from the top edge between two bulbs (or from a hook), never on a bulb. Their
  // places, colours, sizes and thread lengths are random per page load (Sindri 11-04: "a bit
  // more of the hanging decorations, and randomized"); a seed kept on the host means a resize
  // re-lays the same set instead of shuffling it.
  var BAUBLES = {
    head: [4, 6, 8],
    hero: [3, 5, 6],
    band: [3, 4, 5],
    cream: [2, 2, 3],
  };
  function rng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function baubles(host) {
    var phone = innerWidth < 768;
    var tier = phone ? 0 : innerWidth <= 1000 ? 1 : 2;
    var kind = host.dataset.jolBaubles;
    var cream = kind === 'cream';
    host.replaceChildren();
    if (!host.dataset.seed) host.dataset.seed = String((Math.random() * 1e9) | 0);
    var rand = rng(Number(host.dataset.seed));
    var d = depth(host);
    // the same bulb count the lights use, so the gaps line up with the bulbs
    var n = phone ? 8 : tier === 1 ? 12 : cream ? 16 : 20;
    var want = Math.min((BAUBLES[kind] || BAUBLES.band)[tier], n - 1);
    var gaps = [];
    for (var g = 1; g < n; g++) gaps.push(g);
    for (var a = gaps.length - 1; a > 0; a--) {
      var b = Math.floor(rand() * (a + 1));
      var swap = gaps[a];
      gaps[a] = gaps[b];
      gaps[b] = swap;
    }
    // prefer one free gap between neighbours; fill up without it only if there is no room
    var picked = [];
    [2, 1].forEach(function (apart) {
      gaps.forEach(function (gap) {
        if (picked.length >= want || picked.indexOf(gap) >= 0) return;
        if (picked.every(function (p) { return Math.abs(p - gap) >= apart; })) picked.push(gap);
      });
    });
    picked.sort(function (x, y) { return x - y; });
    var colors = ['red', 'gold', 'green', 'cream'];
    var last = '';
    picked.forEach(function (gap, i) {
      var color = colors[Math.floor(rand() * colors.length)];
      if (color === last) color = colors[(colors.indexOf(color) + 1 + Math.floor(rand() * 3)) % 4];
      last = color;
      var size = cream
        ? (phone ? 16 : 22) + rand() * (phone ? 6 : 8)
        : (30 + rand() * 16) * (phone ? 0.65 : 1);
      size = Math.round(size);
      // room under the drop for its shadow, so the band edge never cuts it
      var longest = d - size * (cream ? 1.6 : 1.4);
      var shortest = Math.min(longest, d * (cream ? 0.12 : 0.18));
      var thread = Math.round(shortest + rand() * (longest - shortest));
      var bauble = document.createElement('span');
      bauble.className = 'jol-bauble';
      bauble.style.left = ((gap / n) * 100).toFixed(3) + '%';
      bauble.style.top = '0px';
      bauble.style.setProperty('--thread', thread + 'px');
      bauble.style.setProperty('--size', size + 'px');
      bauble.style.setProperty('--draw-delay', 0.7 + i * 0.12 + 's');
      bauble.style.setProperty('--period', 5 + rand() * 2 + 's');
      bauble.style.setProperty('--ambient-phase', rand() * 2 + 's');
      var cord = svg('svg', {
        viewBox: '0 0 10 ' + (thread + 5),
        preserveAspectRatio: 'none',
        class: 'jol-bauble__thread',
        'aria-hidden': 'true',
      });
      cord.appendChild(
        svg('path', {
          d: 'M5 0V' + thread + 'm0 0a3 3 0 1 0 .01 0',
          pathLength: 1,
        }),
      );
      var drop = document.createElement('span');
      drop.className = 'jol-bauble__drop';
      drop.appendChild(image('bauble-' + color, host));
      bauble.append(cord, drop);
      host.appendChild(bauble);
    });
  }
  function build() {
    document.querySelectorAll('[data-jol-lights]').forEach(lights);
    document.querySelectorAll('[data-jol-baubles]').forEach(baubles);
  }
  build();
  var hosts = document.querySelectorAll(
    '.jol-decor,[data-jol-lights],[data-jol-baubles]',
  );
  if (!animate || !('IntersectionObserver' in window)) {
    hosts.forEach(function (host) {
      host.classList.add('is-drawn', 'is-in-view');
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var targets = Array.from(
            entry.target.querySelectorAll(
              '.jol-decor,[data-jol-lights],[data-jol-baubles]',
            ),
          );
          targets.forEach(function (host) {
            host.classList.toggle('is-in-view', entry.isIntersecting);
            if (entry.isIntersecting) host.classList.add('is-drawn');
          });
        });
      },
      { threshold: 0.05 },
    );
    var bands = [];
    hosts.forEach(function (host) {
      var band = host.closest('section,footer') || host;
      if (bands.indexOf(band) < 0) bands.push(band);
    });
    bands.forEach(function (band) {
      observer.observe(band);
    });
  }
  var timer,
    lastWidth = innerWidth;
  window.addEventListener(
    'resize',
    function () {
      if (innerWidth === lastWidth) return;
      lastWidth = innerWidth;
      clearTimeout(timer);
      timer = setTimeout(build, 150);
    },
    { passive: true },
  );
})();
