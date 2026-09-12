/* ============================================================================
   Coach Tools · Students function
   Proxies the "Students" table in the Coach Tools Airtable base — the master
   identity record for each child (name, DOB, school, cohort). Discipline
   participation detail (ability, position, squad, etc.) stays on "Players";
   see netlify/functions/players.mts. A Player links back to its Student via
   the "Student" field there — that field and this table's "Players" field
   are the two halves of the same Airtable link, so writing either side keeps
   both in sync automatically.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by every other Airtable-backed function

   GET    /.netlify/functions/students?password=xxx
     -> { students: [{ id, recordId, studentName, firstName, surname,
                        currentYearSource, gender, school, dob, cohortOverride,
                        notes, playerIds, receptionStartYear }] }
     (gender: '' | 'male' | 'female')
     (currentYearSource: interim/legacy year-group text migrated from Players;
     a trailing '?' or a slash like 'Y5/Y6' means Chris deliberately left it
     unresolved — never silently "clean up" these values.)
     (playerIds: record ids of linked Players — a Student can have more than
     one across disciplines, though today's app mostly has one per child.)

   POST   /.netlify/functions/students
     body: { password, studentName, firstName?, surname?, currentYearSource?,
             gender?, school?, dob?, cohortOverride?, notes?, playerIds?,
             receptionStartYear? }

   PUT    /.netlify/functions/students
     body: { password, recordId, ...same fields as POST (all optional,
             only given fields are changed) }

   DELETE /.netlify/functions/students
     body: { password, recordId }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tblFvvH5GfZWeKivi';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

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

function toStudentShape(record: any) {
  const f = record.fields || {};
  return {
    id: record.id,
    recordId: record.id,
    studentName: f['Student Name'] || '',
    firstName: f['First Name'] || '',
    surname: f['Surname'] || '',
    currentYearSource: f['Current Year Source'] || '',
    gender: GENDER_SLUGS[f['Gender']] || '',
    school: f['School'] || '',
    dob: f['Date of Birth'] || '',
    cohortOverride: f['Cohort Override'] || '',
    notes: f['Notes'] || '',
    playerIds: f['Players'] || [],
    receptionStartYear: f['Reception Start Year'] ?? null,
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

  return json({ students: all.map(toStudentShape) });
}

function buildFields(body: any, partial: boolean) {
  const fields: Record<string, any> = {};
  const set = (key: string, value: any) => { if (value !== undefined) fields[key] = value; };
  if (!partial || body.studentName !== undefined) set('Student Name', body.studentName);
  if (!partial || body.firstName !== undefined) set('First Name', body.firstName || '');
  if (!partial || body.surname !== undefined) set('Surname', body.surname || '');
  if (!partial || body.currentYearSource !== undefined) set('Current Year Source', body.currentYearSource || '');
  if (!partial || body.gender !== undefined) {
    const g = body.gender ? String(body.gender) : '';
    set('Gender', GENDER_LABELS[g] || null); // null clears a singleSelect
  }
  if (!partial || body.school !== undefined) set('School', body.school || '');
  if (!partial || body.dob !== undefined) set('Date of Birth', body.dob || null);
  if (!partial || body.cohortOverride !== undefined) set('Cohort Override', body.cohortOverride || '');
  if (!partial || body.notes !== undefined) set('Notes', body.notes || '');
  if (!partial || body.playerIds !== undefined) {
    const p = Array.isArray(body.playerIds) ? body.playerIds : (body.playerIds ? [body.playerIds] : []);
    set('Players', p.filter(Boolean));
  }
  if (!partial || body.receptionStartYear !== undefined) {
    const y = body.receptionStartYear;
    set('Reception Start Year', (y === '' || y === null || y === undefined) ? null : Number(y));
  }
  return fields;
}

async function handlePost(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.studentName) return json({ error: 'studentName is required' }, 400);

  const fields = buildFields(body, false);
  const result = await airtableFetch('', {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  return json({ student: toStudentShape(result.records[0]) }, 201);
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields = buildFields(body, true);
  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ student: toStudentShape(result.records[0]) });
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
    console.error('students function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
