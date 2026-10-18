/* Classic deferred script. The tables remain the no-JS fallback. */
(function () {
  'use strict';
  document.querySelectorAll('[data-doneness]').forEach(function (tool) {
    if (tool.dataset.dnReady) return;
    var data;
    try { data = JSON.parse(tool.querySelector('#dn-data').textContent); } catch (_) { return; }
    if (!data.beef || !data.beef.length) return;
    var range = tool.querySelector('#dn-range');
    var output = tool.querySelector('[data-dn-t]');
    var roll = tool.querySelector('[data-dn-roll]');
    var label = tool.querySelector('[data-dn-label]');
    var reference = tool.querySelector('[data-dn-reference]');
    var steps = tool.querySelector('[data-dn-steps]');
    var ticks = tool.querySelector('[data-dn-ticks]');
    var status = tool.querySelector('[data-dn-status]');
    var frames = Array.prototype.slice.call(tool.querySelectorAll('[data-dn-frame]'));
    var meat = 'beef';
    var buttons = [];
    var min = Number(range.min), max = Number(range.max);
    tool.style.setProperty('--dn-divisions', String(max - min));
    // Doneness colour for the controls (track, step markers), from raw purple-red
    // to cooked grey-brown; the drawing itself is the frame stack below.
    var RAW = [126, 28, 44], PINK = [206, 92, 104], ROSE = [222, 150, 148], GREY = [176, 136, 110], DONE = [128, 96, 72];
    var SCALE = [RAW, PINK, ROSE, GREY, DONE];
    function shortName(row) { return row.label.replace(/\s*\([^)]*\)\s*$/, ''); }
    function currentRow(t) {
      return data[meat].reduce(function (hit, row) {
        return row.celsius <= t && (!hit || row.celsius >= hit.celsius) ? row : hit;
      }, null);
    }
    // Colour follows the source rows, not an independently hardcoded heat map.
    function progress(t) {
      var rows = data[meat];
      var stops = [min].concat(rows.map(function (r) { return r.celsius; }));
      for (var i = 1; i < stops.length; i++) {
        if (t <= stops[i]) return ((i - 1) + (t - stops[i - 1]) / Math.max(1, stops[i] - stops[i - 1])) / (stops.length - 1);
      }
      return 1;
    }
    function mix(p) {
      var n = Math.max(0, Math.min(1, p)) * (SCALE.length - 1);
      var i = Math.min(SCALE.length - 2, Math.floor(n));
      return 'rgb(' + SCALE[i].map(function (v, j) { return Math.round(v + (SCALE[i + 1][j] - v) * (n - i)); }).join(',') + ')';
    }
    // The picture for degree t: the frame drawn at or below t stays opaque and
    // the next frame up fades in by how far t has travelled towards it. Frames
    // of the other meat are left alone (their set is hidden by CSS).
    function setFrames(t) {
      var set = frames.filter(function (f) { return f.parentNode && f.parentNode.getAttribute('data-dn-set') === meat; });
      if (!set.length) return;
      set.sort(function (a, b) { return Number(a.dataset.t) - Number(b.dataset.t); });
      var lower = 0;
      for (var i = 0; i < set.length; i++) if (Number(set[i].dataset.t) <= t) lower = i;
      var upper = Math.min(set.length - 1, lower + 1);
      var t0 = Number(set[lower].dataset.t), t1 = Number(set[upper].dataset.t);
      var k = upper === lower || t1 === t0 ? 0 : Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
      set.forEach(function (f, i) {
        var o = i === lower ? 1 : i === upper ? k : 0;
        f.style.setProperty('opacity', o.toFixed(3));
      });
    }
    function update(announce) {
      var t = Number(range.value), hit = currentRow(t);
      var name = hit ? shortName(hit) : 'Hrátt';
      var p = progress(t);
      output.textContent = t;
      if (roll) roll.textContent = t;
      label.textContent = name;
      reference.textContent = hit ? (hit.range || hit.celsius) + ' °C í töflu' : 'Neðan við fyrsta töflugildi';
      var description = t + ' gráður, ' + (meat === 'beef' ? 'naut' : 'lamb') + ', ' + name;
      if (hit && hit.range) description += '. Töflugildi ' + hit.range + ' gráður';
      range.setAttribute('aria-valuetext', description);
      tool.style.setProperty('--dn-core', mix(p));
      tool.style.setProperty('--dn-heat', String(p));
      tool.style.setProperty('--dn-position', String((t - min) / (max - min) * 100) + '%');
      setFrames(t);
      buttons.forEach(function (button, i) {
        var selected = data[meat][i] === hit;
        button.setAttribute('aria-pressed', String(selected));
        button.dataset.passed = String(t >= data[meat][i].celsius);
      });
      if (announce) status.textContent = description;
    }
    function drawSteps() {
      steps.replaceChildren();
      steps.style.setProperty('--dn-rows', String(data[meat].length));
      ticks.replaceChildren();
      buttons = data[meat].map(function (row, i) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'doneness__step';
        var marker = document.createElement('span');
        marker.className = 'doneness__step-marker';
        marker.setAttribute('aria-hidden', 'true');
        var name = document.createElement('span');
        name.className = 'doneness__step-name';
        name.textContent = shortName(row);
        var value = document.createElement('span');
        value.className = 'doneness__step-value';
        value.textContent = (row.range || row.celsius) + ' °C';
        button.append(marker, name, value);
        button.addEventListener('click', function () { glide(row.celsius); });
        steps.append(button);
        var tick = document.createElement('i');
        tick.style.left = ((row.celsius - min) / (max - min) * 100) + '%';
        tick.dataset.label = shortName(row);
        ticks.append(tick);
        return button;
      });
    }
    // A tapped step glides the thermometer there (the number counts, the cut
    // face cooks or cools), ~520 ms ease-out. Dragging stays direct: no tween.
    var reduce = typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canAnimate = typeof requestAnimationFrame === 'function' && typeof performance !== 'undefined';
    var glideId = 0;
    function glide(target) {
      var from = Number(range.value);
      if (reduce || !canAnimate || from === target) { range.value = target; update(true); return; }
      var id = ++glideId, t0 = performance.now(), dur = 520;
      (function frame(now) {
        if (id !== glideId) return;
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        range.value = Math.round(from + (target - from) * e);
        update(k === 1);
        if (k < 1) requestAnimationFrame(frame);
      })(t0);
    }
    range.addEventListener('pointerdown', function () { glideId++; tool.dataset.dragging = 'true'; });
    range.addEventListener('pointerup', function () { delete tool.dataset.dragging; });
    range.addEventListener('pointercancel', function () { delete tool.dataset.dragging; });
    // Native range supplies pointer capture, touch and all keyboard semantics.
    // No snapping, animation frame queue, transitions or deferred work on input.
    range.addEventListener('input', function () { update(false); });
    range.addEventListener('change', function () { update(true); });
    tool.querySelectorAll('input[name="dn-meat"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (!radio.checked || !data[radio.value] || !data[radio.value].length) return;
        meat = radio.value;
        tool.dataset.meat = meat;
        drawSteps();
        update(true);
      });
    });
    drawSteps();
    update(false);
    tool.dataset.dnReady = 'true';
    tool.hidden = false;
  });
})();
