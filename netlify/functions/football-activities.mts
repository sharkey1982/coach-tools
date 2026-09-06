/* ============================================================================
   Coach Tools · Football Activities function
   Proxies the "Football Activities" table in the Coach Tools Airtable base.
   Migrated 2026-09 from the old git-committed-manifest approach (this was
   the one write path in the whole app that didn't go through Airtable) —
   now it matches every other admin surface (syllabus, videos, players).

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by the syllabus/videos/players functions
     ADMIN_PASSWORD   — same shared password (checked site-wide by the edge gate)

   Two response shapes, matching the two files this replaced:
   - Manifest shape (list of activities — was _manifest.json):
       { id, name, source, focus, focusLabel, type, typeLabel, duration,
         tiers: [tier codes], value, summary, group, tagVariant, difficulty,
         ready, draft, favorite, hasDetail }
   - Detail shape (one activity's full write-up — was <id>.json):
       { id, name, source, discipline, focus, focusLabel, type, typeLabel,
         defaultTier, tiers: { ks1: {...}, lks2: {...}, uks2: {...} },
         equipment, space, diagram, base, tierDeltas, coachingCard, pairWith,
         group, tagVariant, draft }
   Complex nested content (tiers detail, equipment, space, base, etc.) is
   stored as `*JSON` text fields in Airtable, matching the app's existing
   convention (TeamsJSON, PresentJSON, WeeksJSON elsewhere) rather than being
   flattened into dozens of granular fields.

   "ready" and "draft" are exact opposites in this data, so Airtable only
   stores a single Draft checkbox (an unchecked Airtable checkbox is never
   returned by the API, which naturally matches "absent = ready"). This
   function still accepts/returns both `ready` and `draft` so every existing
   consumer (admin/activities's two separate checkboxes included) keeps
   working unchanged.

   GET  /.netlify/functions/football-activities
     -> { activities: [...] }  (manifest shape, all activities)

   GET  /.netlify/functions/football-activities?id=<slug>[.json]
     -> {...single activity, detail shape...}
     (accepts a trailing ".json" so it's a drop-in replacement for the old
     static per-activity file path used by shared/session-engine.js)

   PUT  /.netlify/functions/football-activities
     body: { password, id, name?, type?, duration?, summary?, source?, tiers?, group?, tagVariant?,
             focus?, focusLabel?, difficulty?, ready?, draft?, favorite? }
     -> { activity: {...manifest shape, updated...} }

   POST /.netlify/functions/football-activities
     body: { password, name, group, tagVariant?, focusLabel?, difficulty?, type?,
             duration?, tiers?, summary?, source?, value? }
     Adds a new Airtable record (Draft: true — same "needs full write-up"
     stub shape as before). id is slugified from name and must be unique.
     -> { activity: {...manifest shape, new...} }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tbltQfEVPnHtk2GeS';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
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

function safeParse(s: any, fallback: any) {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

function checkPassword(_supplied: string | undefined | null): boolean {
  // Password checks are now handled once, site-wide, by netlify/edge-functions/gate.ts.
  // Kept as a no-op so every call site below still compiles unchanged.
  return true;
}

function toManifestShape(record: any) {
  const f = record.fields || {};
  const draft = !!f['Draft'];
  return {
    recordId: record.id,
    id: f['Slug'] || '',
    name: f['Name'] || '',
    source: f['Source'] || '',
    focus: f['Focus'] || '',
    focusLabel: f['FocusLabel'] || '',
    type: f['Type'] || '',
    typeLabel: f['TypeLabel'] || '',
    duration: f['Duration'] || '',
    tiers: f['TierList'] || [],
    value: safeParse(f['ValueJSON'], null),
    summary: f['Summary'] || '',
    group: f['Group'] || '',
    tagVariant: !!f['TagVariant'],
    difficulty: f['Difficulty'] || '',
    ready: !draft,
    draft,
    favorite: !!f['Favorite'],
    hasDetail: !!f['HasDetail'],
  };
}

function toDetailShape(record: any) {
  const f = record.fields || {};
  return {
    recordId: record.id,
    id: f['Slug'] || '',
    name: f['Name'] || '',
    source: f['Source'] || '',
    discipline: f['Discipline'] || 'football',
    focus: f['Focus'] || '',
    focusLabel: f['FocusLabel'] || '',
    type: f['Type'] || '',
    typeLabel: f['TypeLabel'] || '',
    defaultTier: f['DefaultTier'] || '',
    tiers: safeParse(f['TiersDetailJSON'], {}),
    equipment: safeParse(f['EquipmentJSON'], []),
    space: safeParse(f['SpaceJSON'], null),
    diagram: f['Diagram'] || '',
    base: safeParse(f['BaseJSON'], null),
    tierDeltas: safeParse(f['TierDeltasJSON'], null),
    coachingCard: safeParse(f['CoachingCardJSON'], null),
    pairWith: safeParse(f['PairWithJSON'], []),
    group: f['Group'] || '',
    tagVariant: !!f['TagVariant'],
    draft: !!f['Draft'],
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

async function handleGet(url: URL) {
  let id = url.searchParams.get('id');
  if (id) {
    if (id.endsWith('.json')) id = id.slice(0, -5);
    const record = await findBySlug(id);
    if (!record) return json({ error: `No activity with id "${id}"` }, 404);
    return json(toDetailShape(record));
  }
  const all = await fetchAllRecords();
  return json({ activities: all.map(toManifestShape) });
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.id) return json({ error: 'id is required' }, 400);
  if (body.id === '__check__') return json({ ok: true }); // password-verification no-op used by the unlock screen

  const record = await findBySlug(body.id);
  if (!record) return json({ error: `No activity with id "${body.id}"` }, 404);

  const fields: Record<string, any> = {};
  const currentGroup = record.fields?.['Group'] || '';
  const nextGroup = body.group !== undefined ? body.group : currentGroup;

  if (body.name !== undefined) fields['Name'] = body.name;
  if (body.type !== undefined) fields['Type'] = body.type;
  if (body.duration !== undefined) fields['Duration'] = body.duration;
  if (body.summary !== undefined) fields['Summary'] = body.summary;
  if (body.source !== undefined) fields['Source'] = body.source;
  if (Array.isArray(body.tiers)) fields['TierList'] = body.tiers.filter((t: string) => VALID_TIERS.includes(t));
  if (body.focus !== undefined) fields['Focus'] = body.focus;
  if (body.focusLabel !== undefined) fields['FocusLabel'] = body.focusLabel;
  if (body.difficulty !== undefined) fields['Difficulty'] = body.difficulty || null;
  if (body.group !== undefined) fields['Group'] = body.group || null;
  if (body.tagVariant !== undefined) {
    fields['TagVariant'] = nextGroup === 'movement' ? !!body.tagVariant : false;
  }
  // "ready" and "draft" are opposites in this data; admin/activities shows both as separate
  // checkboxes a person could in theory leave inconsistent, so prefer "ready" (the primary/
  // first checkbox) when both are present, falling back to "draft" if only that was sent.
  if (body.ready !== undefined) fields['Draft'] = !body.ready;
  else if (body.draft !== undefined) fields['Draft'] = !!body.draft;
  if (body.favorite !== undefined) fields['Favorite'] = !!body.favorite;

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: record.id, fields }], typecast: true }),
  });
  return json({ activity: toManifestShape(result.records[0]) });
}

function slugify(name: string): string {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const VALID_GROUPS = ['movement', 'dribbling', 'ball-striking', 'match-play'];
const VALID_TIERS = ['ks1', 'lks2', 'uks2'];

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.name) return json({ error: 'name is required' }, 400);
  if (!VALID_GROUPS.includes(body.group)) return json({ error: 'A valid group is required' }, 400);

  let id = slugify(body.id || body.name);
  if (!id) return json({ error: 'Could not derive an id from that name' }, 400);
  const existing = await findBySlug(id);
  if (existing) return json({ error: `An activity with id "${id}" already exists` }, 409);

  const tiers = Array.isArray(body.tiers) ? body.tiers.filter((t: string) => VALID_TIERS.includes(t)) : [];

  const fields: Record<string, any> = {
    Slug: id,
    Name: body.name,
    Discipline: 'football',
    Source: body.source || 'Added via Activities Admin — needs full write-up',
    Focus: body.focus || '',
    FocusLabel: body.focusLabel || '',
    Type: body.type || '',
    Duration: body.duration || '',
    TierList: tiers.length ? tiers : VALID_TIERS.slice(),
    Summary: body.summary || 'Added via Activities Admin. Full write-up pending.',
    Group: body.group,
    Draft: true,
    HasDetail: false,
  };
  if (body.group === 'movement') fields['TagVariant'] = !!body.tagVariant;
  if (body.difficulty) fields['Difficulty'] = body.difficulty;
  if (body.favorite) fields['Favorite'] = true;
  if (body.value) fields['ValueJSON'] = JSON.stringify(body.value);

  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ activity: toManifestShape(result.records[0]) }, 201);
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet(new URL(req.url));

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'PUT') return await handlePut(body);
    if (req.method === 'POST') return await handlePost(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('football-activities function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
