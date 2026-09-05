'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { devBypass, roleFor, type AdminRole } from '@/lib/admin';
import { record as record_ } from '@/lib/store/audit';
import { InsufficientCoins, balanceOf, record } from '@/lib/store/coins';
import { coins } from '@/lib/format';
import { approveLink, rejectLink } from '@/lib/store/razed-links';
import { markClaimPaid, rejectClaim, upsertTier } from '@/lib/store/milestones';
import { drawRaffle, setRaffleStatus } from '@/lib/store/raffles';
import { resolveRedemption } from '@/lib/store/shop';
import { syncLifetime, syncPeriod } from '@/lib/store/razed-snapshots';
import { award, revoke } from '@/lib/store/badges';
import { evaluateBadges } from '@/lib/store/badge-rules';
import { disabledGames, setGameEnabled, setGamesKilled } from '@/lib/store/settings';
import type { GameSlug } from '@/lib/types';
import {
  ClipError,
  createClip,
  deleteClip,
  setClipPinned,
  setClipStatus,
} from '@/lib/store/clips';
import {
  PeriodError,
  createPeriod,
  currentPeriod,
  deleteTier,
  discardPeriod,
  freezeStandings,
  prizeForRank,
  updatePeriodDates,
  upsertTier as upsertPrizeTier,
} from '@/lib/store/periods';
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
  await record_({
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
  await record_({
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
  await record_({
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
  await record_({
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

  await record_({
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
  await record_({
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

  await record_({
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

  await record_({
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
  const name = String(formData.get('name') ?? '').trim();
  const threshold = Number(formData.get('threshold'));
  const reward = Number(formData.get('reward'));
  const active = formData.get('active') !== 'off';

  if (!name) return { ok: false, error: 'Give the tier a name.' };

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { ok: false, error: 'Threshold must be a positive number.' };
  }
  if (!Number.isFinite(reward) || reward < 0) {
    return { ok: false, error: 'Reward must be zero or more.' };
  }

  await upsertTier({ id, name, threshold, reward, active });
  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: id ? 'milestone.tier.updated' : 'milestone.tier.created',
    target: String(id ?? threshold),
    detail: { name, threshold, reward, active },
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
  await record_({
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
  await record_({
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
 * Re-evaluate every badge rule and award what has been earned.
 *
 * Safe to run as often as anybody likes: awarding a badge already held is a
 * no-op, so the figure reported back is genuinely what was newly earned. The
 * sweep never takes a badge away — that stays `revokeBadge`, by hand, with a
 * name against it in the audit log.
 */
export async function sweepBadges(): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  const report = await evaluateBadges();

  // Only a sweep that changed something is worth a row. A five-minute cron
  // writing "awarded 0" for ever would bury the grants that matter.
  if (report.awarded > 0) {
    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'badge.swept',
      detail: {
        awarded: report.awarded,
        rules: report.rules.filter((r) => r.status === 'evaluated' && r.awarded > 0),
      },
    });
  }

  const skipped = report.rules.filter((r) => r.status === 'no-data');
  revalidatePath('/admin/badges');
  revalidatePath('/profile');

  return {
    ok: true,
    message:
      report.awarded === 0
        ? `Nothing new to award.${skipped.length ? ` ${skipped.length} rule${skipped.length === 1 ? '' : 's'} had no data to read.` : ''}`
        : `Awarded ${report.awarded} badge${report.awarded === 1 ? '' : 's'}.${skipped.length ? ` ${skipped.length} rule${skipped.length === 1 ? '' : 's'} had no data to read.` : ''}`,
  };
}

/** The same rules against one account, from the member screen. */
export async function recheckBadges(userId: number): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  const report = await evaluateBadges([userId]);
  if (report.awarded > 0) {
    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'badge.rechecked',
      target: String(userId),
      detail: { awarded: report.awarded },
    });
  }

  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message:
      report.awarded === 0
        ? 'Already holds everything the rules award.'
        : `Awarded ${report.awarded} badge${report.awarded === 1 ? '' : 's'}.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Games — the kill switch                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The paths a game switch has to reach, so the screens that show it can be
 * revalidated together. Missing one leaves a cached lobby offering a game the
 * API has already started refusing, which reads to a player as the site being
 * broken rather than the game being off.
 */
function revalidateGames(): void {
  revalidatePath('/admin/settings');
  revalidatePath('/games');
  revalidatePath('/games/[slug]', 'page');
  revalidatePath('/');
}

/**
 * Stop every game at once.
 *
 * This is the emergency handle, and the reason it is a stored row rather than
 * a constant: it takes effect on the next request with no deploy and no cache
 * to wait out. `gameIsPlayable` is checked inside both play endpoints, not just
 * the lobby, so flipping this stops bets being accepted rather than merely
 * hiding the buttons.
 *
 * Rounds already in flight are untouched — a blackjack hand mid-deal settles
 * normally. Refusing at the door is the right behaviour; voiding a hand
 * somebody has staked into is not.
 */
export async function killGames(killed: boolean): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  await setGamesKilled(killed, who.name);
  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: killed ? 'games.killed' : 'games.restored',
  });

  revalidateGames();
  return {
    ok: true,
    message: killed
      ? 'Every game is off. The API refuses new bets from the next request.'
      : 'Games are back on.',
  };
}

/**
 * Switch one game off, leaving the rest running.
 *
 * The narrower handle, and the one that gets used: a paytable that looks wrong
 * on Keno is no reason to stop Dice. The site-wide kill still overrides this —
 * `gameIsPlayable` checks it first — so a game showing "on" here is still off
 * while everything is killed, which the screen says rather than leaving the two
 * switches to contradict each other.
 */
export async function setGameAvailable(slug: GameSlug, enabled: boolean): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  await setGameEnabled(slug, enabled, who.name);
  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: enabled ? 'game.enabled' : 'game.disabled',
    target: slug,
  });

  revalidateGames();

  // Read back rather than assume: `setGameEnabled` rewrites a list, and the
  // count is the thing worth saying out loud when several are already off.
  const off = await disabledGames();
  return {
    ok: true,
    message: enabled
      ? `${slug} is back on.${off.length ? ` ${off.length} still off.` : ''}`
      : `${slug} is off. Nothing staked in it is affected.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Clips                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Adding a clip.
 *
 * Everything below was already in `lib/store/clips.ts` — the URL parsing, the
 * pin cap, the big-win validation — and had no caller, so the carousel could
 * only be filled by writing SQL by hand. This is the screen's half of it.
 *
 * New clips default to draft. Nothing reaches the public site until somebody
 * publishes it, which is what stops the wall filling with filler inside a week.
 */
export async function addClip(formData: FormData): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  const kind = formData.get('kind') === 'big_win' ? 'big_win' : 'clip';
  const url = String(formData.get('url') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const slotName = String(formData.get('slotName') ?? '').trim();
  const occurredAt = String(formData.get('occurredAt') ?? '').trim();
  const publish = formData.get('publish') === 'on';
  const pinned = formData.get('pinned') === 'on';

  if (!url) return { ok: false, error: 'Paste the clip URL.' };
  if (!title) return { ok: false, error: 'Give it a title — it is what people read.' };

  const bet = formData.get('bet') ? Number(formData.get('bet')) : null;
  const payout = formData.get('payout') ? Number(formData.get('payout')) : null;

  if (kind === 'big_win') {
    if (!Number.isFinite(bet ?? NaN) || (bet ?? 0) <= 0) {
      return { ok: false, error: 'A big win needs a bet above zero.' };
    }
    if (!Number.isFinite(payout ?? NaN) || (payout ?? 0) <= 0) {
      return { ok: false, error: 'A big win needs a payout above zero.' };
    }
  }

  try {
    const clip = await createClip({
      kind,
      url,
      title,
      status: publish ? 'published' : 'draft',
      pinned,
      slotName: slotName || null,
      bet: kind === 'big_win' ? bet : null,
      payout: kind === 'big_win' ? payout : null,
      // A date-only input is midday UTC, not midnight: midnight lands on the
      // previous day for anyone west of Greenwich and the clip sorts wrong.
      occurredAt: occurredAt ? new Date(`${occurredAt}T12:00:00Z`).toISOString() : undefined,
      addedBy: who.name,
    });

    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'clip.added',
      target: clip.id,
      detail: { kind, url, title, status: clip.status, pinned },
    });

    revalidatePath('/admin/clips');
    revalidatePath('/community');
    revalidatePath('/');
    return {
      ok: true,
      message: publish ? `Published "${clip.title}".` : `Saved "${clip.title}" as a draft.`,
    };
  } catch (error) {
    if (error instanceof ClipError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function publishClip(id: string, publish: boolean): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  await setClipStatus(id, publish ? 'published' : 'draft');
  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: publish ? 'clip.published' : 'clip.unpublished',
    target: id,
  });

  revalidatePath('/admin/clips');
  revalidatePath('/community');
  revalidatePath('/');
  return { ok: true, message: publish ? 'Published.' : 'Back to draft.' };
}

export async function pinClip(id: string, pinned: boolean): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  try {
    await setClipPinned(id, pinned);
  } catch (error) {
    if (error instanceof ClipError) return { ok: false, error: error.message };
    throw error;
  }

  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: pinned ? 'clip.pinned' : 'clip.unpinned',
    target: id,
  });

  revalidatePath('/admin/clips');
  revalidatePath('/community');
  revalidatePath('/');
  return { ok: true, message: pinned ? 'Pinned.' : 'Unpinned.' };
}

/** Removing a clip is a delete, so it is owner-only and confirmed in the UI. */
export async function removeClip(id: string, title: string): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  await deleteClip(id);
  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'clip.deleted',
    target: id,
    detail: { title },
  });

  revalidatePath('/admin/clips');
  revalidatePath('/community');
  revalidatePath('/');
  return { ok: true, message: `Deleted "${title}".` };
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

/* -------------------------------------------------------------------------- */
/* Leaderboard periods and prizes                                             */
/* -------------------------------------------------------------------------- */

/**
 * Open a monthly board.
 *
 * The dates are the calendar month in UTC, because that is what the site tells
 * members ("midnight UTC on the 1st") and a board whose window disagrees with
 * the copy would pay the wrong people. `copyTiers` carries the previous
 * month's prize ladder over, so opening September is one click rather than ten.
 *
 * Only one board of a type may be open at once — the store refuses a second,
 * which is what stops two overlapping months both claiming to be "this month".
 */
export async function openMonthlyPeriod(formData: FormData): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const monthValue = String(formData.get('month') ?? '').trim();
  const copyTiers = formData.get('copyTiers') === 'on';

  // <input type="month"> gives YYYY-MM.
  const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!match) return { ok: false, error: 'Pick a month.' };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const startsAt = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  // The last instant of the month, so the window is inclusive of its final day.
  const endsAt = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 1000);

  try {
    const period = await createPeriod({
      type: 'monthly',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      copyTiersFromLast: copyTiers,
      createdBy: who.name,
    });

    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'leaderboard.period.opened',
      target: String(period.id),
      detail: { startsAt: period.startsAt, endsAt: period.endsAt, tiers: period.tiers.length },
    });

    revalidatePath('/admin/leaderboard');
    revalidatePath('/leaderboard');
    revalidatePath('/');
    return {
      ok: true,
      message: period.tiers.length
        ? `Board open with ${period.tiers.length} prize tiers copied over.`
        : 'Board open. Add prize tiers below.',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof PeriodError ? error.message : 'That board could not be opened.',
    };
  }
}

/** Add or edit one prize tier. A tier can cover a rank range, not just one rank. */
export async function savePrizeTier(formData: FormData): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const periodId = Number(formData.get('periodId'));
  const tierId = Number(formData.get('tierId')) || null;
  const rankFrom = Number(formData.get('rankFrom'));
  const rankTo = Number(formData.get('rankTo')) || rankFrom;
  const amount = Number(formData.get('amount'));

  if (!Number.isInteger(periodId)) return { ok: false, error: 'Unknown period.' };

  try {
    await upsertPrizeTier({ periodId, tierId, rankFrom, rankTo, amount, updatedBy: who.name });
    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: tierId ? 'leaderboard.prize.updated' : 'leaderboard.prize.added',
      target: String(periodId),
      detail: { rankFrom, rankTo, amount },
    });

    revalidatePath('/admin/leaderboard');
    revalidatePath('/leaderboard');
    revalidatePath('/');
    return { ok: true, message: 'Prize saved.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof PeriodError ? error.message : 'That prize could not be saved.',
    };
  }
}

export async function removePrizeTier(tierId: number, periodId: number): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  await deleteTier(tierId);
  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'leaderboard.prize.removed',
    target: String(periodId),
    detail: { tierId },
  });

  revalidatePath('/admin/leaderboard');
  revalidatePath('/leaderboard');
  return { ok: true, message: 'Prize removed.' };
}

/** Form-action wrappers: `<form action>` wants a handler returning void. */
export async function openMonthlyPeriodForm(formData: FormData): Promise<void> {
  await openMonthlyPeriod(formData);
}

export async function savePrizeTierForm(formData: FormData): Promise<void> {
  await savePrizeTier(formData);
}

/**
 * Move an open board's window.
 *
 * The store refuses this once a board is frozen: at that point the dates are
 * the question people already answered, and moving them would change what was
 * competed for after the fact.
 */
export async function setPeriodDates(formData: FormData): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const periodId = Number(formData.get('periodId'));
  const monthValue = String(formData.get('month') ?? '').trim();

  const match = /^(\d{4})-(\d{2})$/.exec(monthValue);
  if (!Number.isInteger(periodId) || !match) return { ok: false, error: 'Pick a month.' };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const startsAt = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endsAt = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 1000);

  try {
    await updatePeriodDates(periodId, startsAt.toISOString(), endsAt.toISOString());
    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'leaderboard.period.moved',
      target: String(periodId),
      detail: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
    });

    revalidatePath('/admin/leaderboard');
    revalidatePath('/leaderboard');
    revalidatePath('/');
    return { ok: true, message: 'Window moved. The board re-reads Razed for the new dates.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof PeriodError ? error.message : 'Those dates could not be set.',
    };
  }
}

/** Discard a board opened by mistake. Refused once it is frozen. */
export async function discardBoard(periodId: number): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  try {
    await discardPeriod(periodId);
    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'leaderboard.period.discarded',
      target: String(periodId),
    });

    revalidatePath('/admin/leaderboard');
    revalidatePath('/leaderboard');
    revalidatePath('/');
    return { ok: true, message: 'Board discarded. You can open the right one now.' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof PeriodError ? error.message : 'That board could not be discarded.',
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Balances                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The largest single adjustment allowed.
 *
 * Not a policy about generosity — a guard against a typo. An extra zero on a
 * grant mints coins that then get spent, and unspending them across a store
 * order and three raffle entries is far harder than refusing the keystroke.
 */
const MAX_ADJUSTMENT = 1_000_000;

/**
 * Add or remove coins from an account.
 *
 * Deliberately not an edit of the balance. It writes an ordinary ledger row
 * through the same path every other movement uses, so the balance stays the
 * sum of the ledger and the member can see exactly what happened and who did
 * it — "Adjustment — compensation for the raffle bug", not a number that
 * silently changed overnight.
 *
 * The reason is required because the member reads it.
 */
export async function adjustBalance(formData: FormData): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const userId = Number(formData.get('userId'));
  const delta = Number(formData.get('delta'));
  const reason = String(formData.get('reason') ?? '').trim();

  if (!Number.isInteger(userId)) return { ok: false, error: 'Unknown account.' };
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, error: 'Enter a whole number of coins, positive or negative.' };
  }
  if (Math.abs(delta) > MAX_ADJUSTMENT) {
    return {
      ok: false,
      error: `That is over the ${coins(MAX_ADJUSTMENT)} limit for one adjustment. Check the figure.`,
    };
  }
  if (!reason) {
    return { ok: false, error: 'Give a reason — the member sees it in their coin history.' };
  }

  const before = await balanceOf(userId);

  try {
    const after = await record({
      userId,
      delta,
      kind: 'adjustment',
      reason: `Adjustment — ${reason}`,
    });

    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: delta > 0 ? 'balance.granted' : 'balance.deducted',
      target: String(userId),
      detail: { delta, reason, before: before.balance, after: after.balance },
    });

    revalidatePath('/admin/users');
    return {
      ok: true,
      message: `${delta > 0 ? 'Added' : 'Removed'} ${coins(Math.abs(delta))} — balance is now ${coins(after.balance)}.`,
    };
  } catch (error) {
    if (error instanceof InsufficientCoins) {
      return {
        ok: false,
        error: `They only have ${coins(error.balance)}. A balance cannot go negative.`,
      };
    }
    throw error;
  }
}
