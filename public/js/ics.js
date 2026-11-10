// Parse an Outlook ICS feed and expand every event (including weekly
// repeats, skipped dates and one-off edits) into concrete occurrences.
import ICAL from '../vendor/ical.min.js'; // ical.js 2.2.1 (MPL-2.0)

/**
 * @param {string} icsText  raw contents of a calendar.ics feed
 * @param {Date} rangeStart  only occurrences ending after this are returned
 * @param {Date} rangeEnd    only occurrences starting before this are returned
 * @returns {{uid:string,title:string,description:string,location:string,start:Date,end:Date}[]}
 */
export function expandIcs(icsText, rangeStart, rangeEnd) {
  const root = new ICAL.Component(ICAL.parse(icsText));

  // Outlook names its zones "Eastern Standard Time" and ships the rules
  // inline, so register each VTIMEZONE before reading any dates.
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    const tz = new ICAL.Timezone(vtz);
    if (!ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz.tzid, tz);
  }

  // Group the master event with its one-off edits (same UID + RECURRENCE-ID).
  const masters = new Map();
  const orphans = [];
  const vevents = root.getAllSubcomponents('vevent');
  for (const ve of vevents) {
    if (!ve.hasProperty('recurrence-id')) masters.set(ve.getFirstPropertyValue('uid'), new ICAL.Event(ve));
  }
  for (const ve of vevents) {
    if (!ve.hasProperty('recurrence-id')) continue;
    const master = masters.get(ve.getFirstPropertyValue('uid'));
    if (master) master.relateException(new ICAL.Event(ve));
    else orphans.push(new ICAL.Event(ve));
  }

  const out = [];
  const push = (ev, start, end) => {
    const s = start.toJSDate();
    const e = end.toJSDate();
    if (e <= rangeStart || s >= rangeEnd) return;
    if (ev.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    out.push({
      uid: ev.uid,
      title: (ev.summary || '').trim(),
      description: (ev.description || '').trim(),
      location: (ev.location || '').trim(),
      start: s,
      end: e,
    });
  };

  for (const ev of [...masters.values(), ...orphans]) {
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate);
      continue;
    }
    const it = ev.iterator();
    for (let next = it.next(); next; next = it.next()) {
      if (next.toJSDate() >= rangeEnd) break;
      const occ = ev.getOccurrenceDetails(next);
      push(occ.item, occ.startDate, occ.endDate);
    }
  }
  return out;
}
