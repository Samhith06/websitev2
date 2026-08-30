import 'server-only';
import { auth } from '@/auth';
import { hasDatabase } from '@/lib/db';
import { ensureUser, type User } from '@/lib/store/accounts';

/**
 * Who is playing, as far as the server is concerned.
 *
 * Every game endpoint goes through this. Coins belong to an account, so a round
 * that cannot name the account it is spending from must not be played.
 *
 * In development, with no Discord app configured, there would otherwise be no
 * way to play at all. `DEV_PLAYER_ID` supplies a stand-in id, and like the admin
 * bypass it is impossible in production: the `NODE_ENV` check is evaluated at
 * build time, so a production bundle cannot honour it however the environment
 * is set.
 */
export async function currentPlayerId(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.discordId;
  if (id) return id;

  if (process.env.NODE_ENV !== 'production' && process.env.DEV_PLAYER_ID) {
    return `dev:${process.env.DEV_PLAYER_ID}`;
  }
  return null;
}

export type Identity = { discordId: string; discordUsername: string; avatarUrl: string | null };

export async function currentIdentity(): Promise<Identity | null> {
  const session = await auth();
  const discordId = session?.user?.discordId;
  if (discordId) {
    return {
      discordId,
      discordUsername: session.user.discordUsername ?? session.user.name ?? discordId,
      avatarUrl: session.user.image ?? null,
    };
  }

  if (process.env.NODE_ENV !== 'production' && process.env.DEV_PLAYER_ID) {
    return {
      discordId: `dev:${process.env.DEV_PLAYER_ID}`,
      discordUsername: process.env.DEV_PLAYER_NAME ?? 'dev',
      avatarUrl: null,
    };
  }
  return null;
}

/**
 * The account row for whoever is signed in, created on first sight.
 *
 * Returns null when nobody is signed in *or* when there is no database — the
 * caller has to handle both, and conflating them would let a missing
 * `DATABASE_URL` look like a sign-in problem to whoever is debugging it.
 */
export async function currentUser(): Promise<User | null> {
  if (!hasDatabase()) return null;
  const identity = await currentIdentity();
  if (!identity) return null;
  return ensureUser(identity);
}

export type PlayerRefusal = {
  ok: false;
  error: 'not-signed-in' | 'no-database';
  detail: string;
};

export const NOT_SIGNED_IN: PlayerRefusal = {
  ok: false,
  error: 'not-signed-in',
  detail: 'Sign in with Discord to play. Coins belong to an account.',
};

export const NO_DATABASE: PlayerRefusal = {
  ok: false,
  error: 'no-database',
  detail:
    'The site has no database configured, so coins cannot be recorded. ' +
    'Set DATABASE_URL and this works immediately.',
};

/**
 * The guard every coin-spending route starts with. Distinguishes "not signed
 * in" (the player's problem, 401) from "no database" (ours, 503) because a
 * player told to sign in again when the server is misconfigured will keep
 * trying and never get anywhere.
 */
export async function requireUser(): Promise<
  { ok: true; user: User } | { ok: false; refusal: PlayerRefusal; status: 401 | 503 }
> {
  const identity = await currentIdentity();
  if (!identity) return { ok: false, refusal: NOT_SIGNED_IN, status: 401 };
  if (!hasDatabase()) return { ok: false, refusal: NO_DATABASE, status: 503 };
  return { ok: true, user: await ensureUser(identity) };
}
