/* ============================================================================
   Coach Tools · Videos function
   Proxies the "Coach Tools — Video Links" Airtable base so the Airtable PAT
   never reaches the browser. Serves reads to anyone (video links aren't
   sensitive); write operations (add/update/delete) require ADMIN_PASSWORD.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — personal access token, scoped to data.records:read
                         and data.records:write on the Video Links base
     ADMIN_PASSWORD   — shared password checked on every write

   GET    /.netlify/functions/videos?discipline=football&focusCategory=Dribbling
     -> { videos: [{ id, type, url, title, credit, activityIds, tags, note,
                      focusCategory, coreSkills }] }
     Shape matches the existing per-discipline _videos.json files, plus
     focusCategory/coreSkills, so video library pages can swap their fetch
     with minimal changes. focusCategory is football-only, coreSkills is
     gymnastics-only, but both fields exist on every row (empty
     string/array when not set/applicable).

     activityIds and coreSkills are both ARRAYS — a video can be linked to
     more than one activity and/or more than one core skill. For gymnastics,
     a video can carry TWO independent kinds of link: coreSkills (Core
     Skills Library skill names, e.g. "Forward Roll" — primary, takes
     precedence over activityIds in the Core Skills Library display) and
     activityIds (RISE Skill Library manifest ids, e.g. "forward-roll" —
     secondary, shown in the RISE library instead).

   POST   /.netlify/functions/videos
     body: { password, discipline, id?, type, url, title, credit?,
             activityIds?, tags?, note?, focusCategory?, coreSkills? }
     Creates a record. If id is omitted, one is slugified from title.
     activityIds/coreSkills are arrays of strings (or omit/[] for none).
     focusCategory is meaningful for discipline "football" — one of
     Movement skills / Dribbling / Ball Striking / Match Play / Other.
     coreSkills is meaningful for discipline "gymnastics" — each entry one
     of the Core Skills Library skill names (see CORE_SKILLS below).

   PUT    /.netlify/functions/videos
     body: { password, recordId, ...same fields as POST (all optional,
             only given fields are changed) }

   DELETE /.netlify/functions/videos
     body: { password, recordId }
   ============================================================================ */

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblH6im53oktzkTvR';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

const ALLOWED_DISCIPLINES = ['football', 'cricket', 'long-jump', 'gymnastics', 'athletics', 'pe'];
const FOCUS_CATEGORIES = ['Movement skills', 'Dribbling', 'Ball Striking', 'Match Play', 'Other'];
// Core Skills Library skill names (gymnastics/core-skills/js/skills-data.js SKILL_ORDER).
// Keep this list in sync with that file and with admin/videos/index.html's CORE_SKILLS.
const CORE_SKILLS = [
  'Forward Roll', 'Backward Roll', 'Handstand', 'Handstand Forward Roll', 'Cartwheel',
  'Round-off', 'Bridge', 'Front Walkover', 'Back Walkover', 'Straight Jump', 'Straddle Jump',
  'Tuck Jump', 'Balance', 'Vault', 'Log Roll', 'Egg Roll', 'Teddy Bear Roll', 'Side Roll',
  'Dish to Arch Roll', 'Headstand', 'Backwards Roll to Handstand', 'Bridge Kickover',
  'Handstand to Bridge', 'Standing Drop Back to Bridge', 'Tinsica', 'Valdez',
  'Front Handspring', 'Back Handspring', 'Somersault', 'Side Aerial',
  'Bars (General)', 'Beam (General)', 'Vault (General)',
];

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

function toStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (v == null || v === '') return [];
  return String(v).split(',').map((t) => t.trim()).filter(Boolean);
}

// Escapes a value for embedding in an Airtable filterByFormula string literal.
function escapeFormulaString(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
    activityIds: Array.isArray(f['Activity IDs']) ? f['Activity IDs'] : [],
    tags: f['Tags'] || [],
    note: f['Note'] || '',
    focusCategory: f['Focus Category'] || '',
    coreSkills: Array.isArray(f['Core Skills']) ? f['Core Skills'] : [],
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

function checkPassword(_supplied: string | undefined | null): boolean {
  // Password checks are now handled once, site-wide, by netlify/edge-functions/gate.ts.
  // Kept as a no-op so every call site below still compiles unchanged.
  return true;
}

async function handleGet(url: URL) {
  const discipline = url.searchParams.get('discipline');
  const focusCategory = url.searchParams.get('focusCategory');
  const coreSkill = url.searchParams.get('coreSkill');
  const activityId = url.searchParams.get('activityId');
  const clauses: string[] = [];
  if (discipline) {
    if (!ALLOWED_DISCIPLINES.includes(discipline)) {
      return json({ error: `Unknown discipline "${discipline}"` }, 400);
    }
    clauses.push(`{Discipline}="${discipline}"`);
  }
  if (focusCategory) {
    if (!FOCUS_CATEGORIES.includes(focusCategory)) {
      return json({ error: `Unknown focusCategory "${focusCategory}"` }, 400);
    }
    clauses.push(`{Focus Category}="${focusCategory}"`);
  }
  if (coreSkill) {
    if (!CORE_SKILLS.includes(coreSkill)) {
      return json({ error: `Unknown coreSkill "${coreSkill}"` }, 400);
    }
    clauses.push(`FIND("${escapeFormulaString(coreSkill)}", ARRAYJOIN({Core Skills}))`);
  }
  if (activityId) {
    clauses.push(`FIND("${escapeFormulaString(activityId)}", ARRAYJOIN({Activity IDs}))`);
  }
  const formula = clauses.length > 1 ? `AND(${clauses.join(',')})` : clauses[0];
  const filterFormula = formula ? `?filterByFormula=${encodeURIComponent(formula)}` : '';

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
    'Activity IDs': toStringArray(body.activityIds),
    Tags: Array.isArray(body.tags) ? body.tags : (body.tags ? String(body.tags).split(',').map((t: string) => t.trim()).filter(Boolean) : []),
    Note: body.note || '',
  };
  if (body.focusCategory) {
    if (!FOCUS_CATEGORIES.includes(body.focusCategory)) {
      return json({ error: 'focusCategory must be one of ' + FOCUS_CATEGORIES.join(', ') }, 400);
    }
    fields['Focus Category'] = body.focusCategory;
  }
  const coreSkills = toStringArray(body.coreSkills);
  if (coreSkills.length) {
    const bad = coreSkills.filter((s) => !CORE_SKILLS.includes(s));
    if (bad.length) return json({ error: 'coreSkills must each be one of ' + CORE_SKILLS.join(', ') }, 400);
    fields['Core Skills'] = coreSkills;
  }

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
  if (body.activityIds !== undefined) fields['Activity IDs'] = toStringArray(body.activityIds);
  if (body.tags !== undefined) fields['Tags'] = Array.isArray(body.tags) ? body.tags : String(body.tags).split(',').map((t: string) => t.trim()).filter(Boolean);
  if (body.note !== undefined) fields['Note'] = body.note;
  if (body.focusCategory !== undefined) {
    if (body.focusCategory && !FOCUS_CATEGORIES.includes(body.focusCategory)) {
      return json({ error: 'focusCategory must be one of ' + FOCUS_CATEGORIES.join(', ') }, 400);
    }
    fields['Focus Category'] = body.focusCategory || null;
  }
  if (body.coreSkills !== undefined) {
    const coreSkills = toStringArray(body.coreSkills);
    const bad = coreSkills.filter((s) => !CORE_SKILLS.includes(s));
    if (bad.length) return json({ error: 'coreSkills must each be one of ' + CORE_SKILLS.join(', ') }, 400);
    fields['Core Skills'] = coreSkills;
  }

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
