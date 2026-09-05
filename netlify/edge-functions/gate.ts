/* ============================================================================
   Coach Tools · site-wide password gate

   Replaces the old per-page/per-function ADMIN_PASSWORD prompts. This single
   Edge Function runs in front of EVERY request to the site (pages, JSON data
   files, and the /.netlify/functions/* API) and requires one shared password
   before anything is served. Once unlocked, a cookie remembers the browser
   for a year, so there's no in-app "Unlock" screen anywhere any more.

   Env var required (set in Netlify site settings):
     SITE_PASSWORD   — the one shared password for the whole site

   If SITE_PASSWORD is not set, the gate is skipped entirely (fail-open) —
   this keeps local/dev/deploy-preview environments usable without also
   configuring the var there.
   ============================================================================ */

const COOKIE_NAME = 'cta';
const LOGIN_PATH = '/__gate';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function loginPage(redirectTo: string, wrongPassword: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Coach Tools · Sign in</title>
<meta name="robots" content="noindex, nofollow">
<style>
  :root { --bg:#F5F1E8; --paper:#FBF8F1; --ink:#15191E; --ink-soft:#3A4049; --muted:#6B7280; --rule:#DAD3C4; --primary:#C8102E; --secondary:#142850; --accent:#F2B705; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; }
  body { display: flex; align-items: center; justify-content: center; padding: 20px; }
  .card { background: var(--paper); border: 1.5px solid var(--ink); border-radius: 8px; padding: 32px 28px; max-width: 340px; width: 100%; }
  h1 { font-size: 20px; letter-spacing: 0.02em; margin-bottom: 6px; }
  p.sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-soft); margin-bottom: 6px; }
  input[type="password"] { width: 100%; padding: 10px 12px; border: 1.5px solid var(--ink); border-radius: 6px; font-size: 15px; background: #fff; }
  button { margin-top: 14px; width: 100%; padding: 11px; border: 1.5px solid var(--ink); border-radius: 6px; background: var(--secondary); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
  button:hover { filter: brightness(1.1); }
  .error { margin-top: 12px; font-size: 13px; color: var(--primary); font-weight: 600; }
</style>
</head>
<body>
  <div class="card">
    <h1>Coach Tools</h1>
    <p class="sub">This site is private. Enter the password to continue.</p>
    <form method="POST" action="${LOGIN_PATH}">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" autofocus required>
      <input type="hidden" name="redirect" value="${redirectTo.replace(/"/g, '&quot;')}">
      <button type="submit">Sign in</button>
      ${wrongPassword ? '<div class="error">Incorrect password — try again.</div>' : ''}
    </form>
  </div>
</body>
</html>`;
}

export default async (request: Request, context: any) => {
  const sitePassword = Deno.env.get('SITE_PASSWORD');
  if (!sitePassword) return context.next(); // gate disabled if not configured

  const url = new URL(request.url);
  const expectedToken = await sha256Hex(sitePassword);

  if (url.pathname === LOGIN_PATH && request.method === 'POST') {
    const form = await request.formData();
    const supplied = String(form.get('password') || '');
    const redirectTo = String(form.get('redirect') || '/');
    const safeRedirect = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';

    if (supplied === sitePassword) {
      const headers = new Headers();
      headers.set('location', safeRedirect);
      headers.append(
        'set-cookie',
        `${COOKIE_NAME}=${encodeURIComponent(expectedToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
      );
      return new Response(null, { status: 302, headers });
    }
    return new Response(loginPage(safeRedirect, true), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const cookieVal = getCookie(request, COOKIE_NAME);
  if (cookieVal && cookieVal === expectedToken) {
    return context.next();
  }

  return new Response(loginPage(url.pathname + url.search, false), {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};

export const config = { path: '/*' };
