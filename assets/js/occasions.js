/* Shared by the static templates and the browser. Iceland uses UTC. */
(function (root) {
  'use strict';

  function validMonthDay(value) {
    if (typeof value !== 'string' || !/^\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date('2000-' + value + 'T12:00:00Z');
    return !isNaN(date) && date.toISOString().slice(5, 10) === value;
  }

  // Keep the whole next window in one year, including after its first day.
  // Elapsed days are filtered separately so a half-finished window stays useful.
  function pickupDays(days, today, earliest, weekdaysOnly) {
    today = today || new Date().toISOString().slice(0, 10);
    var allowed = (days || []).filter(function (day) {
      return validMonthDay(day) && day !== '12-24' && day !== '12-25';
    }).sort();
    if (!allowed.length) return [];
    var year = Number(today.slice(0, 4));
    if (year + '-' + allowed[allowed.length - 1] < today) year++;
    return allowed.map(function (day) { return year + '-' + day; }).filter(function (day, i, all) {
      var date = new Date(day + 'T12:00:00Z');
      return date.toISOString().slice(0, 10) === day && day >= (earliest || today) &&
        (!weekdaysOnly || (date.getUTCDay() !== 0 && date.getUTCDay() !== 6)) && all.indexOf(day) === i;
    });
  }

  root.KjOccasions = { pickupDays: pickupDays, validMonthDay: validMonthDay };
})(globalThis);
