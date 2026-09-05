/* ============================================================================
   Coach Tools · Football Activities admin function
   (redeploy nudge: pick up freshly-set GITHUB_PAT env var)
   Unlike syllabus/videos (Airtable-backed), the activities library's source of
   truth stays the static manifest file in the repo — every consuming page
   (Activities library, Session Builder, Syllabus Admin's Plan A/B dropdowns,
   Video Admin's activity dropdown) already fetches it directly, so keeping it
   as the one source avoids a second copy of the data going stale.

   This function lets Admin edit a narrow set of fields (group, tag-variant
   flag, focus label, ready, draft) on one activity at a time by committing
   the updated manifest straight to GitHub via the Contents API. Netlify
   then redeploys automatically (~30–60s), same as any other push to this
   repo. "group" is the coarse Movement skills / Dribbling / Ball Striking /
   Match Play bucket used everywhere else (Session Builder, Syllabus/Video
   Admin dropdowns, the Activities page filter pills); "focus"/"focusLabel"
   stay as the descriptive per-activity chip text only.

   Env vars required (set in Netlify site settings):
     GITHUB_PAT       — personal access token with repo write access
     ADMIN_PASSWORD   — shared password checked on every write (same one
                        used by the syllabus/videos admin functions)

   GET  /.netlify/functions/football-activities
     -> { activities: [...] }  (read straight from GitHub, so it's never
        behind a stale CDN-cached copy of the static file mid-deploy)

   PUT  /.netlify/functions/football-activities
     body: { password, id, group?, tagVariant?, focus?, focusLabel?, difficulty?, ready?, draft?, favorite? }
       (difficulty: '' clears it; otherwise 'beginner' | 'intermediate' | 'advanced')
     -> { activity: {...updated...} }

   POST /.netlify/functions/football-activities
     body: { password, name, group, tagVariant?, focusLabel?, difficulty?, type?,
             duration?, tiers?, summary?, source?, value? }
     Adds a new manifest-only stub (ready:false, draft:true — same shape as an
     existing "Full write-up pending" entry). id is slugified from name and
     must be unique; there's no detail JSON file yet, so the activity won't
     open a full plan page until one is written and ready is flipped on.
     -> { activity: {...new...} }
   ============================================================================ */

const REPO = 'sharkey1982/coach-tools';
const BRANCH = 'main';
const MANIFEST_PATH = 'football/activities/data/_manifest.json';
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${MANIFEST_PATH}`;

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

declare const Netlify: { env: { get(key: string): string | undefined } };

function githubHeaders(pat: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'coach-tools-admin',
    ...(extra || {}),
  };
}

async function getManifestFile(): Promise<{ manifest: any; sha: string }> {
  const pat = Netlify.env.get('GITHUB_PAT');
  if (!pat) throw new Error('GITHUB_PAT not configured');
  const res = await fetch(`${GITHUB_API}?ref=${BRANCH}`, { headers: githubHeaders(pat) });
  const body = await res.json();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${JSON.stringify(body)}`);
  const content = Buffer.from(body.content, 'base64').toString('utf8');
  return { manifest: JSON.parse(content), sha: body.sha };
}

async function putManifestFile(manifest: any, sha: string, message: string) {
  const pat = Netlify.env.get('GITHUB_PAT');
  if (!pat) throw new Error('GITHUB_PAT not configured');
  const content = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8').toString('base64');
  const res = await fetch(GITHUB_API, {
    method: 'PUT',
    headers: githubHeaders(pat, { 'content-type': 'application/json' }),
    body: JSON.stringify({ message, content, sha, branch: BRANCH }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function checkPassword(_supplied: string | undefined | null): boolean {
  // Password checks are now handled once, site-wide, by netlify/edge-functions/gate.ts.
  // Kept as a no-op so every call site below still compiles unchanged.
  return true;
}

async function handleGet() {
  const { manifest } = await getManifestFile();
  return json({ activities: manifest.activities || [] });
}

async function handlePut(body: any) {
  if (!checkPassword(body.password)) return json({ error: 'Incorrect password' }, 401);
  if (!body.id) return json({ error: 'id is required' }, 400);
  if (body.id === '__check__') return json({ ok: true }); // password-verification no-op used by the unlock screen

  const { manifest, sha } = await getManifestFile();
  const activities: any[] = manifest.activities || [];
  const activity = activities.find((a) => a.id === body.id);
  if (!activity) return json({ error: `No activity with id "${body.id}"` }, 404);

  if (body.focus !== undefined) activity.focus = body.focus;
  if (body.focusLabel !== undefined) activity.focusLabel = body.focusLabel;
  if (body.difficulty !== undefined) {
    if (body.difficulty) activity.difficulty = body.difficulty;
    else delete activity.difficulty; // "— Not set —" clears it
  }
  if (body.group !== undefined) activity.group = body.group;
  if (body.tagVariant !== undefined) {
    if (body.group === 'movement' || (body.group === undefined && activity.group === 'movement')) {
      activity.tagVariant = !!body.tagVariant;
    } else {
      delete activity.tagVariant; // only meaningful within the movement group
    }
  }
  if (body.ready !== undefined) activity.ready = !!body.ready;
  if (body.draft !== undefined) activity.draft = !!body.draft;
  if (body.favorite !== undefined) activity.favorite = !!body.favorite;

  await putManifestFile(manifest, sha, `Admin: update focus tag for ${body.id}`);
  return json({ activity });
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

  const { manifest, sha } = await getManifestFile();
  const activities: any[] = manifest.activities || [];

  let id = slugify(body.id || body.name);
  if (!id) return json({ error: 'Could not derive an id from that name' }, 400);
  if (activities.some((a) => a.id === id)) return json({ error: `An activity with id "${id}" already exists` }, 409);

  const tiers = Array.isArray(body.tiers) ? body.tiers.filter((t: string) => VALID_TIERS.includes(t)) : [];

  const activity: any = {
    id,
    name: body.name,
    source: body.source || 'Added via Activities Admin — needs full write-up',
    focus: body.focus || '',
    focusLabel: body.focusLabel || '',
    type: body.type || '',
    duration: body.duration || '',
    tiers: tiers.length ? tiers : VALID_TIERS.slice(),
    value: body.value || null,
    summary: body.summary || 'Added via Activities Admin. Full write-up pending.',
    group: body.group,
    ready: false,
    draft: true,
  };
  if (body.group === 'movement') activity.tagVariant = !!body.tagVariant;
  if (body.difficulty) activity.difficulty = body.difficulty;
  if (body.favorite) activity.favorite = true;

  activities.push(activity);
  await putManifestFile(manifest, sha, `Admin: add new activity ${id}`);
  return json({ activity }, 201);
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet();

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'PUT') return await handlePut(body);
    if (req.method === 'POST') return await handlePost(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('football-activities function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
