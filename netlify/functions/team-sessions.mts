/* ============================================================================
   Coach Tools · Team Sessions function
   Backs the "Pairings & teams" tool on the Players admin page. Each pitch hosts
   one match — Team 1 v Team 2 — so each saved record is one pitch's fixture for
   a given week/match: which players were on which side, and the position each
   was placed in for that match. Powers the "played together" hint while
   assigning teams, the per-player pairing history, and the Teams history view.
   Password-gated like the players function, since this is still data about
   real children.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by players/videos
     ADMIN_PASSWORD   — same shared password

   GET    /.netlify/functions/team-sessions?password=xxx
     -> { sessions: [{ id, date, label, pitch, teams, playerCount, team1Score, team2Score }] }
     (pitch: '' | '1' | '2' | '3' — which pitch the match was played on)
     (teams: [[{id, role}, ...], [{id, role}, ...]] — normally exactly 2 entries,
     Team 1 and Team 2 for this pitch's match; role is one of 'goalkeeper' |
     'defender' | 'midfielder' | 'attacker', the position the coach put that
     player in for this specific match. Sessions saved before this format was
     added may still have plain recordId strings instead of {id, role} objects
     — the frontend normalizes either shape.)
     (team1Score/team2Score: number | null — the final score for each side, if recorded)

   POST   /.netlify/functions/team-sessions
     body: { password, date, label?, pitch?, teams: [[{id, role}, ...], ...],
             team1Score?, team2Score? }
     -> { session: {...} }

   PUT    /.netlify/functions/team-sessions
     body: { password, recordId, team1Score?, team2Score?, date?, label?, pitch?, teams? }
     -> { session: {...} }
     (pass just the score fields to record/edit a score after the fact; pass date/label/
     pitch/teams too to fully re-edit a saved match's line-up from Teams history)

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
    team1Score: typeof f['Team1Score'] === 'number' ? f['Team1Score'] : null,
    team2Score: typeof f['Team2Score'] === 'number' ? f['Team2Score'] : null,
  };
}

// A score field is optional; an empty string/undefined clears it, a valid number sets it.
function scoreField(value: any): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
  const team1Score = scoreField(body.team1Score);
  if (team1Score !== undefined) fields['Team1Score'] = team1Score;
  const team2Score = scoreField(body.team2Score);
  if (team2Score !== undefined) fields['Team2Score'] = team2Score;
  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ session: toSessionShape(result.records[0]) }, 201);
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields: Record<string, any> = {};
  const team1Score = scoreField(body.team1Score);
  if (team1Score !== undefined) fields['Team1Score'] = team1Score;
  const team2Score = scoreField(body.team2Score);
  if (team2Score !== undefined) fields['Team2Score'] = team2Score;

  // Optional full re-edit of a saved match's line-up (used by Teams history "Edit").
  if (Array.isArray(body.teams)) {
    fields['TeamsJSON'] = JSON.stringify(body.teams);
    fields['PlayerCount'] = body.teams.reduce((n: number, t: any[]) => n + (Array.isArray(t) ? t.length : 0), 0);
  }
  if (body.date) fields['Date'] = body.date;
  if (typeof body.label === 'string') fields['Label'] = body.label;
  if (body.pitch !== undefined) fields['Pitch'] = ['1', '2', '3'].includes(String(body.pitch || '')) ? String(body.pitch) : null;

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ session: toSessionShape(result.records[0]) });
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
    if (req.method === 'PUT') return await handlePut(body);
    if (req.method === 'DELETE') return await handleDelete(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('team-sessions function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
