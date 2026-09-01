import 'server-only';
import type { PoolClient } from 'pg';
import { one, tx } from '@/lib/db';
import { buildShoe, generateServerSeed, hashServerSeed } from '@/lib/fairness';
import { LIMITS } from '@/lib/games';
import {
  MAX_SEATS, type Action, type RoundState, type SeatBet,
  actionsFor, applyAction, handTotal, openRound, settle,
} from '@/lib/blackjack';
import { InsufficientCoins, apply } from './coins';
import { ROUNDS_PER_MINUTE, roundsInLastMinute, tooManyRounds } from './limits';

/**
 * The blackjack round, start to finish.
 *
 * The shape that matters: **the shoe is never stored.** It is rebuilt from the
 * seed pair and the nonce on every request, so what a round will deal is fixed
 * the moment it opens. Only the state — whose turn, which cards are out, how
 * much is staked — is written down.
 *
 * Coins move on exactly two occasions: the opening stake comes out when the
 * hand is dealt, plus whatever a double or a split adds, and everything owed
 * goes back in one movement at settlement. Every one of those happens inside
 * the transaction that changed the hand, so a hand can never exist without its
 * debit, or a payout without its hand.
 */

export type BlackjackView = {
  roundId: number;
  state: RoundState;
  actions: Action[];
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  balance: number;
  staked: number;
  returned: number | null;
};

export type Refusal = { ok: false; error: string; detail?: string; retryAfter?: number };

type RoundRow = {
  id: string;
  seed_pair_id: string;
  nonce: number;
  bets: SeatBet[];
  state: RoundState;
  staked: number;
  returned: number | null;
  settled_at: Date | null;
};

type PairRow = {
  id: string;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
};

const PAIR_SELECT = `SELECT id::text, server_seed, server_seed_hash, client_seed, nonce
                       FROM seed_pairs WHERE user_id = $1 AND revealed_at IS NULL FOR UPDATE`;

async function livePair(client: PoolClient, userId: number): Promise<PairRow> {
  const existing = await client.query<PairRow>(PAIR_SELECT, [userId]);
  if (existing.rows[0]) return existing.rows[0];

  const serverSeed = generateServerSeed();
  await client.query(
    `INSERT INTO seed_pairs (user_id, server_seed, server_seed_hash, client_seed)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [userId, serverSeed, hashServerSeed(serverSeed), generateServerSeed().slice(0, 16)],
  );
  return (await client.query<PairRow>(PAIR_SELECT, [userId])).rows[0];
}

async function balanceOf(client: PoolClient, userId: number): Promise<number> {
  const { rows } = await client.query<{ balance: number }>(
    'SELECT balance FROM coin_balances WHERE user_id = $1',
    [userId],
  );
  return rows[0]?.balance ?? 0;
}

function view(
  roundId: number,
  state: RoundState,
  pair: { server_seed_hash: string; client_seed: string },
  nonce: number,
  balance: number,
  returned: number | null,
): BlackjackView {
  return {
    roundId,
    state,
    actions: actionsFor(state, balance),
    serverSeedHash: pair.server_seed_hash,
    clientSeed: pair.client_seed,
    nonce,
    balance,
    staked: state.staked,
    returned,
  };
}

/* -------------------------------------------------------------------------- */
/* Opening a hand                                                             */
/* -------------------------------------------------------------------------- */

export async function openBlackjack(input: {
  userId: number;
  bets: SeatBet[];
  idempotencyKey: string;
}): Promise<BlackjackView | Refusal> {
  const bets = input.bets.slice(0, MAX_SEATS).map((b) => ({
    main: Math.max(0, Math.floor(b.main || 0)),
    pairs: Math.max(0, Math.floor(b.pairs || 0)),
    plusThree: Math.max(0, Math.floor(b.plusThree || 0)),
  }));

  if (!bets.some((b) => b.main > 0)) {
    return { ok: false, error: 'no-bet', detail: 'Back at least one seat before dealing.' };
  }
  // A side bet without a main bet is not a blackjack hand, it is a lottery
  // ticket on somebody else's cards.
  if (bets.some((b) => b.main === 0 && (b.pairs > 0 || b.plusThree > 0))) {
    return { ok: false, error: 'invalid-request', detail: 'A side bet needs a main bet on that seat.' };
  }

  const staked = bets.reduce((sum, b) => sum + b.main + b.pairs + b.plusThree, 0);
  if (staked < LIMITS.minBet) {
    return { ok: false, error: 'bet-below-minimum', detail: `Minimum total stake is ${LIMITS.minBet} MC.` };
  }
  // The cap is on what goes down at the deal. Doubling and splitting can take
  // it past this, which is how a table works.
  if (staked > LIMITS.maxBet) {
    return { ok: false, error: 'bet-above-maximum', detail: `Maximum total stake is ${LIMITS.maxBet} MC.` };
  }

  try {
    return await tx<BlackjackView | Refusal>(async (client) => {
      const replay = await client.query<RoundRow>(
        `SELECT id::text, seed_pair_id::text, nonce, bets, state, staked, returned, settled_at
           FROM blackjack_rounds WHERE user_id = $1 AND idempotency_key = $2`,
        [input.userId, input.idempotencyKey],
      );
      if (replay.rows[0]) {
        const row = replay.rows[0];
        const pair = await livePair(client, input.userId);
        return view(Number(row.id), row.state, pair, row.nonce, await balanceOf(client, input.userId), row.returned);
      }

      const open = await client.query(
        'SELECT id FROM blackjack_rounds WHERE user_id = $1 AND settled_at IS NULL',
        [input.userId],
      );
      if (open.rows.length) {
        return { ok: false, error: 'hand-in-progress', detail: 'Finish the hand on the table first.' } as const;
      }

      if (await roundsInLastMinute(client, input.userId) >= ROUNDS_PER_MINUTE) {
        return tooManyRounds() as Refusal;
      }

      const pair = await livePair(client, input.userId);
      if (staked > (await balanceOf(client, input.userId))) {
        return { ok: false, error: 'insufficient-coins', detail: 'Not enough coins for those bets.' } as const;
      }

      const shoe = buildShoe(pair.server_seed, pair.client_seed, pair.nonce);
      const state = openRound(shoe, bets);

      const { rows: created } = await client.query<{ id: string }>(
        `INSERT INTO blackjack_rounds (user_id, seed_pair_id, nonce, bets, state, staked, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text`,
        [input.userId, pair.id, pair.nonce, JSON.stringify(bets), JSON.stringify(state), staked, input.idempotencyKey],
      );
      const roundId = Number(created[0].id);

      await client.query('UPDATE seed_pairs SET nonce = nonce + 1 WHERE id = $1', [pair.id]);
      await apply(client, {
        userId: input.userId,
        delta: -staked,
        kind: 'game',
        reason: 'Blackjack — stake',
        refType: 'blackjack_round',
        refId: String(roundId),
      });

      // Everyone dealt a natural, or nobody left to act: the hand is over
      // before anybody touches a button.
      if (state.phase === 'dealer') {
        await finish(client, input.userId, roundId, pair, pair.nonce, state, shoe);
      } else {
        await client.query('UPDATE blackjack_rounds SET state = $2 WHERE id = $1', [
          roundId, JSON.stringify(state),
        ]);
      }

      const fresh = await client.query<RoundRow>(
        `SELECT id::text, seed_pair_id::text, nonce, bets, state, staked, returned, settled_at
           FROM blackjack_rounds WHERE id = $1`,
        [roundId],
      );
      const row = fresh.rows[0];
      return view(roundId, row.state, pair, row.nonce, await balanceOf(client, input.userId), row.returned);
    });
  } catch (error) {
    if (error instanceof InsufficientCoins) {
      return { ok: false, error: 'insufficient-coins', detail: 'Not enough coins for those bets.' };
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Playing it out                                                             */
/* -------------------------------------------------------------------------- */

export async function actBlackjack(input: {
  userId: number;
  action: Action;
}): Promise<BlackjackView | Refusal> {
  try {
    return await tx<BlackjackView | Refusal>(async (client) => {
      const { rows } = await client.query<RoundRow>(
        `SELECT id::text, seed_pair_id::text, nonce, bets, state, staked, returned, settled_at
           FROM blackjack_rounds WHERE user_id = $1 AND settled_at IS NULL FOR UPDATE`,
        [input.userId],
      );
      const row = rows[0];
      if (!row) return { ok: false, error: 'no-hand', detail: 'There is no hand on the table.' } as const;

      const { rows: pairs } = await client.query<PairRow>(
        `SELECT id::text, server_seed, server_seed_hash, client_seed, nonce
           FROM seed_pairs WHERE id = $1 FOR UPDATE`,
        [row.seed_pair_id],
      );
      const pair = pairs[0];

      // Rebuilt, never stored — the cards were decided when the hand opened.
      const shoe = buildShoe(pair.server_seed, pair.client_seed, row.nonce);
      const state = row.state;
      const roundId = Number(row.id);

      const balance = await balanceOf(client, input.userId);
      const applied = applyAction(state, shoe, input.action, balance);
      if (!applied.ok) return { ok: false, error: 'illegal-move', detail: applied.error } as const;

      if (applied.extraStake > 0) {
        await apply(client, {
          userId: input.userId,
          delta: -applied.extraStake,
          kind: 'game',
          reason: `Blackjack — ${input.action}`,
          refType: 'blackjack_round',
          refId: String(roundId),
        });
        await client.query('UPDATE blackjack_rounds SET staked = staked + $2 WHERE id = $1', [
          roundId, applied.extraStake,
        ]);
      }

      if (state.phase === 'dealer') {
        await finish(client, input.userId, roundId, pair, row.nonce, state, shoe);
      } else {
        await client.query('UPDATE blackjack_rounds SET state = $2 WHERE id = $1', [
          roundId, JSON.stringify(state),
        ]);
      }

      const fresh = await client.query<RoundRow>(
        `SELECT id::text, seed_pair_id::text, nonce, bets, state, staked, returned, settled_at
           FROM blackjack_rounds WHERE id = $1`,
        [roundId],
      );
      const after = fresh.rows[0];
      return view(roundId, after.state, pair, after.nonce, await balanceOf(client, input.userId), after.returned);
    });
  } catch (error) {
    if (error instanceof InsufficientCoins) {
      return { ok: false, error: 'insufficient-coins', detail: 'Not enough coins for that move.' };
    }
    throw error;
  }
}

/**
 * The dealer's turn, the payout, and the row that puts this hand in the same
 * history, verifier and admin feed as every other game.
 */
async function finish(
  client: PoolClient,
  userId: number,
  roundId: number,
  pair: PairRow,
  nonce: number,
  state: RoundState,
  shoe: ReturnType<typeof buildShoe>,
): Promise<void> {
  settle(state, shoe);

  // The per-round ceiling applies to a blackjack hand exactly as it does to a
  // keno round: the whole hand is one round, however many seats it covered.
  const returned = Math.min(state.returned, LIMITS.maxWinPerRound);
  state.returned = returned;

  if (returned > 0) {
    await apply(client, {
      userId,
      delta: returned,
      kind: 'game',
      reason: 'Blackjack — return',
      refType: 'blackjack_round',
      refId: String(roundId),
      multiplier: state.staked > 0 ? Math.round((returned / state.staked) * 100) / 100 : null,
    });
  }

  await client.query(
    `UPDATE blackjack_rounds SET state = $2, returned = $3, settled_at = now() WHERE id = $1`,
    [roundId, JSON.stringify(state), returned],
  );

  await client.query(
    `INSERT INTO game_rounds
       (user_id, game, seed_pair_id, nonce, bet, multiplier, payout, outcome, idempotency_key)
     VALUES ($1, 'blackjack', $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING`,
    [
      userId,
      pair.id,
      nonce,
      state.staked,
      state.staked > 0 ? Math.round((returned / state.staked) * 100) / 100 : 0,
      returned,
      JSON.stringify({
        dealer: state.dealer,
        dealerTotal: handTotal(state.dealer),
        seats: state.seats.map((s) => ({
          main: s.main, pairs: s.pairs, plusThree: s.plusThree,
          notes: s.notes,
          hands: s.hands.map((h) => ({
            cards: h.cards, total: handTotal(h.cards), bet: h.bet,
            result: h.result, label: h.resultLabel,
          })),
        })),
      }),
      `bj-${roundId}`,
    ],
  );
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Whatever the table currently shows: the live or last hand if there is one,
 * and otherwise just enough to sit down with.
 *
 * It returns the balance and the seed commitment even when no hand has been
 * played, because a player arriving for the first time was otherwise shown a
 * balance of zero — the same "unknown rendered as nothing" this site refuses
 * everywhere else.
 */
export async function currentBlackjack(userId: number): Promise<BlackjackView | null> {
  const balanceRow = await one<{ balance: number }>(
    'SELECT balance FROM coin_balances WHERE user_id = $1',
    [userId],
  );
  const balance = balanceRow?.balance ?? 0;

  const row = await one<RoundRow>(
    `SELECT id::text, seed_pair_id::text, nonce, bets, state, staked, returned, settled_at
       FROM blackjack_rounds
      WHERE user_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );

  if (row) {
    const pair = await one<{ server_seed_hash: string; client_seed: string }>(
      'SELECT server_seed_hash, client_seed FROM seed_pairs WHERE id = $1',
      [row.seed_pair_id],
    );
    if (pair) {
      return view(Number(row.id), row.state, pair, row.nonce, balance, row.returned);
    }
  }

  // No hand yet. Show the commitment the next one will be dealt from.
  const pair = await one<{ server_seed_hash: string; client_seed: string; nonce: number }>(
    `SELECT server_seed_hash, client_seed, nonce FROM seed_pairs
      WHERE user_id = $1 AND revealed_at IS NULL`,
    [userId],
  );

  return {
    roundId: 0,
    state: {
      cursor: 0, seats: [], dealer: [], holeHidden: true,
      phase: 'settled', activeSeat: -1, activeHand: 0, staked: 0, returned: 0,
    },
    actions: [],
    serverSeedHash: pair?.server_seed_hash ?? '',
    clientSeed: pair?.client_seed ?? '',
    nonce: pair?.nonce ?? 0,
    balance,
    staked: 0,
    returned: null,
  };
}
