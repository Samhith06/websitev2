import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { hasDatabase } from '@/lib/db';
import { pruneOldEvents, runTick } from '@/lib/store/presence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The three-minute coin tick (Master Plan §3, §5).
 *
 * The Master Plan puts this in a separate worker so a web deploy never drops
 * ticks, and that is still the right shape. Until that service exists this is
 * an endpoint a scheduler calls, which gets the economy running now and keeps
 * every rule — the ceiling, the streak, the ban freeze — in one place that the
 * worker can lift wholesale.
 *
 * Missing a tick costs a viewer 1 MC and breaks their hour streak, so the
 * scheduler wants to be reliable rather than clever. Calling it more often than
 * every three minutes is harmless: `runTick` refuses anything early.
 */
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

  const result = await runTick();

  // Cheap, and this is the only thing that runs on a schedule.
  if (result.ran) await pruneOldEvents().catch(() => {});

  return NextResponse.json(result);
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
