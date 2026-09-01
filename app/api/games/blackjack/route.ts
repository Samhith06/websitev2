import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/player';
import { gameIsPlayable } from '@/lib/store/settings';
import { actBlackjack, currentBlackjack, openBlackjack } from '@/lib/store/blackjack';
import type { Action, SeatBet } from '@/lib/blackjack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Blackjack, which needs its own endpoint because a hand is not one request.
 *
 * The other games settle in a single call. Here the browser deals, then asks
 * for each decision in turn, and the server holds the hand between them — so
 * `GET` returns whatever is on the table, and `POST` either opens a hand or
 * plays one move of it.
 *
 * What the browser never gets: the shoe. It sees the cards that have been
 * dealt and nothing beyond them, so knowing what comes next is impossible even
 * with the response open in a console.
 */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json(gate.refusal, { status: gate.status });

  const hand = await currentBlackjack(gate.user.id);
  return NextResponse.json(hand ?? { roundId: null });
}

const ACTIONS: Action[] = ['hit', 'stand', 'double', 'split'];

export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json(gate.refusal, { status: gate.status });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return bad('Malformed body.');
  }

  if (!(await gameIsPlayable('blackjack'))) {
    return NextResponse.json(
      { ok: false, error: 'game-unavailable', detail: 'Blackjack is switched off right now. Nothing has been staked.' },
      { status: 503 },
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Deal                                                                   */
  /* ---------------------------------------------------------------------- */
  if (body.op === 'deal') {
    const idempotencyKey = String(body.idempotencyKey ?? '');
    if (!idempotencyKey) return bad('Missing idempotency key.');

    const raw = body.bets;
    if (!Array.isArray(raw)) return bad('Bets must be a list, one entry per seat.');

    const bets: SeatBet[] = raw.map((b) => {
      const seat = (b ?? {}) as Record<string, unknown>;
      return {
        main: Number(seat.main) || 0,
        pairs: Number(seat.pairs) || 0,
        plusThree: Number(seat.plusThree) || 0,
      };
    });
    if (bets.some((b) => !Number.isFinite(b.main + b.pairs + b.plusThree))) {
      return bad('Every stake has to be a number.');
    }

    const result = await openBlackjack({ userId: gate.user.id, bets, idempotencyKey });
    return respond(result);
  }

  /* ---------------------------------------------------------------------- */
  /* One decision                                                           */
  /* ---------------------------------------------------------------------- */
  if (body.op === 'act') {
    const action = body.action as Action;
    if (!ACTIONS.includes(action)) return bad('Unknown move.');

    const result = await actBlackjack({ userId: gate.user.id, action });
    return respond(result);
  }

  return bad('Unknown operation.');
}

function respond(result: Awaited<ReturnType<typeof openBlackjack>>) {
  if (!('ok' in result)) return NextResponse.json(result);

  if (result.error === 'rate-limited') {
    return NextResponse.json(result, {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfter ?? 30) },
    });
  }
  return NextResponse.json(result, { status: 400 });
}

function bad(detail: string) {
  return NextResponse.json({ ok: false, error: 'invalid-request', detail }, { status: 400 });
}
