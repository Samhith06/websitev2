import { NextResponse } from 'next/server';
import { verify } from '@/lib/fairness';

export const dynamic = 'force-dynamic';

/**
 * Public. It works whether or not you are signed in, and it does not look
 * anything up — the outcome is derived from the three values you pass in, by
 * exactly the same code the games run.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, detail: 'Malformed request.' }, { status: 400 });
  }

  const game = body.game as 'keno' | 'dice' | 'limbo';
  const serverSeed = String(body.serverSeed ?? '').trim();
  const clientSeed = String(body.clientSeed ?? '');
  const nonce = Number(body.nonce);

  if (!['keno', 'dice', 'limbo'].includes(game)) {
    return NextResponse.json({ ok: false, detail: 'Pick one of the three games.' }, { status: 400 });
  }
  if (!serverSeed) {
    return NextResponse.json(
      { ok: false, detail: 'A server seed is needed. It is revealed when you rotate your seed pair.' },
      { status: 400 },
    );
  }
  if (!Number.isInteger(nonce) || nonce < 0) {
    return NextResponse.json({ ok: false, detail: 'The nonce must be a whole number, zero or above.' }, { status: 400 });
  }

  const result = verify({ game, serverSeed, clientSeed, nonce });
  return NextResponse.json({ ok: true, ...result });
}
