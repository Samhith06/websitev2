import { NextResponse } from "next/server";
import { hasDatabase, write, one } from "@/lib/db";
import { fetchKickLiveStatus } from "@/lib/kick-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Background sync endpoint for stream status
 *
 * Call this periodically (e.g., every 30 seconds) to keep database in sync
 * with actual Kick live status. This is useful if webhooks aren't configured.
 *
 * Can be called by:
 * - A cron job (Railway Cron, GitHub Actions, etc.)
 * - A background worker
 * - Client-side polling (not recommended)
 *
 * No authentication required - this is a read-only sync operation
 */
export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json(
      {
        ok: false,
        error: "No database configured",
      },
      { status: 503 },
    );
  }

  try {
    const kickStatus = await fetchKickLiveStatus();

    // Get current database state
    const dbSession = await one<{
      id: number;
      started_at: Date;
      title: string | null;
    }>(
      `SELECT id, started_at, title FROM stream_sessions WHERE ended_at IS NULL LIMIT 1`,
    ).catch(() => null);

    const dbIsLive = Boolean(dbSession);

    // Case 1: Kick says live, DB says offline → Open session
    if (kickStatus.isLive && !dbIsLive) {
      await write(
        `INSERT INTO stream_sessions (started_at, title) VALUES (NOW(), $1)`,
        [kickStatus.title || "Live on Kick"],
      );

      return NextResponse.json({
        ok: true,
        action: "opened",
        title: kickStatus.title,
        viewers: kickStatus.viewers,
      });
    }

    // Case 2: Kick says offline, DB says live → Close session
    if (!kickStatus.isLive && dbIsLive && dbSession) {
      await write(`UPDATE stream_sessions SET ended_at = NOW() WHERE id = $1`, [
        dbSession.id,
      ]);

      return NextResponse.json({
        ok: true,
        action: "closed",
        duration: Date.now() - dbSession.started_at.getTime(),
      });
    }

    // Case 3: Both agree → No action needed
    return NextResponse.json({
      ok: true,
      action: "synced",
      isLive: kickStatus.isLive,
      viewers: kickStatus.viewers,
      title: kickStatus.title,
    });
  } catch (error) {
    console.error("[stream-sync] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Manual trigger endpoint (POST)
 * Useful for testing
 */
export async function POST() {
  return GET();
}
