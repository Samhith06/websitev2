import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { hasDatabase } from '@/lib/db';
import { evaluateBadges } from '@/lib/store/badge-rules';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The badge sweep, on a schedule.
 *
 * Badges were data with no evaluator behind them, so the only way to hold one
 * was a mod granting it by hand. The rules live in `lib/store/badge-rules.ts`;
 * this is the endpoint a scheduler calls so somebody who links their Kick
 * account at two in the morning has the Verified badge by breakfast rather
 * than whenever staff next open the admin screen.
 *
 * Cheap enough to run every few minutes — one set-based query per rule — and
 * safe to run twice, because awarding a badge already held is a no-op. It
 * never revokes, so a lapsed sub or a restated wager cannot take one back
 * behind somebody's back.
 *
 * Guarded by `CRON_SECRET`, the same as the coin tick.
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

  const report = await evaluateBadges();
  return NextResponse.json({ ok: true, ...report });
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
