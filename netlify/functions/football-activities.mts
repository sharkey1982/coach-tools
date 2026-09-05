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
     body: { password, id, group?, tagVariant?, focus?, focusLabel?, ready?, draft? }
     -> { activity: {...updated...} }
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
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
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

function checkPassword(supplied: string | undefined): boolean {
  const expected = Netlify.env.get('ADMIN_PASSWORD');
  return !!expected && !!supplied && supplied === expected;
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

  await putManifestFile(manifest, sha, `Admin: update focus tag for ${body.id}`);
  return json({ activity });
}

export default async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return json({});
    if (req.method === 'GET') return await handleGet();

    const body = req.method !== 'GET' ? await req.json().catch(() => ({})) : {};
    if (req.method === 'PUT') return await handlePut(body);

    return json({ error: 'Method not allowed' }, 405);
  } catch (e: any) {
    console.error('football-activities function error:', e);
    return json({ error: e.message || 'Server error' }, 500);
  }
};
