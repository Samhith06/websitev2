import 'server-only';
import { rows, write } from '@/lib/db';
import { TICK_MINUTES } from './presence';
import { LIFETIME_PERIOD } from './razed-snapshots';

/**
 * The badge evaluator.
 *
 * `badges.criteria` has been data since the table was created, with the
 * comment saying it is "evaluated by a job". This is that job. Until it existed
 * the column was written at seed time and read by nothing, so every badge on
 * the site showed 0 of 14 for everybody however much they had watched or
 * wagered, and the only way to hold one was a mod granting it by hand.
 *
 * Two rules shape everything below.
 *
 * **Set-based, never per-user.** Each rule answers "who qualifies" in one
 * query and the awards go in as one insert. The obvious shape — loop the
 * members, ask twelve questions each — is fourteen thousand queries at a
 * thousand members, which is the kind of job that gets switched off.
 *
 * **It awards; it never revokes.** A badge that came and went with a restated
 * Razed figure or a lapsed sub would be worse than no badge at all, and the
 * profile shelf is something people pin and talk about. Taking one back stays a
 * deliberate act by a mod through `revokeBadge`, where it is written to the
 * audit log with a name against it.
 */

/* -------------------------------------------------------------------------- */
/* Criteria                                                                   */
/* -------------------------------------------------------------------------- */

export type Criteria =
  | { kind: 'manual' }
  | { kind: 'kick_linked' }
  | { kind: 'kick_sub' }
  | { kind: 'raffle_won' }
  | { kind: 'lifetime_wager'; threshold: number }
  | { kind: 'period_wager'; threshold: number; days: number }
  | { kind: 'hours_watched'; threshold: number }
  | { kind: 'streams_attended'; threshold: number }
  | { kind: 'day_streak'; threshold: number }
  | { kind: 'redemptions'; threshold: number }
  | { kind: 'leaderboard_rank'; rank: number };

/**
 * Why a rule produced no awards. "Nobody qualifies yet" and "we could not ask"
 * are different answers, and a sweep that reported them the same way would let
 * a broken Razed feed look like an empty leaderboard for weeks.
 */
export type RuleOutcome =
  | { status: 'evaluated'; qualified: number; awarded: number }
  | { status: 'manual' }
  | { status: 'no-data'; detail: string }
  | { status: 'unknown-kind'; detail: string };

export type RuleReport = RuleOutcome & { slug: string; name: string };

export type SweepReport = {
  awarded: number;
  rules: RuleReport[];
  ranAt: string;
};

/* -------------------------------------------------------------------------- */
/* The rules                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every rule returns user ids and nothing else, so they compose: the caller
 * awards, counts and reports identically whichever one ran.
 *
 * `scope` is the optional id list a single-member re-check passes in. Left
 * null the rule runs across everybody, which is what the sweep wants — the
 * `$1 IS NULL OR ...` shape keeps one query for both rather than two that can
 * drift apart.
 */
type Rule = (criteria: Criteria, scope: number[] | null) => Promise<number[]>;

async function ids(sql: string, params: unknown[]): Promise<number[]> {
  const found = await rows<{ id: string }>(sql, params);
  return found.map((r) => Number(r.id));
}

/** Everyone with a verified Kick link. */
const kickLinked: Rule = (_c, scope) =>
  ids(
    `SELECT u.id::text
       FROM users u
       JOIN kick_links k ON k.user_id = u.id
      WHERE ($1::bigint[] IS NULL OR u.id = ANY($1::bigint[]))`,
    [scope],
  );

/** An active Kick sub. VIP is a different thing and does not count as one. */
const kickSub: Rule = (_c, scope) =>
  ids(
    `SELECT s.user_id::text AS id
       FROM sub_state s
      WHERE s.sub_active_until IS NOT NULL
        AND s.sub_active_until > now()
        AND ($1::bigint[] IS NULL OR s.user_id = ANY($1::bigint[]))`,
    [scope],
  );

const raffleWon: Rule = (_c, scope) =>
  ids(
    `SELECT DISTINCT r.winner_user_id::text AS id
       FROM raffles r
      WHERE r.winner_user_id IS NOT NULL
        AND ($1::bigint[] IS NULL OR r.winner_user_id = ANY($1::bigint[]))`,
    [scope],
  );

const redemptions: Rule = (criteria, scope) => {
  const threshold = 'threshold' in criteria ? criteria.threshold : 0;
  // Rejected orders are refunded, so they are not a redemption in any sense
  // the badge means — Collector is for things people actually received.
  return ids(
    `SELECT r.user_id::text AS id
       FROM redemptions r
      WHERE r.status <> 'rejected'
        AND ($2::bigint[] IS NULL OR r.user_id = ANY($2::bigint[]))
      GROUP BY r.user_id
     HAVING COUNT(*) >= $1`,
    [threshold, scope],
  );
};

/**
 * Hours watched, counted from paid ticks rather than from watch coins.
 *
 * Dividing coins by the tick rate is what the profile screens do, and it is
 * only right at a 1× multiplier: a VIP earns 2.5 coins for the same three
 * minutes and would reach a hundred hours in forty. The rows are the time.
 */
const hoursWatched: Rule = (criteria, scope) => {
  const threshold = 'threshold' in criteria ? criteria.threshold : 0;
  const ticksNeeded = Math.ceil((threshold * 60) / TICK_MINUTES);
  return ids(
    `SELECT l.user_id::text AS id
       FROM coin_ledger l
      WHERE l.kind = 'watch'
        AND ($2::bigint[] IS NULL OR l.user_id = ANY($2::bigint[]))
      GROUP BY l.user_id
     HAVING COUNT(*) >= $1`,
    [ticksNeeded, scope],
  );
};

/**
 * Streams attended, derived rather than counted.
 *
 * Nothing records which stream session paid a tick — the ledger has a
 * timestamp and `stream_sessions` has a window, and that is all. Joining one
 * against the other is the honest reconstruction: a person attended a stream
 * if they were paid for watching while it was open. It is exact for every
 * session that has ended and treats a live one as attended from the first
 * tick, which is what a viewer would say too.
 */
const streamsAttended: Rule = (criteria, scope) => {
  const threshold = 'threshold' in criteria ? criteria.threshold : 0;
  return ids(
    `SELECT l.user_id::text AS id
       FROM coin_ledger l
       JOIN stream_sessions s
         ON l.created_at >= s.started_at
        AND l.created_at <= COALESCE(s.ended_at, now())
      WHERE l.kind IN ('watch', 'bonus')
        AND ($2::bigint[] IS NULL OR l.user_id = ANY($2::bigint[]))
      GROUP BY l.user_id
     HAVING COUNT(DISTINCT s.id) >= $1`,
    [threshold, scope],
  );
};

/**
 * The longest run of consecutive days with a paid tick.
 *
 * Gaps and islands: number the distinct days a person earned on, subtract that
 * number from the day itself, and every unbroken run collapses to one constant
 * — so the runs become groups and the longest group is the streak. The badge
 * is for the best run ever achieved, not the current one, because a streak
 * that evaporates the first day somebody is ill is a punishment rather than an
 * award.
 */
const dayStreak: Rule = (criteria, scope) => {
  const threshold = 'threshold' in criteria ? criteria.threshold : 0;
  return ids(
    `WITH days AS (
       SELECT DISTINCT
              l.user_id,
              (l.created_at AT TIME ZONE 'UTC')::date AS day
         FROM coin_ledger l
        WHERE l.kind IN ('watch', 'bonus')
          AND ($2::bigint[] IS NULL OR l.user_id = ANY($2::bigint[]))
     ),
     grouped AS (
       SELECT user_id,
              day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::integer AS run
         FROM days
     )
     SELECT user_id::text AS id
       FROM grouped
      GROUP BY user_id, run
     HAVING COUNT(*) >= $1`,
    [threshold, scope],
  );
};

/**
 * Wagered under an *approved* Razed link.
 *
 * Approval is the whole gate. A link is a self-declared username with nothing
 * technical behind it, so awarding a gold badge off a pending one would hand
 * Whale to anybody willing to type somebody else's name into a form.
 */
const lifetimeWager: Rule = (criteria, scope) => {
  const threshold = 'threshold' in criteria ? criteria.threshold : 0;
  return ids(
    `SELECT rl.user_id::text AS id
       FROM razed_links rl
       JOIN razed_wagers w ON lower(w.username) = lower(rl.username)
      WHERE rl.status = 'approved'
        AND w.snapshot_id = (
          SELECT id FROM razed_snapshots WHERE period = $2
           ORDER BY fetched_at DESC LIMIT 1
        )
        AND w.wagered >= $1
        AND ($3::bigint[] IS NULL OR rl.user_id = ANY($3::bigint[]))`,
    [threshold, LIFETIME_PERIOD, scope],
  );
};

/**
 * Wagered inside a window, against the newest monthly snapshot.
 *
 * Nothing stores a rolling window. Monthly snapshots are written when a board
 * is frozen and keyed `YYYY-MM`, and that is the only period figure the
 * database holds, so a badge asking for roughly a month is answered from the
 * newest of those and anything else is reported as having no data rather than
 * quietly answered from the wrong window. Syncing a real rolling period would
 * make this exact; until then it says what it is doing.
 */
const periodWager: Rule = async (criteria, scope) => {
  if (criteria.kind !== 'period_wager') return [];
  return ids(
    `SELECT rl.user_id::text AS id
       FROM razed_links rl
       JOIN razed_wagers w ON lower(w.username) = lower(rl.username)
      WHERE rl.status = 'approved'
        AND w.snapshot_id = (
          SELECT id FROM razed_snapshots
           WHERE period ~ '^[0-9]{4}-[0-9]{2}$'
           ORDER BY period DESC, fetched_at DESC LIMIT 1
        )
        AND w.wagered >= $1
        AND ($2::bigint[] IS NULL OR rl.user_id = ANY($2::bigint[]))`,
    [criteria.threshold, scope],
  );
};

/**
 * Finished at or above a rank on a frozen board.
 *
 * Read from `frozen_standings`, never from a live Razed query. The frozen
 * standings are what the board actually said when it locked and what winners
 * were paid against; re-asking Razed today can come back restated, and a badge
 * that appeared and vanished with it would be indefensible.
 */
const leaderboardRank: Rule = async (criteria, scope) => {
  if (criteria.kind !== 'leaderboard_rank') return [];
  return ids(
    `SELECT rl.user_id::text AS id
       FROM lb_periods p
       CROSS JOIN LATERAL jsonb_array_elements(p.frozen_standings) AS standing
       JOIN razed_links rl
         ON lower(rl.username) = lower(standing->>'username')
      WHERE p.frozen_standings IS NOT NULL
        AND standing->>'username' IS NOT NULL
        AND (standing->>'rank')::integer <= $1
        AND rl.status = 'approved'
        AND ($2::bigint[] IS NULL OR rl.user_id = ANY($2::bigint[]))`,
    [criteria.rank, scope],
  );
};

const RULES: Record<string, Rule> = {
  kick_linked: kickLinked,
  kick_sub: kickSub,
  raffle_won: raffleWon,
  redemptions,
  hours_watched: hoursWatched,
  streams_attended: streamsAttended,
  day_streak: dayStreak,
  lifetime_wager: lifetimeWager,
  period_wager: periodWager,
  leaderboard_rank: leaderboardRank,
};

/* -------------------------------------------------------------------------- */
/* Preconditions                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Whether a rule has anything to read.
 *
 * A wager rule with no Razed snapshot behind it does not mean nobody has
 * wagered — it means we have never managed to ask. Returning "no data" keeps
 * that distinction on the report instead of letting a broken feed read as an
 * empty result set.
 */
async function precondition(criteria: Criteria): Promise<string | null> {
  if (criteria.kind === 'lifetime_wager') {
    const [snapshot] = await rows<{ id: string }>(
      `SELECT id::text FROM razed_snapshots WHERE period = $1 LIMIT 1`,
      [LIFETIME_PERIOD],
    );
    return snapshot ? null : 'No lifetime Razed snapshot has been synced yet.';
  }

  if (criteria.kind === 'period_wager') {
    // Snapshots are a calendar month; anything else is a window we do not hold.
    if (criteria.days < 28 || criteria.days > 31) {
      return `Asks for ${criteria.days} days, but only calendar-month snapshots are stored.`;
    }
    const [snapshot] = await rows<{ period: string }>(
      `SELECT period FROM razed_snapshots
        WHERE period ~ '^[0-9]{4}-[0-9]{2}$' ORDER BY period DESC LIMIT 1`,
    );
    return snapshot ? null : 'No monthly Razed snapshot exists — freeze a board to write one.';
  }

  if (criteria.kind === 'leaderboard_rank') {
    const [frozen] = await rows<{ id: string }>(
      `SELECT id::text FROM lb_periods WHERE frozen_standings IS NOT NULL LIMIT 1`,
    );
    return frozen ? null : 'No board has been frozen yet, so no final rank exists.';
  }

  if (criteria.kind === 'streams_attended') {
    const [session] = await rows<{ id: string }>('SELECT id::text FROM stream_sessions LIMIT 1');
    return session ? null : 'No stream session has ever been recorded.';
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* The sweep                                                                  */
/* -------------------------------------------------------------------------- */

function parseCriteria(raw: unknown): Criteria | null {
  if (!raw || typeof raw !== 'object') return null;
  const kind = (raw as { kind?: unknown }).kind;
  if (typeof kind !== 'string') return null;
  return raw as Criteria;
}

/**
 * Award a badge to a set of people at once.
 *
 * `ON CONFLICT DO NOTHING` is what makes the sweep safe to run every five
 * minutes: awarding something already held is not an error and not a second
 * row, so the count returned is genuinely "newly earned" rather than "matched
 * the rule again".
 */
async function awardMany(badgeId: number, userIds: number[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const inserted = await write<{ user_id: string }>(
    `INSERT INTO user_badges (user_id, badge_id)
     SELECT unnest($1::bigint[]), $2
     ON CONFLICT (user_id, badge_id) DO NOTHING
     RETURNING user_id::text`,
    [userIds, badgeId],
  );
  return inserted.length;
}

/**
 * Evaluate every active badge and award what has been earned.
 *
 * `userIds` narrows it to a few accounts — what the member screen's re-check
 * uses. Left out it runs across the whole membership, which is what the
 * scheduled sweep wants.
 */
export async function evaluateBadges(userIds?: number[]): Promise<SweepReport> {
  const scope = userIds && userIds.length > 0 ? userIds : null;

  const badges = await rows<{
    id: string;
    slug: string;
    name: string;
    criteria: unknown;
  }>('SELECT id::text, slug, name, criteria FROM badges WHERE active ORDER BY sort_order, id');

  const report: RuleReport[] = [];
  let awarded = 0;

  for (const badge of badges) {
    const badgeId = Number(badge.id);
    const head = { slug: badge.slug, name: badge.name };
    const criteria = parseCriteria(badge.criteria);

    if (!criteria) {
      report.push({ ...head, status: 'unknown-kind', detail: 'Criteria are not an object.' });
      continue;
    }

    // Founder and Poker Night are somebody's judgement about something that
    // happened off the site. No rule can recompute them after the fact, and
    // pretending otherwise would either award them to nobody or to everybody.
    if (criteria.kind === 'manual') {
      report.push({ ...head, status: 'manual' });
      continue;
    }

    const rule = RULES[criteria.kind];
    if (!rule) {
      report.push({ ...head, status: 'unknown-kind', detail: `No rule for "${criteria.kind}".` });
      continue;
    }

    const blocked = await precondition(criteria);
    if (blocked) {
      report.push({ ...head, status: 'no-data', detail: blocked });
      continue;
    }

    const qualified = await rule(criteria, scope);
    const newly = await awardMany(badgeId, qualified);
    awarded += newly;
    report.push({ ...head, status: 'evaluated', qualified: qualified.length, awarded: newly });
  }

  return { awarded, rules: report, ranAt: new Date().toISOString() };
}
