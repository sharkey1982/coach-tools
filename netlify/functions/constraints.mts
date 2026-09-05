/* ============================================================================
   Coach Tools · Match Constraints function
   Proxies the "Match Constraints" Airtable table so the Airtable PAT never
   reaches the browser. Reads are public (this is coaching content, not
   sensitive data, same as videos/syllabus) — the public football/constraints
   viewer page reads it directly. Writes (add/update/delete) require
   ADMIN_PASSWORD, edited from admin/constraints.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by players/videos/syllabus
     ADMIN_PASSWORD   — same shared password

   GET    /.netlify/functions/constraints
     -> { constraints: [{ id, recordId, name, theme, rule, bestWhen,
                           progression, status, weeks: [number, ...] }] }
     `id` is the ConstraintId slug (used as the anchor id on the public
     page and in URLs) — recordId is the underlying Airtable record id,
     needed for PUT/DELETE.

   POST   /.netlify/functions/constraints
     body: { password, name, id?, theme?, rule?, bestWhen?, progression?,
             status?, weeks?: [number, ...] }
     Creates a record. If id is omitted, one is slugified from name.

   PUT    /.netlify/functions/constraints
     body: { password, recordId, ...same fields as POST (all optional,
             only given fields are changed) }

   DELETE /.netlify/functions/constraints
     body: { password, recordId }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tbl9PZBzPhB3IubVa';
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

function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'constraint';
}

function toConstraintShape(record: any) {
  const f = record.fields || {};
  let weeks: number[] = [];
  try { weeks = JSON.parse(f['WeeksJSON'] || '[]'); } catch { weeks = []; }
  return {
    id: f['ConstraintId'] || record.id,
    recordId: record.id,
    name: f['Name'] || '',
    theme: f['Theme'] || '',
    rule: f['Rule'] || '',
    bestWhen: f['BestWhen'] || '',
    progression: f['Progression'] || '',
    status: f['Status'] || '',
    weeks: Array.isArray(weeks) ? weeks.map(Number).filter(n => Number.isFinite(n)) : [],
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

function parseWeeks(input: any): number[] | undefined {
  if (input === undefined) return undefined;
  if (Array.isArray(input)) return input.map(Number).filter(n => Number.isFinite(n));
  if (typeof input === 'string') {
    return input.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n));
  }
  return [];
}

async function handleGet() {
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);

  const constraints = all.map(toConstraintShape).sort((a, b) => a.name.localeCompare(b.name));
  return json({ constraints });
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.name) return json({ error: 'name is required' }, 400);

  const weeks = parseWeeks(body.weeks) || [];
  const fields: Record<string, any> = {
    Name: body.name,
    ConstraintId: body.id ? slugify(body.id) : slugify(body.name),
    Theme: body.theme || '',
    Rule: body.rule || '',
    BestWhen: body.bestWhen || '',
    Progression: body.progression || '',
    Status: body.status || 'Try',
    WeeksJSON: JSON.stringify(weeks),
  };

  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ constraint: toConstraintShape(result.records[0]) }, 201);
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields: Record<string, any> = {};
  if (body.id !== undefined) fields['ConstraintId'] = slugify(body.id);
  if (body.name !== undefined) fields['Name'] = body.name;
  if (body.theme !== undefined) fields['Theme'] = body.theme;
  if (body.rule !== undefined) fields['Rule'] = body.rule;
  if (body.bestWhen !== undefined) fields['BestWhen'] = body.bestWhen;
  if (body.progression !== undefined) fields['Progression'] = body.progression;
  if (body.status !== undefined) fields['Status'] = body.status;
  const weeks = parseWeeks(body.weeks);
  if (weeks !== undefined) fields['WeeksJSON'] = JSON.stringify(weeks);

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ constraint: toConstraintShape(result.records[0]) });
}

async function handleDelete(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);
  await airtableFetch(`?records[]=${encodeURIComponent(body.recordId)}`, { method: 'DELETE' });
  return json({ ok: true });
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet();

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'POST') return await handlePost(body);
    if (req.method === 'PUT') return await handlePut(body);
    if (req.method === 'DELETE') return await handleDelete(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('constraints function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
