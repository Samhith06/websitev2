'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/player';
import { settingsFor } from '@/lib/store/profile';
import { periodWagerGate } from '@/lib/store/wager-gate';
import {
  SPLIT_STEAL_WAGER_MIN,
  SplitStealError,
  entryRefusal,
  enterEvent,
  liveEvent,
  lockChoice,
  type Choice,
} from '@/lib/store/split-steal';

export type Outcome = { ok: true; message: string } | { ok: false; error: string };

/**
 * Who may play, beyond being signed in: not frozen, and not self-excluded.
 * A cash game is exactly what a self-exclusion is meant to keep someone from.
 */
async function player(): Promise<{ ok: true; userId: number } | { ok: false; error: string }> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };
  if (gate.user.status === 'frozen') return { ok: false, error: 'This account is frozen, so you cannot play right now.' };
  const settings = await settingsFor(gate.user.id);
  if (settings.excludedUntil && new Date(settings.excludedUntil).getTime() > Date.now()) {
    return { ok: false, error: 'You are self-excluded, so games are closed to you until it ends.' };
  }
  return { ok: true, userId: gate.user.id };
}

/** Enter the open event, once the wager check passes. */
export async function enterSplitSteal(): Promise<Outcome> {
  const who = await player();
  if (!who.ok) return who;

  const event = await liveEvent();
  if (!event || event.status !== 'open') return { ok: false, error: 'Entries for Split or Steal are not open right now.' };

  const gate = await periodWagerGate(who.userId, SPLIT_STEAL_WAGER_MIN);
  if (!gate.ok) return { ok: false, error: entryRefusal(gate) };

  try {
    await enterEvent(event.id, who.userId, gate.wagered);
  } catch (error) {
    if (error instanceof SplitStealError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/split-or-steal');
  return { ok: true, message: "You're in. Pairs are drawn when entries close." };
}

/** Lock in Split or Steal. Final, and hidden until the pair is revealed. */
export async function chooseSplitSteal(choice: Choice): Promise<Outcome> {
  if (choice !== 'split' && choice !== 'steal') return { ok: false, error: 'Pick Split or Steal.' };
  const who = await player();
  if (!who.ok) return who;

  const event = await liveEvent();
  if (!event || event.status !== 'choosing') return { ok: false, error: 'Choices are not open right now.' };

  try {
    await lockChoice(event.id, who.userId, choice);
  } catch (error) {
    if (error instanceof SplitStealError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath('/split-or-steal');
  return { ok: true, message: `Locked in: ${choice === 'split' ? 'Split' : 'Steal'}.` };
}
