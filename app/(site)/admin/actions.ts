'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { devBypass, roleFor, type AdminRole } from '@/lib/admin';
import { record } from '@/lib/store/audit';
import { approveLink, rejectLink } from '@/lib/store/razed-links';
import { markClaimPaid, rejectClaim, upsertTier } from '@/lib/store/milestones';
import { drawRaffle, setRaffleStatus } from '@/lib/store/raffles';
import { resolveRedemption } from '@/lib/store/shop';
import { syncLifetime, syncPeriod } from '@/lib/store/razed-snapshots';
import { award, revoke } from '@/lib/store/badges';
import { currentPeriod, freezeStandings, prizeForRank } from '@/lib/store/periods';
import { fetchRazedLeaderboard, toBoardRows } from '@/lib/razed';

export type Outcome = { ok: true; message: string } | { ok: false; error: string };

type Staff = { name: string; discordId: string | null; role: AdminRole };

/**
 * Who is asking, established server-side on every call.
 *
 * The role is read from the environment against the session's Discord id, not
 * from anything the browser sent. A form that posts `role=owner` gets nowhere.
 */
async function staff(required: AdminRole | 'any' = 'any'): Promise<Staff | null> {
  if (devBypass()) return { name: 'Local preview', discordId: null, role: 'owner' };

  const session = await auth();
  const discordId = session?.user?.discordId ?? null;
  const role = roleFor(discordId);
  if (!role) return null;
  if (required === 'owner' && role !== 'owner') return null;

  return {
    name: session?.user?.discordUsername ?? session?.user?.name ?? 'Staff',
    discordId,
    role,
  };
}

const DENIED: Outcome = { ok: false, error: 'You are not authorised to do that.' };

/* -------------------------------------------------------------------------- */
/* Razed links                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Approving a Razed link.
 *
 * There is no technical backstop here — Razed exposes nothing that proves
 * ownership — so this is a mod's judgement being recorded, and the audit row is
 * the only thing that makes a bad call traceable rather than deniable. A
 * flagged request is the shape of an impersonation attempt and should never be
 * approved without a message from that person in Discord.
 */
export async function approveRazedLink(userId: number, username: string): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await approveLink(userId, who.name);
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'razed.link.approved',
    target: String(userId),
    detail: { username },
  });

  revalidatePath('/admin');
  return { ok: true, message: `Approved ${username}.` };
}

export async function rejectRazedLink(
  userId: number,
  username: string,
  reason: string,
): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await rejectLink(userId, who.name, reason || 'Not approved');
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'razed.link.rejected',
    target: String(userId),
    detail: { username, reason },
  });

  revalidatePath('/admin');
  return { ok: true, message: `Rejected ${username}.` };
}

/* -------------------------------------------------------------------------- */
/* Payouts                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Marking a milestone claim paid.
 *
 * The site moves no money — this records that Matty has already sent the tip on
 * Razed by hand. Which is why it is a separate, deliberate action rather than
 * something that happens when a claim is approved.
 */
export async function markPaid(claimId: number, who_: string, amount: number): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await markClaimPaid(claimId, who.name);
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'milestone.paid',
    target: String(claimId),
    detail: { user: who_, amount },
  });

  revalidatePath('/admin/payouts');
  revalidatePath('/admin');
  return { ok: true, message: `${who_} marked paid.` };
}

export async function holdClaim(claimId: number, user: string): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await rejectClaim(claimId, who.name);
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'milestone.rejected',
    target: String(claimId),
    detail: { user },
  });

  revalidatePath('/admin/payouts');
  revalidatePath('/admin');
  return { ok: true, message: `${user}'s claim held.` };
}

/* -------------------------------------------------------------------------- */
/* Redemptions                                                                */
/* -------------------------------------------------------------------------- */

export async function resolveOrder(
  redemptionId: number,
  status: 'approved' | 'fulfilled' | 'rejected',
  reason?: string,
): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  // Rejection refunds through a normal ledger entry rather than an adjustment,
  // so the member's history reads as "spent, then refunded" rather than
  // "someone edited my balance".
  const result = await resolveRedemption({
    id: redemptionId,
    status,
    handledBy: who.name,
    reason,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: `redemption.${status}`,
    target: String(redemptionId),
    detail: { reason },
  });

  revalidatePath('/admin');
  return { ok: true, message: `Order ${status}.` };
}

/* -------------------------------------------------------------------------- */
/* Raffles                                                                    */
/* -------------------------------------------------------------------------- */

/** Drawing a raffle. Irreversible, and it publishes the committed seed. */
export async function draw(raffleId: number): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  const result = await drawRaffle(raffleId, who.name);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === 'no-entries'
          ? 'Nobody entered, so there is nobody to draw.'
          : result.error === 'already-drawn'
            ? 'That raffle has already been drawn.'
            : 'That raffle could not be found.',
    };
  }

  revalidatePath('/admin/raffles');
  revalidatePath('/raffles');
  return {
    ok: true,
    message: `${result.winnerUsername} won, from ${result.entryCount} entries. Seed revealed.`,
  };
}

export async function closeRaffle(raffleId: number): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await setRaffleStatus(raffleId, 'closed');
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'raffle.closed',
    target: String(raffleId),
  });

  revalidatePath('/admin/raffles');
  revalidatePath('/raffles');
  return { ok: true, message: 'Entries closed.' };
}

/* -------------------------------------------------------------------------- */
/* Razed sync and the month freeze                                            */
/* -------------------------------------------------------------------------- */

export async function syncRazed(): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  const result = await syncLifetime();
  if (!result.ok) return { ok: false, error: `Sync failed: ${result.detail}` };

  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'razed.synced',
    detail: { rows: result.rowCount },
  });

  revalidatePath('/admin/razed');
  return { ok: true, message: `Synced ${result.rowCount} wagerers.` };
}

/**
 * Freezing the month.
 *
 * This is the moment the archive stops being a live query. The standings are
 * read once and stored, and from then on that month renders from the stored
 * rows — so a later restatement by Razed cannot move a board somebody has
 * already been paid against.
 */
export async function freezeMonth(): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const period = await currentPeriod('monthly');
  if (!period) return { ok: false, error: 'No monthly period is open.' };

  const feed = await fetchRazedLeaderboard({
    from: period.startsAt.slice(0, 10),
    to: period.endsAt.slice(0, 10),
  });
  if (!feed.ok) {
    return {
      ok: false,
      error: `Razed could not be read (${feed.detail}). Nothing has been frozen — freezing a board we cannot see would archive an empty month.`,
    };
  }

  const standings = toBoardRows(feed.rows, (rank) => prizeForRank(period.tiers, rank));
  const froze = await freezeStandings(period.id, standings);
  if (!froze) return { ok: false, error: 'That period was already frozen.' };

  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'leaderboard.frozen',
    target: String(period.id),
    detail: { rows: standings.length, paid: standings.filter((r) => r.prize > 0).length },
  });

  // The snapshot is kept alongside the frozen standings so the raw figures
  // behind the archive survive too.
  await syncPeriod(
    `${period.startsAt.slice(0, 7)}`,
    period.startsAt.slice(0, 10),
    period.endsAt.slice(0, 10),
  );

  revalidatePath('/admin/leaderboard');
  revalidatePath('/admin/payouts');
  revalidatePath('/leaderboard');
  return {
    ok: true,
    message: `Frozen. ${standings.filter((r) => r.prize > 0).length} payouts queued.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Milestone tiers                                                            */
/* -------------------------------------------------------------------------- */

export async function saveTier(formData: FormData): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const id = Number(formData.get('id')) || undefined;
  const threshold = Number(formData.get('threshold'));
  const reward = Number(formData.get('reward'));
  const active = formData.get('active') !== 'off';

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { ok: false, error: 'Threshold must be a positive number.' };
  }
  if (!Number.isFinite(reward) || reward < 0) {
    return { ok: false, error: 'Reward must be zero or more.' };
  }

  await upsertTier({ id, threshold, reward, active });
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: id ? 'milestone.tier.updated' : 'milestone.tier.created',
    target: String(id ?? threshold),
    detail: { threshold, reward, active },
  });

  revalidatePath('/admin/milestones');
  revalidatePath('/milestones');
  return { ok: true, message: 'Tier saved. Existing claims are untouched.' };
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

export async function grantBadge(userId: number, slug: string): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await award(userId, slug);
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'badge.granted',
    target: String(userId),
    detail: { slug },
  });

  revalidatePath('/admin/badges');
  return { ok: true, message: 'Badge granted.' };
}

export async function revokeBadge(userId: number, slug: string): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await revoke(userId, slug);
  await record({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'badge.revoked',
    target: String(userId),
    detail: { slug },
  });

  revalidatePath('/admin/badges');
  return { ok: true, message: 'Badge revoked.' };
}

/**
 * The form-action wrapper for `saveTier`.
 *
 * React's `<form action>` requires a handler returning void, while the action
 * itself returns an Outcome so a client component can report it. Rather than
 * weaken the return type everywhere, the form path revalidates and lets the
 * re-render show the saved values — the page itself is the confirmation.
 */
export async function saveTierForm(formData: FormData): Promise<void> {
  await saveTier(formData);
}
