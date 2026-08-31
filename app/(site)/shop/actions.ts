'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/player';
import { redeem } from '@/lib/store/shop';

export type RedeemOutcome =
  | { ok: true; message: string; balance: number }
  | { ok: false; error: string };

/**
 * Spending coins.
 *
 * The action does almost nothing itself: it establishes who is asking and hands
 * off to `lib/store/shop.ts`, where the debit and the redemption row are one
 * transaction. Everything that could refuse — stock, cooldown, balance — is
 * checked there, against locked rows, rather than here where it would race.
 */
export async function redeemItem(itemId: number): Promise<RedeemOutcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  if (gate.user.status === 'frozen') {
    return { ok: false, error: 'This account is frozen, so the shop is closed for now.' };
  }

  const result = await redeem(gate.user.id, itemId);
  if (!result.ok) return result;

  revalidatePath('/shop');
  revalidatePath('/me');

  return {
    ok: true,
    balance: result.balance,
    message: result.needsReview
      ? `${result.redemption.itemName} redeemed. A moderator reviews it, usually within a day.`
      : `${result.redemption.itemName} redeemed and granted.`,
  };
}
