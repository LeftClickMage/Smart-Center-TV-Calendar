# Smart-Center-TV-Calendar

The tutoring schedule shown on the TVs in the Purdue **SMART Center**
(Science and Mathematics Academic Resource and Tutoring Center).

It reads five published Outlook calendars (Chemistry, Computer Science, Math,
Physics, Statistics) and shows who is tutoring when, from 10 AM to 8 PM,
sized to be read across the room on a 50" TV.

## What the screen shows

- **Header:** Purdue College of Science co-branded logo, the center's full
  name, "SMART Center" in United Sans, and a clock.
- **Subject chips:** a color key for each subject. The subject currently on
  screen is outlined, and the others fade.
- **Schedule grid:** today plus the next 5 open days (Saturdays skipped).
  Past days are never shown. The grid slides forward one day at midnight.
  Today's column is twice as wide, has a black border, is labeled
  **Today**, and has a gold line marking the current time.
- **One subject at a time:** the grid switches subjects every 4 seconds
  (Chemistry → Computer Science → Math → Physics → Statistics). Subjects with
  no sessions in the visible days are skipped.
- **Tutor blocks:** name, time, and course (e.g. `PHYS 172 — Modern Mechanics`)
  when the event description includes one. Sessions that have ended fade out.
- **Warnings:** if a calendar can't be refreshed, a red message appears at the
  right of the subject chips. The last good copy keeps showing until then.

## Changing settings

Everything you'd normally change is in **[public/config.js](public/config.js)**.
Commit and push the change. Cloudflare redeploys in about a minute, and the
TVs pick it up at their nightly reload (or refresh the TV's browser).

| Setting | What it does | Current |
|---|---|---|
| `displayMode` | `'rolling'` = today and the upcoming days; `'week'` = Sunday–Friday of the current week | `'rolling'` |
| `rollingDays` | How many days to show in rolling mode | `6` |
| `hiddenDays` | Days to skip in rolling mode | `['Saturday']` |
| `todayWidth` | How much wider today's column is (`1` = same as other days) | `2` |
| `dayStartHour` / `dayEndHour` | Hours shown (24-hour clock) | `10` / `20` |
| `cycleSeconds` | Seconds per subject (`0` = show every subject at once) | `4` |
| `mergeSameTutor` | When showing all at once: one tutor on several subjects at the same time → one block with subject tags | `true` |
| `dimPastSessions` | Fade sessions that have ended | `true` |
| `fontScale` | Make all text bigger (`1.2`) or smaller (`0.9`) | `1` |
| `refreshMinutes` | How often new calendar data is fetched | `5` |
| `timeZone` | Time zone for the grid, regardless of the TV's clock | `America/Indiana/Indianapolis` |
| `adobeFontsUrl` | Adobe Fonts link that loads Acumin Pro | `https://use.typekit.net/awh5tdn.css` |
| `header.*` | Header text, logo and the "SMART Center" image | |
| `calendars[].url` | Outlook ICS feed links | |

### Colors

The color variables are at the top of `public/config.js`. Each one has a block
color and a text color.

| Subject | Block color | Text |
|---|---|---|
| Chemistry | `#CFB991` (CMYK 13 20 45 3) | black |
| Computer Science | `#9D9795` (CMYK 34 30 33 8) | black |
| Standard Math | `#EBD99F` (CMYK 3 8 43 0) | black |
| Advanced Math | `#DAAA00` (CMYK 0 20 100 8) | black |
| Physics | `#555960` (CMYK 63 51 45 33) | white |
| Statistics | `#8E6F3E` (CMYK 14 29 62 12) | white |

Other colors (Purdue gold `--gold`, the Today border, grid lines) and the
`--today-border` thickness are CSS variables at the top of
[public/styles.css](public/styles.css).

## Calendar data

### How events must be entered in Outlook

- **One event per tutor.** The title must be `Name: Subject`, e.g.
  `Davyd: CHEM` or `Nebras: Standard Math`. The title and the event's
  start and end times are what the TV shows.
- **Math:** the word **Standard** or **Advanced** in the title picks the
  color. Math events with neither word are shown as Standard.
- **Course line (optional):** put a line in the event description that
  starts with the tutor's name and includes the course, e.g.
  `Christopher Ulate — PHYS 172 — Modern Mechanics`. Other lines in the
  description are ignored, including times written there, so always fix the
  event's actual times rather than the notes.
- Repeating events, skipped dates, and single changed sessions are all handled.

### Feed links

Use the `https://outlook.office365.com/owa/calendar/…/calendar.ics` form. The
`outlook.cloud.microsoft/…` links shown in Outlook only work for the HTML
page. Swapping `.html` for `.ics` on those returns an error.

The calendars must be published with **"Can view all details"**. "Can view
when I'm busy" gives only busy blocks with no names.

### How quickly changes appear

An Outlook edit reaches the TV after:

1. Outlook updates its published feed. This takes minutes to sometimes an
   hour or more, is controlled by Microsoft, and is usually the biggest delay.
2. Cloudflare's 5-minute cache expires.
3. The TV's next 5-minute check.

Other timers: subject switch every 4 s, screen/clock redraw every 30 s,
retry every 1 min after a failed download, full page reload daily at ~3 AM.

## Fonts

- **Acumin Pro** (everything except "SMART Center") loads from the Adobe
  Fonts web project in `adobeFontsUrl` (Regular and Bold). If the deployed
  site falls back to Arial, add the site's domain (e.g.
  `your-project.pages.dev`) to the web project's allowed domains at
  [fonts.adobe.com](https://fonts.adobe.com).
- **United Sans** ("SMART Center") isn't available as a web font, so it's an
  outlined image: [public/assets/smart-center-title.svg](public/assets/smart-center-title.svg).
  To change the wording or color, regenerate it with
  [tools/text2svg.py](tools/text2svg.py) on a computer with United Sans
  installed (instructions are at the top of the script).
- Licensed font files are **not** stored in this repository. Don't add them.

## Deploying on Cloudflare Pages (one-time setup)

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages →
   Connect to Git** and pick this repository.
2. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **`public`**
3. Click **Save and Deploy**. The site will be at
   `https://<project-name>.pages.dev`.
4. Add that domain to the Adobe Fonts web project (see Fonts).
5. Open the URL on each TV's browser in full-screen/kiosk mode.

Every push to `main` redeploys automatically. It's on Cloudflare's free plan.

### How it works

Browsers aren't allowed to read Outlook's calendar feeds directly (no CORS
headers), so a small Cloudflare Pages Function
([functions/api/feeds.js](functions/api/feeds.js)) downloads the five feeds,
retries once if Outlook returns an error, and passes the raw text to the page.
The page ([public/app.js](public/app.js)) expands repeating events and draws
the grid in the TV's browser. Parsing all five calendars takes about 40 ms of
CPU time, more than the free plan's ~10 ms per request, so it runs in the
browser rather than in the function.

## Running it on your own computer

Requires [Node.js](https://nodejs.org) 18 or newer. There's nothing to install.

```sh
npm start
```

Then open http://localhost:3000. Use `PORT=4000 npm start` for a different port.

## Files

```
public/                  the website (what Cloudflare serves)
  config.js              ← settings, colors and calendar links
  index.html             page layout
  styles.css             look and sizes (sized in vh so it scales with the TV)
  app.js                 day selection, subject cycling, drawing the grid
  js/ics.js              reads ICS feeds (repeats, skipped dates, one-off edits)
  js/schedule.js         turns events into tutor blocks
  vendor/ical.min.js     ical.js 2.2.1 calendar parser (MPL-2.0)
  assets/                College of Science logos, "SMART Center" title image
functions/api/feeds.js   Cloudflare function: GET /api/feeds
lib/feeds.js             downloads the feeds (used by the function and server.js)
server.js                local test server (npm start)
tools/text2svg.py        makes the "SMART Center" title image
wrangler.toml            Cloudflare Pages settings
```
