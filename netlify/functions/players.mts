/* ============================================================================
   Coach Tools · Players function
   Proxies TWO Airtable tables — "Football Players" and "Gymnastics Players" —
   presenting them to the app as one unified list, the same as the single
   "Players" table this replaced (2026-09-12 rebuild). A Players row now lives
   in exactly one discipline's table; a child who does two disciplines gets
   two rows (one per table), each linked to the same Student — same model as
   before, just no longer able to silently mix disciplines' fields together
   in one wide table. The old "Players" table is renamed/archived, not
   deleted, and is no longer read or written by this function.

   Only football and gymnastics have a dedicated table today. cricket /
   long-jump / general-pe remain valid Discipline concepts elsewhere in the
   app, but there's no Players data for them yet — add a table + a case here
   the same way, when that's actually needed.

   Unlike videos, this data is about real children (likes, dislikes, notes),
   so EVERY operation — reads included — requires ADMIN_PASSWORD.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by the videos function
     ADMIN_PASSWORD   — same shared password used by the videos function

   GET    /.netlify/functions/players?password=xxx
     -> { players: [{ id, name, surname, group, squadTeam, weekday, setting,
                       abilityGroup, discipline, positions, preferredFoot,
                       squad, competition, likes, dislikes, skillsCompleted,
                       notes, studentId }] }
     (discipline: single-element array, e.g. ['football'] — kept as an array
     for compatibility with existing front-end filtering code, but a row can
     only ever belong to one discipline now, since that's which table it's
     stored in.)
     (abilityGroup / positions / preferredFoot: football-only — always '' / []
     for a gymnastics row, since that table has no such fields.)
     (squadTeam / setting / squad / competition: gymnastics-only — always
     [] / [] / false / [] for a football row, for the same reason.)
     (surname: not stored here — identity fields live on the linked Student.
     Always '' from this endpoint; read the Student record for it.)
     (gender: not stored here either, same reason — always ''.)
     (studentId: record id of the linked master Students record. Required on
     every row — see netlify/functions/students.mts. This is a real Airtable
     link field, so PUTting studentId here also updates that Student's
     "Players" link.)

   POST   /.netlify/functions/players
     body: { password, studentId, name, discipline, group?, abilityGroup?,
             positions?, preferredFoot?, squadTeam?, weekday?, setting?,
             squad?, competition?, likes?, dislikes?, skillsCompleted?,
             notes? }
     `discipline` must be exactly one of 'football' | 'gymnastics' (a single
     string, not an array) — it picks which table the row is created in and
     can't be changed afterwards (delete and recreate in the other table if
     a child's discipline was wrong).

   PUT    /.netlify/functions/players
     body: { password, recordId, discipline, ...same optional fields as POST }
     `discipline` is required here too, so the function knows which table
     `recordId` lives in — the app already has this on every loaded player.

   DELETE /.netlify/functions/players
     body: { password, recordId, discipline }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';

const TABLES: Record<string, string> = {
  football: 'tbl7AyHrhDkk5PJ1N',
  gymnastics: 'tblxhoe6hDsTQhQw0',
};
const DISCIPLINES = Object.keys(TABLES);

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function normalizeDiscipline(value: any): string | null {
  const v = String(value || '').toLowerCase();
  return DISCIPLINES.includes(v) ? v : null;
}

function toPlayerShape(record: any, discipline: string) {
  const f = record.fields || {};
  return {
    id: record.id,
    recordId: record.id,
    name: f['Name'] || '',
    surname: '', // identity fields live on the linked Student, not here
    group: f['Group'] || '',
    discipline: [discipline],
    studentId: (f['Student'] || [])[0] || '',
    likes: f['Likes'] || '',
    dislikes: f['Dislikes'] || '',
    skillsCompleted: f['Skills completed'] || '',
    notes: f['Notes'] || '',
    // Football-only fields — empty defaults on a gymnastics row.
    abilityGroup: discipline === 'football' ? (f['Ability Group'] || '') : '',
    positions: discipline === 'football'
      ? (f['Positions'] || []).map((label: string) => POSITION_SLUGS[label] || label.toLowerCase())
      : [],
    preferredFoot: discipline === 'football' ? (FOOT_SLUGS[f['Preferred Foot']] || '') : '',
    // Gymnastics-only fields — empty defaults on a football row.
    squadTeam: discipline === 'gymnastics' ? (f['Squad Team'] || []) : [],
    setting: discipline === 'gymnastics' ? (f['Setting'] || []) : [],
    squad: discipline === 'gymnastics' ? !!f['Squad'] : false,
    competition: discipline === 'gymnastics' ? (f['Competition'] || []) : [],
    // Weekday exists on both tables.
    weekday: f['Weekday'] || [],
    gender: '', // identity field — lives on the linked Student
  };
}

async function airtableFetch(tableId: string, path: string, init?: RequestInit) {
  const pat = Netlify.env.get('AIRTABLE_PAT');
  if (!pat) throw new Error('AIRTABLE_PAT not configured');
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}${path}`;
  const res = await fetch(url, {
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

async function fetchAllFromTable(discipline: string) {
  const tableId = TABLES[discipline];
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(tableId, offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);
  return all.map((record) => toPlayerShape(record, discipline));
}

async function handleGet(url: URL) {
  const password = url.searchParams.get('password');
  if (!checkPassword(password)) return json({ error: 'Incorrect password' }, 401);

  const results = await Promise.all(DISCIPLINES.map(fetchAllFromTable));
  return json({ players: results.flat() });
}

function buildFields(discipline: string, body: any, partial: boolean) {
  const fields: Record<string, any> = {};
  const set = (key: string, value: any) => { if (value !== undefined) fields[key] = value; };
  const multiSelect = (value: any, allowed: string[]) => {
    const arr = Array.isArray(value)
      ? value
      : (value ? String(value).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    return arr.filter((x: string) => allowed.includes(x));
  };

  if (!partial || body.name !== undefined) set('Name', body.name);
  if (!partial || body.group !== undefined) set('Group', body.group || '');
  if (!partial || body.likes !== undefined) set('Likes', body.likes || '');
  if (!partial || body.dislikes !== undefined) set('Dislikes', body.dislikes || '');
  if (!partial || body.skillsCompleted !== undefined) set('Skills completed', body.skillsCompleted || '');
  if (!partial || body.notes !== undefined) set('Notes', body.notes || '');
  if (!partial || body.weekday !== undefined) set('Weekday', multiSelect(body.weekday, ALLOWED_WEEKDAYS));
  if (!partial || body.studentId !== undefined) {
    set('Student', body.studentId ? [body.studentId] : []);
  }

  if (discipline === 'football') {
    if (!partial || body.abilityGroup !== undefined) {
      const ag = body.abilityGroup ? String(body.abilityGroup) : '';
      set('Ability Group', ['1', '1-2', '2'].includes(ag) ? ag : null);
    }
    if (!partial || body.positions !== undefined) {
      const p = Array.isArray(body.positions)
        ? body.positions
        : (body.positions ? String(body.positions).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
      set('Positions', p.filter((x: string) => POSITION_LABELS[x]).map((x: string) => POSITION_LABELS[x]));
    }
    if (!partial || body.preferredFoot !== undefined) {
      const foot = body.preferredFoot ? String(body.preferredFoot) : '';
      set('Preferred Foot', FOOT_LABELS[foot] || null);
    }
  }

  if (discipline === 'gymnastics') {
    if (!partial || body.squadTeam !== undefined) set('Squad Team', multiSelect(body.squadTeam, ALLOWED_SQUAD_TEAMS));
    if (!partial || body.setting !== undefined) set('Setting', multiSelect(body.setting, ALLOWED_SETTINGS));
    if (!partial || body.squad !== undefined) set('Squad', !!body.squad);
    if (!partial || body.competition !== undefined) set('Competition', multiSelect(body.competition, ALLOWED_COMPETITIONS));
  }

  return fields;
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.studentId) return json({ error: 'studentId is required — player records link to an existing Student rather than a typed name' }, 400);
  if (!body.name) return json({ error: 'name is required' }, 400);
  const discipline = normalizeDiscipline(body.discipline);
  if (!discipline) return json({ error: `discipline must be one of: ${DISCIPLINES.join(', ')}` }, 400);

  const fields = buildFields(discipline, body, false);
  const result = await airtableFetch(TABLES[discipline], '', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ player: toPlayerShape(result.records[0], discipline) }, 201);
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);
  const discipline = normalizeDiscipline(body.discipline);
  if (!discipline) return json({ error: `discipline is required and must be one of: ${DISCIPLINES.join(', ')}` }, 400);

  const fields = buildFields(discipline, body, true);
  const result = await airtableFetch(TABLES[discipline], '', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ player: toPlayerShape(result.records[0], discipline) });
}

async function handleDelete(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);
  const discipline = normalizeDiscipline(body.discipline);
  if (!discipline) return json({ error: `discipline is required and must be one of: ${DISCIPLINES.join(', ')}` }, 400);

  await airtableFetch(TABLES[discipline], `?records[]=${encodeURIComponent(body.recordId)}`, { method: 'DELETE' });
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
