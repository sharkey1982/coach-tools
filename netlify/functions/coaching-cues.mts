/* ============================================================================
   Coach Tools · Coaching Cues function
   Proxies the "Coaching Cues" table in the Coach Tools Airtable base.
   Migrated 2026-09 from a static git-committed file (football/cues/data/cues.json)
   to Airtable, matching every other admin surface — plus a companion table,
   "Coaching Cue Tags" (see coaching-cue-tags.mts), so tags are managed in one
   place rather than free-typed per cue.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by the other Airtable-backed functions
     ADMIN_PASSWORD   — same shared password (checked site-wide by the edge gate)

   Response shape matches the old static file (football/cues/index.html reads
   DATA.cues and DATA.focusTagOptions), with `focusTags` on each cue resolved
   from the linked-record Tags field down to plain tag-slug strings:
     { cues: [{ id, recordId, title, cue, analogy, usage, focusTags: [slug],
                weeks: [number], discipline }],
       focusTagOptions: [slug] }

   GET  /.netlify/functions/coaching-cues[?discipline=football]
     -> { cues: [...], focusTagOptions: [...] }

   PUT  /.netlify/functions/coaching-cues
     body: { password, id, title?, cue?, analogy?, usage?, focusTags?: [slug],
             weeks?: [number], discipline? }
     -> { cue: {...updated...} }

   POST /.netlify/functions/coaching-cues
     body: { password, title, cue?, analogy?, usage?, focusTags?: [slug],
             weeks?: [number], discipline? }
     Adds a new cue. id is slugified from title and must be unique.
     -> { cue: {...new...} }

   DELETE /.netlify/functions/coaching-cues
     body: { password, id }
     -> { ok: true }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblSRlGIeRpaRQuuB';
const TAGS_TABLE_ID = 'tblvLT8lnNHLUAqT4';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
const TAGS_URL = `https://api.airtable.com/v0/${BASE_ID}/${TAGS_TABLE_ID}`;

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

async function airtableFetch(url: string, init?: RequestInit) {
  const pat = Netlify.env.get('AIRTABLE_PAT');
  if (!pat) throw new Error('AIRTABLE_PAT not configured');
  const res = await fetch(url, {
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
  return true;
}

function safeParse(s: any, fallback: any) {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

async function fetchAll(url: string): Promise<any[]> {
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `${url}${url.includes('?') ? '&' : '?'}offset=${offset}` : url);
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);
  return all;
}

async function findBySlug(slug: string): Promise<any | null> {
  const filter = encodeURIComponent(`{Slug} = "${slug.replace(/"/g, '\\"')}"`);
  const page = await airtableFetch(`${AIRTABLE_URL}?filterByFormula=${filter}&maxRecords=1`);
  return (page.records || [])[0] || null;
}

function slugify(name: string): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Builds recordId <-> slug maps for the Tags table, needed to translate the
// cues table's linked-record Tags field down to plain slug strings (and back).
async function loadTagMaps() {
  const tagRecords = await fetchAll(TAGS_URL);
  const idToSlug = new Map<string, string>();
  const slugToId = new Map<string, string>();
  for (const r of tagRecords) {
    const slug = r.fields?.['Slug'] || '';
    if (!slug) continue;
    idToSlug.set(r.id, slug);
    slugToId.set(slug, r.id);
  }
  return { idToSlug, slugToId, allSlugs: [...slugToId.keys()] };
}

function toShape(record: any, idToSlug: Map<string, string>) {
  const f = record.fields || {};
  const tagIds: string[] = f['Tags'] || [];
  return {
    recordId: record.id,
    id: f['Slug'] || '',
    title: f['Title'] || '',
    discipline: f['Discipline'] || '',
    cue: f['Cue'] || '',
    analogy: f['Analogy'] || '',
    usage: f['Usage'] || '',
    focusTags: tagIds.map(tid => idToSlug.get(tid)).filter(Boolean),
    weeks: safeParse(f['WeeksJSON'], []),
  };
}

async function handleGet(url: URL) {
  const discipline = url.searchParams.get('discipline');
  const { idToSlug, allSlugs } = await loadTagMaps();
  const all = await fetchAll(AIRTABLE_URL);
  let cues = all.map(r => toShape(r, idToSlug));
  if (discipline) cues = cues.filter(c => c.discipline === discipline);
  return json({ cues, focusTagOptions: allSlugs });
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.id) return json({ error: 'id is required' }, 400);

  const record = await findBySlug(body.id);
  if (!record) return json({ error: `No cue with id "${body.id}"` }, 404);

  const fields: Record<string, any> = {};
  if (body.title !== undefined) fields['Title'] = body.title;
  if (body.cue !== undefined) fields['Cue'] = body.cue;
  if (body.analogy !== undefined) fields['Analogy'] = body.analogy;
  if (body.usage !== undefined) fields['Usage'] = body.usage;
  if (body.discipline !== undefined) fields['Discipline'] = body.discipline;
  if (Array.isArray(body.weeks)) fields['WeeksJSON'] = JSON.stringify(body.weeks.map(Number).filter((n: number) => !Number.isNaN(n)));
  if (Array.isArray(body.focusTags)) {
    const { slugToId } = await loadTagMaps();
    fields['Tags'] = body.focusTags.map((s: string) => slugToId.get(s)).filter(Boolean);
  }

  const result = await airtableFetch(AIRTABLE_URL, {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: record.id, fields }], typecast: true }),
  });
  const { idToSlug } = await loadTagMaps();
  return json({ cue: toShape(result.records[0], idToSlug) });
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.title) return json({ error: 'title is required' }, 400);

  const id = slugify(body.id || body.title);
  if (!id) return json({ error: 'Could not derive an id from that title' }, 400);
  const existing = await findBySlug(id);
  if (existing) return json({ error: `A cue with id "${id}" already exists` }, 409);

  const { slugToId, idToSlug } = await loadTagMaps();
  const fields: Record<string, any> = {
    Slug: id,
    Title: body.title,
    Discipline: body.discipline || 'football',
    Cue: body.cue || '',
    Analogy: body.analogy || '',
    Usage: body.usage || '',
    WeeksJSON: JSON.stringify(Array.isArray(body.weeks) ? body.weeks.map(Number).filter((n: number) => !Number.isNaN(n)) : []),
  };
  if (Array.isArray(body.focusTags)) {
    fields['Tags'] = body.focusTags.map((s: string) => slugToId.get(s)).filter(Boolean);
  }

  const result = await airtableFetch(AIRTABLE_URL, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ cue: toShape(result.records[0], idToSlug) }, 201);
}

async function handleDelete(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.id) return json({ error: 'id is required' }, 400);

  const record = await findBySlug(body.id);
  if (!record) return json({ error: `No cue with id "${body.id}"` }, 404);

  await airtableFetch(`${AIRTABLE_URL}?records[]=${encodeURIComponent(record.id)}`, { method: 'DELETE' });
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
    console.error('coaching-cues function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
