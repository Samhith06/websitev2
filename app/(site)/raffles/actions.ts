'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/player';
import { enterRaffle } from '@/lib/store/raffles';

export type EnterOutcome =
  | { ok: true; entries: number; balance: number; message: string }
  | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  'not-open': 'This raffle is not open for entries.',
  closed: 'Entries for this raffle have closed.',
  'cap-reached': 'You already hold the maximum number of entries.',
  'insufficient-coins': 'Not enough coins for another entry.',
};

/**
 * Entering a raffle.
 *
 * As with the shop, the action only establishes who is asking. The cap, the
 * balance and the entry row are settled together inside one transaction in
 * `lib/store/raffles.ts`, against locked rows, rather than here where two quick
 * taps would race each other.
 */
export async function enter(raffleId: number): Promise<EnterOutcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  if (gate.user.status === 'frozen') {
    return { ok: false, error: 'This account is frozen, so entries are closed for now.' };
  }

  const result = await enterRaffle({ userId: gate.user.id, raffleId });
  if (!result.ok) {
    return { ok: false, error: MESSAGES[result.error] ?? 'That entry could not be placed.' };
  }

  revalidatePath('/raffles');
  revalidatePath('/profile');

  return {
    ok: true,
    entries: result.entries,
    balance: result.balance,
    message: 'Entered',
  };
}
