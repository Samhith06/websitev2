import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { hasDatabase, write, one } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Admin tool to manually link Kick accounts
 * Use this while Kick webhooks are being configured
 *
 * POST /api/admin/manual-link
 * Body: {
 *   discordId: string,
 *   kickUsername: string,
 *   kickUserId: string
 * }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      {
        error: "No database configured",
      },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const { discordId, kickUsername, kickUserId } = body;

    if (!discordId || !kickUsername || !kickUserId) {
      return NextResponse.json(
        {
          error: "Missing required fields: discordId, kickUsername, kickUserId",
        },
        { status: 400 },
      );
    }

    // Find user by Discord ID
    const user = await one<{ id: number; discord_username: string }>(
      `SELECT id, discord_username FROM users WHERE discord_id = $1`,
      [discordId],
    );

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found with that Discord ID",
        },
        { status: 404 },
      );
    }

    // Check if Kick account already linked (to anyone)
    const existingLink = await one<{ user_id: number }>(
      `SELECT user_id FROM kick_links WHERE kick_user_id = $1`,
      [kickUserId],
    ).catch(() => null);

    if (existingLink && existingLink.user_id !== user.id) {
      return NextResponse.json(
        {
          error: "This Kick account is already linked to another user",
        },
        { status: 409 },
      );
    }

    // Check if this user already has a different Kick link
    const userExistingLink = await one<{ kick_username: string }>(
      `SELECT kick_username FROM kick_links WHERE user_id = $1`,
      [user.id],
    ).catch(() => null);

    if (userExistingLink) {
      // Update existing link
      await write(
        `UPDATE kick_links 
         SET kick_user_id = $1, kick_username = $2, verified_at = NOW() 
         WHERE user_id = $3`,
        [kickUserId, kickUsername, user.id],
      );

      return NextResponse.json({
        ok: true,
        action: "updated",
        message: `Updated Kick link for ${user.discord_username}`,
        previousKickUsername: userExistingLink.kick_username,
        newKickUsername: kickUsername,
      });
    } else {
      // Create new link
      await write(
        `INSERT INTO kick_links (user_id, kick_user_id, kick_username, verified_at)
         VALUES ($1, $2, $3, NOW())`,
        [user.id, kickUserId, kickUsername],
      );

      return NextResponse.json({
        ok: true,
        action: "created",
        message: `Linked ${kickUsername} to ${user.discord_username}`,
        userId: user.id,
        kickUsername,
      });
    }
  } catch (error) {
    console.error("[admin] manual-link error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to link account",
      },
      { status: 500 },
    );
  }
}

/**
 * Get current Kick links
 * GET /api/admin/manual-link?discordId=xxx
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      {
        error: "No database configured",
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const discordId = searchParams.get("discordId");

  if (!discordId) {
    return NextResponse.json(
      {
        error: "Missing discordId parameter",
      },
      { status: 400 },
    );
  }

  try {
    const result = await one<{
      discord_username: string;
      kick_username: string | null;
      kick_user_id: string | null;
      verified_at: Date | null;
    }>(
      `SELECT u.discord_username, k.kick_username, k.kick_user_id, k.verified_at
       FROM users u
       LEFT JOIN kick_links k ON k.user_id = u.id
       WHERE u.discord_id = $1`,
      [discordId],
    ).catch(() => null);

    if (!result) {
      return NextResponse.json(
        {
          error: "User not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      discordUsername: result.discord_username,
      kickUsername: result.kick_username,
      kickUserId: result.kick_user_id,
      verifiedAt: result.verified_at,
      isLinked: Boolean(result.kick_username),
    });
  } catch (error) {
    console.error("[admin] manual-link GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch link info",
      },
      { status: 500 },
    );
  }
}
