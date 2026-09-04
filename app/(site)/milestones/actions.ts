'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/player';
import { claimTier } from '@/lib/store/milestones';
import { wagerStateFor } from '@/lib/store/wager';

export type ClaimOutcome = { ok: true; reward: number } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  'already-claimed': 'That tier has already been claimed.',
  'not-reached': 'You have not wagered enough for that tier yet.',
  'not-approved': 'Your Razed username needs to be approved by a mod before you can claim.',
  'unknown-tier': 'That tier no longer exists.',
};

/**
 * Claiming a milestone.
 *
 * The wager figure is measured here, server-side, and re-checked against the
 * threshold inside the transaction. The browser sends a tier id and nothing
 * else — it never sends how much it thinks it has wagered, because that is the
 * one number a client must not be trusted with.
 */
export async function claim(tierId: number): Promise<ClaimOutcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  if (gate.user.status === 'frozen') {
    return { ok: false, error: 'This account is frozen, so claims are paused.' };
  }

  const wager = await wagerStateFor(gate.user.id);
  if (wager.lifetime == null) {
    return {
      ok: false,
      error: 'We have not been able to read your wager total from Razed yet. Try again shortly.',
    };
  }

  const result = await claimTier({
    userId: gate.user.id,
    tierId,
    lifetimeWagered: wager.lifetime,
    razedApproved: wager.approved,
  });

  if (!result.ok) {
    return { ok: false, error: MESSAGES[result.error] ?? 'That claim could not be placed.' };
  }

  revalidatePath('/milestones');
  revalidatePath('/profile');

  return { ok: true, reward: result.claim.reward };
}
