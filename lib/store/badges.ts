import 'server-only';
import { rows, tx, write } from '@/lib/db';

/**
 * Badges.
 *
 * Definitions are data, and their criteria are stored as JSON rather than
 * compiled in, so a new badge is an insert rather than a deploy. Awarding is
 * the job's business; this module is the read path plus the two writes the
 * admin screens need.
 */

export type Badge = {
  id: number;
  slug: string;
  name: string;
  description: string;
  gold: boolean;
  earnedAt: string | null;
  pinned: boolean;
};

/** Pinning is capped at three, which is what the profile shelf has room for. */
export const MAX_PINNED = 3;

/**
 * Every active badge, with whether this user has it.
 *
 * The locked ones are returned too, and deliberately: a badge nobody can see
 * is a badge nobody works toward, so the profile shows the whole set with the
 * unearned ones dimmed.
 */
export async function badgesFor(userId: number | null): Promise<Badge[]> {
  const result = await rows<{
    id: string;
    slug: string;
    name: string;
    description: string;
    gold: boolean;
    earned_at: Date | null;
    pinned: boolean | null;
  }>(
    `SELECT b.id::text, b.slug, b.name, b.description, b.gold,
            ub.earned_at, ub.pinned
       FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
      WHERE b.active
      ORDER BY b.sort_order ASC, b.id ASC`,
    [userId],
  );
  return result.map((r) => ({
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    description: r.description,
    gold: r.gold,
    earnedAt: r.earned_at?.toISOString() ?? null,
    pinned: r.pinned ?? false,
  }));
}

/** Just the pinned ones, for the identity card and public profile. */
export async function pinnedFor(userId: number): Promise<Badge[]> {
  const all = await badgesFor(userId);
  return all.filter((b) => b.pinned).slice(0, MAX_PINNED);
}

export type PinResult = { ok: true } | { ok: false; error: 'not-earned' | 'too-many' };

/**
 * Pin or unpin a badge.
 *
 * The cap is counted inside the transaction so two quick taps cannot both find
 * room for a fourth pin.
 */
export async function setPinned(
  userId: number,
  badgeId: number,
  pinned: boolean,
): Promise<PinResult> {
  return tx(async (client) => {
    const { rows: owned } = await client.query<{ pinned: boolean }>(
      'SELECT pinned FROM user_badges WHERE user_id = $1 AND badge_id = $2 FOR UPDATE',
      [userId, badgeId],
    );
    if (!owned[0]) return { ok: false, error: 'not-earned' } as const;

    if (pinned) {
      const { rows: count } = await client.query<{ n: string }>(
        'SELECT COUNT(*)::text AS n FROM user_badges WHERE user_id = $1 AND pinned',
        [userId],
      );
      if (!owned[0].pinned && Number(count[0].n) >= MAX_PINNED) {
        return { ok: false, error: 'too-many' } as const;
      }
    }

    await client.query(
      'UPDATE user_badges SET pinned = $3 WHERE user_id = $1 AND badge_id = $2',
      [userId, badgeId, pinned],
    );
    return { ok: true } as const;
  });
}

/** Award a badge. Idempotent — earning something twice is not a thing. */
export async function award(userId: number, slug: string): Promise<void> {
  await write(
    `INSERT INTO user_badges (user_id, badge_id)
     SELECT $1, id FROM badges WHERE slug = $2
     ON CONFLICT (user_id, badge_id) DO NOTHING`,
    [userId, slug],
  );
}

export async function revoke(userId: number, slug: string): Promise<void> {
  await write(
    `DELETE FROM user_badges
      WHERE user_id = $1 AND badge_id = (SELECT id FROM badges WHERE slug = $2)`,
    [userId, slug],
  );
}
