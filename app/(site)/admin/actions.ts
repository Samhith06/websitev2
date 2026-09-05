'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { devBypass, roleFor, type AdminRole } from '@/lib/admin';
import { record as record_ } from '@/lib/store/audit';
import { InsufficientCoins, balanceOf, record } from '@/lib/store/coins';
import { coins } from '@/lib/format';
import { approveLink, rejectLink } from '@/lib/store/razed-links';
import {
  TierInUse,
  deleteTier as deleteMilestoneTier,
  markClaimPaid,
  rejectClaim,
  setTierActive,
  upsertTier,
} from '@/lib/store/milestones';
import { createRaffle, drawRaffle, setRaffleStatus } from '@/lib/store/raffles';
import { ShopError, resolveRedemption, upsertItem } from '@/lib/store/shop';
import type { ShopCategory } from '@/lib/types';
import { syncLifetime, syncPeriod } from '@/lib/store/razed-snapshots';
import { award, revoke } from '@/lib/store/badges';
import { evaluateBadges } from '@/lib/store/badge-rules';
import { disabledGames, setGameEnabled, setGamesKilled } from '@/lib/store/settings';
import type { GameSlug } from '@/lib/types';
import {
  ClipError,
  createClip,
  deleteClip,
  refreshClipMetadata,
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

/**
 * Removing a tier.
 *
 * Refused once anybody has claimed it. At that point the row is referenced by
 * a claim, which is the record of money that has already been sent, and
 * deleting it would erase the evidence behind a payout. The caller is pointed
 * at deactivating instead, which takes the tier off the ladder and leaves
 * every claim intact — the same move migration 009 made for the tiers the
 * current ladder replaced.
 */
export async function removeTier(tierId: number, name: string): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  try {
    await deleteMilestoneTier(tierId);
  } catch (error) {
    if (error instanceof TierInUse) {
      return {
        ok: false,
        error: `${name} has ${error.claims} claim${error.claims === 1 ? '' : 's'} against it, so it cannot be deleted. Switch it off instead — it leaves the ladder and the claims stay.`,
      };
    }
    throw error;
  }

  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: 'milestone.tier.deleted',
    target: String(tierId),
    detail: { name },
  });

  revalidatePath('/admin/milestones');
  revalidatePath('/milestones');
  return { ok: true, message: `Deleted ${name}.` };
}

/** Take a tier off the ladder without destroying the claims against it. */
export async function toggleTier(tierId: number, active: boolean, name: string): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  await setTierActive(tierId, active);
  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: active ? 'milestone.tier.enabled' : 'milestone.tier.disabled',
    target: String(tierId),
    detail: { name },
  });

  revalidatePath('/admin/milestones');
  revalidatePath('/milestones');
  return {
    ok: true,
    message: active ? `${name} is back on the ladder.` : `${name} is off the ladder. Claims kept.`,
  };
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
/* Raffles — creating one                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A URL-safe slug from the title.
 *
 * Derived rather than typed, because it is the public URL and a mod should not
 * have to think about it. A collision is reported rather than silently
 * suffixed: two raffles called "PS5" where one quietly became "ps5-2" is how
 * the wrong one gets linked in Discord.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Creating a raffle.
 *
 * `createRaffle` commits the draw seed and publishes its hash in the same
 * statement that opens the raffle, so entry cannot begin before the outcome is
 * committed to. That is the whole fairness argument, and it is the reason this
 * is one action rather than a create-then-open pair a mod could interleave
 * with entries.
 *
 * Owner-only. Everything a raffle does — take coins, pick a winner, owe
 * somebody a prize — is Matty's to answer for, and mods keep close and draw.
 */
export async function addRaffle(formData: FormData): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const title = String(formData.get('title') ?? '').trim();
  const valueLabel = String(formData.get('valueLabel') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const symbol = String(formData.get('symbol') ?? '').trim() || '✦';
  const closesAt = String(formData.get('closesAt') ?? '').trim();
  const cost = Number(formData.get('cost') ?? 0);
  const maxEntries = Number(formData.get('maxEntries') ?? 1);
  const slug = slugify(String(formData.get('slug') ?? '') || title);

  if (!title) return { ok: false, error: 'Give the raffle a title.' };
  if (!slug) return { ok: false, error: 'That title has no letters or numbers to make a URL from.' };
  if (!valueLabel) {
    return { ok: false, error: 'Say what it is worth — it is the first thing people read.' };
  }
  if (!Number.isInteger(cost) || cost < 0) {
    return { ok: false, error: 'Entry cost must be a whole number of coins, or zero for free.' };
  }
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    return { ok: false, error: 'Max entries must be at least one.' };
  }
  if (!closesAt) return { ok: false, error: 'Set a closing time.' };

  const closes = new Date(closesAt);
  if (Number.isNaN(closes.getTime())) {
    return { ok: false, error: 'That closing time is not a date.' };
  }
  // A raffle that opens already closed takes no entries and cannot be drawn,
  // and the mistake is invisible until somebody asks why nobody has entered.
  if (closes.getTime() <= Date.now()) {
    return { ok: false, error: 'That closing time has already passed.' };
  }

  try {
    const raffle = await createRaffle({
      slug,
      title,
      valueLabel,
      description,
      symbol,
      cost,
      maxEntries,
      closesAt: closes.toISOString(),
    });

    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'raffle.created',
      target: String(raffle.id),
      detail: { slug, title, cost, maxEntries, closesAt: closes.toISOString() },
    });

    revalidatePath('/admin/raffles');
    revalidatePath('/raffles');
    return {
      ok: true,
      message: `"${title}" is open at /raffles/${slug}. The seed hash is published; the seed stays sealed until the draw.`,
    };
  } catch (error) {
    // The slug is unique in the database, which is what actually prevents a
    // duplicate — this turns that constraint into a sentence.
    const message = error instanceof Error ? error.message : '';
    if (message.includes('raffles_slug_key') || message.includes('duplicate key')) {
      return { ok: false, error: `A raffle already uses the URL "${slug}". Give this one a different title or slug.` };
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Store — the catalogue                                                      */
/* -------------------------------------------------------------------------- */

const CATEGORIES: ShopCategory[] = ['entries', 'discord', 'merch', 'stream', 'tips'];

/**
 * Creating or editing a store item.
 *
 * Editing a price is safe by construction: `redemptions` copies the cost onto
 * its own row at the moment of purchase, so changing an item here cannot
 * retroactively alter what anybody paid or what their coin history says.
 *
 * Stock and cooldown are both "blank means unlimited", which is why they are
 * read as empty-string rather than coerced through `Number` — `Number('')` is
 * 0, and an item silently switching from unlimited to out of stock is the bug
 * that shape of parsing always produces.
 */
export async function saveShopItem(formData: FormData): Promise<Outcome> {
  const who = await staff('owner');
  if (!who) return DENIED;

  const rawId = String(formData.get('id') ?? '').trim();
  const id = rawId ? Number(rawId) : null;
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const cost = Number(formData.get('cost') ?? 0);
  const category = String(formData.get('category') ?? '') as ShopCategory;
  const rawStock = String(formData.get('stock') ?? '').trim();
  const rawCooldown = String(formData.get('cooldownDays') ?? '').trim();
  const needsReview = formData.get('needsReview') === 'on';
  const active = formData.get('active') === 'on';

  if (!name) return { ok: false, error: 'Give the item a name.' };
  if (!CATEGORIES.includes(category)) return { ok: false, error: 'Pick a category.' };
  if (!Number.isInteger(cost) || cost <= 0) {
    return { ok: false, error: 'An item has to cost a whole number of coins, above zero.' };
  }

  const stock = rawStock === '' ? null : Number(rawStock);
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
    return { ok: false, error: 'Stock must be a whole number, or blank for unlimited.' };
  }

  const cooldownDays = rawCooldown === '' ? null : Number(rawCooldown);
  if (cooldownDays !== null && (!Number.isInteger(cooldownDays) || cooldownDays < 1)) {
    return { ok: false, error: 'Cooldown must be a whole number of days, or blank for none.' };
  }

  try {
    await upsertItem({
      id,
      name,
      description,
      cost,
      category,
      stock,
      cooldownDays,
      needsReview,
      active,
    });
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, error: error.message };
    throw error;
  }

  await record_({
    actor: who.name,
    actorDiscordId: who.discordId,
    action: id ? 'shop.item.updated' : 'shop.item.created',
    target: id ? String(id) : name,
    detail: { name, cost, category, stock, cooldownDays, needsReview, active },
  });

  revalidatePath('/admin/store');
  revalidatePath('/store');
  return {
    ok: true,
    message: id
      ? `Saved "${name}". Existing orders keep the price they were bought at.`
      : `Added "${name}" at ${coins(cost)}.${active ? '' : ' It is hidden until you switch it live.'}`,
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

/**
 * Re-fetch thumbnails and durations for the Kick clips already stored.
 *
 * Every clip added before the thumbnail was fetched rather than guessed holds
 * a URL with a hardcoded shard segment in it, which 403s — that is the broken
 * image on the home rail. Those rows cannot repair themselves, because the
 * right URL is not derivable from anything they hold, so this asks Kick.
 */
export async function refreshClips(): Promise<Outcome> {
  const who = await staff();
  if (!who) return DENIED;

  const report = await refreshClipMetadata();

  if (report.fixed > 0) {
    await record_({
      actor: who.name,
      actorDiscordId: who.discordId,
      action: 'clip.metadata.refreshed',
      detail: { checked: report.checked, fixed: report.fixed, failed: report.failed.length },
    });
  }

  revalidatePath('/admin/clips');
  revalidatePath('/community');
  revalidatePath('/');

  const failed = report.failed.length
    ? ` ${report.failed.length} could not be read from Kick — they may be deleted or private.`
    : '';
  return {
    ok: true,
    message:
      report.fixed === 0
        ? `Checked ${report.checked}; nothing needed changing.${failed}`
        : `Fixed ${report.fixed} of ${report.checked}.${failed}`,
  };
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
