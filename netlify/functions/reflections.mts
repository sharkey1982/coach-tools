/* ============================================================================
   Coach Tools · Reflections function
   Proxies the "Reflections" Airtable table so the Airtable PAT never reaches
   the browser. Covers session/observation reflections across every
   discipline (not just football) plus general notes with no discipline tie
   at all (e.g. observing someone else's session). Reads are public (same
   category of content as videos/syllabus/constraints) — writes are open too
   since the site-wide edge gate is the only barrier now (see gate.ts).

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by players/videos/syllabus/etc.

   GET    /.netlify/functions/reflections?discipline=Football&week=6
     -> { reflections: [{ id, recordId, date, discipline, week,
                           sessionLabel, reflection, tags, source }] }
     discipline/week are optional filters, applied server-side after
     fetching (dataset is small — no need for an Airtable formula filter).
     Sorted newest-first by date.

   POST   /.netlify/functions/reflections
     body: { discipline, date?, week?, sessionLabel?, reflection, tags?, source? }
     Creates a new reflection record. `reflection` and `discipline` are
     required; everything else is optional (week is blank for general/
     observed notes that aren't tied to a specific syllabus week).

   PUT    /.netlify/functions/reflections
     body: { recordId, ...same fields as POST (all optional, only given
             fields are changed) }

   DELETE /.netlify/functions/reflections
     body: { recordId }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblb2CS2yva7IC1jy';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

const DISCIPLINES = ['Football', 'Gymnastics', 'Cricket', 'Athletics', 'General PE', 'General', 'Other'];
const SOURCES = ['Coach entry', 'Observed session', 'ChatGPT draft'];
const TAGS = ['Coaching technique', 'Behaviour', 'Safeguarding', 'Idea for next session', 'Player development', 'Session structure'];

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

function toReflectionShape(record: any) {
  const f = record.fields || {};
  return {
    id: record.id,
    recordId: record.id,
    date: f['Date'] || '',
    discipline: f['Discipline'] || '',
    week: typeof f['Week'] === 'number' ? f['Week'] : null,
    sessionLabel: f['SessionLabel'] || '',
    reflection: f['Reflection'] || '',
    tags: Array.isArray(f['Tags']) ? f['Tags'] : [],
    source: f['Source'] || '',
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

function normalizeTags(input: any): string[] | undefined {
  if (input === undefined) return undefined;
  const arr = Array.isArray(input) ? input : String(input).split(',').map(s => s.trim());
  return arr.filter((t: string) => TAGS.includes(t));
}

async function handleGet(url: URL) {
  const discipline = url.searchParams.get('discipline');
  const week = url.searchParams.get('week');

  const all = await fetchAll();
  let reflections = all.map(toReflectionShape);

  if (discipline) reflections = reflections.filter(r => r.discipline === discipline);
  if (week !== null && week !== '') {
    const w = Number(week);
    reflections = reflections.filter(r => r.week === w);
  }

  reflections.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return json({ reflections });
}

async function handlePost(body: any) {
  if (!body.reflection) return json({ error: 'reflection is required' }, 400);
  if (!body.discipline || !DISCIPLINES.includes(body.discipline)) {
    return json({ error: `discipline must be one of: ${DISCIPLINES.join(', ')}` }, 400);
  }

  const fields: Record<string, any> = {
    Discipline: body.discipline,
    Reflection: body.reflection,
    Date: body.date || null,
    SessionLabel: body.sessionLabel || '',
  };
  if (body.week !== undefined && body.week !== null && body.week !== '') {
    fields.Week = Number(body.week);
  }
  const tags = normalizeTags(body.tags);
  if (tags !== undefined) fields.Tags = tags;
  if (body.source !== undefined && SOURCES.includes(body.source)) fields.Source = body.source;

  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ reflection: toReflectionShape(result.records[0]) }, 201);
}

async function handlePut(body: any) {
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields: Record<string, any> = {};
  if (body.discipline !== undefined) {
    if (!DISCIPLINES.includes(body.discipline)) {
      return json({ error: `discipline must be one of: ${DISCIPLINES.join(', ')}` }, 400);
    }
    fields.Discipline = body.discipline;
  }
  if (body.reflection !== undefined) fields.Reflection = body.reflection;
  if (body.date !== undefined) fields.Date = body.date || null;
  if (body.sessionLabel !== undefined) fields.SessionLabel = body.sessionLabel;
  if (body.week !== undefined) fields.Week = body.week === null || body.week === '' ? null : Number(body.week);
  const tags = normalizeTags(body.tags);
  if (tags !== undefined) fields.Tags = tags;
  if (body.source !== undefined && SOURCES.includes(body.source)) fields.Source = body.source;

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ reflection: toReflectionShape(result.records[0]) });
}

async function handleDelete(body: any) {
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
    console.error('reflections function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
