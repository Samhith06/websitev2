import { NextResponse } from 'next/server';
import { recordClipPlay } from '@/lib/store/clips';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * One play of one clip, counted.
 *
 * Deliberately unauthenticated: most people watching a clip are not signed in,
 * and a count that only included members would answer a different question
 * from the one being asked.
 *
 * Deliberately anonymous too. Nothing about the caller is read or stored — no
 * session, no address, no fingerprint — so what comes out is a number of plays
 * and never a record of who watched what. Repeat plays are filtered in the
 * browser instead, which keeps the number honest without keeping the history
 * that would make it provable.
 *
 * That trade is worth naming: a determined caller can inflate this by posting
 * repeatedly. It is a vanity counter on a clip carousel, not an audit trail,
 * and the alternative — identifying callers well enough to stop them — costs
 * more privacy than the number is worth. An unpublished or unknown id counts
 * nothing regardless, so this cannot be used to create rows.
 */
export async function POST(request: Request) {
  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id || id.length > 128) return NextResponse.json({ ok: false }, { status: 400 });

  const plays = await recordClipPlay(id);
  return NextResponse.json({ ok: true, plays });
}
