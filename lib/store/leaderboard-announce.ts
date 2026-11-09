import 'server-only';
import { one, write } from '@/lib/db';
import { periodLabel, money } from '@/lib/format';
import { fetchRazedLeaderboard, toBoardRows } from '@/lib/razed';
import type { LeaderboardRow } from '@/lib/types';
import { currentPeriod, prizeForRank, type StoredPeriod } from './periods';

/**
 * Leaderboard updates for a Discord channel, through a webhook.
 *
 * After each Razed sync the top places are compared with the order last
 * announced, and one message lists every climb. The first look at a board only
 * records the order, so a deploy or a new month cannot flood the channel. Once a
 * day the current standings are posted as well.
 *
 * Names are masked exactly as on the public board. With no webhook configured all
 * of this does nothing, and it never asks Razed.
 */

/** Places watched: the paid places, but at least this many. */
const MIN_TRACKED = 10;

const SITE_BOARD = 'https://mattyspins.com/leaderboard';
const ACCENT = 0x1f8bff;
const MEDALS = ['🥇', '🥈', '🥉'];

/** Real names are only ever used as keys, never written to a message. */
type Snapshot = { order: string[]; names: string[] };
type Ranked = LeaderboardRow & { key: string };

/** `Kime***` would turn bold in Discord, so its markdown is escaped. */
const md = (text: string) => text.replace(/[\\*_~`|>]/g, (c) => `\\${c}`);

function joinNames(names: string[]) {
  const bold = names.map((name) => `**${md(name)}**`);
  return bold.length <= 1
    ? bold.join('')
    : `${bold.slice(0, -1).join(', ')} and ${bold[bold.length - 1]}`;
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

const dollars = (amount: number) => money(Math.round(amount));

/** One line per player who climbed past someone, best new place first. */
export function overtakeLines(previous: Snapshot, after: Ranked[]): string[] {
  const before = previous.order;
  const oldRank = new Map(before.map((key, index) => [key, index]));
  const newRank = new Map(after.map((row, index) => [row.key, index]));
  const lines: string[] = [];

  after.forEach((row, index) => {
    const was = oldRank.get(row.key) ?? Infinity;
    if (index >= was) return;
    // Everyone who was ahead of them before and is behind them now.
    const passed = before.filter(
      (key, position) => position < was && (newRank.get(key) ?? Infinity) > index,
    );
    if (!passed.length) return;
    const names = passed.map((key) => previous.names[before.indexOf(key)] ?? 'someone');
    lines.push(
      `📈 **${md(row.maskedUsername)}** just passed ${joinNames(names)} and is now **${ordinal(row.rank)}** with ${dollars(row.wagered)} wagered.`,
    );
  });
  return lines;
}

/** Discord caps a message at 2000 characters. */
export function chunkLines(heading: string, lines: string[]): string[] {
  const chunks: string[] = [];
  let chunk = heading;
  for (const line of lines) {
    if (chunk.length + line.length + 1 > 1900) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += `${chunk ? '\n' : ''}${line}`;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

/** The standings card. `<t:…>` shows each reader their own time zone. */
export function standingsMessage(label: string, endsAt: Date, top: LeaderboardRow[], now: Date) {
  return {
    embeds: [
      {
        title: `📊 Live Leaderboard — Top ${top.length}`,
        url: SITE_BOARD,
        color: ACCENT,
        description: `**${md(label)}** · updated <t:${unix(now)}:f> · ends <t:${unix(endsAt)}:R>`,
        fields: top.map((row) => ({
          name: `${MEDALS[row.rank - 1] ?? `#${row.rank}`} ${md(row.maskedUsername)}`,
          value: `${dollars(row.wagered)}${row.prize ? `\n🏆 ${money(row.prize)}` : ''}`,
          inline: true,
        })),
        footer: { text: 'MattySpins Leaderboard' },
        timestamp: now.toISOString(),
      },
    ],
  };
}

async function post(url: string, message: string | Record<string, unknown>) {
  const body = typeof message === 'string' ? { content: message } : message;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Mentions off, so nothing in a message can ever ping anybody.
    body: JSON.stringify({ ...body, allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Discord webhook returned ${response.status}`);
}

async function readState<T>(key: string): Promise<T | null> {
  const row = await one<{ value: T }>('SELECT value FROM settings WHERE key = $1', [key]);
  return row?.value ?? null;
}

async function saveState(key: string, value: unknown) {
  await write(
    `INSERT INTO settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, 'leaderboard-announce', now())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

/** Only a real Discord webhook, so a mistyped variable cannot send data elsewhere. */
function webhookUrl(): string | null {
  const url = process.env.DISCORD_LEADERBOARD_WEBHOOK_URL?.trim();
  return url && /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\//.test(url) ? url : null;
}

function dailyHour(): number {
  const hour = Number(process.env.LEADERBOARD_DAILY_HOUR_UTC ?? 18);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 18;
}

async function announceClimbs(url: string, period: StoredPeriod, label: string, top: Ranked[]) {
  const key = `leaderboard-announce:${period.id}`;
  const before = await readState<Snapshot>(key);
  const lines = before ? overtakeLines(before, top) : [];

  if (lines.length) {
    for (const chunk of chunkLines(`🏁 **${md(label)}** leaderboard update`, lines)) {
      await post(url, chunk);
    }
  }

  // Only remembered once posted, so a failed post is retried on the next run.
  await saveState(key, {
    order: top.map((row) => row.key),
    names: top.map((row) => row.maskedUsername),
  } satisfies Snapshot);
  return lines.length;
}

async function postDaily(url: string, period: StoredPeriod, label: string, top: Ranked[], now: Date) {
  if (now.getUTCHours() < dailyHour()) return false;

  const key = `leaderboard-daily:${period.id}`;
  const day = now.toISOString().slice(0, 10);
  const last = await readState<{ day: string }>(key);
  if (last?.day === day) return false;

  const wagering = top.filter((row) => row.wagered > 0);
  if (wagering.length) await post(url, standingsMessage(label, new Date(period.endsAt), wagering, now));

  // Marked even for an empty board, so it is not asked about all evening.
  await saveState(key, { day });
  return wagering.length > 0;
}

export type AnnounceResult = { climbs: number; standings: boolean };

/** Called after each sync. Each part fails on its own, so one cannot block the other. */
export async function announceLeaderboard(now = new Date()): Promise<AnnounceResult> {
  const nothing = { climbs: 0, standings: false };
  const url = webhookUrl();
  if (!url) return nothing;

  const period = await currentPeriod('monthly');
  if (
    !period ||
    period.status !== 'open' ||
    now < new Date(period.startsAt) ||
    now >= new Date(period.endsAt)
  ) {
    return nothing;
  }

  const places = Math.max(MIN_TRACKED, ...period.tiers.map((tier) => tier.rankTo));
  const feed = await fetchRazedLeaderboard({
    from: period.startsAt.slice(0, 10),
    to: period.endsAt.slice(0, 10),
    top: places,
    revalidate: 0,
  });
  // A failed read is not an empty board, and must not look like everyone dropped out.
  if (!feed.ok) return nothing;

  const top: Ranked[] = toBoardRows(feed.rows, (rank) => prizeForRank(period.tiers, rank), {
    reveal: true,
  })
    .slice(0, places)
    .map((row) => ({ ...row, key: (row.username ?? row.maskedUsername).toLowerCase() }));

  const label = periodLabel(period.startsAt, period.endsAt);
  const [climbs, standings] = await Promise.allSettled([
    announceClimbs(url, period, label, top),
    postDaily(url, period, label, top, now),
  ]);

  for (const outcome of [climbs, standings]) {
    if (outcome.status === 'rejected') console.error('[leaderboard-announce]', outcome.reason);
  }
  return {
    climbs: climbs.status === 'fulfilled' ? climbs.value : 0,
    standings: standings.status === 'fulfilled' ? standings.value : false,
  };
}
