/* ============================================================================
   Coach Tools · Videos function
   Proxies the "Coach Tools — Video Links" Airtable base so the Airtable PAT
   never reaches the browser. Serves reads to anyone (video links aren't
   sensitive); write operations (add/update/delete) require ADMIN_PASSWORD.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — personal access token, scoped to data.records:read
                         and data.records:write on the Video Links base
     ADMIN_PASSWORD   — shared password checked on every write

   GET    /.netlify/functions/videos?discipline=football
     -> { videos: [{ id, type, url, title, credit, activityId, tags, note }] }
     Shape matches the existing per-discipline _videos.json files exactly,
     so video library pages can swap their fetch with no other changes.

   POST   /.netlify/functions/videos
     body: { password, discipline, id?, type, url, title, credit?,
             activityId?, tags?, note? }
     Creates a record. If id is omitted, one is slugified from title.

   PUT    /.netlify/functions/videos
     body: { password, recordId, ...same fields as POST (all optional,
             only given fields are changed) }

   DELETE /.netlify/functions/videos
     body: { password, recordId }
   ============================================================================ */

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblH6im53oktzkTvR';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

const ALLOWED_DISCIPLINES = ['football', 'cricket', 'long-jump'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'video';
}

function toVideoShape(record: any) {
  const f = record.fields || {};
  return {
    id: f['Video ID'] || record.id,
    recordId: record.id,
    type: f['Type'] || 'link',
    url: f['URL'] || '',
    title: f['Title'] || '',
    credit: f['Credit'] || '',
    activityId: f['Activity ID'] || null,
    tags: f['Tags'] || [],
    note: f['Note'] || '',
  };
}

declare const Netlify: { env: { get(key: string): string | undefined } };

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

function checkPassword(supplied: string | undefined): boolean {
  const expected = Netlify.env.get('ADMIN_PASSWORD');
  return !!expected && !!supplied && supplied === expected;
}

async function handleGet(url: URL) {
  const discipline = url.searchParams.get('discipline');
  let filterFormula = '';
  if (discipline) {
    if (!ALLOWED_DISCIPLINES.includes(discipline)) {
      return json({ error: `Unknown discipline "${discipline}"` }, 400);
    }
    filterFormula = `?filterByFormula=${encodeURIComponent(`{Discipline}="${discipline}"`)}`;
  }

  let all: any[] = [];
  let offset: string | undefined;
  do {
    const sep = filterFormula ? '&' : '?';
    const page = await airtableFetch(`${filterFormula}${offset ? `${sep}offset=${offset}` : ''}`);
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);

  return json({ videos: all.map(toVideoShape) });
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.discipline || !ALLOWED_DISCIPLINES.includes(body.discipline)) {
    return json({ error: 'discipline must be one of ' + ALLOWED_DISCIPLINES.join(', ') }, 400);
  }
  if (!body.url || !body.title) return json({ error: 'url and title are required' }, 400);

  const fields: Record<string, any> = {
    'Video ID': body.id ? slugify(body.id) : slugify(body.title),
    Discipline: body.discipline,
    Type: body.type || 'link',
    URL: body.url,
    Title: body.title,
    Credit: body.credit || '',
    'Activity ID': body.activityId || '',
    Tags: Array.isArray(body.tags) ? body.tags : (body.tags ? String(body.tags).split(',').map((t: string) => t.trim()).filter(Boolean) : []),
    Note: body.note || '',
  };

  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ video: toVideoShape(result.records[0]) }, 201);
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields: Record<string, any> = {};
  if (body.id !== undefined) fields['Video ID'] = slugify(body.id);
  if (body.discipline !== undefined) fields['Discipline'] = body.discipline;
  if (body.type !== undefined) fields['Type'] = body.type;
  if (body.url !== undefined) fields['URL'] = body.url;
  if (body.title !== undefined) fields['Title'] = body.title;
  if (body.credit !== undefined) fields['Credit'] = body.credit;
  if (body.activityId !== undefined) fields['Activity ID'] = body.activityId;
  if (body.tags !== undefined) fields['Tags'] = Array.isArray(body.tags) ? body.tags : String(body.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
  if (body.note !== undefined) fields['Note'] = body.note;

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ video: toVideoShape(result.records[0]) });
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
    if (url.searchParams.get('_envdebug') === '1') {
      return json({
        TEST_VAR: Netlify.env.get('TEST_VAR') || null,
        AIRTABLE_PAT_present: !!Netlify.env.get('AIRTABLE_PAT'),
        ADMIN_PASSWORD_present: !!Netlify.env.get('ADMIN_PASSWORD'),
      });
    }
    if (req.method === 'GET') return await handleGet(url);

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'POST') return await handlePost(body);
    if (req.method === 'PUT') return await handlePut(body);
    if (req.method === 'DELETE') return await handleDelete(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('videos function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};

