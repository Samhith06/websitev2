'use server';

import { revalidatePath } from 'next/cache';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { hasDatabase, write } from '@/lib/db';
import { ShopError, upsertItem } from '@/lib/store/shop';
import type { ShopCategory } from '@/lib/types';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function guard() {
  const identity = await currentIdentity();
  const role = roleFor(identity?.discordId);
  if (!identity || !role) return { ok: false as const, error: 'You are not signed in as an admin.' };
  if (!hasDatabase()) return { ok: false as const, error: 'No database is configured.' };
  return { ok: true as const, who: identity.discordUsername };
}

async function audit(who: string, action: string, target: string) {
  await write(
    `INSERT INTO audit_log (admin_name, action, target) VALUES ($1, $2, $3)`,
    [who, action, target],
  ).catch(() => console.error('[admin] could not write an audit row'));
}

const CATEGORIES: ShopCategory[] = ['entries', 'discord', 'merch', 'stream'];

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * Creating and editing items.
 *
 * Changing a price here never rewrites history: a redemption stores the cost it
 * was made at, so yesterday's purchase keeps yesterday's number.
 */
export async function saveItem(formData: FormData): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const idRaw = String(formData.get('id') ?? '');
  const category = String(formData.get('category') ?? 'entries') as ShopCategory;

  try {
    await upsertItem({
      id: idRaw ? Number(idRaw) : null,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      cost: Number(formData.get('cost')),
      category: CATEGORIES.includes(category) ? category : 'entries',
      // Blank means unlimited, which is different from zero — zero is sold out.
      stock: optionalNumber(formData.get('stock')),
      cooldownDays: optionalNumber(formData.get('cooldownDays')) || null,
      needsReview: formData.get('needsReview') === 'on',
      active: formData.get('active') === 'on',
    });
    await audit(gate.who, idRaw ? 'Edited a shop item' : 'Added a shop item',
      String(formData.get('name') ?? ''));
    revalidatePath('/admin/shop');
    revalidatePath('/shop');
    return { ok: true, message: idRaw ? 'Item updated.' : 'Item added to the shop.' };
  } catch (error) {
    if (error instanceof ShopError) return { ok: false, error: error.message };
    console.error('[admin/shop] saveItem failed', error);
    return { ok: false, error: 'That did not save. The details are in the server log.' };
  }
}

/**
 * Hiding rather than deleting. A deleted item would orphan every redemption
 * that referenced it, and those rows are the record of what people were sold.
 */
export async function setItemActive(id: number, active: boolean): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  await write('UPDATE shop_items SET active = $2, updated_at = now() WHERE id = $1', [id, active]);
  await audit(gate.who, active ? 'Showed a shop item' : 'Hid a shop item', String(id));
  revalidatePath('/admin/shop');
  revalidatePath('/shop');
  return { ok: true, message: active ? 'Item is live in the shop.' : 'Item hidden from the shop.' };
}

export async function setItemStock(id: number, stock: number | null): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  await write('UPDATE shop_items SET stock = $2, updated_at = now() WHERE id = $1', [id, stock]);
  await audit(gate.who, 'Changed stock', `${id} -> ${stock ?? 'unlimited'}`);
  revalidatePath('/admin/shop');
  revalidatePath('/shop');
  return { ok: true, message: 'Stock updated.' };
}
