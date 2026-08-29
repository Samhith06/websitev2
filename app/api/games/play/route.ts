import { NextResponse } from 'next/server';
import { diceRoll, kenoDraw, limboResult } from '@/lib/fairness';
import {
  KENO_MAX_PICKS, KENO_RISKS, capPayout, diceChance, diceMultiplier, diceWins, kenoHits,
  kenoPaytable,
} from '@/lib/games';
import { checkBet, getSession, settle } from '@/lib/session';
import { NOT_SIGNED_IN, currentPlayerId } from '@/lib/player';
import type { KenoRisk } from '@/lib/games';
import type { GameSlug } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Server-authoritative, always. The browser sends "play"; it never computes an
 * outcome and is never trusted with one (Master Plan §9).
 *
 * It is also authenticated. Coins belong to an account, so a round that cannot
 * name the account it is spending from is refused before anything is drawn.
 *
 * Every request carries an idempotency key. Without one a double-tap is two
 * bets, and that is the bug players notice first and forgive last.
 */
export async function POST(request: Request) {
  const playerId = await currentPlayerId();
  if (!playerId) return NextResponse.json(NOT_SIGNED_IN, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-request', detail: 'Malformed body.' }, { status: 400 });
  }

  const game = body.game as GameSlug;
  const bet = Number(body.bet);
  const idempotencyKey = String(body.idempotencyKey ?? '');

  if (!idempotencyKey) {
    return NextResponse.json(
      { ok: false, error: 'invalid-request', detail: 'Missing idempotency key.' },
      { status: 400 },
    );
  }

  const session = getSession(playerId);

  // A replayed key returns the original round without touching the balance.
  const replay = session.seen.get(idempotencyKey);
  if (replay) {
    return NextResponse.json(
      settle(session, {
        game: replay.game, bet: replay.bet, multiplier: replay.multiplier,
        payout: replay.payout, outcome: replay.outcome, idempotencyKey,
      }),
    );
  }

  const failure = checkBet(session, bet);
  if (failure) return NextResponse.json(failure, { status: 400 });

  const { serverSeed, clientSeed, nonce } = session;

  switch (game) {
    /* ------------------------------------------------------------------ */
    case 'keno': {
      const picks = (body.picks as number[]) ?? [];
      const risk = body.risk as KenoRisk;
      if (!KENO_RISKS.includes(risk)) {
        return bad('Unknown risk level.');
      }
      if (
        !Array.isArray(picks) || picks.length < 1 || picks.length > KENO_MAX_PICKS ||
        new Set(picks).size !== picks.length ||
        picks.some((n) => !Number.isInteger(n) || n < 1 || n > 40)
      ) {
        return bad('Pick between 1 and 10 distinct numbers from 1 to 40.');
      }

      const { drawn } = kenoDraw(serverSeed, clientSeed, nonce);
      const hits = kenoHits(picks, drawn);
      const multiplier = kenoPaytable(risk, picks.length)[hits.length] ?? 0;
      const payout = capPayout(bet, multiplier);

      return NextResponse.json(
        settle(session, {
          game, bet, multiplier, payout, idempotencyKey,
          outcome: { drawn, picks, hits, risk },
        }),
      );
    }

    /* ------------------------------------------------------------------ */
    case 'dice': {
      const target = Number(body.target);
      const direction = body.direction === 'over' ? 'over' : 'under';
      if (!Number.isFinite(target) || target < 2 || target > 98) {
        return bad('Target must be between 2 and 98.');
      }

      const { roll } = diceRoll(serverSeed, clientSeed, nonce);
      const won = diceWins(roll, target, direction);
      const multiplier = won ? diceMultiplier(diceChance(target, direction)) : 0;
      const payout = capPayout(bet, multiplier);

      return NextResponse.json(
        settle(session, {
          game, bet, multiplier, payout, idempotencyKey,
          outcome: { roll, target, direction, won, chance: diceChance(target, direction) },
        }),
      );
    }

    /* ------------------------------------------------------------------ */
    case 'limbo': {
      const target = Number(body.target);
      if (!Number.isFinite(target) || target < 1.01 || target > 1_000_000) {
        return bad('Target must be between 1.01× and 1,000,000×.');
      }

      const { result } = limboResult(serverSeed, clientSeed, nonce);
      const won = result >= target;
      const multiplier = won ? Math.floor(target * 100) / 100 : 0;
      const payout = capPayout(bet, multiplier);

      return NextResponse.json(
        settle(session, {
          game, bet, multiplier, payout, idempotencyKey,
          outcome: { result, target, won },
        }),
      );
    }

    default:
      return bad('Unknown game.');
  }
}

function bad(detail: string) {
  return NextResponse.json({ ok: false, error: 'invalid-request', detail }, { status: 400 });
}
