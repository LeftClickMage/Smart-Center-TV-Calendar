// SMART Center TV Calendar — fetches the raw feeds from /api/feeds, builds the
// schedule in the browser and draws it.
import config from './config.js';
import { buildSchedule } from './js/schedule.js';

(function () {
  'use strict';

  var DAY_MS = 86400000;

  // Load Acumin Pro from Adobe Fonts if a web project link is configured.
  if (config.adobeFontsUrl) {
    var fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = config.adobeFontsUrl;
    document.head.appendChild(fontLink);
  }
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Display settings plus a flat list of every subject (for colors + legend).
  var viewConfig = Object.assign({}, config, {
    subjects: config.calendars.reduce(function (all, c) {
      return all.concat(c.subjects.map(function (s) { return Object.assign({}, s, { calendar: c.name }); }));
    }, [])
  });

  // Cycling shows one calendar at a time; merged multi-subject blocks don't
  // make sense then, so merging only applies when everything is shown at once.
  var cycling = config.cycleSeconds > 0;
  var buildConfig = Object.assign({}, config, { mergeSameTutor: config.mergeSameTutor && !cycling });

  var state = { data: null, lastOk: null, error: false, loadedAt: Date.now(), cycleIndex: 0 };
  var partsFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  // ── Time helpers (everything in the configured time zone) ────────────────
  function zoned(date) {
    var out = {};
    partsFormatter.formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    var y = +out.year, m = +out.month, d = +out.day;
    return {
      y: y, m: m, d: d,
      minutes: (+out.hour % 24) * 60 + +out.minute,
      key: y + '-' + pad(m) + '-' + pad(d),
      dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Calendar day `offset` days from y-m-d (pure date math, no DST issues).
  function addDays(y, m, d, offset) {
    var t = new Date(Date.UTC(y, m - 1, d + offset));
    var ty = t.getUTCFullYear(), tm = t.getUTCMonth() + 1, td = t.getUTCDate();
    return { y: ty, m: tm, d: td, dow: t.getUTCDay(), key: ty + '-' + pad(tm) + '-' + pad(td) };
  }

  function visibleDays(cfg, today) {
    var days = [], i;
    if (cfg.displayMode === 'rolling') {
      // Today onward, skipping hidden days, until we have rollingDays days.
      var want = cfg.rollingDays || 6;
      var hidden = cfg.hiddenDays || [];
      if (hidden.length >= 7) hidden = [];
      for (i = 0; days.length < want; i++) {
        var day = addDays(today.y, today.m, today.d, i);
        if (hidden.indexOf(DAY_NAMES[day.dow]) === -1) days.push(day);
      }
      return days;
    }
    // Sunday–Friday; on Saturday, jump ahead to the coming week.
    var toSunday = today.dow === 6 ? 1 : -today.dow;
    for (i = 0; i < 6; i++) days.push(addDays(today.y, today.m, today.d, toSunday + i));
    return days;
  }

  function fmtClock(minutes, withMeridiem) {
    var h = Math.floor(minutes / 60) % 24, m = minutes % 60;
    var mer = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad(m) + (withMeridiem ? ' ' + mer : '');
  }

  function fmtRange(startMin, endMin) {
    var sameHalf = (startMin < 720) === (endMin < 720);
    return fmtClock(startMin, !sameHalf) + '–' + fmtClock(endMin, true);
  }

  function hourLabel(h) {
    if (h === 12) return '12 PM';
    if (h === 0 || h === 24) return '12 AM';
    return (h % 12) + (h < 12 ? ' AM' : ' PM');
  }

  // ── Layout: place overlapping blocks side by side ────────────────────────
  function layoutDay(items) {
    items.sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); });
    var clusters = [], cur = null, curEnd = -1;
    items.forEach(function (it) {
      if (!cur || it.s >= curEnd) { cur = []; clusters.push(cur); curEnd = it.e; }
      cur.push(it);
      curEnd = Math.max(curEnd, it.e);
    });
    clusters.forEach(function (group) {
      var laneEnds = [];
      group.forEach(function (it) {
        var lane = 0;
        while (lane < laneEnds.length && laneEnds[lane] > it.s) lane++;
        laneEnds[lane] = it.e;
        it.lane = lane;
      });
      var lanes = laneEnds.length;
      group.forEach(function (it) {
        // Stretch right into lanes that stay free for this block's whole time.
        var span = 1;
        for (var l = it.lane + 1; l < lanes; l++) {
          var blocked = group.some(function (o) { return o.lane === l && o.s < it.e && o.e > it.s; });
          if (blocked) break;
          span++;
        }
        it.left = it.lane / lanes;
        it.width = span / lanes;
      });
    });
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderStatic(cfg) {
    document.documentElement.style.setProperty('--scale', cfg.fontScale || 1);
    document.getElementById('title').textContent = cfg.header.title;
    var subtitle = document.getElementById('subtitle');
    if (cfg.header.subtitleImage) {
      var img = el('img', 'subtitle-img');
      img.src = cfg.header.subtitleImage;
      img.alt = cfg.header.subtitle;
      subtitle.appendChild(img);
    } else {
      subtitle.textContent = cfg.header.subtitle;
    }
    var logo = document.getElementById('logo');
    if (cfg.header.logo) logo.src = cfg.header.logo; else logo.hidden = true;

    var legend = document.getElementById('legend');
    legend.innerHTML = '';
    cfg.subjects.forEach(function (s) {
      var li = el('li', null, s.label);
      li.style.background = s.color;
      li.style.color = s.text;
      li.setAttribute('data-calendar', s.calendar);
      legend.appendChild(li);
    });
  }

  // Events (optionally only one calendar's) bucketed into the visible days and
  // clipped to the display hours. Returns { days, byDay, count }.
  function bucketEvents(calendarName, now) {
    var cfg = state.data.config;
    var days = visibleDays(cfg, zoned(now));
    var startMin = cfg.dayStartHour * 60, endMin = cfg.dayEndHour * 60;
    var byDay = {}, count = 0;
    days.forEach(function (d) { byDay[d.key] = []; });
    state.data.events.forEach(function (ev) {
      if (calendarName && ev.calendar !== calendarName) return;
      var start = new Date(ev.start), end = new Date(ev.end);
      var zs = zoned(start), ze = zoned(end);
      if (!byDay[zs.key]) return;
      var s = zs.minutes;
      var e = ze.key === zs.key ? ze.minutes : 1440;
      var cs = Math.max(s, startMin), ce = Math.min(e, endMin);
      if (ce <= cs) return;
      byDay[zs.key].push({ ev: ev, s: cs, e: ce, realS: s, realE: e, past: end <= now });
      count++;
    });
    return { days: days, byDay: byDay, count: count };
  }

  // The calendar currently on screen when cycling (null = show all).
  function currentCalendar() {
    if (!cycling) return null;
    return config.calendars[state.cycleIndex % config.calendars.length].name;
  }

  // Index of the first calendar, `fromStep` places after the current one,
  // that has sessions in the visible days. Stays put if none do.
  function nextShowable(fromStep, now) {
    var n = config.calendars.length;
    for (var step = fromStep; step < fromStep + n; step++) {
      var idx = (state.cycleIndex + step) % n;
      if (bucketEvents(config.calendars[idx].name, now).count > 0) return idx;
    }
    return state.cycleIndex;
  }

  function advanceCycle() {
    if (!state.data) return;
    state.cycleIndex = nextShowable(1, new Date());
    render();
  }

  function render() {
    var data = state.data;
    if (!data) return;
    var cfg = data.config;
    var now = new Date();
    var today = zoned(now);
    // Make sure the calendar on screen still has sessions (data or week may
    // have changed since the last switch).
    if (cycling) state.cycleIndex = nextShowable(0, now);
    var calName = currentCalendar();
    var bucket = bucketEvents(calName, now);
    var days = bucket.days, byDay = bucket.byDay;
    var startMin = cfg.dayStartHour * 60, endMin = cfg.dayEndHour * 60;
    var span = endMin - startMin;
    var subjects = {};
    cfg.subjects.forEach(function (s) { subjects[s.key] = s; });

    // Legend: highlight the calendar on screen, dim the rest.
    var chips = document.querySelectorAll('#legend li');
    for (var c = 0; c < chips.length; c++) {
      var mine = !calName || chips[c].getAttribute('data-calendar') === calName;
      chips[c].className = calName ? (mine ? 'active' : 'inactive') : '';
    }

    var root = document.getElementById('schedule');
    root.className = 'schedule' + (calName !== state.lastShown ? ' fade' : '');
    state.lastShown = calName;
    root.innerHTML = '';
    // Today's column is todayWidth times as wide as the other days.
    var todayWidth = cfg.todayWidth || 1;
    root.style.gridTemplateColumns = 'var(--axis-w) ' + days.map(function (d) {
      return 'minmax(0, ' + (d.key === today.key ? todayWidth : 1) + 'fr)';
    }).join(' ');
    root.style.setProperty('--hours', span / 60);

    root.appendChild(el('div', 'corner'));
    days.forEach(function (d) {
      var head = el('div', 'day-head' + (d.key === today.key ? ' today' : ''));
      head.appendChild(el('span', 'dow', d.key === today.key ? 'Today' : DAY_NAMES[d.dow]));
      head.appendChild(el('span', 'date', d.m + '/' + d.d));
      root.appendChild(head);
    });

    var axis = el('div', 'axis');
    for (var h = cfg.dayStartHour; h <= cfg.dayEndHour; h++) {
      var lab = el('div', 'axis-label', hourLabel(h));
      var pct = ((h * 60 - startMin) / span) * 100;
      lab.style.top = pct + '%';
      if (h === cfg.dayStartHour) lab.style.transform = 'translateY(0.2vh)';
      if (h === cfg.dayEndHour) lab.style.transform = 'translateY(-110%)';
      axis.appendChild(lab);
    }
    root.appendChild(axis);

    days.forEach(function (d) {
      var col = el('div', 'day-col' + (d.key === today.key ? ' today' : ''));
      var items = byDay[d.key];
      layoutDay(items);
      items.forEach(function (it) { col.appendChild(renderEvent(it, subjects, cfg, startMin, span)); });

      if (d.key === today.key && today.minutes >= startMin && today.minutes <= endMin) {
        var line = el('div', 'now-line');
        line.style.top = ((today.minutes - startMin) / span) * 100 + '%';
        col.appendChild(line);
      }
      root.appendChild(col);
    });

    renderClock(today);
    renderStatus();
  }

  function renderEvent(it, subjects, cfg, startMin, span) {
    var ev = it.ev;
    var box = el('div', 'event');
    box.style.top = ((it.s - startMin) / span) * 100 + '%';
    box.style.height = ((it.e - it.s) / span) * 100 + '%';
    box.style.left = it.left * 100 + '%';
    box.style.width = it.width * 100 + '%';
    if (cfg.dimPastSessions && it.past) box.className += ' past';

    var inner = el('div', 'event-inner');
    var subs = ev.subjects.map(function (k) { return subjects[k]; }).filter(Boolean);
    inner.appendChild(el('div', 'event-name', ev.name));

    if (subs.length > 1) {
      box.className += ' multi';
      var tags = el('div', 'tags');
      subs.forEach(function (s) {
        var t = el('span', 'tag', s.short);
        t.style.background = s.color;
        t.style.color = s.text;
        tags.appendChild(t);
      });
      inner.appendChild(tags);
    } else if (subs.length === 1) {
      inner.style.background = subs[0].color;
      inner.style.color = subs[0].text;
    }

    inner.appendChild(el('div', 'event-time', fmtRange(it.realS, it.realE)));
    if (ev.courses.length) inner.appendChild(el('div', 'event-course', ev.courses.join(' · ')));
    box.appendChild(inner);
    return box;
  }

  function renderClock(today) {
    document.getElementById('clock-time').textContent = fmtClock(today.minutes, true);
    document.getElementById('clock-date').textContent =
      DAY_NAMES[today.dow] + ', ' + MONTHS[today.m - 1] + ' ' + today.d;
  }

  function renderStatus() {
    var status = document.getElementById('status');
    var data = state.data;
    var stale = data.staleCalendars || [];
    // Normally empty; only speaks up when something is wrong.
    if (state.error) {
      var since = state.lastOk ? ' from ' + fmtClock(zoned(state.lastOk).minutes, true) : '';
      status.className = 'status warn';
      status.textContent = 'Can’t reach the schedule server — showing info' + since;
    } else if (stale.length) {
      status.className = 'status warn';
      status.textContent = 'Couldn’t refresh: ' + stale.join(', ');
    } else {
      status.className = 'status';
      status.textContent = '';
    }
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  function load() {
    fetch('/api/feeds', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (payload) {
        var first = !state.data;
        // A generous window; render() picks the exact days to show.
        var now = Date.now();
        var built = buildSchedule(buildConfig, payload.feeds, new Date(now - 2 * DAY_MS), new Date(now + ((config.rollingDays || 6) + 3 + 7) * DAY_MS));
        state.data = { config: viewConfig, events: built.events, staleCalendars: built.problems };
        state.lastOk = new Date();
        state.error = false;
        if (first) renderStatic(viewConfig);
        render();
        schedule(config.refreshMinutes * 60000);
      })
      .catch(function (err) {
        console.error('Schedule load failed:', err);
        state.error = true;
        if (state.data) render();
        else document.getElementById('loading').textContent = 'Can’t load the schedule — retrying…';
        schedule(60000);
      });
  }

  var timer = null;
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(load, ms);
  }

  // Redraw every 30 s so the clock, current-time line and fading stay current
  // and the week rolls over on its own.
  setInterval(render, 30000);

  // Switch to the next calendar every cycleSeconds.
  if (cycling) setInterval(advanceCycle, config.cycleSeconds * 1000);

  // Reload the whole page once a day (around 3 AM) to pick up any updates.
  setInterval(function () {
    var z = zoned(new Date());
    if (z.minutes >= 180 && z.minutes < 190 && Date.now() - state.loadedAt > 3600000) location.reload();
  }, 5 * 60000);

  load();
})();
