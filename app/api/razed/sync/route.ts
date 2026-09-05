import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { hasDatabase } from '@/lib/db';
import { latestSnapshot, syncLifetime } from '@/lib/store/razed-snapshots';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The Razed sync, on a schedule.
 *
 * The leaderboard page is already `force-dynamic`, so it renders fresh on
 * every request — but it renders the newest *snapshot*, and until now the only
 * things that ever wrote one were the admin's "Sync now" button and a script
 * run by hand. A board that is only as current as the last time somebody
 * remembered to press a button is not a live leaderboard, which is what the
 * "synced N ago" line in the staff bar has been quietly reporting.
 *
 * Snapshots are append-only: a failed or partial fetch writes nothing and the
 * previous one stays, so the board keeps showing the last good figures with an
 * honest timestamp rather than emptying out.
 *
 * `minIntervalMinutes` guards against a scheduler firing faster than intended,
 * or two schedulers being pointed at this at once. `syncLifetime` walks the
 * Razed API a window at a time, so a stray double-fire is real traffic against
 * somebody else's API rather than a wasted millisecond.
 */
const MIN_INTERVAL_MINUTES = 8;

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

  // `?force=1` is the manual override, for when somebody wants a sync now and
  // does not care that one ran four minutes ago.
  const force = new URL(request.url).searchParams.get('force') === '1';

  if (!force) {
    const previous = await latestSnapshot('lifetime');
    if (previous) {
      const ageMinutes = (Date.now() - new Date(previous.fetchedAt).getTime()) / 60_000;
      if (ageMinutes < MIN_INTERVAL_MINUTES) {
        return NextResponse.json({
          ok: true,
          ran: false,
          reason: 'too-soon',
          lastSyncedMinutesAgo: Math.round(ageMinutes),
        });
      }
    }
  }

  const result = await syncLifetime();
  if (!result.ok) {
    // A failed sync is a 200 with `ran: false`, not a 500: the scheduler should
    // not treat "Razed did not answer" as this endpoint being broken, and the
    // previous snapshot is still being served either way.
    return NextResponse.json({ ok: false, ran: false, reason: result.reason, detail: result.detail });
  }

  return NextResponse.json({
    ok: true,
    ran: true,
    rows: result.rowCount,
    snapshotAt: result.snapshot.fetchedAt,
  });
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
