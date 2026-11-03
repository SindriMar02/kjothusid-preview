/* The supplied glass assets hang from a wire and gold threads. No product imagery. */
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
  function lights(host) {
    var width = host.clientWidth;
    if (!width) return;
    host.replaceChildren();
    var phone = width < 768;
    var spans = Math.max(2, Math.round(width / (phone ? 120 : 120)));
    var span = width / spans,
      sag = phone ? 10 : 14,
      top = 1;
    var wire = svg('svg', {
      width: width,
      height: 70,
      viewBox: '0 0 ' + width + ' 70',
      'aria-hidden': 'true'
    });
    var path = 'M0 1';
    for (var i = 0; i < spans; i++)
      path +=
        ' Q' +
        (i * span + span / 2) +
        ' ' +
        (top + sag * 2) +
        ' ' +
        (i + 1) * span +
        ' 1';
    wire.appendChild(
      svg('path', { d: path, class: 'jol-lights__wire', pathLength: 1 })
    );
    host.appendChild(wire);
    var colors = ['warm', 'red', 'warm', 'amber', 'warm', 'green'];
    var glows = {
      warm: '#ffd9a0',
      red: '#ff6a5a',
      amber: '#ffb347',
      green: '#8fe39a'
    };
    var index = 0;
    for (var s = 0; s < spans; s++) {
      [0.3, 0.7].forEach(function (t) {
        var x = s * span + span * t;
        var y = top + 4 * sag * t * (1 - t);
        var angle = Math.max(
          -12,
          Math.min(
            12,
            (Math.atan((4 * sag * (1 - 2 * t)) / span) * 180) / Math.PI
          )
        );
        var bulb = document.createElement('span');
        bulb.className = 'jol-bulb';
        bulb.style.left = x + 'px';
        bulb.style.top = y + 'px';
        bulb.style.setProperty('--angle', angle + 'deg');
        bulb.style.setProperty('--bulb-delay', (x / width) * 1.4 + 's');
        bulb.style.setProperty('--glow', glows[colors[index % 6]]);
        bulb.style.setProperty('--period', 2.6 + Math.random() * 1.6 + 's');
        bulb.style.setProperty('--phase', -(Math.random() * 4.2) + 's');
        var glow = document.createElement('span');
        glow.className = 'jol-bulb__glow';
        bulb.append(glow, image('bulb-' + colors[index % 6], host));
        host.appendChild(bulb);
        index++;
      });
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
      var thread = Number(part[1]) * (phone ? 0.6 : 1);
      var bauble = document.createElement('span');
      bauble.className = 'jol-bauble';
      bauble.style.left = (phone ? (i === 0 ? 5 : 95) : part[0]) + '%';
      bauble.style.setProperty('--thread', thread + 'px');
      bauble.style.setProperty(
        '--size',
        [56, 44, 64, 50][i % 4] * (phone ? 0.75 : 1) + 'px'
      );
      bauble.style.setProperty('--draw-delay', 0.35 + i * 0.14 + 's');
      bauble.style.setProperty('--period', 5 + Math.random() * 2 + 's');
      bauble.style.setProperty('--ambient-phase', Math.random() * 2 + 's');
      var cord = svg('svg', {
        viewBox: '0 0 10 ' + (thread + 5),
        preserveAspectRatio: 'none',
        class: 'jol-bauble__thread',
        'aria-hidden': 'true'
      });
      cord.appendChild(
        svg('path', {
          d: 'M5 0V' + thread + 'm0 0a3 3 0 1 0 .01 0',
          pathLength: 1
        })
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
    '[data-jol-lights],[data-jol-baubles],.jol-ribbon'
  );
  if (!animate || !('IntersectionObserver' in window)) {
    hosts.forEach(function (host) {
      host.classList.add('is-drawn', 'is-in-view');
    });
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          entry.target
            .querySelectorAll(
              '[data-jol-lights],[data-jol-baubles],.jol-ribbon'
            )
            .forEach(function (host) {
              host.classList.toggle('is-in-view', entry.isIntersecting);
              if (entry.isIntersecting) host.classList.add('is-drawn');
            });
        });
      },
      { threshold: 0.05 }
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
    { passive: true }
  );
})();
