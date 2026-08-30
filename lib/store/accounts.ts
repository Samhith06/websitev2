import 'server-only';
import { randomInt } from 'node:crypto';
import { one, rows, tx, write } from '@/lib/db';
import { apply } from './coins';
import type { KickLink, VerificationState } from '@/lib/types';

/**
 * Accounts, and the Kick link that gates earning (Master Plan §4).
 *
 * One person = one Discord account = one Kick account, unique in both
 * directions. Both of those uniques live on the table, not in a check here,
 * because this is exactly the constraint alt accounts are pointed at.
 */

export type User = {
  id: number;
  discordId: string;
  discordUsername: string;
  avatarUrl: string | null;
  status: 'active' | 'frozen';
  frozenReason: string | null;
  frozenUntil: string | null;
  createdAt: string;
};

type UserRow = {
  id: string;
  discord_id: string;
  discord_username: string;
  avatar_url: string | null;
  status: string;
  frozen_reason: string | null;
  frozen_until: Date | null;
  created_at: Date;
};

function toUser(row: UserRow): User {
  return {
    id: Number(row.id),
    discordId: row.discord_id,
    discordUsername: row.discord_username,
    avatarUrl: row.avatar_url,
    status: row.status === 'frozen' ? 'frozen' : 'active',
    frozenReason: row.frozen_reason,
    frozenUntil: row.frozen_until ? row.frozen_until.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

const USER_COLUMNS =
  'id::text, discord_id, discord_username, avatar_url, status, frozen_reason, frozen_until, created_at';

/**
 * The account row, created on first sight and refreshed on every visit.
 *
 * Keyed on the numeric Discord id, never the username. Usernames change; a
 * balance attached to one would follow the wrong person the day it did.
 */
export async function ensureUser(input: {
  discordId: string;
  discordUsername: string;
  avatarUrl?: string | null;
}): Promise<User> {
  // `xmax = 0` is true only when this statement inserted the row, so a brand
  // new account can be recognised without a second query on every request.
  const found = await write<UserRow & { inserted: boolean }>(
    `INSERT INTO users (discord_id, discord_username, avatar_url)
     VALUES ($1, $2, $3)
     ON CONFLICT (discord_id) DO UPDATE
       SET discord_username = EXCLUDED.discord_username,
           avatar_url       = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
           last_seen_at     = now()
     RETURNING ${USER_COLUMNS}, (xmax = 0) AS inserted`,
    [input.discordId, input.discordUsername, input.avatarUrl ?? null],
  );

  const user = toUser(found[0]);
  if (found[0].inserted) await grantWelcomeCoins(user.id);
  return user;
}

/**
 * Optional starting balance, from `WELCOME_COINS`.
 *
 * Off unless set, and deliberately so: every coin it mints is a coin nobody
 * watched for, and the economy in §3 is balanced around watching. It exists
 * because a brand-new account otherwise has nothing to play with until a
 * stream runs, which makes the games impossible to try or to test.
 */
async function grantWelcomeCoins(userId: number): Promise<void> {
  const amount = Number(process.env.WELCOME_COINS ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return;
  await tx((client) =>
    apply(client, {
      userId,
      delta: Math.round(amount),
      kind: 'adjustment',
      reason: 'Welcome coins',
    }),
  ).catch((error) => {
    // A missing welcome grant must never stop somebody signing in.
    console.error('[accounts] welcome coins failed', error);
  });
}

export async function userByDiscordId(discordId: string): Promise<User | null> {
  const row = await one<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE discord_id = $1`,
    [discordId],
  );
  return row ? toUser(row) : null;
}

export async function userCount(): Promise<number> {
  const row = await one<{ n: string }>('SELECT count(*)::text AS n FROM users');
  return Number(row?.n ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Kick links                                                                 */
/* -------------------------------------------------------------------------- */

type LinkRow = { kick_user_id: string; kick_username: string; verified_at: Date };

function toLink(row: LinkRow): KickLink {
  return {
    kickUserId: Number(row.kick_user_id),
    kickUsername: row.kick_username,
    verifiedAt: row.verified_at.toISOString(),
  };
}

export async function kickLinkFor(userId: number): Promise<KickLink | null> {
  const row = await one<LinkRow>(
    'SELECT kick_user_id, kick_username, verified_at FROM kick_links WHERE user_id = $1',
    [userId],
  );
  return row ? toLink(row) : null;
}

export async function userIdByKickId(kickUserId: string): Promise<number | null> {
  const row = await one<{ user_id: string }>(
    'SELECT user_id::text FROM kick_links WHERE kick_user_id = $1',
    [kickUserId],
  );
  return row ? Number(row.user_id) : null;
}

/* -------------------------------------------------------------------------- */
/* Verification codes                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Six characters, ambiguous ones removed, from `randomInt` rather than
 * `Math.random` — a guessable code is a way to claim somebody else's account.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_TTL_MINUTES = 10;

function newCode(): string {
  let body = '';
  for (let i = 0; i < 4; i += 1) body += ALPHABET[randomInt(ALPHABET.length)];
  return `MS-${body}`;
}

export type IssuedCode = { code: string; expiresAt: string };

/**
 * Issues a code, replacing any the user has outstanding. Single use, ten
 * minutes, so one cannot be passed around after the fact.
 */
export async function issueVerificationCode(userId: number): Promise<IssuedCode> {
  return tx(async (client) => {
    await client.query(
      `UPDATE verification_codes
          SET consumed_at = now()
        WHERE user_id = $1 AND consumed_at IS NULL`,
      [userId],
    );

    // Retry on the (vanishingly unlikely) collision rather than handing back a
    // code that belongs to somebody else.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = newCode();
      const inserted = await client.query<{ code: string; expires_at: Date }>(
        `INSERT INTO verification_codes (code, user_id, expires_at)
         VALUES ($1, $2, now() + ($3 || ' minutes')::interval)
         ON CONFLICT (code) DO NOTHING
         RETURNING code, expires_at`,
        [code, userId, String(CODE_TTL_MINUTES)],
      );
      if (inserted.rows[0]) {
        return {
          code: inserted.rows[0].code,
          expiresAt: inserted.rows[0].expires_at.toISOString(),
        };
      }
    }
    throw new Error('Could not allocate a verification code.');
  });
}

/**
 * What the profile card renders. Four states, and "expired" is deliberately not
 * an error — it greys out and offers a new one.
 */
export async function verificationStateFor(userId: number): Promise<VerificationState> {
  const link = await kickLinkFor(userId);
  if (link) return { status: 'linked', link };

  const pending = await one<{ code: string; expires_at: Date }>(
    `SELECT code, expires_at
       FROM verification_codes
      WHERE user_id = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  if (!pending) return { status: 'unlinked' };

  if (pending.expires_at.getTime() <= Date.now()) {
    return { status: 'expired', code: pending.code };
  }
  return {
    status: 'waiting',
    code: pending.code,
    expiresAt: pending.expires_at.toISOString(),
  };
}

export type RedeemOutcome =
  | { ok: true; userId: number; kickUsername: string }
  | { ok: false; reason: 'no-code' | 'expired' | 'kick-taken' | 'already-linked' };

/**
 * Consumes a code seen in Kick chat and writes the link.
 *
 * Both uniques are enforced by the database, and both failures are reported
 * rather than swallowed: "that Kick account is already on another profile" is
 * something the person in chat needs to be told, not a silent no-op.
 */
export async function redeemVerificationCode(input: {
  code: string;
  kickUserId: string;
  kickUsername: string;
}): Promise<RedeemOutcome> {
  return tx(async (client) => {
    const { rows: found } = await client.query<{ user_id: string; expires_at: Date }>(
      `SELECT user_id::text, expires_at
         FROM verification_codes
        WHERE code = $1 AND consumed_at IS NULL
        FOR UPDATE`,
      [input.code.toUpperCase()],
    );
    const pending = found[0];
    if (!pending) return { ok: false, reason: 'no-code' } as const;

    if (pending.expires_at.getTime() <= Date.now()) {
      return { ok: false, reason: 'expired' } as const;
    }

    const userId = Number(pending.user_id);

    const { rows: mine } = await client.query(
      'SELECT 1 FROM kick_links WHERE user_id = $1',
      [userId],
    );
    if (mine.length) return { ok: false, reason: 'already-linked' } as const;

    const { rows: taken } = await client.query(
      'SELECT 1 FROM kick_links WHERE kick_user_id = $1',
      [input.kickUserId],
    );
    if (taken.length) return { ok: false, reason: 'kick-taken' } as const;

    await client.query(
      `INSERT INTO kick_links (user_id, kick_user_id, kick_username)
       VALUES ($1, $2, $3)`,
      [userId, input.kickUserId, input.kickUsername],
    );
    await client.query(
      'UPDATE verification_codes SET consumed_at = now() WHERE code = $1',
      [input.code.toUpperCase()],
    );

    return { ok: true, userId, kickUsername: input.kickUsername } as const;
  });
}

/** Usernames change; ids do not. Refreshed from every webhook that carries one. */
export async function refreshKickUsername(kickUserId: string, kickUsername: string): Promise<void> {
  await write(
    `UPDATE kick_links
        SET kick_username = $2
      WHERE kick_user_id = $1 AND kick_username IS DISTINCT FROM $2`,
    [kickUserId, kickUsername],
  );
}

/* -------------------------------------------------------------------------- */
/* Sub and VIP state                                                          */
/* -------------------------------------------------------------------------- */

export type SubState = { subActiveUntil: string | null; isVip: boolean };

export async function subStateFor(userId: number): Promise<SubState> {
  const row = await one<{ sub_active_until: Date | null; is_vip: boolean }>(
    'SELECT sub_active_until, is_vip FROM sub_state WHERE user_id = $1',
    [userId],
  );
  return {
    subActiveUntil: row?.sub_active_until ? row.sub_active_until.toISOString() : null,
    isVip: row?.is_vip ?? false,
  };
}

export async function setSubState(input: {
  userId: number;
  subActiveUntil?: Date | null;
  isVip?: boolean;
  source: 'badge' | 'webhook';
}): Promise<void> {
  await write(
    `INSERT INTO sub_state (user_id, sub_active_until, is_vip, source, updated_at)
     VALUES ($1, $2, COALESCE($3, false), $4, now())
     ON CONFLICT (user_id) DO UPDATE
       SET sub_active_until = COALESCE(EXCLUDED.sub_active_until, sub_state.sub_active_until),
           is_vip           = COALESCE($3, sub_state.is_vip),
           source           = EXCLUDED.source,
           updated_at       = now()`,
    [input.userId, input.subActiveUntil ?? null, input.isVip ?? null, input.source],
  );
}

/**
 * The earning multiplier (§3). Multipliers never stack: the highest single one
 * applies, so a VIP who also subs earns 2.5×, not 5×.
 */
export function multiplierFor(sub: SubState): { label: string; value: number } {
  if (sub.isVip) return { label: 'VIP', value: 2.5 };
  const active = sub.subActiveUntil && new Date(sub.subActiveUntil).getTime() > Date.now();
  if (active) return { label: 'Sub', value: 2 };
  return { label: 'Member', value: 1 };
}

/* -------------------------------------------------------------------------- */
/* Freezing                                                                   */
/* -------------------------------------------------------------------------- */

/** A chat ban freezes accrual for its duration (§5). Coins already held stay. */
export async function freezeUser(userId: number, reason: string, until: Date | null): Promise<void> {
  await write(
    `UPDATE users SET status = 'frozen', frozen_reason = $2, frozen_until = $3 WHERE id = $1`,
    [userId, reason, until],
  );
}

export async function unfreezeUser(userId: number): Promise<void> {
  await write(
    `UPDATE users SET status = 'active', frozen_reason = NULL, frozen_until = NULL WHERE id = $1`,
    [userId],
  );
}

/** Admin's member list, newest first. */
export async function recentUsers(
  limit = 50,
): Promise<Array<User & { kick: KickLink | null; balance: number; lifetimeEarned: number }>> {
  const found = await rows<UserRow & {
    kick_user_id: string | null;
    kick_username: string | null;
    verified_at: Date | null;
    balance: number | null;
    lifetime_earned: number | null;
  }>(
    `SELECT u.id::text, u.discord_id, u.discord_username, u.avatar_url, u.status,
            u.frozen_reason, u.frozen_until, u.created_at,
            k.kick_user_id, k.kick_username, k.verified_at,
            b.balance, b.lifetime_earned
       FROM users u
       LEFT JOIN kick_links    k ON k.user_id = u.id
       LEFT JOIN coin_balances b ON b.user_id = u.id
      ORDER BY u.last_seen_at DESC
      LIMIT $1`,
    [limit],
  );

  return found.map((row) => ({
    ...toUser(row),
    kick: row.kick_user_id && row.kick_username && row.verified_at
      ? toLink({ kick_user_id: row.kick_user_id, kick_username: row.kick_username, verified_at: row.verified_at })
      : null,
    balance: row.balance ?? 0,
    lifetimeEarned: row.lifetime_earned ?? 0,
  }));
}
