import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { hasDatabase } from '@/lib/db';
import { announceLeaderboard } from '@/lib/store/leaderboard-announce';
import {
  LAST_30_DAYS_PERIOD,
  LIFETIME_PERIOD,
  latestSnapshot,
  monthKey,
  monthPeriod,
  syncBadgeWindows,
  syncLifetime,
  syncMonth,
} from '@/lib/store/razed-snapshots';

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
 *
 * The running month and the lifetime total are guarded separately, because a new
 * month has no snapshot at all. A shared guard would hold every monthly ladder on
 * "waiting for a sync" whenever the lifetime walk happened to have run recently.
 */
const MIN_INTERVAL_MINUTES = 8;

async function minutesSince(period: string): Promise<number | null> {
  const previous = await latestSnapshot(period);
  return previous ? (Date.now() - new Date(previous.fetchedAt).getTime()) / 60_000 : null;
}

function due(age: number | null): boolean {
  return age == null || age >= MIN_INTERVAL_MINUTES;
}

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

  const [monthAge, lifetimeAge, badgeAge] = await Promise.all([
    minutesSince(monthPeriod(monthKey())),
    minutesSince(LIFETIME_PERIOD),
    minutesSince(LAST_30_DAYS_PERIOD),
  ]);
  const monthDue = force || due(monthAge);
  const lifetimeDue = force || due(lifetimeAge);
  const badgesDue = force || due(badgeAge);

  if (!monthDue && !lifetimeDue && !badgesDue) {
    return NextResponse.json({
      ok: true,
      ran: false,
      reason: 'too-soon',
      lastSyncedMinutesAgo: Math.round(lifetimeAge ?? 0),
    });
  }

  // The month first: it is a single window, and one bad walk of the lifetime
  // history should not cost every monthly ladder its figures.
  const month = monthDue ? await syncMonth() : null;
  const badgeWindows = badgesDue ? await syncBadgeWindows() : [];
  const lifetime = lifetimeDue ? await syncLifetime() : null;

  // Reads Razed itself, and a Discord problem must never fail the sync.
  await announceLeaderboard().catch((error) => console.error('[leaderboard-announce]', error));

  const ran = Boolean(month?.ok || lifetime?.ok || badgeWindows.some((result) => result.ok));
  const failed = [month, ...badgeWindows, lifetime].find((result) => result && !result.ok);
  if (failed && !failed.ok) {
    // A failed sync is a 200 with `ok: false`, not a 500: the scheduler should
    // not treat "Razed did not answer" as this endpoint being broken, and the
    // previous snapshot is still being served either way.
    return NextResponse.json({ ok: false, ran, reason: failed.reason, detail: failed.detail });
  }

  return NextResponse.json({
    ok: true,
    ran,
    monthRows: month?.ok ? month.rowCount : undefined,
    rows: lifetime?.ok ? lifetime.rowCount : undefined,
    snapshotAt: lifetime?.ok ? lifetime.snapshot.fetchedAt : undefined,
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
