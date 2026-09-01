import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { streamWentLive, streamWentOffline } from "@/lib/store/presence";

export const dynamic = "force-dynamic";

/**
 * Admin utility to manually set stream status
 * Use this for testing before Kick webhooks are configured
 *
 * POST /api/admin/stream-status
 * Body: { action: 'live' | 'offline', title?: string }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, title } = body;

    if (action === "live") {
      await streamWentLive(title || "Live on Kick");
      return NextResponse.json({
        ok: true,
        message: "Stream marked as LIVE",
        title: title || "Live on Kick",
      });
    } else if (action === "offline") {
      await streamWentOffline();
      return NextResponse.json({
        ok: true,
        message: "Stream marked as OFFLINE",
      });
    } else {
      return NextResponse.json(
        {
          error: 'Invalid action. Use "live" or "offline"',
        },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("[admin] stream-status error:", error);
    return NextResponse.json(
      {
        error: "Failed to update stream status",
      },
      { status: 500 },
    );
  }
}

/**
 * Get current stream status
 * GET /api/admin/stream-status
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentStream } = await import("@/lib/store/stream");
  const stream = await currentStream();

  return NextResponse.json({
    live: stream.live,
    title: stream.title,
    startedAt: stream.startedAt,
    channel: stream.channel,
  });
}
