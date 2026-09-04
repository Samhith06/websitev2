import 'server-only';
import { one, rows, write } from '@/lib/db';

/**
 * A site account's claim on a Razed username.
 *
 * This is the highest-stakes row in the schema. Approving the wrong one hands
 * somebody else's wager history — and their milestone money — to the wrong
 * person, and since Razed exposes nothing that would let us verify ownership
 * automatically, a mod's judgement is the only defence. Everything here exists
 * to make that judgement well-informed: the mod queue carries the signals
 * alongside the request rather than making anyone go and look them up.
 */

export type LinkStatus = 'pending' | 'matched' | 'approved' | 'rejected';

export type RazedLink = {
  userId: number;
  username: string;
  status: LinkStatus;
  matchedWagered: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
};

function toLink(r: {
  user_id: string;
  username: string;
  status: LinkStatus;
  matched_wagered: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  reject_reason: string | null;
  created_at: Date;
}): RazedLink {
  return {
    userId: Number(r.user_id),
    username: r.username,
    status: r.status,
    matchedWagered: r.matched_wagered == null ? null : Number(r.matched_wagered),
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at?.toISOString() ?? null,
    rejectReason: r.reject_reason,
    createdAt: r.created_at.toISOString(),
  };
}

const SELECT = `SELECT user_id::text, username, status, matched_wagered::text,
                       reviewed_by, reviewed_at, reject_reason, created_at
                  FROM razed_links`;

export async function linkFor(userId: number): Promise<RazedLink | null> {
  const row = await one<Parameters<typeof toLink>[0]>(`${SELECT} WHERE user_id = $1`, [userId]);
  return row ? toLink(row) : null;
}

export type SubmitResult =
  | { ok: true; link: RazedLink }
  | { ok: false; error: 'taken' | 'not-found-in-referrals' };

/**
 * Submit or change a claimed username.
 *
 * Two checks happen before anything is stored. First, whether another account
 * already holds it — rejected immediately, because a queue is the wrong place
 * to discover a collision. Second, whether the name appears in Razed's referral
 * data at all: a username that has never wagered under the code cannot belong
 * to anyone here, and telling them so straight away beats leaving a request to
 * rot in a queue nobody can action.
 *
 * Changing the username resets to pending. Anything already paid stays paid.
 */
export async function submitLink(input: {
  userId: number;
  username: string;
  /** The wager total seen for this username in the newest snapshot, or null. */
  matchedWagered: number | null;
}): Promise<SubmitResult> {
  const clean = input.username.trim();

  const holder = await one<{ user_id: string }>(
    'SELECT user_id::text FROM razed_links WHERE lower(username) = lower($1)',
    [clean],
  );
  if (holder && Number(holder.user_id) !== input.userId) {
    return { ok: false, error: 'taken' };
  }

  if (input.matchedWagered == null) {
    return { ok: false, error: 'not-found-in-referrals' };
  }

  const row = await one<Parameters<typeof toLink>[0]>(
    `INSERT INTO razed_links (user_id, username, status, matched_wagered, updated_at)
     VALUES ($1, $2, 'matched', $3, now())
     ON CONFLICT (user_id) DO UPDATE
       SET username = EXCLUDED.username,
           matched_wagered = EXCLUDED.matched_wagered,
           -- Re-submitting the same approved name must not knock it back to
           -- the queue; only an actual change of username does.
           status = CASE WHEN lower(razed_links.username) = lower(EXCLUDED.username)
                         THEN razed_links.status ELSE 'matched' END,
           reviewed_by = CASE WHEN lower(razed_links.username) = lower(EXCLUDED.username)
                              THEN razed_links.reviewed_by ELSE NULL END,
           reviewed_at = CASE WHEN lower(razed_links.username) = lower(EXCLUDED.username)
                              THEN razed_links.reviewed_at ELSE NULL END,
           reject_reason = NULL,
           updated_at = now()
     RETURNING user_id::text, username, status, matched_wagered::text,
               reviewed_by, reviewed_at, reject_reason, created_at`,
    [input.userId, clean, input.matchedWagered],
  );
  return { ok: true, link: toLink(row!) };
}

/* -------------------------------------------------------------------------- */
/* Mod queue                                                                  */
/* -------------------------------------------------------------------------- */

export type QueueRow = RazedLink & {
  discordUsername: string;
  /** Every signal the approve decision should be made on, in one row. */
  accountAgeDays: number;
  kickVerified: boolean;
  /** Whether this account has ever claimed a different Razed username. */
  previousClaims: number;
  /** High-value username meeting a new account — the impersonation shape. */
  flagged: boolean;
};

const FLAG_WAGER = 25_000;
const FLAG_AGE_DAYS = 14;

export async function reviewQueue(limit = 100): Promise<QueueRow[]> {
  const result = await rows<
    Parameters<typeof toLink>[0] & {
      discord_username: string;
      account_age_days: string;
      kick_verified: boolean;
      previous_claims: string;
    }
  >(
    `SELECT rl.user_id::text, rl.username, rl.status, rl.matched_wagered::text,
            rl.reviewed_by, rl.reviewed_at, rl.reject_reason, rl.created_at,
            u.discord_username,
            EXTRACT(EPOCH FROM (now() - u.created_at)) / 86400 AS account_age_days,
            (kl.user_id IS NOT NULL)                           AS kick_verified,
            (SELECT COUNT(*) FROM audit_log a
              WHERE a.target = u.id::text AND a.action = 'razed.link.changed')::text
              AS previous_claims
       FROM razed_links rl
       JOIN users u ON u.id = rl.user_id
       LEFT JOIN kick_links kl ON kl.user_id = rl.user_id
      WHERE rl.status IN ('pending', 'matched')
      ORDER BY rl.created_at ASC
      LIMIT $1`,
    [limit],
  );

  return result.map((r) => {
    const link = toLink(r);
    const ageDays = Math.floor(Number(r.account_age_days));
    const wagered = link.matchedWagered ?? 0;
    return {
      ...link,
      discordUsername: r.discord_username,
      accountAgeDays: ageDays,
      kickVerified: r.kick_verified,
      previousClaims: Number(r.previous_claims),
      flagged: wagered >= FLAG_WAGER && ageDays <= FLAG_AGE_DAYS,
    };
  });
}

export async function approveLink(userId: number, by: string): Promise<void> {
  await write(
    `UPDATE razed_links
        SET status = 'approved', reviewed_by = $2, reviewed_at = now(), updated_at = now()
      WHERE user_id = $1`,
    [userId, by],
  );
}

export async function rejectLink(userId: number, by: string, reason: string): Promise<void> {
  await write(
    `UPDATE razed_links
        SET status = 'rejected', reviewed_by = $2, reviewed_at = now(),
            reject_reason = $3, updated_at = now()
      WHERE user_id = $1`,
    [userId, by, reason],
  );
}

export async function pendingLinkCount(): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM razed_links WHERE status IN ('pending','matched')`,
  );
  return Number(row?.n ?? 0);
}
