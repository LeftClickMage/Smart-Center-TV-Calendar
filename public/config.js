// ─────────────────────────────────────────────────────────────────────────────
//  SMART Center TV Calendar — settings
//  Edit this file and push to GitHub; Cloudflare Pages redeploys on its own
//  and the TVs pick up the change at their next daily reload (or refresh).
// ─────────────────────────────────────────────────────────────────────────────

// ── Calendar colors ──────────────────────────────────────────────────────────
// background = block fill color, text = font color on that block.
const CHEMISTRY_COLOR        = '#CFB991'; // CMYK 13 20 45 3 / RGB 207 185 145
const CHEMISTRY_TEXT         = '#000000';

const COMPUTER_SCIENCE_COLOR = '#9D9795';
const COMPUTER_SCIENCE_TEXT  = '#000000';

const MATH_STANDARD_COLOR    = '#EBD99F'; // CMYK 3 8 43 0 / RGB 235 217 159
const MATH_STANDARD_TEXT     = '#000000';

const MATH_ADVANCED_COLOR    = '#DAAA00'; // CMYK 0 20 100 8 / RGB 218 170 0
const MATH_ADVANCED_TEXT     = '#000000';

const PHYSICS_COLOR          = '#555960';
const PHYSICS_TEXT           = '#FFFFFF';

const STATISTICS_COLOR       = '#8E6F3E';
const STATISTICS_TEXT        = '#FFFFFF';

// ── Published Outlook calendar feeds ─────────────────────────────────────────
// Use the outlook.office365.com/owa/calendar/... form ending in calendar.ics.
// (The outlook.cloud.microsoft/... form only works for the HTML page.)
const FEED_BASE = 'https://outlook.office365.com/owa/calendar/6a501ef441f64318bb404190a37d0aa7@purdue.edu';

export default {
  // ── What to show ───────────────────────────────────────────────────────────
  // 'rolling' = today and the upcoming days (no past days); slides forward
  //             one day at midnight
  // 'week'    = Sunday–Friday of the current week (on Saturday it shows next week)
  displayMode: 'rolling',

  // 'rolling' only: how many days to show, and which days to leave out.
  // e.g. on a Thursday: Thu, Fri, Sun, Mon, Tue, Wed.
  rollingDays: 6,
  hiddenDays: ['Saturday'],

  // How much wider today's column is than the other days (1 = same width).
  todayWidth: 2,

  // Hours shown on the grid (24-hour clock). 10 → 10 AM, 20 → 8 PM.
  dayStartHour: 10,
  dayEndHour: 20,

  // Time zone used for the grid, regardless of the TV's own clock setting.
  timeZone: 'America/Indiana/Indianapolis',

  // Show one calendar at a time (Chemistry → Computer Science → Math →
  // Physics → Statistics), switching every this many seconds.
  // 0 = show every calendar at once. Calendars with no sessions in the
  // visible days are skipped.
  cycleSeconds: 5,

  // Only used when cycleSeconds is 0: show one tutor working several subjects
  // at the same time as a single block tagged with each subject (true), or as
  // separate blocks (false).
  mergeSameTutor: true,

  // Fade out sessions that have already ended.
  dimPastSessions: true,

  // Make all text bigger or smaller (1 = default sizing for a 50" 1080p/4K TV).
  fontScale: 1,

  // Font: Acumin Pro. It's a licensed Adobe font, so the TVs need an Adobe
  // Fonts web project link to load it. Create one at fonts.adobe.com
  // (Web Projects → add Acumin Pro, Regular + Bold) and paste the CSS link,
  // e.g. 'https://use.typekit.net/abc1234.css'. Leave empty to use Acumin Pro
  // only where it's installed, and a similar font everywhere else.
  adobeFontsUrl: 'https://use.typekit.net/awh5tdn.css',

  // How often to pull fresh data from Outlook (minutes).
  refreshMinutes: 5,

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    title: 'Science and Mathematics Academic Resource and Tutoring Center',
    subtitle: 'SMART Center',
    // "SMART Center" pre-drawn in United Sans Heavy, Purdue Gold, so it looks
    // right on every TV without the font installed. Set to '' to use plain text.
    subtitleImage: '/assets/smart-center-title.svg',
    logo: '/assets/cos-logo-reverse.svg', // white-text logo for the black header
  },

  // ── Calendars ──────────────────────────────────────────────────────────────
  // Each calendar produces one or more "subjects" (color + legend entry).
  // Math is split by the words "Standard" / "Advanced" in the event title;
  // math events with neither word use `defaultSubject`.
  calendars: [
    {
      name: 'Chemistry',
      url: `${FEED_BASE}/8718e39f3a9b46a4b575da3b1f30445414879568777023687763/calendar.ics`,
      subjects: [{ key: 'chemistry', label: 'Chemistry', short: 'CHEM', color: CHEMISTRY_COLOR, text: CHEMISTRY_TEXT }],
    },
    {
      name: 'Computer Science',
      url: `${FEED_BASE}/843b629b4b2f43399a6a6fb409262d0011761019314464792941/calendar.ics`,
      subjects: [{ key: 'computer-science', label: 'Computer Science', short: 'CS', color: COMPUTER_SCIENCE_COLOR, text: COMPUTER_SCIENCE_TEXT }],
    },
    {
      name: 'Math',
      url: `${FEED_BASE}/f505d2fe3f2849ae9eb9dd1a0fb6171a12062148485429377724/calendar.ics`,
      subjects: [
        { key: 'math-standard', label: 'Standard Math', short: 'MATH', color: MATH_STANDARD_COLOR, text: MATH_STANDARD_TEXT, match: /standard/i },
        { key: 'math-advanced', label: 'Advanced Math', short: 'ADV MATH', color: MATH_ADVANCED_COLOR, text: MATH_ADVANCED_TEXT, match: /advanced/i },
      ],
      defaultSubject: 'math-standard',
    },
    {
      name: 'Physics',
      url: `${FEED_BASE}/b9a1e10189dd40a79932e8a84fe1d4008694371021094967307/calendar.ics`,
      subjects: [{ key: 'physics', label: 'Physics', short: 'PHYS', color: PHYSICS_COLOR, text: PHYSICS_TEXT }],
    },
    {
      name: 'Statistics',
      url: `${FEED_BASE}/4fd7cab1e4c64e78bb5e8f98b313937015362810744748450423/calendar.ics`,
      subjects: [{ key: 'statistics', label: 'Statistics', short: 'STAT', color: STATISTICS_COLOR, text: STATISTICS_TEXT }],
    },
  ],
};
