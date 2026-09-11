/* ============================================================================
   Coach Tools · Spelling Lists function
   Proxies the "Spelling Lists" table in the main Coach Tools Airtable base
   (same base as Players/Syllabus/Videos/etc.), so the Airtable PAT never
   reaches the browser. Same pattern as constraints.mts / syllabus.mts.
   Reads are public (family app, no password gate needed beyond the site-wide
   edge gate) — writes go through admin/spelling.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT   — same token used by every other Coach Tools function

   GET    /.netlify/functions/spelling-lists?profile=Pippa&active=true
     -> { lists: [{ recordId, word, profile, year, week, focus, sentence, dateAdded, active }] }

   POST   /.netlify/functions/spelling-lists
     body: { word, profile, year?, week?, focus?, sentence?, active? }

   PUT    /.netlify/functions/spelling-lists
     body: { recordId, ...same fields as POST (all optional) }

   DELETE /.netlify/functions/spelling-lists
     body: { recordId }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblvVW0V95YKLfYoc';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

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

function toListShape(record: any) {
  const f = record.fields || {};
  return {
    recordId: record.id,
    word: f['Word'] || '',
    profile: f['Profile'] || '',
    year: f['Year'] || '',
    week: f['Week'] || '',
    focus: f['Focus'] || '',
    sentence: f['Sentence'] || '',
    dateAdded: f['DateAdded'] || '',
    active: !!f['Active'],
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

async function handleGet(url: URL) {
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);

  let lists = all.map(toListShape);

  const profile = url.searchParams.get('profile');
  if (profile) lists = lists.filter(l => l.profile === profile);

  const active = url.searchParams.get('active');
  if (active === 'true') lists = lists.filter(l => l.active);
  if (active === 'false') lists = lists.filter(l => !l.active);

  return json({ lists });
}

async function handlePost(body: any) {
  if (!body.word) return json({ error: 'word is required' }, 400);

  const fields: Record<string, any> = {
    Word: body.word,
    Profile: body.profile || 'Pippa',
    Year: body.year || '',
    Week: body.week || '',
    Focus: body.focus || '',
    Sentence: body.sentence || '',
    DateAdded: body.dateAdded || new Date().toISOString().slice(0, 10),
    Active: body.active !== undefined ? !!body.active : true,
  };

  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ list: toListShape(result.records[0]) }, 201);
}

async function handlePut(body: any) {
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields: Record<string, any> = {};
  if (body.word !== undefined) fields['Word'] = body.word;
  if (body.profile !== undefined) fields['Profile'] = body.profile;
  if (body.year !== undefined) fields['Year'] = body.year;
  if (body.week !== undefined) fields['Week'] = body.week;
  if (body.focus !== undefined) fields['Focus'] = body.focus;
  if (body.sentence !== undefined) fields['Sentence'] = body.sentence;
  if (body.active !== undefined) fields['Active'] = !!body.active;

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ list: toListShape(result.records[0]) });
}

async function handleDelete(body: any) {
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);
  await airtableFetch(`?records[]=${encodeURIComponent(body.recordId)}`, { method: 'DELETE' });
  return json({ ok: true });
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet(new URL(req.url));

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'POST') return await handlePost(body);
    if (req.method === 'PUT') return await handlePut(body);
    if (req.method === 'DELETE') return await handleDelete(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('spelling-lists function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
