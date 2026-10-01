/* ============================================================================
   Coach Tools · Planner function
   Proxies the "Planner" table in the Coach Tools Airtable base. Replaces the
   planner page's old browser-only localStorage persistence with one shared,
   server-side state so it's consistent across devices/browsers and editable
   directly in Airtable if needed.

   The whole planner state (staff, timetables, clubs, clubsFooterNote,
   fixtures, term, dayYearGroup, visibleDays) is kept as one JSON blob in a
   single Airtable record's "State" field — mirroring exactly how the app's
   own persistAll() already treats it as one atomic save every time. There is
   always exactly one row, keyed "current" in "Key".

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by every other Airtable-backed function

   GET    /.netlify/functions/planner
     -> { state: {...} | null }
     (null means no row exists yet — the page falls back to its own
     buildDefault*() functions exactly as it did before this migration)

   PUT    /.netlify/functions/planner
     body: { state: {...} }
     Upserts the single "current" row. Always saves the whole object — there
     is no partial-field update, matching the page's own all-at-once save.
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tbl4PA5lnJdwU92Mk';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
const ROW_KEY = 'current';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function airtableFetch(path: string, init?: RequestInit) {
  const pat = Netlify.env.get('AIRTABLE_PAT');
  if (!pat) throw new Error('AIRTABLE_PAT not configured');
  const res = await fetch(`${AIRTABLE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      'content-type': 'application/json',
      ...(init && init.headers ? init.headers : {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function findCurrentRecord(): Promise<any | null> {
  const filter = encodeURIComponent(`{Key} = "${ROW_KEY}"`);
  const data = await airtableFetch(`?filterByFormula=${filter}&maxRecords=1`);
  return (data.records && data.records[0]) || null;
}

export default async (req: Request) => {
  try {
    if (req.method === 'GET') {
      const record = await findCurrentRecord();
      if (!record) return json({ state: null });
      let state: unknown = null;
      try {
        state = JSON.parse(record.fields['State'] || 'null');
      } catch {
        state = null;
      }
      return json({ state });
    }

    if (req.method === 'PUT') {
      const body = await req.json();
      if (!body || typeof body.state === 'undefined') {
        return json({ error: 'Missing state in request body' }, 400);
      }
      const stateJson = JSON.stringify(body.state);
      const existing = await findCurrentRecord();
      if (existing) {
        await airtableFetch(`/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: { State: stateJson } }),
        });
      } else {
        await airtableFetch('', {
          method: 'POST',
          body: JSON.stringify({ fields: { Key: ROW_KEY, State: stateJson } }),
        });
      }
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err: any) {
    return json({ error: err.message || String(err) }, 500);
  }
};
