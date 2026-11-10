// Download the Outlook ICS feeds. Shared by the Cloudflare Pages Function
// (functions/api/feeds.js) and the local test server (server.js).
//
// Browsers can't read Outlook's feeds directly (no CORS headers), so this
// runs on the server side and passes the raw text through. Parsing happens in
// the TV's browser, which keeps the Cloudflare function within the free
// plan's CPU limit.

const FETCH_TIMEOUT_MS = 20_000;

// Last good copy of each feed, so a brief Outlook outage keeps showing the
// previous schedule. (On Cloudflare this lives only as long as the worker
// instance does; the edge cache below does most of the work there.)
const lastGood = new Map(); // url -> { text, fetchedAt }

async function fetchOne(url, cacheSeconds) {
  const cached = lastGood.get(url);
  if (cached && Date.now() - cached.fetchedAt < cacheSeconds * 1000) {
    return { text: cached.text, stale: false };
  }
  // Outlook occasionally answers with a one-off error (seen: HTTP 400), so
  // retry once before giving up.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        // Cloudflare only: keep a copy at the edge so Outlook is asked at most
        // once per cacheSeconds. Ignored when running under Node.
        cf: { cacheTtl: cacheSeconds, cacheEverything: true },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('response is not an ICS calendar');
      lastGood.set(url, { text, fetchedAt: Date.now() });
      return { text, stale: false };
    } catch (err) {
      console.error(`[feed] attempt ${attempt} ${url}: ${err.message}`);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { text: cached ? cached.text : null, stale: true };
}

/** @returns {Promise<{feeds: {name:string, ics:string|null, stale:boolean}[], fetchedAt:string}>} */
export async function fetchFeeds(config) {
  const cacheSeconds = Math.max(60, Math.round(config.refreshMinutes * 60));
  const results = await Promise.all(config.calendars.map((c) => fetchOne(c.url, cacheSeconds)));
  return {
    fetchedAt: new Date().toISOString(),
    feeds: config.calendars.map((c, i) => ({ name: c.name, ics: results[i].text, stale: results[i].stale })),
  };
}
