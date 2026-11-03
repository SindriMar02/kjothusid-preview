/* Quiet weather behind the hero copy. One clock owns drawing and the fade. */
(function () {
  'use strict';

  var layer = document.querySelector('[data-snow]');
  if (!layer || layer.hidden) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  function start() {
    if (reduced.matches || layer.hidden) return;
    var band = layer.parentElement;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    layer.appendChild(canvas);
    var context = canvas.getContext('2d');
    if (!context) { canvas.remove(); return; }

    var depths = [
      { min: 0.8, max: 1.3, alpha: 0.35, slow: 12, fast: 18 },
      { min: 1.3, max: 2, alpha: 0.55, slow: 18, fast: 28 },
      { min: 2, max: 2.6, alpha: 0.8, slow: 28, fast: 40 }
    ];
    var flakes = [];
    var width = 0, height = 0, dpr = 1;
    var frame = 0, previous = 0, elapsed = 0;
    var visible = false, stopped = false;
    var luxe = typeof gsap !== 'undefined' ? gsap.parseEase('luxe') : function (t) { return 1 - Math.pow(1 - t, 3); };
    function random(min, max) { return min + Math.random() * (max - min); }

    // Each soft sprite is prepared once, never during a drawing frame.
    function flake(x, y, index) {
      var depth = depths[index % 3];
      var radius = random(depth.min, depth.max);
      var sprite = document.createElement('canvas');
      var extent = radius + 0.6;
      sprite.width = sprite.height = Math.ceil(extent * 2 * dpr);
      var brush = sprite.getContext('2d');
      var center = sprite.width / 2;
      var gradient = brush.createRadialGradient(center, center, radius * dpr * 0.5, center, center, extent * dpr);
      gradient.addColorStop(0, 'rgba(240,240,240,' + depth.alpha + ')');
      gradient.addColorStop(1, 'rgba(240,240,240,0)');
      brush.fillStyle = gradient;
      brush.fillRect(0, 0, sprite.width, sprite.height);
      return {
        x: x, y: y, speed: random(depth.slow, depth.fast),
        amplitude: random(6, 18), period: random(4, 9), phase: random(0, Math.PI * 2),
        sprite: sprite, size: extent * 2
      };
    }

    function resize() {
      var oldWidth = width, oldHeight = height;
      width = band.clientWidth;
      height = band.clientHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.min(matchMedia('(max-width: 47.999rem)').matches ? Number(layer.dataset.snowPhone || 40) : Number(layer.dataset.snowDesktop || 90), Math.round(width * height / 9000));
      // Preserve existing trajectories; populate only the newly exposed strips.
      flakes = flakes.filter(function (f) { return f.x <= width + 30 && f.y <= height + 5; });
      flakes.length = Math.min(flakes.length, count);
      while (flakes.length < count) {
        var x = random(0, width), y = random(0, height);
        if (oldWidth && oldHeight) {
          var rightArea = Math.max(0, width - oldWidth) * height;
          var bottomArea = Math.min(oldWidth, width) * Math.max(0, height - oldHeight);
          if (rightArea + bottomArea > 0) {
            if (Math.random() * (rightArea + bottomArea) < rightArea) x = random(oldWidth, width);
            else { x = random(0, Math.min(oldWidth, width)); y = random(oldHeight, height); }
          }
        }
        flakes.push(flake(x, y, flakes.length));
      }
    }

    function draw(now) {
      frame = 0;
      var dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      elapsed += dt;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = luxe(Math.min(elapsed / 1.2, 1));
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.x += 4 * dt;
        f.y += f.speed * dt;
        if (f.y > height + 5) f.y = -5;
        if (f.x > width + 30) f.x = -30;
        var sway = Math.sin(elapsed * Math.PI * 2 / f.period + f.phase) * f.amplitude;
        context.drawImage(f.sprite, f.x + sway - f.size / 2, f.y - f.size / 2, f.size, f.size);
      }
      frame = requestAnimationFrame(draw);
    }

    function sync() {
      if (stopped || document.hidden || !visible) {
        cancelAnimationFrame(frame);
        frame = 0;
        previous = 0;
      } else if (!frame) frame = requestAnimationFrame(draw);
    }
    var observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    });
    function stop() {
      stopped = true;
      sync();
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', sync);
      reduced.removeEventListener('change', stop);
      canvas.remove();
    }
    resize();
    observer.observe(band);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', stop);
    // No pagehide teardown: a page kept for Back is frozen with its clock and
    // resumes on return (dt is clamped), so the snow is still there.
  }

  if (!layer.closest('.hero') || window.kjHeroReady || typeof gsap === 'undefined') start();
  else document.addEventListener('kj:hero-ready', start, { once: true });
})();
