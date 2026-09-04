import 'server-only';
import { one, write } from '@/lib/db';

/**
 * Per-account settings.
 *
 * The one that matters is `excludedUntil`. A self-exclusion toggle the server
 * does not honour is not a self-exclusion feature, so every play endpoint
 * checks this row and refuses outright — the UI hiding the games is a courtesy
 * on top, not the mechanism.
 */

export type Settings = {
  gamesEnabled: boolean;
  gameSound: boolean;
  publicProfile: boolean;
  streamNotifications: boolean;
  excludedUntil: string | null;
};

export const DEFAULTS: Settings = {
  // Games are opt-in and hidden until switched on, by design.
  gamesEnabled: false,
  gameSound: true,
  publicProfile: true,
  streamNotifications: true,
  excludedUntil: null,
};

export async function settingsFor(userId: number): Promise<Settings> {
  const row = await one<{
    games_enabled: boolean;
    game_sound: boolean;
    public_profile: boolean;
    stream_notifications: boolean;
    excluded_until: Date | null;
  }>(
    `SELECT games_enabled, game_sound, public_profile, stream_notifications, excluded_until
       FROM user_settings WHERE user_id = $1`,
    [userId],
  );
  if (!row) return DEFAULTS;
  return {
    gamesEnabled: row.games_enabled,
    gameSound: row.game_sound,
    publicProfile: row.public_profile,
    streamNotifications: row.stream_notifications,
    excludedUntil: row.excluded_until?.toISOString() ?? null,
  };
}

/** Whether games are actually available to this account right now. */
export function gamesAvailable(settings: Settings): boolean {
  if (!settings.gamesEnabled) return false;
  if (!settings.excludedUntil) return true;
  return new Date(settings.excludedUntil).getTime() <= Date.now();
}

export async function updateSettings(
  userId: number,
  patch: Partial<Omit<Settings, 'excludedUntil'>>,
): Promise<void> {
  await write(
    `INSERT INTO user_settings
       (user_id, games_enabled, game_sound, public_profile, stream_notifications)
     VALUES ($1,
             COALESCE($2, false), COALESCE($3, true),
             COALESCE($4, true),  COALESCE($5, true))
     ON CONFLICT (user_id) DO UPDATE SET
       games_enabled       = COALESCE($2, user_settings.games_enabled),
       game_sound          = COALESCE($3, user_settings.game_sound),
       public_profile      = COALESCE($4, user_settings.public_profile),
       stream_notifications = COALESCE($5, user_settings.stream_notifications),
       updated_at = now()`,
    [
      userId,
      patch.gamesEnabled ?? null,
      patch.gameSound ?? null,
      patch.publicProfile ?? null,
      patch.streamNotifications ?? null,
    ],
  );
}

/**
 * Self-exclude until a date.
 *
 * Only ever extends. Someone who excluded themselves for a month and comes
 * back on day three to shorten it is exactly the person the feature exists
 * for, so the greatest of the two dates wins and lifting it early is a
 * conversation with a mod rather than a button.
 */
export async function selfExclude(userId: number, until: Date): Promise<void> {
  await write(
    `INSERT INTO user_settings (user_id, games_enabled, excluded_until)
     VALUES ($1, false, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       games_enabled  = false,
       excluded_until = GREATEST(COALESCE(user_settings.excluded_until, $2), $2),
       updated_at = now()`,
    [userId, until.toISOString()],
  );
}

export async function setPokerHandle(userId: number, handle: string): Promise<void> {
  const clean = handle.trim();
  if (!clean) {
    await write('DELETE FROM poker_links WHERE user_id = $1', [userId]);
    return;
  }
  await write(
    `INSERT INTO poker_links (user_id, handle) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET handle = EXCLUDED.handle, updated_at = now()`,
    [userId, clean],
  );
}

export async function pokerHandleFor(userId: number): Promise<string | null> {
  const row = await one<{ handle: string }>(
    'SELECT handle FROM poker_links WHERE user_id = $1',
    [userId],
  );
  return row?.handle ?? null;
}
