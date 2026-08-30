import 'server-only';
import { hasDatabase, one } from '@/lib/db';
import { channel, offlineStream } from '@/lib/mock';
import type { StreamState } from '@/lib/types';

/**
 * Whether Matty is actually live.
 *
 * This used to be a constant. The hero said "LIVE ON KICK · 1,284 viewers ·
 * uptime 01:40:54" while the Kick player embedded next to it said the channel
 * was offline — the site contradicting itself on the one fact a visitor can
 * check in a single glance.
 *
 * The truth now comes from `stream_sessions`, which the
 * `livestream.status.updated` webhook opens and closes. Two consequences worth
 * being deliberate about:
 *
 *   • **Until that webhook is configured, the site says offline.** That is the
 *     honest default: we have not been told a stream started, so we do not
 *     claim one has.
 *   • **The viewer count is unknown, not zero.** Kick's per-user API cannot
 *     tell us who is watching and the aggregate count needs a separate call we
 *     do not make, so the count is omitted rather than guessed. An invented
 *     "1,284 watching" is worse than no number at all.
 */
export async function currentStream(): Promise<StreamState> {
  if (!hasDatabase()) return offlineStream;

  const session = await one<{ started_at: Date; title: string | null }>(
    `SELECT started_at, title FROM stream_sessions WHERE ended_at IS NULL LIMIT 1`,
  ).catch(() => null);

  if (!session) return offlineStream;

  return {
    ...offlineStream,
    live: true,
    startedAt: session.started_at.toISOString(),
    title: session.title,
    // Deliberately absent: see above.
    viewers: null,
    channel,
  };
}
