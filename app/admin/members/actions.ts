'use server';

import { revalidatePath } from 'next/cache';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { hasDatabase, write } from '@/lib/db';
import { InsufficientCoins, record } from '@/lib/store/coins';
import { freezeUser, unfreezeUser } from '@/lib/store/accounts';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * A moderator's adjustment is capped; an owner's is not. The cap is enforced
 * here rather than in the form, because the form is a suggestion and this is
 * the rule.
 */
const MOD_LIMIT = 500;

async function guard() {
  const identity = await currentIdentity();
  const role = roleFor(identity?.discordId);
  if (!identity || !role) return { ok: false as const, error: 'You are not signed in as an admin.' };
  if (!hasDatabase()) return { ok: false as const, error: 'No database is configured.' };
  return { ok: true as const, who: identity.discordUsername, role };
}

async function audit(who: string, action: string, target: string, detail?: unknown) {
  await write(
    `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, $2, $3, $4)`,
    [who, action, target, detail ? JSON.stringify(detail) : null],
  ).catch(() => console.error('[admin] could not write an audit row'));
}

/**
 * Moving coins by hand.
 *
 * The reason is mandatory and is stored on the ledger row itself, not only in
 * the audit log: six months later somebody will ask why an account got 500
 * coins, and "adjustment" is not an answer.
 */
export async function adjustCoins(formData: FormData): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const userId = Number(formData.get('userId'));
  const amount = Math.round(Number(formData.get('amount')));
  const reason = String(formData.get('reason') ?? '').trim();

  if (!Number.isInteger(userId) || userId <= 0) return { ok: false, error: 'Pick a member first.' };
  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: 'An adjustment of zero is not an adjustment.' };
  }
  if (!reason) return { ok: false, error: 'A reason is required. It is stored on the ledger row.' };
  if (gate.role === 'mod' && Math.abs(amount) > MOD_LIMIT) {
    return { ok: false, error: `Moderators can adjust up to ${MOD_LIMIT} MC. This one needs an owner.` };
  }

  try {
    const balance = await record({
      userId,
      delta: amount,
      kind: 'adjustment',
      reason: `${reason} — by ${gate.who}`,
    });
    await audit(gate.who, 'Adjusted coins', String(userId), { amount, reason });
    revalidatePath('/admin/members');
    return {
      ok: true,
      message: `${amount > 0 ? 'Added' : 'Removed'} ${Math.abs(amount)} MC. Balance is now ${balance.balance}.`,
    };
  } catch (error) {
    if (error instanceof InsufficientCoins) {
      return { ok: false, error: `That would take the balance below zero (currently ${error.balance}).` };
    }
    console.error('[admin] adjustCoins failed', error);
    return { ok: false, error: 'Could not apply that adjustment.' };
  }
}

export async function setFrozen(userId: number, frozen: boolean, reason: string): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  if (frozen) await freezeUser(userId, reason || `Frozen by ${gate.who}`, null);
  else await unfreezeUser(userId);

  await audit(gate.who, frozen ? 'Froze earning' : 'Unfroze earning', String(userId));
  revalidatePath('/admin/members');
  return { ok: true, message: frozen ? 'Earning frozen. Coins already held are untouched.' : 'Earning resumed.' };
}
