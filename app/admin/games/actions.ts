'use server';

import { revalidatePath } from 'next/cache';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { hasDatabase, write } from '@/lib/db';
import { setGameEnabled, setGamesKilled } from '@/lib/store/settings';
import type { GameSlug } from '@/lib/types';

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * The two controls on this screen that genuinely change something.
 *
 * Both are owner-only. Disabling every game is the most disruptive thing anyone
 * can do from admin, and it is exactly the kind of button a moderator should be
 * able to see and not press.
 */
async function guard() {
  const identity = await currentIdentity();
  const role = roleFor(identity?.discordId);
  if (!identity || !role) return { ok: false as const, error: 'You are not signed in as an admin.' };
  if (role !== 'owner') {
    return { ok: false as const, error: 'Only an owner can switch games on or off.' };
  }
  if (!hasDatabase()) return { ok: false as const, error: 'No database is configured.' };
  return { ok: true as const, who: identity.discordUsername };
}

async function audit(who: string, action: string, target: string) {
  await write(
    `INSERT INTO audit_log (admin_name, action, target) VALUES ($1, $2, $3)`,
    [who, action, target],
  ).catch(() => console.error('[admin] could not write an audit row'));
}

function refresh() {
  revalidatePath('/admin/games');
  revalidatePath('/games');
  revalidatePath('/');
}

export async function toggleKillSwitch(killed: boolean): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  await setGamesKilled(killed, gate.who);
  await audit(gate.who, killed ? 'Disabled every game' : 'Brought games back', 'kill switch');
  refresh();

  return {
    ok: true,
    message: killed
      ? 'Every game is off. The play endpoint refuses immediately; rounds already in progress settle normally.'
      : 'Games are back on.',
  };
}

export async function toggleGame(slug: GameSlug, enabled: boolean): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  await setGameEnabled(slug, enabled, gate.who);
  await audit(gate.who, enabled ? `Enabled ${slug}` : `Disabled ${slug}`, slug);
  refresh();

  return { ok: true, message: enabled ? `${slug} is playable again.` : `${slug} is switched off.` };
}
