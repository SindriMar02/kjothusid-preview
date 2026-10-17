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
    var label = tool.querySelector('[data-dn-label]');
    var reference = tool.querySelector('[data-dn-reference]');
    var steps = tool.querySelector('[data-dn-steps]');
    var ticks = tool.querySelector('[data-dn-ticks]');
    var status = tool.querySelector('[data-dn-status]');
    var meat = 'beef';
    var buttons = [];
    var min = Number(range.min), max = Number(range.max);
    tool.style.setProperty('--dn-divisions', String(max - min));
    var colours = [[139, 43, 52], [187, 68, 76], [210, 124, 126], [182, 137, 114], [140, 116, 92]];
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
    function colour(p) {
      var n = Math.max(0, Math.min(1, p)) * (colours.length - 1);
      var i = Math.min(colours.length - 2, Math.floor(n));
      return 'rgb(' + colours[i].map(function (v, j) { return Math.round(v + (colours[i + 1][j] - v) * (n - i)); }).join(',') + ')';
    }
    function update(announce) {
      var t = Number(range.value), hit = currentRow(t);
      var name = hit ? shortName(hit) : 'Hrátt';
      var p = progress(t);
      output.textContent = t;
      label.textContent = name;
      reference.textContent = hit ? (hit.range || hit.celsius) + ' °C í töflu' : 'Neðan við fyrsta töflugildi';
      var description = t + ' gráður, ' + (meat === 'beef' ? 'naut' : 'lamb') + ', ' + name;
      if (hit && hit.range) description += '. Töflugildi ' + hit.range + ' gráður';
      range.setAttribute('aria-valuetext', description);
      tool.style.setProperty('--dn-core', colour(p));
      tool.style.setProperty('--dn-band', colour(Math.min(1, p + .38)));
      tool.style.setProperty('--dn-core-scale', String(1 - .38 * p));
      tool.style.setProperty('--dn-position', String((t - min) / (max - min) * 100) + '%');
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
        ticks.append(tick);
        return button;
      });
    }
    // A tapped step glides the thermometer there (the numbers count, the meat
    // cooks or cools), ~420 ms ease-out. Dragging stays direct: no tween on input.
    var reduce = typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canAnimate = typeof requestAnimationFrame === 'function' && typeof performance !== 'undefined';
    var glideId = 0;
    function glide(target) {
      var from = Number(range.value);
      if (reduce || !canAnimate || from === target) { range.value = target; update(true); return; }
      var id = ++glideId, t0 = performance.now(), dur = 420;
      (function frame(now) {
        if (id !== glideId) return;
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        range.value = Math.round(from + (target - from) * e);
        update(k === 1);
        if (k < 1) requestAnimationFrame(frame);
      })(t0);
    }
    range.addEventListener('pointerdown', function () { glideId++; });
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
