import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { hasDatabase, write, one } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Manual Kick verification tool for admin
 * Use this while Kick webhooks are being configured
 *
 * POST /api/admin/manual-verify
 * Body: { discordId: string, kickUserId: string, kickUsername: string }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const { discordId, kickUserId, kickUsername } = await request.json();

    if (!discordId || !kickUserId || !kickUsername) {
      return NextResponse.json(
        {
          error: "Missing required fields: discordId, kickUserId, kickUsername",
        },
        { status: 400 },
      );
    }

    // Get user ID from Discord ID
    const user = await one<{ id: number; discord_username: string }>(
      `SELECT id, discord_username FROM users WHERE discord_id = $1`,
      [discordId],
    );

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found. They need to sign in with Discord first.",
        },
        { status: 404 },
      );
    }

    // Link Kick account
    await write(
      `INSERT INTO kick_links (user_id, kick_user_id, kick_username, verified_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         kick_user_id = $2,
         kick_username = $3,
         verified_at = NOW()`,
      [user.id, kickUserId, kickUsername],
    );

    // Log this manual verification
    await write(
      `INSERT INTO audit_log (admin_name, action, target, details)
       VALUES ($1, 'MANUAL_VERIFY', $2, $3)`,
      [
        session.user.name || "Admin",
        user.discord_username,
        `Manually linked Kick: ${kickUsername} (${kickUserId})`,
      ],
    ).catch(() => {}); // Audit log is optional

    return NextResponse.json({
      ok: true,
      message: `Successfully linked ${kickUsername} to ${user.discord_username}`,
      userId: user.id,
    });
  } catch (error) {
    console.error("[admin] manual-verify error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Get list of unverified users
 * GET /api/admin/manual-verify
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.discordId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "true";

    const query = showAll
      ? `SELECT u.id, u.discord_id, u.discord_username, u.created_at,
                kl.kick_username, kl.verified_at
         FROM users u
         LEFT JOIN kick_links kl ON kl.user_id = u.id
         ORDER BY u.created_at DESC
         LIMIT 50`
      : `SELECT u.id, u.discord_id, u.discord_username, u.created_at
         FROM users u
         LEFT JOIN kick_links kl ON kl.user_id = u.id
         WHERE kl.user_id IS NULL
         ORDER BY u.created_at DESC
         LIMIT 20`;

    const users = await write<{
      id: number;
      discord_id: string;
      discord_username: string;
      created_at: Date;
      kick_username?: string;
      verified_at?: Date;
    }>(query, []);

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        discordId: u.discord_id,
        discordUsername: u.discord_username,
        createdAt: u.created_at.toISOString(),
        kickUsername: u.kick_username || null,
        verifiedAt: u.verified_at?.toISOString() || null,
        isVerified: !!u.kick_username,
      })),
    });
  } catch (error) {
    console.error("[admin] manual-verify GET error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
