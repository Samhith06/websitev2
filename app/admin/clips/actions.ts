'use server';

import { revalidatePath } from 'next/cache';
import { currentIdentity } from '@/lib/player';
import { isAdmin } from '@/lib/admin';
import { hasDatabase, write } from '@/lib/db';
import {
  ClipError, createClip, deleteClip, parseSourceUrl, setClipPinned, setClipStatus,
} from '@/lib/store/clips';

/**
 * The clip editor's write path.
 *
 * Every action re-checks the caller. A server action is a public endpoint with
 * a generated name — the fact that it is only *rendered* inside /admin protects
 * nothing, and `app/admin/layout.tsx` guarding the page does not guard these.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

async function guard(): Promise<{ ok: true; who: string } | { ok: false; error: string }> {
  const identity = await currentIdentity();
  if (!identity || !isAdmin(identity.discordId)) {
    return { ok: false, error: 'You are not signed in as an admin.' };
  }
  if (!hasDatabase()) {
    return { ok: false, error: 'No database is configured, so nothing can be saved yet.' };
  }
  return { ok: true, who: identity.discordUsername };
}

async function audit(who: string, action: string, target: string): Promise<void> {
  await write(
    `INSERT INTO audit_log (admin_name, action, target) VALUES ($1, $2, $3)`,
    [who, action, target],
  ).catch(() => {
    // An audit row failing must not roll back the thing it was recording, but
    // it is worth knowing about.
    console.error('[admin] could not write an audit row');
  });
}

function refresh() {
  revalidatePath('/admin/clips');
  revalidatePath('/clips');
  revalidatePath('/wins');
  revalidatePath('/');
}

export async function saveClip(formData: FormData): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const kind = formData.get('kind') === 'big_win' ? 'big_win' : 'clip';
  const status = formData.get('status') === 'published' ? 'published' : 'draft';
  const url = String(formData.get('url') ?? '');
  const title = String(formData.get('title') ?? '');
  const date = String(formData.get('date') ?? '');
  const bet = numberOrNull(formData.get('bet'));
  const payout = numberOrNull(formData.get('payout'));

  try {
    const clip = await createClip({
      kind,
      url,
      title,
      status,
      occurredAt: date ? new Date(`${date}T12:00:00Z`).toISOString() : undefined,
      pinned: formData.get('pinned') === 'on',
      slotName: String(formData.get('slot') ?? '') || null,
      bet,
      payout,
      addedBy: gate.who,
    });

    await audit(gate.who, status === 'published' ? 'Published a clip' : 'Saved a clip draft', clip.title);
    refresh();
    return {
      ok: true,
      message: status === 'published' ? `Published “${clip.title}”.` : `Saved “${clip.title}” as a draft.`,
    };
  } catch (error) {
    if (error instanceof ClipError) return { ok: false, error: error.message };
    console.error('[admin] saveClip failed', error);
    return { ok: false, error: 'Could not save that clip. The details are in the server log.' };
  }
}

/** The Fetch button: works out the platform, embed and thumbnail from the URL. */
export async function inspectUrl(url: string): Promise<
  { ok: true; source: string; thumbUrl: string; aspect: string } | { ok: false; error: string }
> {
  const gate = await guard();
  if (!gate.ok) return gate;

  const parsed = parseSourceUrl(url);
  if (!parsed) {
    return { ok: false, error: 'That is not a Kick, YouTube, Instagram or X link.' };
  }
  return {
    ok: true,
    source: parsed.source,
    thumbUrl: parsed.thumbUrl,
    aspect: parsed.aspect,
  };
}

export async function publishClip(id: string): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  await setClipStatus(id, 'published');
  await audit(gate.who, 'Published a clip', id);
  refresh();
  return { ok: true, message: 'Published.' };
}

export async function unpublishClip(id: string): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  await setClipStatus(id, 'draft');
  await audit(gate.who, 'Unpublished a clip', id);
  refresh();
  return { ok: true, message: 'Moved back to draft.' };
}

export async function togglePin(id: string, pinned: boolean): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  try {
    await setClipPinned(id, pinned);
  } catch (error) {
    if (error instanceof ClipError) return { ok: false, error: error.message };
    throw error;
  }
  await audit(gate.who, pinned ? 'Pinned a clip' : 'Unpinned a clip', id);
  refresh();
  return { ok: true, message: pinned ? 'Pinned to the homepage.' : 'Unpinned.' };
}

export async function removeClip(id: string): Promise<ActionResult> {
  const gate = await guard();
  if (!gate.ok) return gate;
  await deleteClip(id);
  await audit(gate.who, 'Deleted a clip', id);
  refresh();
  return { ok: true, message: 'Deleted.' };
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const n = Number(String(value));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
