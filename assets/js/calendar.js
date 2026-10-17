/* Browser-only calendar exports. Iceland uses UTC year-round; no TZID is needed.
 * Call download() directly from a user gesture. Nothing is sent or persisted.
 */
(function (root) {
  'use strict';

  var MINUTE = 60000;
  var DAY = 86400000;

  function string(value) {
    return value == null ? '' : String(value);
  }

  function text(value) {
    return string(value)
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }

  // URI and recurrence properties are not TEXT; disallow content-line injection.
  function singleLine(value) {
    return string(value).replace(/[\x00-\x1f\x7f]/g, '');
  }

  function clock(value) {
    if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
    return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  }

  function normalize(event) {
    var e = event || {};
    if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || e.date.slice(0, 4) === '0000') {
      throw new Error('Invalid date: expected a real calendar date in YYYY-MM-DD format');
    }
    var midnight = Date.parse(e.date + 'T00:00:00Z');
    if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== e.date) {
      throw new Error('Invalid date: expected a real calendar date in YYYY-MM-DD format');
    }
    var timed = e.time != null;
    var minutes = timed ? clock(e.time) : 0;
    if (minutes === null) throw new Error('Invalid time: expected HH:MM in the range 00:00–23:59');
    var duration = Number.isSafeInteger(e.durationMinutes) && e.durationMinutes > 0 ? e.durationMinutes : 30;
    var start = midnight + minutes * MINUTE;
    var end = start + (timed ? duration * MINUTE : DAY);
    // An unusable optional duration falls back to the documented 30 minutes.
    if (!Number.isFinite(new Date(end).getTime()) || end > Date.parse('9999-12-31T23:59:59Z')) {
      end = start + (timed ? 30 * MINUTE : DAY);
    }
    if (end > Date.parse('9999-12-31T23:59:59Z')) {
      throw new Error('Invalid date: YYYY-MM-DD event end must fit within years 0001–9999');
    }
    return { event: e, midnight: midnight, start: start, end: end, timed: timed };
  }

  function iso(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function stamp(ms) { return iso(ms).replace(/[-:]/g, ''); }
  function date(ms) { return iso(ms).slice(0, 10); }
  function compactDate(ms) { return date(ms).replace(/-/g, ''); }

  // Count UTF-8 octets per code point, including the continuation space.
  // for...of keeps surrogate pairs (e.g. emoji) together as well as Icelandic text.
  function fold(line) {
    var result = '';
    var bytes = 0;
    for (var ch of line) {
      var cp = ch.codePointAt(0);
      var size = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4;
      if (bytes + size > 75) {
        result += '\r\n ';
        bytes = 1;
      }
      result += ch;
      bytes += size;
    }
    return result;
  }

  function duration(minutes) {
    var sign = minutes < 0 ? '-' : '';
    var remaining = Math.abs(minutes);
    var days = Math.floor(remaining / 1440);
    var hours = Math.floor((remaining % 1440) / 60);
    var mins = remaining % 60;
    return sign + 'P' + (days ? days + 'D' : '') +
      (hours || mins || !days ? 'T' + (hours ? hours + 'H' : '') + (mins || !hours ? mins + 'M' : '') : '');
  }

  function alarms(n) {
    if (!Array.isArray(n.event.alarms)) return [];
    var result = [];
    n.event.alarms.forEach(function (alarm) {
      if (!alarm || typeof alarm !== 'object') return;
      var trigger;
      if (Number.isSafeInteger(alarm.daysBefore) && alarm.daysBefore >= 0) {
        var at = clock(alarm.at == null ? '10:00' : alarm.at);
        if (at === null) return; // Malformed optional alarms are ignored.
        var target = n.midnight - alarm.daysBefore * DAY + at * MINUTE;
        var offset = (target - n.start) / MINUTE;
        if (!Number.isSafeInteger(offset)) return;
        trigger = duration(offset);
      } else if (Number.isSafeInteger(alarm.minutesBefore) && alarm.minutesBefore >= 0) {
        trigger = '-PT' + alarm.minutesBefore + 'M';
      } else return;
      result.push('BEGIN:VALARM', 'TRIGGER:' + trigger, 'ACTION:DISPLAY',
        'DESCRIPTION:' + text(n.event.title || 'Kjöthúsið'), 'END:VALARM');
    });
    return result;
  }

  function uid(n) {
    if (n.event.uid) return text(n.event.uid);
    // Callers should supply the stable business UID. This deterministic fallback
    // still avoids a fresh random identity on every click for a minimal event.
    var key = string(n.event.title) + '|' + n.start;
    var hash = 2166136261;
    for (var i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    return 'event-' + (hash >>> 0).toString(16) + '@kjothusid.is';
  }

  function recurrence(e) { return singleLine(e.rrule).replace(/^RRULE:/i, ''); }

  function ics(event) {
    var n = normalize(event);
    var e = n.event;
    var output = [
      'BEGIN:VCALENDAR', 'PRODID:-//Kjöthúsið//kjothusid.is//IS', 'VERSION:2.0',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + uid(n), 'DTSTAMP:' + stamp(Date.now()),
      n.timed ? 'DTSTART:' + stamp(n.start) : 'DTSTART;VALUE=DATE:' + compactDate(n.start),
      n.timed ? 'DTEND:' + stamp(n.end) : 'DTEND;VALUE=DATE:' + compactDate(n.end),
      'SUMMARY:' + text(e.title || 'Kjöthúsið')
    ];
    if (e.description) output.push('DESCRIPTION:' + text(e.description));
    if (e.location) output.push('LOCATION:' + text(e.location));
    if (e.url) output.push('URL:' + singleLine(e.url));
    if (e.rrule) output.push('RRULE:' + recurrence(e));
    output = output.concat(alarms(n), ['END:VEVENT', 'END:VCALENDAR']);
    return output.map(fold).join('\r\n') + '\r\n';
  }

  function details(e) {
    var description = string(e.description);
    var url = string(e.url);
    return url && description.indexOf(url) === -1 ? description + (description ? '\n' : '') + url : description;
  }

  function googleUrl(event) {
    var n = normalize(event);
    var e = n.event;
    var url = new URL('https://calendar.google.com/calendar/render');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', e.title || 'Kjöthúsið');
    url.searchParams.set('dates', n.timed ? stamp(n.start) + '/' + stamp(n.end) : compactDate(n.start) + '/' + compactDate(n.end));
    url.searchParams.set('details', details(e));
    if (e.location) url.searchParams.set('location', e.location);
    if (e.rrule) url.searchParams.set('recur', 'RRULE:' + recurrence(e));
    return url.href;
  }

  // Outlook's public compose deeplink has no recurrence or alarm parameters:
  // this is intentionally the first occurrence. Use ICS for recurrence/alarms.
  function outlookUrl(event) {
    var n = normalize(event);
    var e = n.event;
    var url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
    url.searchParams.set('path', '/calendar/action/compose');
    url.searchParams.set('rru', 'addevent');
    url.searchParams.set('subject', e.title || 'Kjöthúsið');
    url.searchParams.set('body', details(e));
    if (e.location) url.searchParams.set('location', e.location);
    url.searchParams.set('startdt', n.timed ? iso(n.start) : date(n.start));
    url.searchParams.set('enddt', n.timed ? iso(n.end) : date(n.end));
    url.searchParams.set('allday', n.timed ? 'false' : 'true');
    return url.href;
  }

  function filename(value) {
    var stem = string(value).toLowerCase().replace(/(?:\.ics)+$/i, '')
      .replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae')
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/g, '');
    return (stem || 'calendar') + '.ics';
  }

  function download(event, name) {
    var content = ics(event); // Validate before touching the DOM or allocating a URL.
    var blob = new root.Blob([content], { type: 'text/calendar;charset=utf-8' });
    var url = root.URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    var nav = root.navigator || {};
    var ios = /iPad|iPhone|iPod/.test(nav.userAgent || '') ||
      (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
    a.href = url;
    a.type = 'text/calendar';
    a.style.display = 'none';
    if (ios) {
      // Let Safari handle the calendar MIME type in the current user gesture.
      // Omit download to request inline handling instead of a Files download.
      // A mock cannot prove the OS handoff: real iOS import remains a manual check.
      a.target = '_self';
    } else {
      a.download = filename(name == null ? event.title : name);
    }
    try {
      root.document.body.appendChild(a);
      a.click();
    } finally {
      if (a.parentNode) a.parentNode.removeChild(a);
      // Do not invalidate the blob while Safari is still consuming the resource.
      root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 60000);
    }
  }

  root.KjCal = { ics: ics, googleUrl: googleUrl, outlookUrl: outlookUrl, download: download };
})(typeof globalThis !== 'undefined' ? globalThis : window);
