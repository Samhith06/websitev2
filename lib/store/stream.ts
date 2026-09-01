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
  // Try database first (webhook-based)
  if (hasDatabase()) {
    const session = await one<{ started_at: Date; title: string | null }>(
      `SELECT started_at, title FROM stream_sessions WHERE ended_at IS NULL LIMIT 1`,
    ).catch(() => null);

    if (session) {
      return {
        ...offlineStream,
        live: true,
        startedAt: session.started_at.toISOString(),
        title: session.title,
        viewers: null,
        channel,
      };
    }
  }

  // Fallback to direct Kick API check (automatic!)
  const kickStatus = await fetchKickLiveStatus();

  if (kickStatus.isLive) {
    // Optionally sync to database if we have one
    if (hasDatabase()) {
      try {
        await syncLiveStatusToDatabase(kickStatus.title || "Live on Kick");
      } catch (error) {
        console.error(
          "[stream] Failed to sync live status to database:",
          error,
        );
      }
    }

    return {
      ...offlineStream,
      live: true,
      startedAt: kickStatus.startTime || new Date().toISOString(),
      title: kickStatus.title || "Live on Kick",
      viewers: kickStatus.viewers,
      thumbUrl: kickStatus.thumbnailUrl || offlineStream.thumbUrl,
      channel,
    };
  }

  // Get last VOD for offline state
  const lastVod = await fetchLastVOD();

  return {
    ...offlineStream,
    lastVodUrl: lastVod?.url || offlineStream.lastVodUrl,
    lastVodTitle: lastVod?.title || offlineStream.lastVodTitle,
    lastVodThumb: lastVod?.thumbnail || offlineStream.lastVodThumb,
  };
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
