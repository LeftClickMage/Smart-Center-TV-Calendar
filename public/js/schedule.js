// Turn the raw Outlook feeds into the list of tutor blocks the TV draws.
import { expandIcs } from './ics.js';

// "Davyd: CHEM" -> { name: "Davyd", label: "CHEM" }
function parseTitle(title) {
  const i = title.indexOf(':');
  if (i === -1) return { name: title.trim(), label: '' };
  return { name: title.slice(0, i).trim(), label: title.slice(i + 1).trim() };
}

function pickSubject(calendar, title) {
  const { subjects } = calendar;
  if (subjects.length === 1) return subjects[0].key;
  const hit = subjects.find((s) => s.match && s.match.test(title));
  return hit ? hit.key : calendar.defaultSubject || subjects[0].key;
}

const COURSE_RE = /\b([A-Za-z]{2,5})\s?(\d{3,5})\b(.*)$/;
const TIME_RANGE_RE = /\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\.?/gi;

// Pull "PHYS 172 — Modern Mechanics" out of text like
// "Christopher Ulate — Phys 172 — Modern Mechanics".
function extractCourse(text) {
  const m = COURSE_RE.exec(text.replace(TIME_RANGE_RE, ' '));
  if (!m) return '';
  const rest = m[3].replace(/^[\s—–-]+/, '').replace(/[\s—–.-]+$/, '').replace(/\s+/g, ' ');
  return `${m[1].toUpperCase()} ${m[2]}${rest ? ` — ${rest}` : ''}`;
}

// Each Outlook event is one tutor; its title and times are the source of
// truth. Descriptions are free-form notes that often list other tutors (and
// out-of-date times), so only a line starting with this tutor's name is used,
// and only to find the course.
function findCourse(name, label, description) {
  const fromTitle = extractCourse(label);
  if (fromTitle) return fromTitle;
  const lower = name.toLowerCase();
  for (const line of description.split(/\r?\n/)) {
    if (line.trim().toLowerCase().startsWith(lower)) {
      const course = extractCourse(line.trim().slice(name.length));
      if (course) return course;
    }
  }
  return '';
}

/**
 * @param config  public/config.js
 * @param feeds   [{ name, ics, stale }] from /api/feeds, same order as config.calendars
 * @returns {{ events: {name,start:Date,end:Date,subjects:string[],courses:string[]}[], problems: string[] }}
 */
export function buildSchedule(config, feeds, from, to) {
  const subjectOrder = config.calendars.flatMap((c) => c.subjects.map((s) => s.key));
  const blocks = [];
  const problems = [];

  config.calendars.forEach((calendar, i) => {
    const feed = feeds[i];
    if (!feed || feed.stale) problems.push(calendar.name);
    if (!feed || !feed.ics) return;
    let events;
    try {
      events = expandIcs(feed.ics, from, to);
    } catch (err) {
      console.error(`[parse] ${calendar.name}:`, err);
      if (!problems.includes(calendar.name)) problems.push(calendar.name);
      return;
    }
    for (const ev of events) {
      const { name, label } = parseTitle(ev.title);
      if (!name) continue;
      blocks.push({
        calendar: calendar.name,
        name,
        start: ev.start,
        end: ev.end,
        subjects: [pickSubject(calendar, ev.title)],
        courses: [findCourse(name, label, ev.description)].filter(Boolean),
      });
    }
  });

  const events = config.mergeSameTutor ? mergeSameTutor(blocks) : blocks;
  for (const b of events) b.subjects.sort((a, c) => subjectOrder.indexOf(a) - subjectOrder.indexOf(c));
  events.sort((a, b) => a.start - b.start || b.end - a.end || a.name.localeCompare(b.name));
  return { events, problems };
}

// Same person, same start and end time -> one block listing every subject.
function mergeSameTutor(blocks) {
  const byKey = new Map();
  for (const b of blocks) {
    const key = `${b.name.toLowerCase()}|${+b.start}|${+b.end}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...b, subjects: [...b.subjects], courses: [...b.courses] });
      continue;
    }
    for (const s of b.subjects) if (!existing.subjects.includes(s)) existing.subjects.push(s);
    for (const c of b.courses) if (!existing.courses.includes(c)) existing.courses.push(c);
  }
  return [...byKey.values()];
}
