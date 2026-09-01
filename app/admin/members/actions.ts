'use server';

import { revalidatePath } from 'next/cache';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { hasDatabase, rows, tx, write } from '@/lib/db';
import { apply, InsufficientCoins, record } from '@/lib/store/coins';
import {
  earningMemberIds, freezeUser, memberIdsMatching, membersByIds,
  resolveMembersByName, unfreezeUser, type ResolvedMember,
} from '@/lib/store/accounts';

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

/* -------------------------------------------------------------------------- */
/* Bulk grants                                                                */
/* -------------------------------------------------------------------------- */

/**
 * How many accounts one batch may touch. A moderator handing out a giveaway
 * prize is working in tens; "everybody watching" is an owner's decision because
 * on a busy night it is three hundred accounts and a five-figure mint.
 */
const MOD_BATCH_LIMIT = 50;
const OWNER_BATCH_LIMIT = 2000;

export type BulkResult =
  | { ok: true; message: string; applied: number; total: number }
  | { ok: false; error: string; blocked?: string[] };

/**
 * One amount, many accounts, one transaction.
 *
 * Three rules, each of which exists because the alternative is worse:
 *
 *   1. **All or nothing.** Three hundred separate writes that fail at row two
 *      hundred leave a mess nobody can unpick — half the room paid, no record
 *      of where it stopped. The batch commits together or not at all.
 *   2. **Deductions are pre-checked.** `apply` throws rather than let a balance
 *      go negative, so a single broke account would roll back the whole grant.
 *      Balances are checked first and the batch is refused *by name* instead.
 *   3. **One audit row for the batch**, carrying the count and the reason. Three
 *      hundred audit rows for one action is not a record, it is noise.
 */
export async function bulkAdjustCoins(input: {
  userIds: number[];
  amount: number;
  reason: string;
}): Promise<BulkResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const ids = [...new Set(input.userIds.filter((n) => Number.isInteger(n) && n > 0))];
  const amount = Math.round(Number(input.amount));
  const reason = String(input.reason ?? '').trim();

  if (ids.length === 0) return { ok: false, error: 'No accounts were selected.' };
  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: 'An adjustment of zero is not an adjustment.' };
  }
  if (!reason) return { ok: false, error: 'A reason is required. It is stored on every ledger row.' };

  const batchLimit = gate.role === 'owner' ? OWNER_BATCH_LIMIT : MOD_BATCH_LIMIT;
  if (ids.length > batchLimit) {
    return {
      ok: false,
      error: gate.role === 'owner'
        ? `A batch is capped at ${OWNER_BATCH_LIMIT} accounts. This one has ${ids.length}.`
        : `Moderators can grant to ${MOD_BATCH_LIMIT} accounts at once. This one has ${ids.length} and needs an owner.`,
    };
  }
  if (gate.role === 'mod' && Math.abs(amount) > MOD_LIMIT) {
    return { ok: false, error: `Moderators can adjust up to ${MOD_LIMIT} MC each. This one needs an owner.` };
  }

  // Rule 2: a deduction is checked against every balance before anything is
  // written, so the batch is refused by name rather than half-applied.
  if (amount < 0) {
    const short = await rows<{ discord_username: string; balance: number }>(
      `SELECT u.discord_username, COALESCE(b.balance, 0) AS balance
         FROM users u
         LEFT JOIN coin_balances b ON b.user_id = u.id
        WHERE u.id = ANY($1::bigint[]) AND COALESCE(b.balance, 0) < $2
        ORDER BY u.discord_username
        LIMIT 25`,
      [ids, Math.abs(amount)],
    );
    if (short.length > 0) {
      return {
        ok: false,
        error: `${short.length} account${short.length === 1 ? '' : 's'} cannot cover ${Math.abs(amount)} MC. Nothing was changed.`,
        blocked: short.map((r) => `${r.discord_username} (${r.balance} MC)`),
      };
    }
  }

  try {
    await tx(async (client) => {
      for (const userId of ids) {
        await apply(client, {
          userId,
          delta: amount,
          kind: 'adjustment',
          reason: `${reason} — bulk by ${gate.who}`,
        });
      }
    });
  } catch (error) {
    if (error instanceof InsufficientCoins) {
      return { ok: false, error: 'A balance moved while the batch was running. Nothing was changed — try again.' };
    }
    console.error('[admin] bulkAdjustCoins failed', error);
    return { ok: false, error: 'Could not apply that batch. Nothing was changed.' };
  }

  await audit(gate.who, amount > 0 ? 'Bulk coin grant' : 'Bulk coin deduction', `${ids.length} accounts`, {
    amount,
    accounts: ids.length,
    reason,
    total: amount * ids.length,
  });
  revalidatePath('/admin/members');
  revalidatePath('/admin/bulk');

  return {
    ok: true,
    applied: ids.length,
    total: amount * ids.length,
    message: `${amount > 0 ? 'Granted' : 'Removed'} ${Math.abs(amount)} MC ${amount > 0 ? 'to' : 'from'} ${ids.length} account${ids.length === 1 ? '' : 's'}.`,
  };
}

export type TargetMode = 'paste' | 'earning' | 'filter';

export type PreviewResult =
  | {
      ok: true;
      mode: TargetMode;
      members: ResolvedMember[];
      unmatched: string[];
      ambiguous: Array<{ input: string; candidates: ResolvedMember[] }>;
    }
  | { ok: false; error: string };

/**
 * The dry run. Nothing is written here — this exists so the confirmation step
 * can show exactly who is about to be paid, and, just as importantly, who was
 * asked for and *not* found. An unmatched line is somebody who will quietly go
 * unpaid, which is the failure mode this whole screen is built to prevent.
 */
export async function previewTargets(input: {
  mode: TargetMode;
  text?: string;
  query?: string;
  filter?: string;
}): Promise<PreviewResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  if (input.mode === 'paste') {
    // Split on newlines, commas and whitespace: a moderator pastes whatever
    // shape the source gave them and should not have to reformat it.
    const names = String(input.text ?? '')
      .split(/[\n,;]+|\s{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return { ok: false, error: 'Paste some names first.' };
    if (names.length > OWNER_BATCH_LIMIT) {
      return { ok: false, error: `That is ${names.length} names. The most a batch can hold is ${OWNER_BATCH_LIMIT}.` };
    }
    const { matched, unmatched, ambiguous } = await resolveMembersByName(names);
    return { ok: true, mode: 'paste', members: matched, unmatched, ambiguous };
  }

  const ids = input.mode === 'earning'
    ? await earningMemberIds()
    : await memberIdsMatching({
        query: input.query,
        filter: input.filter === 'unlinked' || input.filter === 'frozen' ? input.filter : 'all',
      });

  return { ok: true, mode: input.mode, members: await membersByIds(ids), unmatched: [], ambiguous: [] };
}
