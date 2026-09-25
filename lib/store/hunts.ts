import 'server-only';
import { one, rows, tx, write } from '@/lib/db';
import { apply } from './coins';
import { matchSlot } from './slots';

/**
 * Bonus hunts, run on this site.
 *
 * A hunt collects bonuses (slot + bet), then opens them one by one recording
 * what each paid. Chat feeds it two ways: `!sr` suggests a slot while bonuses
 * are being collected, and `!gtb` guesses what the whole hunt will pay back.
 *
 * Money figures here are the stream's real-money balance, stored as
 * numeric(12,2) and read back as numbers. Coins only move once, at
 * settlement, through `apply` like every other coin on the site.
 */

export type HuntStatus = 'collecting' | 'opening' | 'finished';
export type GtbStatus = 'closed' | 'open' | 'locked' | 'settled';

export type Hunt = {
  id: number;
  title: string;
  startCost: number;
  status: HuntStatus;
  requestsOpen: boolean;
  gtbStatus: GtbStatus;
  gtbPrize: number;
  finalBalance: number | null;
  gtbWinner: { name: string; kickUserId: string; userId: number | null } | null;
  createdAt: string;
  openingAt: string | null;
  finishedAt: string | null;
  settledAt: string | null;
};

export type Bonus = {
  id: number;
  slotId: number | null;
  slotName: string;
  provider: string;
  imageUrl: string | null;
  bet: number;
  payout: number | null;
  position: number;
  requestedBy: string | null;
  openedAt: string | null;
};

export type SlotRequest = {
  id: number;
  kickUsername: string;
  query: string;
  slotId: number | null;
  slotName: string | null;
  provider: string | null;
  imageUrl: string | null;
  status: 'pending' | 'added' | 'dismissed';
  createdAt: string;
};

export type Guess = {
  kickUserId: string;
  kickUsername: string;
  guess: number;
  guessedAt: string;
  /** Whether this chatter has a verified Kick link — only they can be paid. */
  linked: boolean;
};

type HuntRow = {
  id: string;
  title: string;
  start_cost: string;
  status: HuntStatus;
  requests_open: boolean;
  gtb_status: GtbStatus;
  gtb_prize: number;
  final_balance: string | null;
  gtb_winner_kick_id: string | null;
  gtb_winner_name: string | null;
  gtb_winner_user_id: string | null;
  created_at: Date;
  opening_at: Date | null;
  finished_at: Date | null;
  settled_at: Date | null;
};

const HUNT_SELECT = `
  SELECT id::text, title, start_cost::text, status, requests_open, gtb_status, gtb_prize,
         final_balance::text, gtb_winner_kick_id, gtb_winner_name, gtb_winner_user_id::text,
         created_at, opening_at, finished_at, settled_at
    FROM bonus_hunts`;

function toHunt(r: HuntRow): Hunt {
  return {
    id: Number(r.id),
    title: r.title,
    startCost: Number(r.start_cost),
    status: r.status,
    requestsOpen: r.requests_open,
    gtbStatus: r.gtb_status,
    gtbPrize: r.gtb_prize,
    finalBalance: r.final_balance == null ? null : Number(r.final_balance),
    gtbWinner:
      r.gtb_winner_kick_id && r.gtb_winner_name
        ? {
            name: r.gtb_winner_name,
            kickUserId: r.gtb_winner_kick_id,
            userId: r.gtb_winner_user_id == null ? null : Number(r.gtb_winner_user_id),
          }
        : null,
    createdAt: r.created_at.toISOString(),
    openingAt: r.opening_at?.toISOString() ?? null,
    finishedAt: r.finished_at?.toISOString() ?? null,
    settledAt: r.settled_at?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

/** The one unfinished hunt, if there is one. Chat commands act on this. */
export async function liveHunt(): Promise<Hunt | null> {
  const row = await one<HuntRow>(`${HUNT_SELECT} WHERE status <> 'finished' LIMIT 1`);
  return row ? toHunt(row) : null;
}

/** What the public page shows: the live hunt, else the last one to finish. */
export async function featuredHunt(): Promise<Hunt | null> {
  const row = await one<HuntRow>(
    `${HUNT_SELECT} ORDER BY (status <> 'finished') DESC, created_at DESC LIMIT 1`,
  );
  return row ? toHunt(row) : null;
}

export async function huntById(id: number): Promise<Hunt | null> {
  const row = await one<HuntRow>(`${HUNT_SELECT} WHERE id = $1`, [id]);
  return row ? toHunt(row) : null;
}

export type HuntSummary = Hunt & { bonuses: number; won: number; bestX: number | null };

/** Past hunts with their totals, for the history table. */
export async function finishedHunts(limit = 10): Promise<HuntSummary[]> {
  const found = await rows<HuntRow & { n: string; won: string; best_x: string | null }>(
    `SELECT h.id::text, h.title, h.start_cost::text, h.status, h.requests_open, h.gtb_status,
            h.gtb_prize, h.final_balance::text, h.gtb_winner_kick_id, h.gtb_winner_name,
            h.gtb_winner_user_id::text, h.created_at, h.opening_at, h.finished_at, h.settled_at,
            (SELECT COUNT(*) FROM hunt_bonuses b WHERE b.hunt_id = h.id)::text AS n,
            (SELECT COALESCE(SUM(payout), 0) FROM hunt_bonuses b WHERE b.hunt_id = h.id)::text AS won,
            (SELECT MAX(payout / bet) FROM hunt_bonuses b WHERE b.hunt_id = h.id)::text AS best_x
       FROM bonus_hunts h
      WHERE h.status = 'finished'
      ORDER BY h.finished_at DESC
      LIMIT $1`,
    [limit],
  );
  return found.map((r) => ({
    ...toHunt(r),
    bonuses: Number(r.n),
    won: Number(r.won),
    bestX: r.best_x == null ? null : Number(r.best_x),
  }));
}

export async function bonusesFor(huntId: number): Promise<Bonus[]> {
  const found = await rows<{
    id: string;
    slot_id: string | null;
    slot_name: string;
    provider: string;
    image_url: string | null;
    bet: string;
    payout: string | null;
    position: number;
    requested_by: string | null;
    opened_at: Date | null;
  }>(
    `SELECT id::text, slot_id::text, slot_name, provider, image_url, bet::text, payout::text,
            position, requested_by, opened_at
       FROM hunt_bonuses WHERE hunt_id = $1 ORDER BY position, id`,
    [huntId],
  );
  return found.map((r) => ({
    id: Number(r.id),
    slotId: r.slot_id == null ? null : Number(r.slot_id),
    slotName: r.slot_name,
    provider: r.provider,
    imageUrl: r.image_url,
    bet: Number(r.bet),
    payout: r.payout == null ? null : Number(r.payout),
    position: r.position,
    requestedBy: r.requested_by,
    openedAt: r.opened_at?.toISOString() ?? null,
  }));
}

export async function requestsFor(
  huntId: number,
  status?: SlotRequest['status'],
): Promise<SlotRequest[]> {
  const found = await rows<{
    id: string;
    kick_username: string;
    query: string;
    slot_id: string | null;
    name: string | null;
    provider: string | null;
    image_url: string | null;
    status: SlotRequest['status'];
    created_at: Date;
  }>(
    `SELECT r.id::text, r.kick_username, r.query, r.slot_id::text, s.name, s.provider, s.image_url,
            r.status, r.created_at
       FROM slot_requests r LEFT JOIN slots s ON s.id = r.slot_id
      WHERE r.hunt_id = $1 AND ($2::text IS NULL OR r.status = $2)
      ORDER BY r.created_at ASC`,
    [huntId, status ?? null],
  );
  return found.map((r) => ({
    id: Number(r.id),
    kickUsername: r.kick_username,
    query: r.query,
    slotId: r.slot_id == null ? null : Number(r.slot_id),
    slotName: r.name,
    provider: r.provider,
    imageUrl: r.image_url,
    status: r.status,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function guessesFor(huntId: number): Promise<Guess[]> {
  const found = await rows<{
    kick_user_id: string;
    kick_username: string;
    guess: string;
    guessed_at: Date;
    linked: boolean;
  }>(
    `SELECT g.kick_user_id, g.kick_username, g.guess::text, g.guessed_at,
            (k.user_id IS NOT NULL) AS linked
       FROM gtb_guesses g LEFT JOIN kick_links k ON k.kick_user_id = g.kick_user_id
      WHERE g.hunt_id = $1
      ORDER BY g.guessed_at ASC`,
    [huntId],
  );
  return found.map((r) => ({
    kickUserId: r.kick_user_id,
    kickUsername: r.kick_username,
    guess: Number(r.guess),
    guessedAt: r.guessed_at.toISOString(),
    linked: r.linked,
  }));
}

/* -------------------------------------------------------------------------- */
/* The figures                                                                */
/* -------------------------------------------------------------------------- */

export type HuntStats = {
  bonuses: number;
  opened: number;
  totalBet: number;
  won: number;
  /** Won so far minus what the hunt cost. */
  profit: number;
  /** Average multiplier across the bonuses opened so far. */
  averageX: number | null;
  /**
   * The average multiplier the unopened bonuses need to get the hunt back to
   * its start cost. Null when there is nothing left to open, or already even.
   */
  breakEvenX: number | null;
  best: Bonus | null;
};

/** Derived, never stored, so the figures can never disagree with the rows. */
export function huntStats(hunt: Hunt, bonuses: Bonus[]): HuntStats {
  const opened = bonuses.filter((b) => b.payout != null);
  const won = opened.reduce((sum, b) => sum + (b.payout ?? 0), 0);
  const openedBet = opened.reduce((sum, b) => sum + b.bet, 0);
  const remainingBet = bonuses.reduce((sum, b) => sum + (b.payout == null ? b.bet : 0), 0);
  const shortfall = hunt.startCost - won;

  let best: Bonus | null = null;
  for (const b of opened) {
    if (!best || (b.payout ?? 0) / b.bet > (best.payout ?? 0) / best.bet) best = b;
  }

  return {
    bonuses: bonuses.length,
    opened: opened.length,
    totalBet: bonuses.reduce((sum, b) => sum + b.bet, 0),
    won,
    profit: won - hunt.startCost,
    averageX: openedBet > 0 ? won / openedBet : null,
    breakEvenX: remainingBet > 0 && shortfall > 0 ? shortfall / remainingBet : null,
    best,
  };
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                       */
/* -------------------------------------------------------------------------- */

export type ChatOutcome =
  | { ok: true; detail: string }
  | { ok: false; reason: 'no-hunt' | 'closed' | 'duplicate' };

/**
 * `!sr <slot>`. A viewer can request as many slots as they like; each is its
 * own row, so the queue shows them all. The one thing ignored is the same
 * viewer asking for the same slot again while that request is still waiting —
 * the same catalog slot, or the same typed name when there was no match — so
 * repeating a command cannot flood the queue. The check and the insert are
 * one statement, so two copies of one message cannot both land.
 */
export async function submitRequest(input: {
  kickUserId: string;
  kickUsername: string;
  query: string;
}): Promise<ChatOutcome> {
  const hunt = await liveHunt();
  if (!hunt) return { ok: false, reason: 'no-hunt' };
  if (hunt.status !== 'collecting' || !hunt.requestsOpen) return { ok: false, reason: 'closed' };

  const slot = await matchSlot(input.query);
  const saved = await write<{ id: string }>(
    `INSERT INTO slot_requests (hunt_id, kick_user_id, kick_username, query, slot_id)
     SELECT $1, $2, $3, $4, $5
      WHERE NOT EXISTS (
        SELECT 1 FROM slot_requests r
         WHERE r.hunt_id = $1 AND r.kick_user_id = $2 AND r.status = 'pending'
           AND (CASE WHEN $5::bigint IS NOT NULL THEN r.slot_id = $5::bigint
                     ELSE r.slot_id IS NULL
                          AND regexp_replace(lower(r.query), '[^a-z0-9]', '', 'g')
                            = regexp_replace(lower($4::text), '[^a-z0-9]', '', 'g')
                END))
     RETURNING id::text`,
    [hunt.id, input.kickUserId, input.kickUsername, input.query, slot?.id ?? null],
  );
  if (saved.length === 0) return { ok: false, reason: 'duplicate' };
  return { ok: true, detail: slot ? `matched ${slot.name}` : 'no catalog match, kept as typed' };
}

/** `!gtb <amount>`. Replaceable until guessing is locked. */
export async function submitGuess(input: {
  kickUserId: string;
  kickUsername: string;
  amount: number;
}): Promise<ChatOutcome> {
  const hunt = await liveHunt();
  if (!hunt) return { ok: false, reason: 'no-hunt' };
  if (hunt.gtbStatus !== 'open') return { ok: false, reason: 'closed' };

  // The status is re-checked in the statement itself, so a guess racing the
  // lock button cannot land after guessing closed.
  const saved = await write<{ hunt_id: string }>(
    `INSERT INTO gtb_guesses (hunt_id, kick_user_id, kick_username, guess)
     SELECT id, $2, $3, $4 FROM bonus_hunts WHERE id = $1 AND gtb_status = 'open'
     ON CONFLICT (hunt_id, kick_user_id) DO UPDATE
       SET kick_username = EXCLUDED.kick_username, guess = EXCLUDED.guess, guessed_at = now()
     RETURNING hunt_id::text`,
    [hunt.id, input.kickUserId, input.kickUsername, input.amount],
  );
  if (saved.length === 0) return { ok: false, reason: 'closed' };
  return { ok: true, detail: `guessed ${input.amount}` };
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export class HuntError extends Error {}

export async function createHunt(input: { title: string; startCost: number }): Promise<Hunt> {
  // A new hunt takes over the admin screen, so an unsettled one would lose its
  // settle button and its winner would never be paid.
  const unsettled = await one<{ title: string }>(
    `SELECT title FROM bonus_hunts WHERE status = 'finished' AND gtb_status IN ('open', 'locked') LIMIT 1`,
  );
  if (unsettled) {
    throw new HuntError(`Settle the guesses on "${unsettled.title}" before starting another hunt.`);
  }
  try {
    const [row] = await write<HuntRow>(
      `INSERT INTO bonus_hunts (title, start_cost) VALUES ($1, $2)
       RETURNING id::text, title, start_cost::text, status, requests_open, gtb_status, gtb_prize,
                 final_balance::text, gtb_winner_kick_id, gtb_winner_name,
                 gtb_winner_user_id::text, created_at, opening_at, finished_at, settled_at`,
      [input.title, input.startCost],
    );
    return toHunt(row);
  } catch (error) {
    if (error instanceof Error && error.message.includes('bonus_hunts_one_live_idx')) {
      throw new HuntError('A hunt is already running. Finish it before starting another.');
    }
    throw error;
  }
}

export async function updateHunt(
  huntId: number,
  input: { title: string; startCost: number },
): Promise<void> {
  const done = await write(
    `UPDATE bonus_hunts SET title = $2, start_cost = $3
      WHERE id = $1 AND settled_at IS NULL RETURNING id`,
    [huntId, input.title, input.startCost],
  );
  if (done.length === 0) throw new HuntError('A settled hunt cannot be edited.');
}

/**
 * Moving a hunt forward.
 *
 * Starting to open closes requests and locks guessing in the same statement:
 * a guess placed after the first bonus has paid is a guess with information
 * nobody else had. Finishing needs every bonus opened, because the final
 * balance is the sum of payouts and an unopened bonus would be counted as
 * nothing. Going back from opening is allowed only while nothing is opened —
 * that is correcting a misclick, not rewinding a hunt.
 */
export async function setHuntStatus(huntId: number, next: HuntStatus): Promise<void> {
  await tx(async (client) => {
    const { rows: found } = await client.query<{ status: HuntStatus }>(
      'SELECT status FROM bonus_hunts WHERE id = $1 FOR UPDATE',
      [huntId],
    );
    const current = found[0]?.status;
    if (!current) throw new HuntError('That hunt does not exist.');

    const { rows: counts } = await client.query<{ total: string; unopened: string; opened: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE payout IS NULL)::text AS unopened,
              COUNT(*) FILTER (WHERE payout IS NOT NULL)::text AS opened
         FROM hunt_bonuses WHERE hunt_id = $1`,
      [huntId],
    );
    const total = Number(counts[0].total);
    const unopened = Number(counts[0].unopened);
    const opened = Number(counts[0].opened);

    if (current === 'collecting' && next === 'opening') {
      if (total === 0) throw new HuntError('Add at least one bonus before opening.');
      await client.query(
        `UPDATE bonus_hunts
            SET status = 'opening', opening_at = now(), requests_open = false,
                gtb_status = CASE WHEN gtb_status = 'open' THEN 'locked' ELSE gtb_status END
          WHERE id = $1`,
        [huntId],
      );
      return;
    }
    if (current === 'opening' && next === 'collecting') {
      if (opened > 0) throw new HuntError('Bonuses have already been opened; the hunt cannot go back.');
      await client.query(
        `UPDATE bonus_hunts SET status = 'collecting', opening_at = NULL WHERE id = $1`,
        [huntId],
      );
      return;
    }
    if (current === 'opening' && next === 'finished') {
      if (unopened > 0) {
        throw new HuntError(`${unopened} bonus${unopened === 1 ? ' is' : 'es are'} still unopened.`);
      }
      await client.query(
        `UPDATE bonus_hunts
            SET status = 'finished', finished_at = now(), requests_open = false,
                gtb_status = CASE WHEN gtb_status = 'open' THEN 'locked' ELSE gtb_status END
          WHERE id = $1`,
        [huntId],
      );
      return;
    }
    throw new HuntError(`A hunt cannot go from ${current} to ${next}.`);
  });
}

export async function setRequestsOpen(huntId: number, open: boolean): Promise<void> {
  const done = await write(
    `UPDATE bonus_hunts SET requests_open = $2
      WHERE id = $1 AND (status = 'collecting' OR $2 = false) RETURNING id`,
    [huntId, open],
  );
  if (done.length === 0) throw new HuntError('Requests only open while bonuses are being collected.');
}

/**
 * Guessing: closed → open → locked. It can only open before the hunt starts
 * opening, and the prize is fixed when it opens so nobody guesses for one
 * prize and is paid another.
 */
export async function setGuessing(
  huntId: number,
  next: 'open' | 'locked',
  prize?: number,
): Promise<void> {
  if (next === 'open') {
    const done = await write(
      `UPDATE bonus_hunts SET gtb_status = 'open', gtb_prize = $2
        WHERE id = $1 AND status = 'collecting' AND gtb_status IN ('closed', 'locked')
        RETURNING id`,
      [huntId, prize ?? 0],
    );
    if (done.length === 0) {
      throw new HuntError('Guessing can only open while bonuses are still being collected.');
    }
    return;
  }
  const done = await write(
    `UPDATE bonus_hunts SET gtb_status = 'locked'
      WHERE id = $1 AND gtb_status = 'open' RETURNING id`,
    [huntId],
  );
  if (done.length === 0) throw new HuntError('Guessing is not open.');
}

/**
 * Adding a bonus, from the catalog, from a chat request, or typed by hand.
 * A request is marked added in the same transaction, so a request can never be
 * in the hunt twice or shown as pending once it is in.
 */
export async function addBonus(input: {
  huntId: number;
  bet: number;
  slotId?: number | null;
  name?: string;
  provider?: string;
  requestId?: number | null;
}): Promise<void> {
  let slotId = input.slotId ?? null;
  let requestedBy: string | null = null;

  await tx(async (client) => {
    const { rows: hunt } = await client.query<{ status: HuntStatus }>(
      'SELECT status FROM bonus_hunts WHERE id = $1 FOR UPDATE',
      [input.huntId],
    );
    if (!hunt[0]) throw new HuntError('That hunt does not exist.');
    if (hunt[0].status === 'finished') throw new HuntError('That hunt is finished.');

    let name = input.name?.trim() ?? '';
    let provider = input.provider?.trim() ?? '';

    if (input.requestId) {
      const { rows: req } = await client.query<{
        kick_username: string;
        query: string;
        slot_id: string | null;
        status: string;
      }>(
        `SELECT kick_username, query, slot_id::text, status FROM slot_requests
          WHERE id = $1 AND hunt_id = $2 FOR UPDATE`,
        [input.requestId, input.huntId],
      );
      if (!req[0]) throw new HuntError('That request is not part of this hunt.');
      if (req[0].status === 'added') throw new HuntError('That request is already in the hunt.');
      requestedBy = req[0].kick_username;
      slotId ??= req[0].slot_id == null ? null : Number(req[0].slot_id);
      if (!slotId && !name) name = req[0].query;
      await client.query(`UPDATE slot_requests SET status = 'added' WHERE id = $1`, [input.requestId]);
    }

    let imageUrl: string | null = null;
    if (slotId) {
      // Read through the transaction's own connection rather than the pool.
      const { rows: slot } = await client.query<{ name: string; provider: string; image_url: string | null }>(
        'SELECT name, provider, image_url FROM slots WHERE id = $1',
        [slotId],
      );
      if (!slot[0]) throw new HuntError('That slot is no longer in the catalog.');
      name = slot[0].name;
      provider = slot[0].provider;
      imageUrl = slot[0].image_url;
    }
    if (!name) throw new HuntError('Pick a slot or type its name.');

    await client.query(
      `INSERT INTO hunt_bonuses (hunt_id, slot_id, slot_name, provider, image_url, bet, position, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE((SELECT MAX(position) FROM hunt_bonuses WHERE hunt_id = $1), 0) + 1, $7)`,
      [input.huntId, slotId, name, provider, imageUrl, input.bet, requestedBy],
    );
  });
}

/** Records (or clears, with null) what a bonus paid. Locked once settled. */
export async function setPayout(bonusId: number, payout: number | null): Promise<void> {
  const done = await write(
    `UPDATE hunt_bonuses b
        SET payout = $2, opened_at = CASE WHEN $2::numeric IS NULL THEN NULL ELSE COALESCE(b.opened_at, now()) END
       FROM bonus_hunts h
      WHERE b.id = $1 AND h.id = b.hunt_id AND h.status = 'opening'
      RETURNING b.id`,
    [bonusId, payout],
  );
  if (done.length === 0) throw new HuntError('Payouts are recorded while the hunt is opening.');
}

export async function removeBonus(bonusId: number): Promise<void> {
  const done = await write(
    `DELETE FROM hunt_bonuses b USING bonus_hunts h
      WHERE b.id = $1 AND h.id = b.hunt_id AND h.status = 'collecting'
      RETURNING b.id`,
    [bonusId],
  );
  if (done.length === 0) throw new HuntError('Bonuses can only be removed while collecting.');
}

export async function dismissRequest(requestId: number): Promise<void> {
  await write(
    `UPDATE slot_requests SET status = 'dismissed' WHERE id = $1 AND status = 'pending'`,
    [requestId],
  );
}

/**
 * Deleting a hunt — for test runs and mistakes. Its bonuses, requests and
 * guesses go with it (the foreign keys cascade). A hunt whose guess the
 * balance already paid a prize is refused: those coins are real, and the hunt
 * is the record of why they were paid.
 */
export async function deleteHunt(huntId: number): Promise<{ title: string }> {
  const done = await write<{ title: string }>(
    `DELETE FROM bonus_hunts
      WHERE id = $1
        AND NOT (gtb_status = 'settled' AND gtb_winner_user_id IS NOT NULL AND gtb_prize > 0)
      RETURNING title`,
    [huntId],
  );
  if (done.length > 0) return done[0];
  const exists = await one<{ id: string }>('SELECT id::text FROM bonus_hunts WHERE id = $1', [huntId]);
  throw new HuntError(
    exists
      ? 'This hunt paid a guess-the-balance prize, so it stays as the record of that payment.'
      : 'That hunt does not exist.',
  );
}

export type SettleResult = {
  finalBalance: number;
  winner: { name: string; guess: number; userId: number } | null;
  guesses: number;
  paid: number;
};

/**
 * Settling guess the balance.
 *
 * The final balance is the sum of payouts, written onto the hunt so later
 * edits cannot move it. The winner is the closest guess from a chatter with a
 * verified Kick link — coins can only be paid to an account, and the page says
 * so to everyone guessing. A tie goes to whoever guessed first. The payout and
 * the settled mark are one transaction, and the row lock makes a second
 * settle a no-op rather than a second payment.
 */
export async function settleGuessing(huntId: number, by: string): Promise<SettleResult> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{
      title: string;
      status: HuntStatus;
      gtb_status: GtbStatus;
      gtb_prize: number;
    }>(
      'SELECT title, status, gtb_status, gtb_prize FROM bonus_hunts WHERE id = $1 FOR UPDATE',
      [huntId],
    );
    const hunt = found[0];
    if (!hunt) throw new HuntError('That hunt does not exist.');
    if (hunt.status !== 'finished') throw new HuntError('Finish the hunt before settling guesses.');
    if (hunt.gtb_status === 'settled') throw new HuntError('Guesses are already settled.');
    if (hunt.gtb_status === 'closed') throw new HuntError('Guessing never opened on this hunt.');

    const { rows: sum } = await client.query<{ total: string }>(
      'SELECT COALESCE(SUM(payout), 0)::text AS total FROM hunt_bonuses WHERE hunt_id = $1',
      [huntId],
    );
    const finalBalance = Number(sum[0].total);

    const { rows: best } = await client.query<{
      kick_user_id: string;
      kick_username: string;
      guess: string;
      user_id: string;
    }>(
      `SELECT g.kick_user_id, g.kick_username, g.guess::text, k.user_id::text
         FROM gtb_guesses g JOIN kick_links k ON k.kick_user_id = g.kick_user_id
        WHERE g.hunt_id = $1
        ORDER BY abs(g.guess - $2::numeric), g.guessed_at
        LIMIT 1`,
      [huntId, finalBalance],
    );
    const { rows: count } = await client.query<{ n: string }>(
      'SELECT COUNT(*)::text AS n FROM gtb_guesses WHERE hunt_id = $1',
      [huntId],
    );

    const winner = best[0]
      ? { name: best[0].kick_username, guess: Number(best[0].guess), userId: Number(best[0].user_id) }
      : null;

    await client.query(
      `UPDATE bonus_hunts
          SET gtb_status = 'settled', settled_at = now(), final_balance = $2,
              gtb_winner_kick_id = $3, gtb_winner_name = $4, gtb_winner_user_id = $5
        WHERE id = $1`,
      [huntId, finalBalance, best[0]?.kick_user_id ?? null, winner?.name ?? null, winner?.userId ?? null],
    );

    let paid = 0;
    if (winner && hunt.gtb_prize > 0) {
      await apply(client, {
        userId: winner.userId,
        delta: hunt.gtb_prize,
        kind: 'giveaway',
        reason: `Guess the balance — ${hunt.title}`,
        refType: 'bonus_hunt',
        refId: String(huntId),
      });
      paid = hunt.gtb_prize;
    }

    await client.query(
      `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, 'hunt.gtb.settled', $2, $3)`,
      [
        by,
        String(huntId),
        JSON.stringify({ finalBalance, winner: winner?.name ?? null, guess: winner?.guess ?? null, paid }),
      ],
    );

    return { finalBalance, winner, guesses: Number(count[0].n), paid };
  });
}
