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
                       presentCount, totalCount, reflection }] }

   POST   /.netlify/functions/attendance
     body: { password, week, date?, presentIds?: [recordId, ...], totalCount?, reflection? }
     -> { record: {...} }
     If a record for this week already exists, it is updated in place
     (upsert) rather than duplicated. presentIds/totalCount and reflection
     are independent — pass just { password, week, reflection } to save a
     reflection note without touching that week's saved attendance (and
     vice versa); whichever fields are omitted are left as they were (or
     default to empty on a brand-new week record).

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
    reflection: f['Reflection'] || '',
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

function checkPassword(_supplied: string | undefined | null): boolean {
  // Password checks are now handled once, site-wide, by netlify/edge-functions/gate.ts.
  // Kept as a no-op so every call site below still compiles unchanged.
  return true;
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

  // Upsert: if a record for this week already exists, update it instead of
  // creating a duplicate (re-saving attendance for the same week).
  const all = await fetchAll();
  const existing = all.find((r: any) => Number(r.fields?.['Week']) === Number(body.week));

  // presentIds/totalCount and reflection are independent — only touch the fields actually
  // supplied, so saving a reflection alone doesn't wipe attendance already recorded (or vice versa).
  const fields: Record<string, any> = { Week: Number(body.week) };
  if (body.date !== undefined) fields.Date = body.date || null;
  if (Array.isArray(body.presentIds)) {
    fields.PresentJSON = JSON.stringify(body.presentIds);
    fields.PresentCount = body.presentIds.length;
    fields.TotalCount = Number(body.totalCount) || body.presentIds.length;
  }
  if (typeof body.reflection === 'string') fields.Reflection = body.reflection;

  // A brand-new record needs sensible defaults for anything not supplied
  // (e.g. saving a reflection alone, before attendance has ever been recorded for this week).
  if (!existing) {
    if (fields.PresentJSON === undefined) {
      fields.PresentJSON = '[]';
      fields.PresentCount = 0;
      fields.TotalCount = Number(body.totalCount) || 0;
    }
    if (fields.Reflection === undefined) fields.Reflection = '';
  }

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
