import { NextResponse } from 'next/server';
import { baccaratCoup, diceRoll, kenoDraw, limboResult, wheelSpin } from '@/lib/fairness';
import {
  KENO_MAX_PICKS, KENO_RISKS, LIMITS, WHEEL_RISKS, capPayout, diceChance, diceMultiplier,
  diceWins, kenoHits, kenoPaytable, wheelSegments,
} from '@/lib/games';
import {
  BACCARAT_BETS, emptySpread, settleCoup, spreadTotal,
  type BaccaratSpread,
} from '@/lib/baccarat';
import { playRound, type PlayFailure, type Resolution } from '@/lib/store/play';
import { requireUser } from '@/lib/player';
import { gameIsPlayable } from '@/lib/store/settings';
import type { KenoRisk, WheelRisk } from '@/lib/games';
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

  // The kill switch is checked here, not only in the lobby. A switch that
  // leaves the API accepting bets is not a switch.
  if (!(await gameIsPlayable(game))) {
    return NextResponse.json(
      {
        ok: false,
        error: 'game-unavailable',
        detail: 'This game is switched off right now. Nothing has been staked.',
      },
      { status: 503 },
    );
  }

  const result = await playRound({
    userId: gate.user.id,
    game,
    bet,
    idempotencyKey,
    resolve,
  });

  if (result.ok) return NextResponse.json(result);

  // 429 with Retry-After, so a client can back off rather than guess.
  if (result.error === 'rate-limited') {
    return NextResponse.json(result, {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfter) },
    });
  }
  return NextResponse.json(result, { status: 400 });
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

    /* ------------------------------------------------------------------ */
    case 'wheel': {
      const risk = body.risk as WheelRisk;

      return ({ serverSeed, clientSeed, nonce }) => {
        if (!WHEEL_RISKS.includes(risk)) return refuse('Unknown risk level.');

        // The spin picks a segment; the segment carries the multiplier. The
        // browser is told which index came up so it can land the animation on
        // it, but it never chooses the index and never states the payout.
        const segments = wheelSegments(risk);
        const { index } = wheelSpin(serverSeed, clientSeed, nonce, segments.length);
        const multiplier = segments[index] ?? 0;
        return {
          multiplier,
          payout: capPayout(Number(body.bet), multiplier),
          outcome: { index, risk, segments, multiplier },
        };
      };
    }

    /* ------------------------------------------------------------------ */
    /**
     * Baccarat, the one game here that stakes several spots at once.
     *
     * `playRound` records a round as one bet and one payout, which still fits:
     * the bet is the whole spread and the multiplier is what actually came
     * back per coin of it. The split is validated against that total rather
     * than trusted, because the total is what the balance was debited by — a
     * spread that summed to more than it claimed would be a free bet.
     */
    case 'baccarat': {
      const bet = Number(body.bet);
      const raw = (body.spread ?? {}) as Record<string, unknown>;

      const spread: BaccaratSpread = emptySpread();
      for (const key of BACCARAT_BETS) {
        const amount = Number(raw[key] ?? 0);
        if (!Number.isFinite(amount) || amount < 0 || Math.floor(amount) !== amount) {
          return () => refuse('Every stake has to be a whole number of coins.');
        }
        spread[key] = amount;
      }

      return ({ serverSeed, clientSeed, nonce }) => {
        const total = spreadTotal(spread);
        if (total === 0) return refuse('Back at least one spot before dealing.');
        if (total !== bet) {
          return refuse('The stakes on the table do not add up to the bet. Nothing has been staked.');
        }

        const coup = baccaratCoup(serverSeed, clientSeed, nonce);
        const { lines, returned } = settleCoup(spread, coup);

        // Capped like every other game, and the multiplier is recomputed from
        // the capped figure so the round never records a payout it did not
        // make.
        const payout = Math.min(returned, LIMITS.maxWinPerRound);
        return {
          multiplier: bet > 0 ? Math.round((payout / bet) * 10_000) / 10_000 : 0,
          payout,
          outcome: {
            player: coup.player,
            banker: coup.banker,
            playerTotal: coup.playerTotal,
            bankerTotal: coup.bankerTotal,
            result: coup.outcome,
            natural: coup.natural,
            playerPair: coup.playerPair,
            bankerPair: coup.bankerPair,
            spread,
            lines,
          },
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
