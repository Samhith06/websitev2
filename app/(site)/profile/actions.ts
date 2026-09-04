'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/player';
import { issueVerificationCode } from '@/lib/store/accounts';
import { submitLink } from '@/lib/store/razed-links';
import { wageredForUsername } from '@/lib/store/razed-snapshots';
import { selfExclude, setPokerHandle, updateSettings } from '@/lib/store/profile';
import { setPinned } from '@/lib/store/badges';
import { write } from '@/lib/db';

export type Outcome = { ok: true; message: string } | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Razed link                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Submitting a Razed username.
 *
 * The name is checked against the referral data before anything is stored. A
 * username that has never wagered under the code cannot belong to anyone here,
 * and saying so immediately beats leaving a request to rot in a queue no mod
 * can action.
 */
export async function saveRazedUsername(formData: FormData): Promise<Outcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  const username = String(formData.get('username') ?? '').trim();
  if (!username) return { ok: false, error: 'Enter your Razed username.' };
  if (username.length > 64) return { ok: false, error: 'That username is too long.' };

  const wagered = await wageredForUsername(username);
  const result = await submitLink({ userId: gate.user.id, username, matchedWagered: wagered });

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'taken'
          ? 'Another account has already claimed that Razed username. If it is yours, message a mod in Discord.'
          : 'That username has never appeared in wagering under the code, so it cannot be matched. Check the spelling, or sign up on Razed under MATTYSPINS first.',
    };
  }

  // A changed username is worth an audit row of its own: the mod queue counts
  // previous claims as one of its impersonation signals.
  await write(
    `INSERT INTO audit_log (admin_name, action, target, detail)
     VALUES ($1, 'razed.link.changed', $2, $3)`,
    [gate.user.discordUsername, String(gate.user.id), JSON.stringify({ username })],
  ).catch(() => {
    /* the link is saved either way; a missing audit row must not fail the save */
  });

  revalidatePath('/profile');
  revalidatePath('/milestones');
  return { ok: true, message: 'Submitted — a mod reviews it before milestones unlock.' };
}

export async function savePokerHandle(formData: FormData): Promise<Outcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  const handle = String(formData.get('handle') ?? '').trim();
  if (handle.length > 64) return { ok: false, error: 'That handle is too long.' };

  await setPokerHandle(gate.user.id, handle);
  revalidatePath('/profile');
  return { ok: true, message: handle ? 'Saved.' : 'Removed.' };
}

/* -------------------------------------------------------------------------- */
/* Kick verification                                                          */
/* -------------------------------------------------------------------------- */

export async function newVerificationCode(): Promise<
  { ok: true; code: string; expiresAt: string } | { ok: false; error: string }
> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  const issued = await issueVerificationCode(gate.user.id);
  revalidatePath('/profile');
  return { ok: true, code: issued.code, expiresAt: issued.expiresAt };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export async function toggleSetting(
  key: 'gamesEnabled' | 'gameSound' | 'publicProfile' | 'streamNotifications',
  value: boolean,
): Promise<Outcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  await updateSettings(gate.user.id, { [key]: value });
  revalidatePath('/profile');
  revalidatePath('/games');
  return { ok: true, message: 'Saved.' };
}

const EXCLUSION_DAYS: Record<string, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  permanent: 365 * 100,
};

/**
 * Self-exclusion.
 *
 * Server-enforced, extend-only, and it turns games off in the same write. A
 * toggle the server does not honour is not a self-exclusion feature, and one a
 * person can shorten at 2am is not one either.
 */
export async function excludeSelf(period: string): Promise<Outcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  const days = EXCLUSION_DAYS[period];
  if (!days) return { ok: false, error: 'Pick how long the break should last.' };

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await selfExclude(gate.user.id, until);

  revalidatePath('/profile');
  revalidatePath('/games');
  return {
    ok: true,
    message: `Games are switched off until ${until.toLocaleDateString('en-GB')}. A mod cannot shorten this for you.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

export async function pinBadge(badgeId: number, pinned: boolean): Promise<Outcome> {
  const gate = await requireUser();
  if (!gate.ok) return { ok: false, error: gate.refusal.detail };

  const result = await setPinned(gate.user.id, badgeId, pinned);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'too-many'
          ? 'Three pinned badges is the limit — unpin one first.'
          : 'You have not earned that badge yet.',
    };
  }

  revalidatePath('/profile');
  return { ok: true, message: pinned ? 'Pinned.' : 'Unpinned.' };
}
