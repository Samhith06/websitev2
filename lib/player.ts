import 'server-only';
import { auth } from '@/auth';

/**
 * Who is playing, as far as the server is concerned.
 *
 * Every game endpoint goes through this. Coins belong to an account, so a round
 * that cannot name the account it is spending from must not be played — see
 * `requirePlayer`.
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

export type PlayerRefusal = {
  ok: false;
  error: 'not-signed-in';
  detail: string;
};

export const NOT_SIGNED_IN: PlayerRefusal = {
  ok: false,
  error: 'not-signed-in',
  detail: 'Sign in with Discord to play. Coins belong to an account.',
};
