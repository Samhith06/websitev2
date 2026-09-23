import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { hasDatabase } from '@/lib/db';
import { catalogStats, syncCatalog } from '@/lib/store/slots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The slot catalog sync, on a schedule.
 *
 * BonusHunt refreshes its feed hourly and it only covers the last week, so a
 * daily call is enough to miss nothing and an hourly one is the most that is
 * ever useful. `MIN_INTERVAL_MINUTES` refuses anything faster — each sync is
 * a couple of dozen requests against somebody else's free API.
 */
const MIN_INTERVAL_MINUTES = 30;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no-secret',
        detail: 'CRON_SECRET is not set, so this endpoint stays closed rather than open to anyone.',
      },
      { status: 503 },
    );
  }
  if (!authorised(request, secret)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ ok: false, error: 'no-database' }, { status: 503 });
  }

  const force = new URL(request.url).searchParams.get('force') === '1';
  if (!force) {
    const { lastSyncedAt } = await catalogStats();
    if (lastSyncedAt) {
      const ageMinutes = (Date.now() - new Date(lastSyncedAt).getTime()) / 60_000;
      if (ageMinutes < MIN_INTERVAL_MINUTES) {
        return NextResponse.json({ ok: true, ran: false, reason: 'too-soon', lastSyncedMinutesAgo: Math.round(ageMinutes) });
      }
    }
  }

  const result = await syncCatalog();
  if (!result.ok) {
    return NextResponse.json({ ok: false, ran: false, detail: result.detail });
  }
  return NextResponse.json({ ...result, ran: true });
}

/** GET is allowed too: most schedulers only send one. */
export const GET = POST;

function authorised(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const supplied = bearer || new URL(request.url).searchParams.get('secret') || '';
  if (supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}
