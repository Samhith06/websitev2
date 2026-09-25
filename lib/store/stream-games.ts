import 'server-only';
import { one } from '@/lib/db';
import type { LiveGames } from '@/lib/nav';

/**
 * Which stream games are running, for the primary nav. One small query, since
 * it runs under every page: a hunt counts until it is finished, a bingo while
 * it is running.
 *
 * The nav is not worth a broken page, so a failed read means "nothing live".
 */
export async function liveGames(): Promise<LiveGames> {
  try {
    const row = await one<{ hunt: boolean; bingo: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM bonus_hunts WHERE status <> 'finished') AS hunt,
              EXISTS (SELECT 1 FROM bingo_cards WHERE status = 'running') AS bingo`,
    );
    return { hunt: row?.hunt ?? false, bingo: row?.bingo ?? false };
  } catch (error) {
    console.error('[nav] could not read live stream games', error);
    return { hunt: false, bingo: false };
  }
}
