import 'server-only';
import { hasDatabase, one, write } from '@/lib/db';
import type { GameSlug } from '@/lib/types';

/**
 * Operational switches, read on every request rather than cached.
 *
 * The kill switch is the reason this exists. It used to be a constant, checked
 * in the lobby and nowhere else — so flipping it hid the games while every play
 * endpoint carried on accepting bets. It is now a row, and `gamesAreKilled` is
 * checked inside the play route before anything is drawn.
 *
 * Reading on every request is deliberate. A switch you reach for in an
 * emergency must not wait out a cache.
 */

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    const row = await one<{ value: T }>('SELECT value FROM settings WHERE key = $1', [key]);
    return row ? row.value : fallback;
  } catch {
    // A switch that cannot be read must not take the games down by itself.
    return fallback;
  }
}

export async function gamesAreKilled(): Promise<boolean> {
  return readSetting<boolean>('games_killed', false);
}

export async function setGamesKilled(killed: boolean, by: string): Promise<void> {
  await write(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES ('games_killed', $1::jsonb, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_by = $2, updated_at = now()`,
    [JSON.stringify(killed), by],
  );
}

export async function disabledGames(): Promise<GameSlug[]> {
  return readSetting<GameSlug[]>('games_disabled', []);
}

export async function setGameEnabled(slug: GameSlug, enabled: boolean, by: string): Promise<void> {
  const current = await disabledGames();
  const next = enabled ? current.filter((s) => s !== slug) : [...new Set([...current, slug])];
  await write(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES ('games_disabled', $1::jsonb, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_by = $2, updated_at = now()`,
    [JSON.stringify(next), by],
  );
}

/** One call for the play route: is this game playable at all right now? */
export async function gameIsPlayable(slug: GameSlug): Promise<boolean> {
  if (await gamesAreKilled()) return false;
  return !(await disabledGames()).includes(slug);
}
