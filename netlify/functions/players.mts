/* ============================================================================
   Coach Tools · Players function
   Proxies the "Players" table in the Coach Tools Airtable base. Unlike videos,
   this data is about real children (likes, dislikes, notes), so EVERY
   operation — reads included — requires ADMIN_PASSWORD.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by the videos function
     ADMIN_PASSWORD   — same shared password used by the videos function

   GET    /.netlify/functions/players?password=xxx
     -> { players: [{ id, name, group, abilityGroup, discipline, positions,
                       likes, dislikes, skillsCompleted, notes }] }
     (abilityGroup: '' | '1' | '2' — a coaching ability tag, independent of
     "group", which is the free-text class/cohort e.g. "Y3/4 Tuesday Football")
     (positions: array of 'goalkeeper' | 'defender' | 'midfielder' | 'attacker'
     — football natural position(s); more than one flags a player who can
     cover multiple positions, particularly goalkeeper)

   POST   /.netlify/functions/players
     body: { password, name, group?, abilityGroup?, discipline?, positions?,
             likes?, dislikes?, skillsCompleted?, notes? }

   PUT    /.netlify/functions/players
     body: { password, recordId, ...same fields as POST (all optional,
             only given fields are changed) }

   DELETE /.netlify/functions/players
     body: { password, recordId }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblhd852cId0y3UyY';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

const ALLOWED_DISCIPLINES = ['football', 'cricket', 'long-jump', 'gymnastics', 'general-pe'];

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: 'Goalkeeper',
  defender: 'Defender',
  midfielder: 'Midfielder',
  attacker: 'Attacker',
};
const POSITION_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(POSITION_LABELS).map(([slug, label]) => [label, slug])
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toPlayerShape(record: any) {
  const f = record.fields || {};
  return {
    id: record.id,
    recordId: record.id,
    name: f['Name'] || '',
    group: f['Group'] || '',
    abilityGroup: f['Ability Group'] || '',
    discipline: f['Discipline'] || [],
    positions: (f['Positions'] || []).map((label: string) => POSITION_SLUGS[label] || label.toLowerCase()),
    likes: f['Likes'] || '',
    dislikes: f['Dislikes'] || '',
    skillsCompleted: f['Skills completed'] || '',
    notes: f['Notes'] || '',
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
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function checkPassword(supplied: string | undefined | null): boolean {
  const expected = Netlify.env.get('ADMIN_PASSWORD');
  return !!expected && !!supplied && supplied === expected;
}

async function handleGet(url: URL) {
  const password = url.searchParams.get('password');
  if (!checkPassword(password)) return json({ error: 'Incorrect password' }, 401);

  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);

  return json({ players: all.map(toPlayerShape) });
}

function buildFields(body: any, partial: boolean) {
  const fields: Record<string, any> = {};
  const set = (key: string, value: any) => { if (value !== undefined) fields[key] = value; };
  if (!partial || body.name !== undefined) set('Name', body.name);
  if (!partial || body.group !== undefined) set('Group', body.group || '');
  if (!partial || body.abilityGroup !== undefined) {
    const ag = body.abilityGroup ? String(body.abilityGroup) : '';
    set('Ability Group', ['1', '2'].includes(ag) ? ag : null); // null clears a singleSelect
  }
  if (!partial || body.discipline !== undefined) {
    const d = Array.isArray(body.discipline)
      ? body.discipline
      : (body.discipline ? String(body.discipline).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    set('Discipline', d.filter((x: string) => ALLOWED_DISCIPLINES.includes(x)));
  }
  if (!partial || body.positions !== undefined) {
    const p = Array.isArray(body.positions)
      ? body.positions
      : (body.positions ? String(body.positions).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    set('Positions', p.filter((x: string) => POSITION_LABELS[x]).map((x: string) => POSITION_LABELS[x]));
  }
  if (!partial || body.likes !== undefined) set('Likes', body.likes || '');
  if (!partial || body.dislikes !== undefined) set('Dislikes', body.dislikes || '');
  if (!partial || body.skillsCompleted !== undefined) set('Skills completed', body.skillsCompleted || '');
  if (!partial || body.notes !== undefined) set('Notes', body.notes || '');
  return fields;
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.name) return json({ error: 'name is required' }, 400);

  const fields = buildFields(body, false);
  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ player: toPlayerShape(result.records[0]) }, 201);
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields = buildFields(body, true);
  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ player: toPlayerShape(result.records[0]) });
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
    console.error('players function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};

