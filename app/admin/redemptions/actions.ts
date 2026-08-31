'use server';

import { revalidatePath } from 'next/cache';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { hasDatabase, write } from '@/lib/db';
import { resolveRedemption } from '@/lib/store/shop';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Approving and rejecting.
 *
 * Rejecting refunds the coins and restores the stock inside the same
 * transaction that changes the status — the shop tells members exactly that,
 * so it cannot be a second step that might not run.
 */
async function guard() {
  const identity = await currentIdentity();
  const role = roleFor(identity?.discordId);
  if (!identity || !role) return { ok: false as const, error: 'You are not signed in as an admin.' };
  if (!hasDatabase()) return { ok: false as const, error: 'No database is configured.' };
  return { ok: true as const, who: identity.discordUsername };
}

export async function decideRedemption(
  id: number,
  status: 'approved' | 'fulfilled' | 'rejected',
  reason?: string,
): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const result = await resolveRedemption({ id, status, handledBy: gate.who, reason });
  if (!result.ok) return { ok: false, error: result.error };

  await write(
    `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, $2, $3, $4)`,
    [gate.who, `Redemption ${status}`, String(id), reason ? JSON.stringify({ reason }) : null],
  ).catch(() => console.error('[admin] could not write an audit row'));

  revalidatePath('/admin/redemptions');
  revalidatePath('/admin');
  revalidatePath('/me');

  return {
    ok: true,
    message:
      status === 'rejected'
        ? 'Rejected. The coins have been refunded and the member sees the reason.'
        : `Marked ${status}.`,
  };
}
