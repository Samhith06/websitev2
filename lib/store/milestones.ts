import 'server-only';
import { one, rows, tx, write } from '@/lib/db';
import { LIFETIME_PERIOD } from './razed-snapshots';

/**
 * The wager ladder.
 *
 * It runs in cycles. For most members a cycle is a calendar month in UTC:
 * progress is that month's wager, and on the 1st it starts again from zero with
 * every tier claimable again. Members on the hand-kept lifetime list stay on one
 * cycle for good, measured against their lifetime total.
 *
 * A tier is claimable exactly once per cycle, and that is enforced by a unique
 * index on (user, tier, cycle) rather than by the button being disabled.
 */

/** The cycle a lifetime member's claims are filed under. Months are 'YYYY-MM'. */
export const LIFETIME_CYCLE = 'lifetime';

export type Tier = {
  id: number;
  /** Rookie, Hustler, Grinder… — how the ladder is actually talked about. */
  name: string;
  threshold: number;
  reward: number;
  active: boolean;
};

export type ClaimStatus = 'pending' | 'paid' | 'rejected';

export type Claim = {
  id: number;
  tierId: number;
  /** 'YYYY-MM', or LIFETIME_CYCLE. */
  cycle: string;
  status: ClaimStatus;
  reward: number;
  wageredAtClaim: number;
  createdAt: string;
  paidAt: string | null;
};

export type LadderRung = {
  tier: Tier;
  /** claimed covers both pending and paid — the tier is spent either way. */
  state: 'locked' | 'claimable' | 'pending' | 'paid';
  claim: Claim | null;
};

export async function listTiers(includeInactive = false): Promise<Tier[]> {
  /**
   * The casts are aliased away from the source column names on purpose.
   *
   * `SELECT threshold::text ... ORDER BY threshold` looks right and is wrong:
   * a bare name in ORDER BY resolves to the *output* column first, so it would
   * sort the text and put $100,000 between $10,000 and $25,000. Different
   * names mean ORDER BY can only mean the numeric column.
   */
  const result = await rows<{
    id: string;
    name: string | null;
    threshold_text: string;
    reward_text: string;
    active: boolean;
  }>(
    `SELECT id::text, name, threshold::text AS threshold_text,
            reward::text AS reward_text, active
       FROM milestone_tiers
      ${includeInactive ? '' : 'WHERE active'}
      ORDER BY threshold ASC`,
  );
  return result.map((r) => ({
    id: Number(r.id),
    name: r.name ?? '',
    threshold: Number(r.threshold_text),
    reward: Number(r.reward_text),
    active: r.active,
  }));
}

export async function claimsFor(userId: number): Promise<Claim[]> {
  const result = await rows<{
    id: string;
    tier_id: string;
    cycle: string;
    status: ClaimStatus;
    reward: string;
    wagered_at_claim: string;
    created_at: Date;
    paid_at: Date | null;
  }>(
    `SELECT id::text, tier_id::text, cycle, status, reward::text,
            wagered_at_claim::text, created_at, paid_at
       FROM milestone_claims
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return result.map((r) => ({
    id: Number(r.id),
    tierId: Number(r.tier_id),
    cycle: r.cycle,
    status: r.status,
    reward: Number(r.reward),
    wageredAtClaim: Number(r.wagered_at_claim),
    createdAt: r.created_at.toISOString(),
    paidAt: r.paid_at?.toISOString() ?? null,
  }));
}

/**
 * The claims that count against a cycle's ladder.
 *
 * A month only sees its own. A lifetime member sees every live claim they hold,
 * whichever cycle it was made in: each tier is once-ever for them, so a tier
 * they claimed on a monthly ladder before being added is already spent.
 */
export function claimsForCycle(claims: Claim[], cycle: string): Claim[] {
  return cycle === LIFETIME_CYCLE
    ? claims.filter((c) => c.status !== 'rejected')
    : claims.filter((c) => c.cycle === cycle);
}

/**
 * The ladder as a screen wants it: every tier, its state, and the claim behind
 * that state. `claims` is the result of `claimsForCycle`, and `wagered` is the
 * figure for the same cycle.
 *
 * `razedApproved` gates claimability rather than progress. Someone whose link
 * is still pending should see how far along they are — hiding it would make
 * the approval queue feel like a black hole — but cannot claim until a mod has
 * confirmed the username is theirs.
 */
export function buildLadder(
  tiers: Tier[],
  claims: Claim[],
  wagered: number,
  razedApproved: boolean,
): LadderRung[] {
  const byTier = new Map(claims.map((c) => [c.tierId, c]));
  return tiers.map((tier) => {
    const claim = byTier.get(tier.id) ?? null;
    if (claim && claim.status === 'paid') return { tier, claim, state: 'paid' as const };
    if (claim && claim.status === 'pending') return { tier, claim, state: 'pending' as const };
    const reached = wagered >= tier.threshold;
    return {
      tier,
      claim,
      state: reached && razedApproved ? ('claimable' as const) : ('locked' as const),
    };
  });
}

/** The next unreached tier, for the home rail and the milestones header. */
export function nextTier(tiers: Tier[], wagered: number): Tier | null {
  return tiers.find((t) => t.threshold > wagered) ?? null;
}

/** How far through the current tier someone is, 0–100. */
export function progressTo(tiers: Tier[], wagered: number): number {
  const next = nextTier(tiers, wagered);
  if (!next) return 100;
  const previous = tiers.filter((t) => t.threshold < next.threshold).pop()?.threshold ?? 0;
  const span = next.threshold - previous;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((wagered - previous) / span) * 100)));
}

export type ClaimResult =
  | { ok: true; claim: Claim }
  | { ok: false; error: 'already-claimed' | 'not-reached' | 'not-approved' | 'unknown-tier' };

/**
 * Claim one tier, on one cycle's ladder.
 *
 * The threshold is re-checked inside the transaction against the wager figure
 * the caller measured for that cycle, and the figure is frozen onto the claim.
 * If Razed later restates a number downward, a claim already made stays valid —
 * it was earned against what the site could see at the time, and clawing it back
 * would be indefensible.
 *
 * The caller passes the cycle it measured rather than this working out the
 * current one. Otherwise a claim landing just after midnight on the 1st would
 * spend the new month's tier using the old month's figure.
 */
export async function claimTier(input: {
  userId: number;
  tierId: number;
  cycle: string;
  wagered: number;
  razedApproved: boolean;
}): Promise<ClaimResult> {
  if (!input.razedApproved) return { ok: false, error: 'not-approved' };

  return tx(async (client) => {
    const { rows: tierRows } = await client.query<{
      id: string;
      threshold: string;
      reward: string;
    }>(
      'SELECT id::text, threshold::text, reward::text FROM milestone_tiers WHERE id = $1 AND active',
      [input.tierId],
    );
    const tier = tierRows[0];
    if (!tier) return { ok: false, error: 'unknown-tier' } as const;
    if (input.wagered < Number(tier.threshold)) {
      return { ok: false, error: 'not-reached' } as const;
    }

    // The index only stops a repeat within one cycle. A lifetime member gets
    // each tier once ever, including any they claimed on a monthly ladder before
    // they were added, and that has to be checked by hand.
    if (input.cycle === LIFETIME_CYCLE) {
      const { rows: spent } = await client.query(
        `SELECT 1 FROM milestone_claims
          WHERE user_id = $1 AND tier_id = $2 AND status <> 'rejected'
          LIMIT 1`,
        [input.userId, input.tierId],
      );
      if (spent[0]) return { ok: false, error: 'already-claimed' } as const;
    }

    const { rows: inserted } = await client.query<{
      id: string;
      tier_id: string;
      cycle: string;
      status: ClaimStatus;
      reward: string;
      wagered_at_claim: string;
      created_at: Date;
      paid_at: Date | null;
    }>(
      `INSERT INTO milestone_claims (user_id, tier_id, cycle, wagered_at_claim, reward)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, tier_id, cycle) DO NOTHING
       RETURNING id::text, tier_id::text, cycle, status, reward::text,
                 wagered_at_claim::text, created_at, paid_at`,
      [input.userId, input.tierId, input.cycle, input.wagered, tier.reward],
    );

    // The conflict path is the double-tap: the tier is already claimed, and
    // saying so is the correct answer rather than an error.
    if (!inserted[0]) return { ok: false, error: 'already-claimed' } as const;

    const r = inserted[0];
    return {
      ok: true,
      claim: {
        id: Number(r.id),
        tierId: Number(r.tier_id),
        cycle: r.cycle,
        status: r.status,
        reward: Number(r.reward),
        wageredAtClaim: Number(r.wagered_at_claim),
        createdAt: r.created_at.toISOString(),
        paidAt: r.paid_at?.toISOString() ?? null,
      },
    } as const;
  });
}

/* -------------------------------------------------------------------------- */
/* The lifetime list                                                          */
/* -------------------------------------------------------------------------- */

export async function isLifetimeMember(userId: number): Promise<boolean> {
  const row = await one<{ user_id: string }>(
    'SELECT user_id::text FROM milestone_lifetime_members WHERE user_id = $1',
    [userId],
  );
  return row != null;
}

export type LifetimeMember = {
  userId: number;
  username: string;
  razedUsername: string | null;
  /** Null when there is no approved Razed link to read a figure for. */
  wagered: number | null;
  addedBy: string;
  addedAt: string;
};

export async function listLifetimeMembers(): Promise<LifetimeMember[]> {
  const result = await rows<{
    user_id: string;
    username: string;
    razed_username: string | null;
    wagered: string | null;
    added_by: string;
    created_at: Date;
  }>(
    `SELECT m.user_id::text,
            u.discord_username AS username,
            rl.username        AS razed_username,
            rw.wagered::text   AS wagered,
            m.added_by,
            m.created_at
       FROM milestone_lifetime_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN razed_links rl ON rl.user_id = m.user_id
       LEFT JOIN razed_wagers rw
              ON lower(rw.username) = lower(rl.username)
             AND rl.status = 'approved'
             AND rw.snapshot_id = (
               SELECT id FROM razed_snapshots WHERE period = $1
                ORDER BY fetched_at DESC LIMIT 1
             )
      ORDER BY lower(u.discord_username) ASC`,
    [LIFETIME_PERIOD],
  );
  return result.map((r) => ({
    userId: Number(r.user_id),
    username: r.username,
    razedUsername: r.razed_username,
    wagered: r.wagered == null ? null : Number(r.wagered),
    addedBy: r.added_by,
    addedAt: r.created_at.toISOString(),
  }));
}

/**
 * Accounts matching a name exactly: Discord username or id, Kick username, or
 * Razed username.
 *
 * Exact rather than a search, because this decides who is owed money, and
 * "matty" should not quietly pick one of three accounts. The caller refuses
 * anything but a single match. Two rows is enough to know that.
 */
export async function findMembersByHandle(
  handle: string,
): Promise<Array<{ userId: number; username: string }>> {
  const result = await rows<{ id: string; discord_username: string }>(
    `SELECT DISTINCT u.id::text, u.discord_username
       FROM users u
       LEFT JOIN kick_links k   ON k.user_id = u.id
       LEFT JOIN razed_links rl ON rl.user_id = u.id
      WHERE u.discord_id = $1
         OR lower(u.discord_username) = lower($1)
         OR lower(k.kick_username) = lower($1)
         OR lower(rl.username) = lower($1)
      LIMIT 2`,
    [handle],
  );
  return result.map((r) => ({ userId: Number(r.id), username: r.discord_username }));
}

/** Returns false when they were already on the list. */
export async function grantLifetime(userId: number, by: string): Promise<boolean> {
  const inserted = await rows<{ user_id: string }>(
    `INSERT INTO milestone_lifetime_members (user_id, added_by)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING user_id::text`,
    [userId, by],
  );
  return inserted.length > 0;
}

export async function revokeLifetime(userId: number): Promise<void> {
  await write('DELETE FROM milestone_lifetime_members WHERE user_id = $1', [userId]);
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export type PayoutRow = {
  claimId: number;
  username: string;
  razedUsername: string | null;
  /** Which ladder it was claimed on, because the same tier now recurs. */
  cycle: string;
  threshold: number;
  reward: number;
  createdAt: string;
  hoursWaiting: number;
};

/** The milestone half of the payout queue, oldest first — that is the order
 *  Matty should work it in, and the one that surfaces anything overdue. */
export async function pendingPayouts(): Promise<PayoutRow[]> {
  const result = await rows<{
    claim_id: string;
    username: string;
    razed_username: string | null;
    cycle: string;
    threshold: string;
    reward: string;
    created_at: Date;
    hours: string;
  }>(
    `SELECT c.id::text                AS claim_id,
            u.discord_username        AS username,
            rl.username               AS razed_username,
            c.cycle,
            t.threshold::text,
            c.reward::text,
            c.created_at,
            EXTRACT(EPOCH FROM (now() - c.created_at)) / 3600 AS hours
       FROM milestone_claims c
       JOIN users u           ON u.id = c.user_id
       JOIN milestone_tiers t ON t.id = c.tier_id
       LEFT JOIN razed_links rl ON rl.user_id = c.user_id
      WHERE c.status = 'pending'
      ORDER BY c.created_at ASC`,
  );
  return result.map((r) => ({
    claimId: Number(r.claim_id),
    username: r.username,
    razedUsername: r.razed_username,
    cycle: r.cycle,
    threshold: Number(r.threshold),
    reward: Number(r.reward),
    createdAt: r.created_at.toISOString(),
    hoursWaiting: Math.round(Number(r.hours)),
  }));
}

export async function markClaimPaid(claimId: number, by: string): Promise<void> {
  await write(
    `UPDATE milestone_claims
        SET status = 'paid', paid_by = $2, paid_at = now()
      WHERE id = $1 AND status = 'pending'`,
    [claimId, by],
  );
}

export async function rejectClaim(claimId: number, by: string): Promise<void> {
  await write(
    `UPDATE milestone_claims
        SET status = 'rejected', paid_by = $2, paid_at = now()
      WHERE id = $1 AND status = 'pending'`,
    [claimId, by],
  );
}

export async function upsertTier(input: {
  id?: number;
  name: string;
  threshold: number;
  reward: number;
  active: boolean;
}): Promise<void> {
  if (input.id) {
    await write(
      `UPDATE milestone_tiers
          SET name = $2, threshold = $3, reward = $4, active = $5
        WHERE id = $1`,
      [input.id, input.name, input.threshold, input.reward, input.active],
    );
    // The threshold may have moved, and the ladder's order follows it.
    await resequenceTiers();
    return;
  }
  await write(
    `INSERT INTO milestone_tiers (name, threshold, reward, active)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (threshold) DO UPDATE
       SET name = EXCLUDED.name, reward = EXCLUDED.reward, active = EXCLUDED.active`,
    [input.name, input.threshold, input.reward, input.active],
  );
  await resequenceTiers();
}

/**
 * How many claims stand against a tier.
 *
 * The delete guard depends on this. A claimed tier is referenced by
 * `milestone_claims`, which is the record of a real payout, so removing it
 * would either break the foreign key or erase the evidence behind money that
 * has already been sent.
 */
export async function claimCountForTier(tierId: number): Promise<number> {
  const row = await one<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM milestone_claims WHERE tier_id = $1',
    [tierId],
  );
  return Number(row?.n ?? 0);
}

export class TierInUse extends Error {
  constructor(public readonly claims: number) {
    super(`That tier has ${claims} claim${claims === 1 ? '' : 's'} against it.`);
    this.name = 'TierInUse';
  }
}

/**
 * Remove a tier outright.
 *
 * Only ever a tier nobody has claimed. The alternative — deactivating — is
 * what migration 009 did to the tiers the new ladder replaced, and it is the
 * right move for anything with history: the tier stops being offered while
 * every claim against it stays intact and explicable.
 */
export async function deleteTier(tierId: number): Promise<void> {
  const claims = await claimCountForTier(tierId);
  if (claims > 0) throw new TierInUse(claims);
  await write('DELETE FROM milestone_tiers WHERE id = $1', [tierId]);
  await resequenceTiers();
}

export async function setTierActive(tierId: number, active: boolean): Promise<void> {
  await write('UPDATE milestone_tiers SET active = $2 WHERE id = $1', [tierId, active]);
}

/**
 * Renumber `sort_order` to match threshold order.
 *
 * The ladder's order is not a preference — `nextTier` takes the first tier
 * above a figure and `progressTo` takes the last one below it, so a ladder
 * held in any order but ascending by threshold computes the wrong progress
 * bar. `sort_order` is kept in step rather than being an independent handle,
 * which means adding a tier in the middle slots it in rather than landing at
 * the end.
 *
 * Called after every write that can change the order.
 */
export async function resequenceTiers(): Promise<void> {
  await write(
    `UPDATE milestone_tiers t
        SET sort_order = ordered.position
       FROM (
         SELECT id, ROW_NUMBER() OVER (ORDER BY threshold ASC) AS position
           FROM milestone_tiers
       ) AS ordered
      WHERE t.id = ordered.id AND t.sort_order IS DISTINCT FROM ordered.position`,
  );
}

export async function pendingClaimCount(): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM milestone_claims WHERE status = 'pending'`,
  );
  return Number(row?.n ?? 0);
}
