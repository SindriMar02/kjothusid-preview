/* Refresh collection years between publishes, just like the order form. */
(function () {
  'use strict';
  var occasions = JSON.parse(document.getElementById('kj-occasions').textContent);
  var weekdays = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
  var months = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  function refresh() {
    var jol = occasions.find(function (o) { return o.key === 'jol'; });
    var year = KjOccasions.pickupDays(jol ? jol.pickupDays : ['12-23'])[0];
    if (year) document.querySelectorAll('[data-jol-year]').forEach(function (element) { element.textContent = year.slice(0, 4); });
    document.querySelectorAll('[data-occasion-days]').forEach(function (element) {
      var occasion = occasions.find(function (o) { return o.key === element.dataset.occasionDays; });
      var list = element.querySelector('ul');
      list.replaceChildren();
      KjOccasions.pickupDays(occasion.pickupDays).forEach(function (day) {
        var date = new Date(day + 'T12:00:00Z');
        var item = document.createElement('li');
        var weekday = document.createElement('span');
        weekday.className = 'occasion-card__weekday';
        weekday.textContent = weekdays[date.getUTCDay()];
        var value = document.createElement('span');
        value.textContent = date.getUTCDate() + '. ' + months[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
        item.append(weekday, document.createTextNode(' '), value);
        list.appendChild(item);
      });
    });
  }
  refresh();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
})();
