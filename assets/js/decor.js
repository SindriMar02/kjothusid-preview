/* One garland anchors the supplied glass lights and baubles on spruce. */
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
      '.jol-decor,[data-jol-lights],[data-jol-baubles],.jol-spray',
    )
    .forEach(function (node) {
      node.remove();
    });
  var surfaces = document.querySelectorAll(
    '.hero,.season--jol,.jol-head,.jol-gifts,.order-head--occasion,.footer',
  );
  surfaces.forEach(function (surface, index) {
    surface.classList.add('jol-surface');
    var layer = document.createElement('div');
    layer.className = 'jol-decor';
    layer.setAttribute('aria-hidden', 'true');
    var garland = image('garland', surface);
    garland.className = 'jol-garland';
    var picture = document.createElement('picture');
    var phoneSource = document.createElement('source');
    phoneSource.media = '(max-width: 767px)';
    phoneSource.srcset = base + 'assets/img/jol/garland-800.webp';
    picture.append(phoneSource, garland);
    garland.width = 1344;
    garland.height = 315;
    garland.loading =
      index === 0 && surface.getBoundingClientRect().top < innerHeight
        ? 'eager'
        : 'lazy';
    var light = document.createElement('div');
    light.className = 'jol-lights';
    light.dataset.jolLights = '';
    var bauble = document.createElement('div');
    bauble.className = 'jol-baubles';
    bauble.dataset.jolBaubles = surface.matches('.jol-head')
      ? '6:30:gold,24:35:red,76:25:cream,94:30:green'
      : surface.matches('.hero')
        ? '72:20:red,92:24:gold'
        : '6:20:red,94:24:gold';
    layer.append(picture, light, bauble);
    surface.prepend(layer);
  });
  document
    .querySelectorAll('.slip__head,.occasion-card--jol')
    .forEach(function (surface) {
      surface.classList.add('jol-spray-host');
      var spray = image('fir-spray', surface);
      spray.className = 'jol-spray';
      surface.prepend(spray);
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
  function depth() {
    return innerWidth < 768 ? 110 : innerWidth <= 1000 ? 150 : 220;
  }
  function lights(host) {
    var width = host.clientWidth;
    if (!width) return;
    host.replaceChildren();
    var short = host.dataset.jolLights === 'short';
    var n = short ? 8 : innerWidth < 768 ? 8 : innerWidth <= 1000 ? 12 : 20;
    var d = short ? 32 : depth();
    function y(x) {
      return (
        d * (0.62 + 0.16 * Math.pow(Math.sin((x / width) * Math.PI * 2), 2))
      );
    }
    var wire = svg('svg', {
      width: width,
      height: d,
      viewBox: '0 0 ' + width + ' ' + d,
      'aria-hidden': 'true',
    });
    var path = '';
    for (var x = 0; x <= width; x += width / 80)
      path += (x === 0 ? 'M' : 'L') + x + ' ' + y(x);
    wire.appendChild(
      svg('path', { d: path, class: 'jol-lights__wire', pathLength: 1 }),
    );
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
      bulb.style.setProperty('--angle', '0deg');
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
  function baubles(host) {
    var phone = matchMedia('(max-width: 47.999rem)').matches;
    host.replaceChildren();
    var specs = host.dataset.jolBaubles.split(',');
    if (phone) specs = [specs[0], specs[specs.length - 1]].filter(Boolean);
    specs.forEach(function (spec, i) {
      var part = spec.trim().split(':');
      var color = part[2] === 'silver' ? 'cream' : part[2];
      var thread = phone ? 12 : Number(part[1]);
      var bauble = document.createElement('span');
      bauble.className = 'jol-bauble';
      bauble.style.left = part[0] + '%';
      bauble.style.top = depth() * 0.55 + 'px';
      bauble.style.setProperty('--thread', thread + 'px');
      bauble.style.setProperty(
        '--size',
        [42, 36, 42, 36][i % 4] * (phone ? 0.65 : 1) + 'px',
      );
      bauble.style.setProperty('--draw-delay', 0.7 + i * 0.14 + 's');
      bauble.style.setProperty('--period', 5 + Math.random() * 2 + 's');
      bauble.style.setProperty('--ambient-phase', Math.random() * 2 + 's');
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
    '.jol-decor,[data-jol-lights],[data-jol-baubles],.jol-spray',
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
              '.jol-decor,[data-jol-lights],[data-jol-baubles],.jol-spray',
            ),
          );
          if (entry.target.matches('.jol-spray')) targets.push(entry.target);
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
      var band = host.matches('.jol-spray')
        ? host
        : host.closest('section,footer') || host;
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
