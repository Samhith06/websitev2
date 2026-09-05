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

/* -------------------------------------------------------------------------- */
/* Per-game bet limits                                                        */
/* -------------------------------------------------------------------------- */

export type BetLimits = { minBet: number; maxBet: number };

/**
 * Overrides, by game slug. A game with no row here uses the figures in
 * `lib/games.ts`, which stay the default rather than being copied into the
 * database on first read — that way "unset" is visible as unset, and changing
 * the shipped default still moves every game that never had an override.
 */
type LimitOverrides = Partial<Record<GameSlug, Partial<BetLimits>>>;

async function limitOverrides(): Promise<LimitOverrides> {
  return readSetting<LimitOverrides>('game_limits', {});
}

/**
 * The limits actually in force for one game.
 *
 * Read on every request like every other switch here. A maximum bet you lower
 * mid-stream because somebody is spiralling has to apply to their next round,
 * not once a cache expires.
 *
 * The stored values are clamped against the defaults rather than trusted
 * outright: this is read on the play path, and a bad row — a negative minimum,
 * a maximum below the minimum — would otherwise make a game unplayable or
 * uncapped. `sanitise` is what stops a typo in the admin form becoming an
 * exploit, and it runs here rather than only on write because rows can be
 * edited by hand.
 */
export async function limitsFor(slug: GameSlug, defaults: BetLimits): Promise<BetLimits> {
  const stored = (await limitOverrides())[slug];
  return sanitise(stored, defaults);
}

export async function allGameLimits(
  defaultsFor: (slug: GameSlug) => BetLimits,
  slugs: GameSlug[],
): Promise<Record<string, BetLimits & { overridden: boolean }>> {
  const overrides = await limitOverrides();
  const out: Record<string, BetLimits & { overridden: boolean }> = {};
  for (const slug of slugs) {
    const defaults = defaultsFor(slug);
    const stored = overrides[slug];
    out[slug] = {
      ...sanitise(stored, defaults),
      overridden: Boolean(stored && (stored.minBet != null || stored.maxBet != null)),
    };
  }
  return out;
}

function sanitise(stored: Partial<BetLimits> | undefined, defaults: BetLimits): BetLimits {
  const whole = (n: unknown): number | null =>
    typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;

  const minBet = whole(stored?.minBet) ?? defaults.minBet;
  const maxBet = whole(stored?.maxBet) ?? defaults.maxBet;

  // A maximum below the minimum makes every bet invalid, which reads to a
  // player as the game being broken. The minimum wins, because it is the
  // figure a player is told they must stake.
  return { minBet, maxBet: Math.max(minBet, maxBet) };
}

/**
 * Set or clear one game's limits. Passing null for a field restores the
 * shipped default rather than storing a copy of it.
 */
export async function setGameLimits(
  slug: GameSlug,
  limits: { minBet: number | null; maxBet: number | null },
  by: string,
): Promise<void> {
  const current = await limitOverrides();
  const next: LimitOverrides = { ...current };

  const entry: Partial<BetLimits> = {};
  if (limits.minBet != null) entry.minBet = limits.minBet;
  if (limits.maxBet != null) entry.maxBet = limits.maxBet;

  if (Object.keys(entry).length === 0) delete next[slug];
  else next[slug] = entry;

  await write(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES ('game_limits', $1::jsonb, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_by = $2, updated_at = now()`,
    [JSON.stringify(next), by],
  );
}
