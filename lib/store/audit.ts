import 'server-only';
import { rows, write } from '@/lib/db';

/**
 * The audit log.
 *
 * Append-only, and non-negotiable once real money is being approved: every mod
 * and admin action lands here with who did it and what it touched, so a bad
 * call is traceable rather than deniable. Nothing in this module deletes or
 * updates a row, and nothing should ever be added that does.
 */

export type AuditEntry = {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

export async function record(input: {
  actor: string;
  actorDiscordId?: string | null;
  action: string;
  target?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await write(
    `INSERT INTO audit_log (admin_name, admin_discord_id, action, target, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.actor,
      input.actorDiscordId ?? null,
      input.action,
      input.target ?? '',
      input.detail ? JSON.stringify(input.detail) : null,
    ],
  );
}

export async function recent(limit = 200): Promise<AuditEntry[]> {
  const result = await rows<{
    id: string;
    admin_name: string;
    action: string;
    target: string;
    detail: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `SELECT id::text, admin_name, action, target, detail, created_at
       FROM audit_log
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return result.map((r) => ({
    id: Number(r.id),
    actor: r.admin_name,
    action: r.action,
    target: r.target,
    detail: r.detail,
    createdAt: r.created_at.toISOString(),
  }));
}
