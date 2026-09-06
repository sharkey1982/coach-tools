/* ============================================================================
   Coach Tools · Coaching Cue Tags function
   Proxies the "Coaching Cue Tags" table in the Coach Tools Airtable base —
   the focus tags used to categorise Coaching Cues (e.g. awareness, dribbling,
   1v1). Kept as its own table (rather than a free-text field on each cue) so
   a rename or addition happens in one place and every cue picks it up.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by the other Airtable-backed functions
     ADMIN_PASSWORD   — same shared password (checked site-wide by the edge gate)

   GET  /.netlify/functions/coaching-cue-tags[?discipline=football]
     -> { tags: [{ recordId, id, name, discipline }] }

   PUT  /.netlify/functions/coaching-cue-tags
     body: { password, id, name?, discipline? }
     -> { tag: {...updated...} }

   POST /.netlify/functions/coaching-cue-tags
     body: { password, name, discipline? }
     Adds a new tag. id is slugified from name and must be unique.
     -> { tag: {...new...} }

   DELETE /.netlify/functions/coaching-cue-tags
     body: { password, id }
     Deletes the tag outright. Any cue linking to it simply loses that link
     (Airtable clears the reverse side of the link automatically) — it is
     not a blocking check, since a tag going away shouldn't strand a cue.
     -> { ok: true }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblvLT8lnNHLUAqT4';
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
  // Password checks are handled once, site-wide, by netlify/edge-functions/gate.ts.
  return true;
}

function toShape(record: any) {
  const f = record.fields || {};
  return {
    recordId: record.id,
    id: f['Slug'] || '',
    name: f['Name'] || '',
    discipline: f['Discipline'] || '',
  };
}

async function fetchAllRecords(): Promise<any[]> {
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);
  return all;
}

async function findBySlug(slug: string): Promise<any | null> {
  const filter = encodeURIComponent(`{Slug} = "${slug.replace(/"/g, '\\"')}"`);
  const page = await airtableFetch(`?filterByFormula=${filter}&maxRecords=1`);
  return (page.records || [])[0] || null;
}

function slugify(name: string): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function handleGet(url: URL) {
  const discipline = url.searchParams.get('discipline');
  const all = await fetchAllRecords();
  const shaped = all.map(toShape).filter(t => !discipline || t.discipline === discipline);
  return json({ tags: shaped });
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.id) return json({ error: 'id is required' }, 400);

  const record = await findBySlug(body.id);
  if (!record) return json({ error: `No tag with id "${body.id}"` }, 404);

  const fields: Record<string, any> = {};
  if (body.name !== undefined) fields['Name'] = body.name;
  if (body.discipline !== undefined) fields['Discipline'] = body.discipline;

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: record.id, fields }], typecast: true }),
  });
  return json({ tag: toShape(result.records[0]) });
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.name) return json({ error: 'name is required' }, 400);

  const id = slugify(body.id || body.name);
  if (!id) return json({ error: 'Could not derive an id from that name' }, 400);
  const existing = await findBySlug(id);
  if (existing) return json({ error: `A tag with id "${id}" already exists` }, 409);

  const fields: Record<string, any> = {
    Slug: id,
    Name: body.name,
    Discipline: body.discipline || 'football',
  };

  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ tag: toShape(result.records[0]) }, 201);
}

async function handleDelete(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.id) return json({ error: 'id is required' }, 400);

  const record = await findBySlug(body.id);
  if (!record) return json({ error: `No tag with id "${body.id}"` }, 404);

  await airtableFetch(`?records[]=${encodeURIComponent(record.id)}`, { method: 'DELETE' });
  return json({ ok: true });
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet(new URL(req.url));

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'PUT') return await handlePut(body);
    if (req.method === 'POST') return await handlePost(body);
    if (req.method === 'DELETE') return await handleDelete(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('coaching-cue-tags function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
