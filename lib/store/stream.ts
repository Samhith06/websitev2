import "server-only";
import { hasDatabase, one } from "@/lib/db";
import { channel, offlineStream } from "@/lib/mock";
import { fetchKickLiveStatus, fetchLastVOD } from "@/lib/kick-api";
import type { StreamState } from "@/lib/types";

/**
 * Whether Matty is actually live - now with AUTOMATIC detection!
 *
 * This function tries multiple sources in priority order:
 * 1. Database webhook session (most reliable, if configured)
 * 2. Direct Kick API check (automatic fallback)
 * 3. Offline state (default)
 *
 * This means the site will automatically show live status even without
 * webhooks configured, by directly querying Kick's public API.
 */
export async function currentStream(): Promise<StreamState> {
  /**
   * An open session used to be trusted on its own, which made the site claim
   * LIVE forever: the row is only closed by a `livestream.status.updated`
   * webhook, and until those are subscribed nothing ever closes it. The stage
   * then showed a LIVE badge over a player saying the channel was offline.
   *
   * Kick's public channel endpoint is the authority, so it is always asked. The
   * session row is a cache and a record of when the stream began, not the
   * answer.
   */
  const session = hasDatabase()
    ? await one<{ id: number; started_at: Date; title: string | null }>(
        `SELECT id, started_at, title FROM stream_sessions WHERE ended_at IS NULL LIMIT 1`,
      ).catch(() => null)
    : null;

  const kickStatus = await fetchKickLiveStatus();

  /*
   * A failed check is not an offline channel. If Kick cannot be reached we keep
   * showing whatever the session says, because ending a live stream over a
   * network blip is worse than being a few minutes stale.
   */
  const reallyLive = kickStatus.checked ? kickStatus.isLive : Boolean(session);

  if (session && kickStatus.checked && !kickStatus.isLive) {
    await closeStreamSession(session.id);
  }

  if (reallyLive) {
    if (!session && hasDatabase()) {
      try {
        await syncLiveStatusToDatabase(kickStatus.title || "Live on Kick");
      } catch (error) {
        console.error("[stream] Failed to sync live status to database:", error);
      }
    }

    return {
      ...offlineStream,
      live: true,
      // The session knows when it actually started; Kick knows the rest.
      startedAt:
        session?.started_at.toISOString() ??
        kickStatus.startTime ??
        new Date().toISOString(),
      title: kickStatus.title ?? session?.title ?? "Live on Kick",
      viewers: kickStatus.viewers,
      thumbUrl: kickStatus.thumbnailUrl || offlineStream.thumbUrl,
      channel,
    };
  }

  // Offline: carry the last VOD so the stage has something to point at.
  const lastVod = await fetchLastVOD();

  return {
    ...offlineStream,
    lastVodUrl: lastVod?.url || offlineStream.lastVodUrl,
    lastVodTitle: lastVod?.title || offlineStream.lastVodTitle,
    lastVodThumb: lastVod?.thumbnail || offlineStream.lastVodThumb,
  };
}

/**
 * Close a session Kick says has ended.
 *
 * Coins only accrue inside an open session, so a session left open after the
 * stream ends would keep paying people for chatting into an empty channel.
 */
async function closeStreamSession(id: number): Promise<void> {
  const { write } = await import("@/lib/db");
  try {
    await write(
      `UPDATE stream_sessions SET ended_at = now() WHERE id = $1 AND ended_at IS NULL`,
      [id],
    );
    console.log("[stream] Closed a session Kick reported as offline");
  } catch (error) {
    console.error("[stream] Failed to close stale session:", error);
  }
}

/**
 * Sync the detected live status to database
 * This creates a session if one doesn't exist
 */
async function syncLiveStatusToDatabase(title: string): Promise<void> {
  const { write } = await import("@/lib/db");

  // Check if there's already an open session
  const existing = await one<{ id: number }>(
    `SELECT id FROM stream_sessions WHERE ended_at IS NULL LIMIT 1`,
  ).catch(() => null);

  if (!existing) {
    // Create new session
    await write(
      `INSERT INTO stream_sessions (started_at, title) VALUES (NOW(), $1)`,
      [title],
    );
    console.log("[stream] Auto-created session from Kick API detection");
  }
}
