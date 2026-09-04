import 'server-only';
import { one, rows, tx, write } from '@/lib/db';

/**
 * The lifetime wager ladder.
 *
 * Milestones are cumulative and never reset, which is the whole point of them
 * next to a leaderboard that resets every month. A tier is claimable exactly
 * once, forever, and that is enforced by a unique index on (user, tier) rather
 * than by the button being disabled.
 */

export type Tier = {
  id: number;
  threshold: number;
  reward: number;
  active: boolean;
};

export type ClaimStatus = 'pending' | 'paid' | 'rejected';

export type Claim = {
  id: number;
  tierId: number;
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
  const result = await rows<{
    id: string;
    threshold: string;
    reward: string;
    active: boolean;
  }>(
    `SELECT id::text, threshold::text, reward::text, active
       FROM milestone_tiers
      ${includeInactive ? '' : 'WHERE active'}
      ORDER BY threshold ASC`,
  );
  return result.map((r) => ({
    id: Number(r.id),
    threshold: Number(r.threshold),
    reward: Number(r.reward),
    active: r.active,
  }));
}

export async function claimsFor(userId: number): Promise<Claim[]> {
  const result = await rows<{
    id: string;
    tier_id: string;
    status: ClaimStatus;
    reward: string;
    wagered_at_claim: string;
    created_at: Date;
    paid_at: Date | null;
  }>(
    `SELECT id::text, tier_id::text, status, reward::text,
            wagered_at_claim::text, created_at, paid_at
       FROM milestone_claims
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return result.map((r) => ({
    id: Number(r.id),
    tierId: Number(r.tier_id),
    status: r.status,
    reward: Number(r.reward),
    wageredAtClaim: Number(r.wagered_at_claim),
    createdAt: r.created_at.toISOString(),
    paidAt: r.paid_at?.toISOString() ?? null,
  }));
}

/**
 * The ladder as a screen wants it: every tier, its state, and the claim behind
 * that state.
 *
 * `razedApproved` gates claimability rather than progress. Someone whose link
 * is still pending should see how far along they are — hiding it would make
 * the approval queue feel like a black hole — but cannot claim until a mod has
 * confirmed the username is theirs.
 */
export function buildLadder(
  tiers: Tier[],
  claims: Claim[],
  lifetimeWagered: number,
  razedApproved: boolean,
): LadderRung[] {
  const byTier = new Map(claims.map((c) => [c.tierId, c]));
  return tiers.map((tier) => {
    const claim = byTier.get(tier.id) ?? null;
    if (claim && claim.status === 'paid') return { tier, claim, state: 'paid' as const };
    if (claim && claim.status === 'pending') return { tier, claim, state: 'pending' as const };
    const reached = lifetimeWagered >= tier.threshold;
    return {
      tier,
      claim,
      state: reached && razedApproved ? ('claimable' as const) : ('locked' as const),
    };
  });
}

/** The next unreached tier, for the home rail and the milestones header. */
export function nextTier(tiers: Tier[], lifetimeWagered: number): Tier | null {
  return tiers.find((t) => t.threshold > lifetimeWagered) ?? null;
}

/** How far through the current tier someone is, 0–100. */
export function progressTo(tiers: Tier[], lifetimeWagered: number): number {
  const next = nextTier(tiers, lifetimeWagered);
  if (!next) return 100;
  const previous = tiers.filter((t) => t.threshold < next.threshold).pop()?.threshold ?? 0;
  const span = next.threshold - previous;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((lifetimeWagered - previous) / span) * 100)));
}

export type ClaimResult =
  | { ok: true; claim: Claim }
  | { ok: false; error: 'already-claimed' | 'not-reached' | 'not-approved' | 'unknown-tier' };

/**
 * Claim one tier.
 *
 * The threshold is re-checked inside the transaction against the wager figure
 * the caller measured, and the figure is frozen onto the claim. If Razed later
 * restates a number downward, a claim already made stays valid — it was earned
 * against what the site could see at the time, and clawing it back would be
 * indefensible.
 */
export async function claimTier(input: {
  userId: number;
  tierId: number;
  lifetimeWagered: number;
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
    if (input.lifetimeWagered < Number(tier.threshold)) {
      return { ok: false, error: 'not-reached' } as const;
    }

    const { rows: inserted } = await client.query<{
      id: string;
      tier_id: string;
      status: ClaimStatus;
      reward: string;
      wagered_at_claim: string;
      created_at: Date;
      paid_at: Date | null;
    }>(
      `INSERT INTO milestone_claims (user_id, tier_id, wagered_at_claim, reward)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, tier_id) DO NOTHING
       RETURNING id::text, tier_id::text, status, reward::text,
                 wagered_at_claim::text, created_at, paid_at`,
      [input.userId, input.tierId, input.lifetimeWagered, tier.reward],
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
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export type PayoutRow = {
  claimId: number;
  username: string;
  razedUsername: string | null;
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
    threshold: string;
    reward: string;
    created_at: Date;
    hours: string;
  }>(
    `SELECT c.id::text                AS claim_id,
            u.discord_username        AS username,
            rl.username               AS razed_username,
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
  threshold: number;
  reward: number;
  active: boolean;
}): Promise<void> {
  if (input.id) {
    await write(
      'UPDATE milestone_tiers SET threshold = $2, reward = $3, active = $4 WHERE id = $1',
      [input.id, input.threshold, input.reward, input.active],
    );
    return;
  }
  await write(
    `INSERT INTO milestone_tiers (threshold, reward, active)
     VALUES ($1, $2, $3)
     ON CONFLICT (threshold) DO UPDATE SET reward = EXCLUDED.reward, active = EXCLUDED.active`,
    [input.threshold, input.reward, input.active],
  );
}

export async function pendingClaimCount(): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM milestone_claims WHERE status = 'pending'`,
  );
  return Number(row?.n ?? 0);
}
