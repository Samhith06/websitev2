import 'server-only';
import { one } from '@/lib/db';
import type { LiveGames } from '@/lib/nav';

/**
 * Which stream games are running, for the primary nav. One small query, since
 * it runs under every page: a hunt counts until it is finished, a bingo, a
 * king of the hill or a boss raid while it is running.
 *
 * The nav is not worth a broken page, so a failed read means "nothing live".
 */
export async function liveGames(): Promise<LiveGames> {
  try {
    const row = await one<{ hunt: boolean; bingo: boolean; koth: boolean; raid: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM bonus_hunts WHERE status <> 'finished') AS hunt,
              EXISTS (SELECT 1 FROM bingo_cards WHERE status = 'running') AS bingo,
              EXISTS (SELECT 1 FROM koth_games WHERE status = 'running') AS koth,
              EXISTS (SELECT 1 FROM raid_games WHERE status = 'running') AS raid`,
    );
    return {
      hunt: row?.hunt ?? false,
      bingo: row?.bingo ?? false,
      koth: row?.koth ?? false,
      raid: row?.raid ?? false,
    };
  } catch (error) {
    console.error('[nav] could not read live stream games', error);
    return { hunt: false, bingo: false, koth: false, raid: false };
  }
}

/*
 * The games chat joins with `!sr`. Only one of them may run at a time — chat
 * cannot say which one it meant — so each refuses to start while another is
 * running. (The bonus hunt also takes !sr, but only when none of these is
 * running, so it can run alongside them.)
 */
const SR_GAMES = {
  bingo: { table: 'bingo_cards', name: 'slot bingo' },
  koth: { table: 'koth_games', name: 'king of the hill' },
  raid: { table: 'raid_games', name: 'boss raid' },
} as const;

export type SrGame = keyof typeof SR_GAMES;

/** A SQL condition, true when no !sr game other than `self` is running. */
export function noOtherSrGame(self: SrGame): string {
  return (Object.keys(SR_GAMES) as SrGame[])
    .filter((g) => g !== self)
    .map((g) => `NOT EXISTS (SELECT 1 FROM ${SR_GAMES[g].table} WHERE status = 'running')`)
    .join(' AND ');
}

/** Why `self` cannot start: which other !sr game is running, as a sentence. */
export async function otherSrGameMessage(self: SrGame): Promise<string> {
  for (const g of Object.keys(SR_GAMES) as SrGame[]) {
    if (g === self) continue;
    const row = await one<{ live: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM ${SR_GAMES[g].table} WHERE status = 'running') AS live`,
    );
    if (row?.live) {
      const name = SR_GAMES[g].name;
      return `A ${name} is running and takes !sr. End it first.`;
    }
  }
  return 'Another stream game is running and takes !sr. End it first.';
}
