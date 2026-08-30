import { NextResponse } from 'next/server';
import { diceRoll, kenoDraw, limboResult } from '@/lib/fairness';
import {
  KENO_MAX_PICKS, KENO_RISKS, capPayout, diceChance, diceMultiplier, diceWins, kenoHits,
  kenoPaytable,
} from '@/lib/games';
import { playRound, type PlayFailure, type Resolution } from '@/lib/store/play';
import { requireUser } from '@/lib/player';
import type { KenoRisk } from '@/lib/games';
import type { GameSlug } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-authoritative, always. The browser sends "play"; it never computes an
 * outcome and is never trusted with one (Master Plan §9).
 *
 * It is also authenticated, and now transactional: the seed pair is locked, the
 * outcome is drawn against the locked nonce, and the round, the ledger rows and
 * the balance are one write or none. The resolver below is handed the seed
 * material by `playRound` rather than reading it first, which is what stops two
 * simultaneous rounds sharing a nonce.
 */
export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.ok) return NextResponse.json(gate.refusal, { status: gate.status });

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
    return bad('Missing idempotency key.');
  }

  const resolve = resolverFor(game, body);
  if (!resolve) return bad('Unknown game.');

  const result = await playRound({
    userId: gate.user.id,
    game,
    bet,
    idempotencyKey,
    resolve,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

type Resolver = (seed: { serverSeed: string; clientSeed: string; nonce: number }) => Resolution | PlayFailure;

/**
 * One resolver per game. Each returns either a resolution or a refusal, and the
 * refusal path is taken before any coins move — validation that reads the
 * request lives here, beside the maths it protects.
 */
function resolverFor(game: GameSlug, body: Record<string, unknown>): Resolver | null {
  switch (game) {
    /* ------------------------------------------------------------------ */
    case 'keno': {
      const picks = (body.picks as number[]) ?? [];
      const risk = body.risk as KenoRisk;

      return ({ serverSeed, clientSeed, nonce }) => {
        if (!KENO_RISKS.includes(risk)) return refuse('Unknown risk level.');
        if (
          !Array.isArray(picks) || picks.length < 1 || picks.length > KENO_MAX_PICKS ||
          new Set(picks).size !== picks.length ||
          picks.some((n) => !Number.isInteger(n) || n < 1 || n > 40)
        ) {
          return refuse('Pick between 1 and 10 distinct numbers from 1 to 40.');
        }

        const { drawn } = kenoDraw(serverSeed, clientSeed, nonce);
        const hits = kenoHits(picks, drawn);
        const multiplier = kenoPaytable(risk, picks.length)[hits.length] ?? 0;
        return {
          multiplier,
          payout: capPayout(Number(body.bet), multiplier),
          outcome: { drawn, picks, hits, risk },
        };
      };
    }

    /* ------------------------------------------------------------------ */
    case 'dice': {
      const target = Number(body.target);
      const direction = body.direction === 'over' ? 'over' : 'under';

      return ({ serverSeed, clientSeed, nonce }) => {
        if (!Number.isFinite(target) || target < 2 || target > 98) {
          return refuse('Target must be between 2 and 98.');
        }
        const { roll } = diceRoll(serverSeed, clientSeed, nonce);
        const won = diceWins(roll, target, direction);
        const multiplier = won ? diceMultiplier(diceChance(target, direction)) : 0;
        return {
          multiplier,
          payout: capPayout(Number(body.bet), multiplier),
          outcome: { roll, target, direction, won, chance: diceChance(target, direction) },
        };
      };
    }

    /* ------------------------------------------------------------------ */
    case 'limbo': {
      const target = Number(body.target);

      return ({ serverSeed, clientSeed, nonce }) => {
        if (!Number.isFinite(target) || target < 1.01 || target > 1_000_000) {
          return refuse('Target must be between 1.01× and 1,000,000×.');
        }
        const { result } = limboResult(serverSeed, clientSeed, nonce);
        const won = result >= target;
        const multiplier = won ? Math.floor(target * 100) / 100 : 0;
        return {
          multiplier,
          payout: capPayout(Number(body.bet), multiplier),
          outcome: { result, target, won },
        };
      };
    }

    default:
      return null;
  }
}

function refuse(detail: string): PlayFailure {
  return { ok: false, error: 'invalid-request', detail };
}

function bad(detail: string) {
  return NextResponse.json({ ok: false, error: 'invalid-request', detail }, { status: 400 });
}
