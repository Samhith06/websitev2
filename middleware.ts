import { NextResponse, type NextRequest } from 'next/server';

/**
 * A single job: keep a not-yet-public deployment private.
 *
 * Admin is NOT gated here. It is gated in `app/admin/layout.tsx` by Discord
 * sign-in plus the id allowlist in `lib/admin.ts` — a real identity check on
 * the server, on every request, rather than a shared password.
 *
 * SITE_PASSWORD set → the whole site asks for a password before anything
 * renders. Use it for staging while there is no real auth on the public pages
 * and every visitor shares one mock account. Leave it unset to go public.
 */

const USER = 'matty';

/**
 * Header values are ByteStrings, so the realm must stay ASCII — a stray em dash
 * in here throws at runtime and turns every 401 into a 500.
 */
function unauthorized() {
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MattySpins private preview", charset="UTF-8"',
    },
  });
}

function passwordMatches(request: NextRequest, expected: string): boolean {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;
  try {
    const [user, ...rest] = atob(header.slice(6)).split(':');
    return user === USER && rest.join(':') === expected;
  } catch {
    return false;
  }
}

/**
 * One canonical hostname, and www redirects to it.
 *
 * Two hostnames serving identical content is not only a duplicate for
 * crawlers. With AUTH_URL on the bare domain, somebody who signs in from www
 * has their session cookie set on the apex and returns to www looking signed
 * out — the same confusion as signing in on the old railway.app origin, just
 * mirrored. Railway has no domain-level redirect, so it happens here, before
 * anything renders.
 *
 * Only the exact www host is matched, so localhost and any preview hostname
 * are left alone and development is unaffected. The scheme is forced to https
 * because Railway terminates TLS at its proxy and the app sees plain http.
 */
const CANONICAL_HOST = 'mattyspins.com';

function canonicalRedirect(request: NextRequest): NextResponse | null {
  if (request.headers.get('host') !== `www.${CANONICAL_HOST}`) return null;

  const url = request.nextUrl.clone();
  url.protocol = 'https:';
  url.host = CANONICAL_HOST;
  url.port = '';
  // 308 rather than 302: permanent, and it preserves the method, so a POST
  // arriving on www is not silently downgraded to a GET.
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return NextResponse.next();

  // The OAuth round trip must stay reachable, or signing in behind the preview
  // password becomes impossible — Discord cannot send a Basic auth header.
  if (request.nextUrl.pathname.startsWith('/api/auth/')) return NextResponse.next();

  if (!passwordMatches(request, sitePassword)) return unauthorized();
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)'],
};
