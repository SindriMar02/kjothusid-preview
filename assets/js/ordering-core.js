/* Pure ordering rules shared by the browser and Node tests. Iceland uses UTC. */
(function (root) {
  'use strict';
  var weekdays = ['SUN.', 'MÁN.', 'ÞRI.', 'MIÐ.', 'FIM.', 'FÖS.', 'LAU.'];
  var months = [
    'JAN.',
    'FEB.',
    'MARS',
    'APR.',
    'MAÍ',
    'JÚN.',
    'JÚL.',
    'ÁGÚ.',
    'SEP.',
    'OKT.',
    'NÓV.',
    'DES.'
  ];
  function iso(date) {
    return date.toISOString().slice(0, 10);
  }
  function weekend(date) {
    return date.getUTCDay() === 0 || date.getUTCDay() === 6;
  }
  function dayTiles(options) {
    var today = options.today;
    var date = new Date(today + 'T12:00:00Z');
    var left = options.noticeDays || 1;
    while (left > 0 || (options.weekdaysOnly && weekend(date))) {
      date.setUTCDate(date.getUTCDate() + 1);
      if (!(options.weekdaysOnly && weekend(date))) left--;
    }
    var first = iso(date),
      end = new Date(today + 'T12:00:00Z');
    end.setUTCDate(end.getUTCDate() + 60);
    var days = [];
    if (options.occasionDays) {
      days = options.occasionDays.filter(function (day) {
        return day >= first;
      });
    } else {
      while (date <= end) {
        var value = iso(date);
        if (
          (!options.weekdaysOnly || !weekend(date)) &&
          (options.banned || []).indexOf(value) < 0
        )
          days.push(value);
        date.setUTCDate(date.getUTCDate() + 1);
      }
    }
    return days.map(function (day) {
      var d = new Date(day + 'T12:00:00Z');
      return {
        value: day,
        weekday: weekdays[d.getUTCDay()],
        date: d.getUTCDate(),
        month: months[d.getUTCMonth()],
        selected: day === options.selected
      };
    });
  }
  function snapshot(lines, now) {
    return {
      expires: now + 30000,
      lines: lines.map(function (line) {
        return Object.assign({}, line);
      })
    };
  }
  function restore(saved, now) {
    return saved && saved.expires > now && Array.isArray(saved.lines)
      ? saved.lines.map(function (line) {
          return Object.assign({}, line);
        })
      : null;
  }
  function fold(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ð/g, 'd')
      .replace(/þ/g, 'th')
      .replace(/æ/g, 'ae');
  }
  root.KJOrdering = {
    dayTiles: dayTiles,
    snapshot: snapshot,
    restore: restore,
    fold: fold
  };
})(globalThis);
