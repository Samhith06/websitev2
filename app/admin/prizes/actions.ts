'use server';

import { revalidatePath } from 'next/cache';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { hasDatabase, write } from '@/lib/db';
import {
  PeriodError, createPeriod, deleteTier, setPeriodStatus, updatePeriodDates, upsertTier,
} from '@/lib/store/periods';
import type { PeriodStatus } from '@/lib/types';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Prize money is the one thing on this site people will argue about, so every
 * action here re-checks the caller and writes an audit row. A server action is
 * a public endpoint — being rendered inside /admin protects nothing.
 *
 * Freezing and paying are owner-only. A moderator can draft next week's tiers;
 * declaring a board final is a different kind of decision.
 */
async function guard(ownerOnly = false) {
  const identity = await currentIdentity();
  const role = roleFor(identity?.discordId);
  if (!identity || !role) return { ok: false as const, error: 'You are not signed in as an admin.' };
  if (!hasDatabase()) return { ok: false as const, error: 'No database is configured.' };
  if (ownerOnly && role !== 'owner') {
    return { ok: false as const, error: 'Only an owner can freeze or finalise a board.' };
  }
  return { ok: true as const, who: identity.discordUsername, role };
}

async function audit(who: string, action: string, target: string, detail?: unknown) {
  await write(
    `INSERT INTO audit_log (admin_name, action, target, detail) VALUES ($1, $2, $3, $4)`,
    [who, action, target, detail ? JSON.stringify(detail) : null],
  ).catch(() => console.error('[admin] could not write an audit row'));
}

function refresh() {
  revalidatePath('/admin/prizes');
  revalidatePath('/leaderboard');
  revalidatePath('/');
}

function fail(error: unknown): ActionResult {
  if (error instanceof PeriodError) return { ok: false, error: error.message };
  console.error('[admin/prizes]', error);
  return { ok: false, error: 'That did not save. The details are in the server log.' };
}

export async function addPeriod(formData: FormData): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const type = formData.get('type') === 'monthly' ? 'monthly' : 'weekly';
  const startsAt = String(formData.get('startsAt') ?? '');
  const endsAt = String(formData.get('endsAt') ?? '');

  try {
    // Dates arrive as calendar days; the board runs to the end of its last day
    // in UTC, and the page says so.
    const period = await createPeriod({
      type,
      startsAt: `${startsAt}T00:00:00Z`,
      endsAt: `${endsAt}T23:59:59Z`,
      copyTiersFromLast: formData.get('copyTiers') === 'on',
      createdBy: gate.who,
    });
    await audit(gate.who, `Opened a ${type} board`, `${startsAt} to ${endsAt}`);
    refresh();
    return {
      ok: true,
      message: period.tiers.length
        ? `Opened the ${type} board with ${period.tiers.length} tiers copied over.`
        : `Opened the ${type} board. Add its prize tiers below.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function editPeriodDates(formData: FormData): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const id = Number(formData.get('periodId'));
  const startsAt = String(formData.get('startsAt') ?? '');
  const endsAt = String(formData.get('endsAt') ?? '');

  try {
    await updatePeriodDates(id, `${startsAt}T00:00:00Z`, `${endsAt}T23:59:59Z`);
    await audit(gate.who, 'Changed a board’s dates', `${startsAt} to ${endsAt}`);
    refresh();
    return { ok: true, message: 'Dates updated. This is the window sent to Razed.' };
  } catch (error) {
    return fail(error);
  }
}

export async function changeStatus(periodId: number, status: PeriodStatus): Promise<ActionResult> {
  const gate = await guard(status === 'frozen' || status === 'paid' || status === 'archived');
  if (!gate.ok) return gate;

  try {
    await setPeriodStatus(periodId, status);
    await audit(gate.who, `Set a board to ${status}`, String(periodId));
    refresh();
    const said: Record<string, string> = {
      frozen: 'Board frozen. The ranks are locked and claims can open.',
      paid: 'Board marked paid.',
      archived: 'Board archived. It stays in the archive permanently.',
      open: 'Board reopened.',
    };
    return { ok: true, message: said[status] ?? 'Updated.' };
  } catch (error) {
    return fail(error);
  }
}

export async function saveTier(formData: FormData): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const tierIdRaw = String(formData.get('tierId') ?? '');
  try {
    await upsertTier({
      periodId: Number(formData.get('periodId')),
      tierId: tierIdRaw ? Number(tierIdRaw) : null,
      rankFrom: Number(formData.get('rankFrom')),
      rankTo: Number(formData.get('rankTo')),
      amount: Number(formData.get('amount')),
      currency: String(formData.get('currency') || 'USD'),
      updatedBy: gate.who,
    });
    await audit(gate.who, tierIdRaw ? 'Edited a prize tier' : 'Added a prize tier',
      `ranks ${formData.get('rankFrom')}–${formData.get('rankTo')}`);
    refresh();
    return { ok: true, message: 'Saved. The prize pool is re-summed from the tiers.' };
  } catch (error) {
    return fail(error);
  }
}

export async function removeTier(tierId: number): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  try {
    await deleteTier(tierId);
    await audit(gate.who, 'Removed a prize tier', String(tierId));
    refresh();
    return { ok: true, message: 'Tier removed.' };
  } catch (error) {
    return fail(error);
  }
}
