/* Refresh collection years between publishes, just like the order form. */
(function () {
  'use strict';
  var occasions = JSON.parse(document.getElementById('kj-occasions').textContent);
  var weekdays = ['sunnudagur', 'mánudagur', 'þriðjudagur', 'miðvikudagur', 'fimmtudagur', 'föstudagur', 'laugardagur'];
  var months = ['janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní', 'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'];
  function refresh() {
    document.querySelectorAll('[data-occasion-days]').forEach(function (element) {
      var occasion = occasions.find(function (o) { return o.key === element.dataset.occasionDays; });
      var list = element.querySelector('ul');
      list.replaceChildren();
      KjOccasions.pickupDays(occasion.pickupDays).forEach(function (day) {
        var date = new Date(day + 'T12:00:00Z');
        var item = document.createElement('li');
        item.textContent = weekdays[date.getUTCDay()] + ' ' + date.getUTCDate() + '. ' + months[date.getUTCMonth()] + ' ' + date.getUTCFullYear();
        list.appendChild(item);
      });
    });
  }
  refresh();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
})();
