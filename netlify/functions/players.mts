/* ============================================================================
   Coach Tools · Players function
   Proxies the "Players" table in the Coach Tools Airtable base. Unlike videos,
   this data is about real children (likes, dislikes, notes), so EVERY
   operation — reads included — requires ADMIN_PASSWORD.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by the videos function
     ADMIN_PASSWORD   — same shared password used by the videos function

   GET    /.netlify/functions/players?password=xxx
     -> { players: [{ id, name, surname, group, squadTeam, weekday, setting,
                       abilityGroup, discipline, positions, preferredFoot,
                       squad, competition, likes, dislikes, skillsCompleted,
                       notes, studentId }] }
     (abilityGroup: '' | '1' | '1-2' | '2' — a coaching ability tag, independent
     of "group", which is the free-text class/cohort e.g. "Y3/4 Tuesday Football".
     '1-2' flags a player who is between the two groups / middling ability)
     (positions: array of 'goalkeeper' | 'defender' | 'midfielder' | 'attacker'
     — football natural position(s); more than one flags a player who can
     cover multiple positions, particularly goalkeeper)
     (preferredFoot: '' | 'left' | 'right' | 'both')
     (gender: '' | 'male' | 'female' — displayed/stored in Airtable as Boy/Girl)
     (surname: full surname where known, otherwise a surname initial)
     (squadTeam: array of gymnastics squad age-team tags, e.g. 'U7'..'U11')
     (weekday: array of regular coaching/session weekday(s))
     (setting: array of coaching setting(s) attended, e.g. 'School', 'Twisters')
     (squad: bool — selected for a gymnastics squad/team)
     (competition: array of school gymnastics competitions selected for,
     e.g. 'ISGA', 'IAPS', 'ISA')
     (studentId: record id of the linked master Students record, or '' if this
     participation record hasn't been reconciled to a Student yet — see
     netlify/functions/students.mts. This is a real Airtable link field, so
     PUTting studentId here also updates that Student's "Players" link.)

   POST   /.netlify/functions/players
     body: { password, name, surname?, group?, squadTeam?, weekday?, setting?,
             abilityGroup?, discipline?, positions?, preferredFoot?, gender?,
             squad?, competition?, likes?, dislikes?, skillsCompleted?,
             notes?, studentId? }

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

// These four pass through as literal strings (no slug<->label mapping needed —
// the Airtable option names are already the values the app should use).
const ALLOWED_SQUAD_TEAMS = ['U7', 'U8', 'U9', 'U10', 'U11'];
const ALLOWED_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ALLOWED_SETTINGS = ['Twisters', 'School'];
const ALLOWED_COMPETITIONS = ['ISGA', 'IAPS', 'ISA'];

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: 'Goalkeeper',
  defender: 'Defender',
  midfielder: 'Midfielder',
  attacker: 'Attacker',
};
const POSITION_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(POSITION_LABELS).map(([slug, label]) => [label, slug])
);

const FOOT_LABELS: Record<string, string> = { left: 'Left', right: 'Right', both: 'Both' };
const FOOT_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(FOOT_LABELS).map(([slug, label]) => [label, slug])
);

const GENDER_LABELS: Record<string, string> = { male: 'Boy', female: 'Girl' };
const GENDER_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(GENDER_LABELS).map(([slug, label]) => [label, slug])
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
    surname: f['Surname'] || '',
    group: f['Group'] || '',
    squadTeam: f['Squad Team'] || [],
    weekday: f['Weekday'] || [],
    setting: f['Setting'] || [],
    abilityGroup: f['Ability Group'] || '',
    discipline: f['Discipline'] || [],
    positions: (f['Positions'] || []).map((label: string) => POSITION_SLUGS[label] || label.toLowerCase()),
    preferredFoot: FOOT_SLUGS[f['Preferred Foot']] || '',
    gender: GENDER_SLUGS[f['Gender']] || '',
    squad: !!f['Squad'],
    competition: f['Competition'] || [],
    likes: f['Likes'] || '',
    dislikes: f['Dislikes'] || '',
    skillsCompleted: f['Skills completed'] || '',
    notes: f['Notes'] || '',
    studentId: (f['Student'] || [])[0] || '',
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

function checkPassword(_supplied: string | undefined | null): boolean {
  // Password checks are now handled once, site-wide, by netlify/edge-functions/gate.ts.
  // Kept as a no-op so every call site below still compiles unchanged.
  return true;
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
  const multiSelect = (value: any, allowed: string[]) => {
    const arr = Array.isArray(value)
      ? value
      : (value ? String(value).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    return arr.filter((x: string) => allowed.includes(x));
  };

  if (!partial || body.name !== undefined) set('Name', body.name);
  if (!partial || body.surname !== undefined) set('Surname', body.surname || '');
  if (!partial || body.group !== undefined) set('Group', body.group || '');
  if (!partial || body.squadTeam !== undefined) set('Squad Team', multiSelect(body.squadTeam, ALLOWED_SQUAD_TEAMS));
  if (!partial || body.weekday !== undefined) set('Weekday', multiSelect(body.weekday, ALLOWED_WEEKDAYS));
  if (!partial || body.setting !== undefined) set('Setting', multiSelect(body.setting, ALLOWED_SETTINGS));
  if (!partial || body.squad !== undefined) set('Squad', !!body.squad);
  if (!partial || body.competition !== undefined) set('Competition', multiSelect(body.competition, ALLOWED_COMPETITIONS));
  if (!partial || body.abilityGroup !== undefined) {
    const ag = body.abilityGroup ? String(body.abilityGroup) : '';
    set('Ability Group', ['1', '1-2', '2'].includes(ag) ? ag : null); // null clears a singleSelect
  }
  if (!partial || body.discipline !== undefined) {
    const d = Array.isArray(body.discipline)
      ? body.discipline
      : (body.discipline ? String(body.discipline).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    // Case-insensitive match against the canonical lowercase values, so a
    // stray "Football"/"Gymnastics" typed elsewhere never creates a second,
    // differently-cased duplicate option in Airtable (see 2026-09 incident).
    set('Discipline', d
      .map((x: string) => ALLOWED_DISCIPLINES.find((allowed) => allowed.toLowerCase() === String(x).toLowerCase()))
      .filter((x: string | undefined): x is string => !!x));
  }
  if (!partial || body.positions !== undefined) {
    const p = Array.isArray(body.positions)
      ? body.positions
      : (body.positions ? String(body.positions).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    set('Positions', p.filter((x: string) => POSITION_LABELS[x]).map((x: string) => POSITION_LABELS[x]));
  }
  if (!partial || body.preferredFoot !== undefined) {
    const foot = body.preferredFoot ? String(body.preferredFoot) : '';
    set('Preferred Foot', FOOT_LABELS[foot] || null); // null clears a singleSelect
  }
  if (!partial || body.gender !== undefined) {
    const g = body.gender ? String(body.gender) : '';
    set('Gender', GENDER_LABELS[g] || null); // null clears a singleSelect
  }
  if (!partial || body.likes !== undefined) set('Likes', body.likes || '');
  if (!partial || body.dislikes !== undefined) set('Dislikes', body.dislikes || '');
  if (!partial || body.skillsCompleted !== undefined) set('Skills completed', body.skillsCompleted || '');
  if (!partial || body.notes !== undefined) set('Notes', body.notes || '');
  if (!partial || body.studentId !== undefined) {
    set('Student', body.studentId ? [body.studentId] : []);
  }
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

