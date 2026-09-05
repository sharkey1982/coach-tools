/* ============================================================================
   Coach Tools · Team Sessions function
   Backs the "Pairings & teams" tool on the Players admin page. Each saved
   week records which players were grouped into which team, so the page can
   show a "played together" hint while assigning teams and a per-player
   pairing history. Password-gated like the players function, since this is
   still data about real children.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by players/videos
     ADMIN_PASSWORD   — same shared password

   GET    /.netlify/functions/team-sessions?password=xxx
     -> { sessions: [{ id, date, label, pitch, teams: [[recordId, ...], ...], playerCount }] }
     (pitch: '' | '1' | '2' | '3' — which pitch the match was played on)

   POST   /.netlify/functions/team-sessions
     body: { password, date, label?, pitch?, teams: [[recordId, ...], ...] }
     -> { session: {...} }

   DELETE /.netlify/functions/team-sessions
     body: { password, recordId }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblAlhWwUCZkdp7u6';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toSessionShape(record: any) {
  const f = record.fields || {};
  let teams: string[][] = [];
  try { teams = JSON.parse(f['TeamsJSON'] || '[]'); } catch { teams = []; }
  return {
    id: record.id,
    recordId: record.id,
    date: f['Date'] || '',
    label: f['Label'] || '',
    pitch: f['Pitch'] || '',
    teams,
    playerCount: f['PlayerCount'] || 0,
  };
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
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function checkPassword(supplied: string | undefined | null): boolean {
  const expected = Netlify.env.get('ADMIN_PASSWORD');
  return !!expected && !!supplied && supplied === expected;
}

async function handleGet(url: URL) {
  const password = url.searchParams.get('password');
  if (!checkPassword(password)) return json({ error: 'Incorrect password' }, 401);

  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);

  const sessions = all.map(toSessionShape).sort((a, b) => (a.date < b.date ? 1 : -1));
  return json({ sessions });
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.date) return json({ error: 'date is required' }, 400);
  const teams = Array.isArray(body.teams) ? body.teams : [];
  if (!teams.length) return json({ error: 'teams is required' }, 400);

  const playerCount = teams.reduce((n: number, t: any[]) => n + (Array.isArray(t) ? t.length : 0), 0);
  const pitch = ['1', '2', '3'].includes(String(body.pitch || '')) ? String(body.pitch) : null;
  const fields: Record<string, any> = {
    Date: body.date,
    Label: body.label || '',
    Pitch: pitch,
    TeamsJSON: JSON.stringify(teams),
    PlayerCount: playerCount,
  };
  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ session: toSessionShape(result.records[0]) }, 201);
}

async function handleDelete(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);
  await airtableFetch(`?records[]=${encodeURIComponent(body.recordId)}`, { method: 'DELETE' });
  return json({ ok: true });
}

export default async (req: Request) => {
  const url = new URL(req.url);
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet(url);

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'POST') return await handlePost(body);
    if (req.method === 'DELETE') return await handleDelete(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('team-sessions function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
