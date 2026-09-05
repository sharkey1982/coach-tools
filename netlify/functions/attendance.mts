/* ============================================================================
   Coach Tools · Attendance function
   Backs the "Attendance" tool on the Players admin page. One record per
   syllabus week, listing which players attended. Saving the same week again
   overwrites that week's record rather than creating a duplicate. Password
   -gated like players/team-sessions, since this is still data about real
   children.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by players/videos/team-sessions
     ADMIN_PASSWORD   — same shared password

   GET    /.netlify/functions/attendance?password=xxx
     -> { records: [{ id, week, date, presentIds: [recordId, ...],
                       presentCount, totalCount }] }

   POST   /.netlify/functions/attendance
     body: { password, week, date, presentIds: [recordId, ...], totalCount }
     -> { record: {...} }
     If a record for this week already exists, it is updated in place
     (upsert) rather than duplicated.

   DELETE /.netlify/functions/attendance
     body: { password, recordId }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblJlUPHdvGQTHv8Q';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toAttendanceShape(record: any) {
  const f = record.fields || {};
  let presentIds: string[] = [];
  try { presentIds = JSON.parse(f['PresentJSON'] || '[]'); } catch { presentIds = []; }
  return {
    id: record.id,
    recordId: record.id,
    week: f['Week'] || null,
    date: f['Date'] || '',
    presentIds,
    presentCount: f['PresentCount'] || 0,
    totalCount: f['TotalCount'] || 0,
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

async function fetchAll() {
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);
  return all;
}

async function handleGet(url: URL) {
  const password = url.searchParams.get('password');
  if (!checkPassword(password)) return json({ error: 'Incorrect password' }, 401);

  const all = await fetchAll();
  const records = all.map(toAttendanceShape).sort((a, b) => (b.week || 0) - (a.week || 0));
  return json({ records });
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (body.week === undefined || body.week === null || body.week === '') {
    return json({ error: 'week is required' }, 400);
  }
  const presentIds = Array.isArray(body.presentIds) ? body.presentIds : [];
  const fields = {
    Week: Number(body.week),
    Date: body.date || null,
    PresentJSON: JSON.stringify(presentIds),
    PresentCount: presentIds.length,
    TotalCount: Number(body.totalCount) || presentIds.length,
  };

  // Upsert: if a record for this week already exists, update it instead of
  // creating a duplicate (re-saving attendance for the same week).
  const all = await fetchAll();
  const existing = all.find((r: any) => Number(r.fields?.['Week']) === Number(body.week));

  const result = existing
    ? await airtableFetch('', {
        method: 'PATCH',
        body: JSON.stringify({ records: [{ id: existing.id, fields }], typecast: true }),
      })
    : await airtableFetch('', {
        method: 'POST',
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      });

  return json({ record: toAttendanceShape(result.records[0]) }, existing ? 200 : 201);
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
    console.error('attendance function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
