// Cloudflare Pages Function: GET /api/feeds
// Returns the raw ICS text of every calendar listed in public/config.js.
import config from '../../public/config.js';
import { fetchFeeds } from '../../lib/feeds.js';

export async function onRequestGet() {
  try {
    const body = await fetchFeeds(config);
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Could not load the calendars.' }, { status: 500 });
  }
}
