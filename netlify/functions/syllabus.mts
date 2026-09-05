/* ============================================================================
   Coach Tools · Syllabus function
   Proxies the "Syllabus" table (football, 12 weeks) in the Coach Tools
   Airtable base. Reads are public (same as videos — this is coaching content,
   not sensitive data); writes require ADMIN_PASSWORD so Chris can edit each
   week's content from the admin page.

   Env vars required (set in Netlify site settings):
     AIRTABLE_PAT     — same token used by the videos/players functions
     ADMIN_PASSWORD   — same shared password used by the videos/players functions

   GET    /.netlify/functions/syllabus
     -> { weeks: [{ recordId, week, block, blockName, headlineFocus,
                     learningProgression, arrivalGame, activity1, activity2,
                     finishing, needsReview, weekBeginning, clubDate,
                     fixtureNote, activity1AId, activity1BId, activity1Note,
                     activity2AId, activity2BId, activity2Note }],
        structure: {...}, term: {...} }
     Weeks are sorted by week number. `structure` is a fixed constant (the
     6-stage framework + formats) — not stored in Airtable, since it doesn't
     change per week. `term` is a fixed constant describing the Alleyn Court
     Autumn Term 2026 calendar the weeks are mapped onto (term dates,
     half-term, club day). weekBeginning/clubDate are per-week Airtable
     dates; fixtureNote is a free-text field for flagging when a school
     fixture is steering or reordering that week's content. activity1/2
     are legacy free-text (kept for history); activity{1,2}{A,B}Id are the
     real links into the football activities library (Plan A / optional
     Plan B alternate), and activity{1,2}Note is an optional free-text
     qualifier shown alongside the picked activity/activities.

   PUT    /.netlify/functions/syllabus
     body: { password, recordId, ...any of the week fields to change }
   ============================================================================ */

declare const Netlify: { env: { get(key: string): string | undefined } };

const BASE_ID = 'appmH5PUZEbBSIvLg';
const TABLE_ID = 'tbl37Xxx7XPe5KlRy';
const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

// Alleyn Court School term calendar (source: alleyn-court.co.uk/admissions/term-dates,
// checked 2026-09-04). Weeks 1-12 map onto the Autumn Term 2026, skipping the
// half-term break — the football after-school club runs Thursdays, and week 1's
// club date (3 Sep) is the term's actual first day.
const TERM_INFO = {
  termName: 'Autumn Term 2026',
  termStart: '2026-09-03',
  termEnd: '2026-12-11',
  halfTerm: { start: '2026-10-16', end: '2026-11-02' },
  clubDay: 'Thursday',
  note: "Syllabus weeks 1-12 run weekly on Thursdays from 3 Sep, skipping the two Thursdays inside half-term (22 & 29 Oct) — so week 8 picks up on 5 Nov. Each week's theme is meant to apply across the week's PE lessons too, not just the Thursday club.",
};

const STRUCTURE = {
  lengthNote: '12 weeks, run as four 3-week blocks',
  stages: [
    { num: 1, name: 'Arrival small-sided game', purpose: 'Get playing quickly', typicalUse: 'Minimal coaching — a movement/tag-style game while everyone arrives' },
    { num: 2, name: 'Coach welcome & theme intro', purpose: 'Reset and set the theme', typicalUse: "Behaviour reminder + introduce this week's focus, straight after the arrival game" },
    { num: 3, name: 'Activity 1 — Movement skills', purpose: 'Build the movement base', typicalUse: 'Agility, awareness, evasion — always movement-skills themed' },
    { num: 4, name: 'Activity 2 — Dribbling', purpose: 'Apply it with the ball', typicalUse: 'Always a dribbling-focused activity' },
    { num: 5, name: 'Finishing game', purpose: 'Close with a match', typicalUse: 'Sometimes small-sided, sometimes bigger; sometimes longer with the two activities shortened to feed teaching points into it' },
    { num: 6, name: 'Conclusion & dispersal', purpose: 'Wrap up and send off safely', typicalUse: 'Recap the theme, praise effort, dismiss to parents' },
  ],
  formats: [
    { format: '5v5', use: 'Competition-format familiarity', principle: 'Mostly let them play' },
    { format: '2v2', use: 'Hands-on coaching', principle: 'Rotate players; more touches and 1v1 moments' },
  ],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toWeekShape(record: any) {
  const f = record.fields || {};
  return {
    recordId: record.id,
    week: f['Week'] ?? null,
    block: f['Block'] ?? null,
    blockName: f['BlockName'] || '',
    headlineFocus: f['HeadlineFocus'] || '',
    learningProgression: f['LearningProgression'] || '',
    arrivalGame: f['ArrivalGame'] || '',
    activity1: f['Activity1'] || '',
    activity2: f['Activity2'] || '',
    finishing: f['Finishing'] || '',
    needsReview: !!f['NeedsReview'],
    weekBeginning: f['WeekBeginning'] || null,
    clubDate: f['ClubDate'] || null,
    fixtureNote: f['FixtureNote'] || '',
    activity1AId: f['Activity1AId'] || '',
    activity1BId: f['Activity1BId'] || '',
    activity1Note: f['Activity1Note'] || '',
    activity2AId: f['Activity2AId'] || '',
    activity2BId: f['Activity2BId'] || '',
    activity2Note: f['Activity2Note'] || '',
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

async function handleGet() {
  let all: any[] = [];
  let offset: string | undefined;
  do {
    const page = await airtableFetch(offset ? `?offset=${offset}` : '');
    all = all.concat(page.records || []);
    offset = page.offset;
  } while (offset);

  const weeks = all.map(toWeekShape).sort((a, b) => (a.week || 0) - (b.week || 0));
  return json({ weeks, structure: STRUCTURE, term: TERM_INFO });
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.recordId) return json({ error: 'recordId is required' }, 400);

  const fields: Record<string, any> = {};
  const set = (key: string, value: any) => { if (value !== undefined) fields[key] = value; };
  set('Week', body.week);
  set('Block', body.block);
  set('BlockName', body.blockName);
  set('HeadlineFocus', body.headlineFocus);
  set('LearningProgression', body.learningProgression);
  set('ArrivalGame', body.arrivalGame);
  set('Activity1', body.activity1);
  set('Activity2', body.activity2);
  set('Finishing', body.finishing);
  set('NeedsReview', body.needsReview);
  set('WeekBeginning', body.weekBeginning);
  set('ClubDate', body.clubDate);
  set('FixtureNote', body.fixtureNote);
  set('Activity1AId', body.activity1AId);
  set('Activity1BId', body.activity1BId);
  set('Activity1Note', body.activity1Note);
  set('Activity2AId', body.activity2AId);
  set('Activity2BId', body.activity2BId);
  set('Activity2Note', body.activity2Note);

  const result = await airtableFetch('', {
    method: 'PATCH',
    body: JSON.stringify({ records: [{ id: body.recordId, fields }], typecast: true }),
  });
  return json({ week: toWeekShape(result.records[0]) });
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet();

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'PUT') return await handlePut(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('syllabus function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
