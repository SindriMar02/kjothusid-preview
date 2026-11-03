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
    'DES.',
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
        return (
          day >= first &&
          day <= iso(end) &&
          (!options.weekdaysOnly || !weekend(new Date(day + 'T12:00:00Z'))) &&
          (options.banned || []).indexOf(day) < 0
        );
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
        selected: day === options.selected,
      };
    });
  }
  function snapshot(lines, now) {
    return {
      expires: now + 30000,
      lines: lines.map(function (line) {
        return Object.assign({}, line);
      }),
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
  function icon(name) {
    return (
      '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>'
    );
  }
  // Wishes are never clipped. Reject an oversized wish block before submission.
  function mergeNotes(lines, notes) {
    var wishes = lines
      .filter(function (line) {
        return line.w && line.w.trim();
      })
      .map(function (line) {
        return line.n + ': ' + line.w.trim();
      })
      .join('\n');
    if (wishes.length > 2000) throw new RangeError('wish-limit');
    var room = 2000 - wishes.length;
    var own = String(notes || '').trim();
    return (
      wishes +
      (own && room > (wishes ? 1 : 0)
        ? (wishes ? '\n' : '') + own.slice(0, room - (wishes ? 1 : 0))
        : '')
    );
  }
  function done(lines, date, time, name, email, phone, sent) {
    return [
      !!lines.length,
      !!(date && time),
      !!(
        name.trim() &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        phone.replace(/\D/g, '').length >= 7 &&
        !/[^\d\s+()-]/.test(phone)
      ),
      !!sent,
    ];
  }
  function dropdownRows(season, count) {
    return 1 + (season ? 2 : 0) + (count ? 1 : 0);
  }
  // The unit sits inside the amount box as one small button: it shows the current unit and
  // a tap switches to the other (the amount converts, 0,5 kg is 500 g). Sindri 11-03: the
  // control from before, centred on the number's line.
  function units(unit, attr, name) {
    var other = unit === 'g' ? 'kg' : 'g';
    return (
      '<button type="button" class="unit-toggle" ' +
      attr +
      '="' +
      other +
      '" aria-label="Skipta í ' +
      (other === 'g' ? 'grömm' : 'kíló') +
      ', núna ' +
      (unit === 'g' ? 'grömm' : 'kíló') +
      ' af ' +
      name +
      '" title="Skipta í ' +
      other +
      '">' +
      unit +
      '</button>'
    );
  }
  function validRemember(value) {
    var string = function (v) {
      return typeof v === 'string';
    };
    var stamp = function (v) {
      return string(v) && Number.isFinite(Date.parse(v));
    };
    var time = function (v) {
      return string(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
    };
    if (
      !value ||
      value.v !== 1 ||
      !stamp(value.savedAt) ||
      !value.contact ||
      !value.slot ||
      !Array.isArray(value.orders)
    )
      return false;
    if (
      !['name', 'email', 'phone', 'company', 'kennitala'].every(function (key) {
        return string(value.contact[key]);
      }) ||
      typeof value.contact.isCompany !== 'boolean'
    )
      return false;
    if (
      !Number.isInteger(value.slot.weekday) ||
      value.slot.weekday < 0 ||
      value.slot.weekday > 6 ||
      !time(value.slot.time) ||
      value.orders.length > 5
    )
      return false;
    return value.orders.every(function (order) {
      return (
        order &&
        string(order.ref) &&
        stamp(order.sentAt) &&
        [null, 'jol', 'aramot'].indexOf(order.occasion) >= 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(order.date) &&
        time(order.time) &&
        Array.isArray(order.lines) &&
        order.lines.length <= 80 &&
        order.lines.every(function (line) {
          return (
            line &&
            string(line.k) &&
            string(line.n) &&
            Number.isFinite(line.q) &&
            line.q > 0 &&
            line.q <= 10000 &&
            ['kg', 'g', 'stk'].indexOf(line.u) >= 0 &&
            string(line.w) &&
            line.w.length <= 140
          );
        })
      );
    });
  }
  function readRemember(storage) {
    try {
      var raw = storage.getItem('kj-muna');
      if (!raw) return null;
      var value = JSON.parse(raw);
      if (!validRemember(value) || new TextEncoder().encode(raw).length > 51200)
        throw new Error('invalid');
      return value;
    } catch (error) {
      try {
        storage.removeItem('kj-muna');
      } catch (ignored) {}
      return null;
    }
  }
  function remember(previous, contact, order, checked, now) {
    if (!checked) return null;
    var clean = {
      ref: order.ref,
      sentAt: now,
      occasion: order.occasion || null,
      date: order.date,
      time: order.time,
      lines: order.lines.map(function (line) {
        return { k: line.k, n: line.n, q: line.q, u: line.u, w: line.w || '' };
      }),
    };
    var value = {
      v: 1,
      savedAt: now,
      contact: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        kennitala: contact.kennitala,
        isCompany: !!contact.isCompany,
      },
      orders: [clean]
        .concat(previous && validRemember(previous) ? previous.orders : [])
        .sort(function (a, b) {
          return Date.parse(b.sentAt) - Date.parse(a.sentAt);
        })
        .slice(0, 5),
      slot: {
        weekday: new Date(order.date + 'T12:00:00Z').getUTCDay(),
        time: order.time,
      },
    };
    while (
      value.orders.length &&
      new TextEncoder().encode(JSON.stringify(value)).length > 51200
    )
      value.orders.pop();
    return value;
  }
  function mergeRemember(basket, order, catalogue, seasonal) {
    var lines = basket.map(function (line) {
      return Object.assign({}, line);
    });
    var skipped = [];
    order.lines.forEach(function (line) {
      var item = catalogue.find(function (item) {
        return item.k === line.k;
      });
      if (!item || (!seasonal && item.c === 'Jólavörur')) {
        skipped.push(line.n);
        return;
      }
      var clean = { k: item.k, n: item.n, q: line.q, u: line.u, w: line.w };
      var at = lines.findIndex(function (item) {
        return item.k === line.k;
      });
      if (at < 0) lines.push(clean);
      else lines[at] = clean;
    });
    return {
      lines: lines,
      skipped: skipped,
      count: order.lines.length - skipped.length,
    };
  }
  function nextSlot(slot, options) {
    if (!slot || (options.times || []).indexOf(slot.time) < 0) return null;
    var day = dayTiles(options).find(function (day) {
      return new Date(day.value + 'T12:00:00Z').getUTCDay() === slot.weekday;
    });
    return day ? { date: day.value, time: slot.time } : null;
  }
  root.KJOrdering = {
    validRemember: validRemember,
    readRemember: readRemember,
    remember: remember,
    mergeRemember: mergeRemember,
    nextSlot: nextSlot,
    icon: icon,
    units: units,
    mergeNotes: mergeNotes,
    done: done,
    dropdownRows: dropdownRows,
    dayTiles: dayTiles,
    snapshot: snapshot,
    restore: restore,
    fold: fold,
  };
})(globalThis);
