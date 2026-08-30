import 'server-only';
import { randomUUID } from 'node:crypto';
import { one, rows, write } from '@/lib/db';
import type { Clip, ClipSource } from '@/lib/types';

/**
 * Clips and big wins, as rows rather than a file.
 *
 * Nothing reaches the public site until somebody publishes it, which is what
 * stops the carousel filling with filler inside a week (§10). Drafts are
 * visible in admin and nowhere else.
 *
 * The multiplier on a big win is deliberately not a column. It is derived from
 * the bet and payout every time it is shown, so it can never disagree with the
 * two figures printed beside it.
 */

type ClipRow = {
  id: string;
  kind: string;
  source: string;
  url: string;
  embed_url: string;
  thumb_url: string;
  title: string;
  aspect: string;
  duration_seconds: number;
  views: number | null;
  occurred_at: Date;
  pinned: boolean;
  status: string;
  slot_name: string | null;
  bet_amount: number | null;
  payout_amount: number | null;
};

const COLUMNS = `id, kind, source, url, embed_url, thumb_url, title, aspect,
                 duration_seconds, views, occurred_at, pinned, status,
                 slot_name, bet_amount, payout_amount`;

function toClip(row: ClipRow): Clip {
  return {
    id: row.id,
    kind: row.kind === 'big_win' ? 'big_win' : 'clip',
    source: row.source as ClipSource,
    url: row.url,
    embedUrl: row.embed_url,
    thumbUrl: row.thumb_url,
    title: row.title,
    aspect: row.aspect === '9:16' ? '9:16' : '16:9',
    durationSeconds: row.duration_seconds,
    views: row.views ?? undefined,
    occurredAt: row.occurred_at.toISOString(),
    pinned: row.pinned,
    status: row.status === 'published' ? 'published' : 'draft',
    slotName: row.slot_name ?? undefined,
    bet: row.bet_amount ?? undefined,
    payout: row.payout_amount ?? undefined,
  };
}

/**
 * Pinned first, then explicit order, then newest. The public site always passes
 * `status: 'published'`; admin is the only caller that sees drafts.
 */
export async function listClips(options: {
  kind?: 'clip' | 'big_win';
  status?: 'published' | 'draft';
  limit?: number;
} = {}): Promise<Clip[]> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (options.kind) {
    values.push(options.kind);
    where.push(`kind = $${values.length}`);
  }
  if (options.status) {
    values.push(options.status);
    where.push(`status = $${values.length}`);
  }
  values.push(options.limit ?? 60);

  const found = await rows<ClipRow>(
    `SELECT ${COLUMNS} FROM clips
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY pinned DESC, sort_order ASC, occurred_at DESC
     LIMIT $${values.length}`,
    values,
  );
  return found.map(toClip);
}

export async function publishedClips(limit = 24): Promise<Clip[]> {
  return listClips({ kind: 'clip', status: 'published', limit });
}

export async function publishedBigWins(limit = 24): Promise<Clip[]> {
  return listClips({ kind: 'big_win', status: 'published', limit });
}

export async function clipById(id: string): Promise<Clip | null> {
  const row = await one<ClipRow>(`SELECT ${COLUMNS} FROM clips WHERE id = $1`, [id]);
  return row ? toClip(row) : null;
}

export async function pinnedCount(): Promise<number> {
  const row = await one<{ n: string }>(
    `SELECT count(*)::text AS n FROM clips WHERE pinned`,
  );
  return Number(row?.n ?? 0);
}

export type NewClip = {
  kind: 'clip' | 'big_win';
  url: string;
  title: string;
  status: 'draft' | 'published';
  occurredAt?: string;
  pinned?: boolean;
  slotName?: string | null;
  bet?: number | null;
  payout?: number | null;
  addedBy?: string;
};

/** At most three pins, refused with a message rather than silently dropped. */
export const MAX_PINS = 3;

export async function createClip(input: NewClip): Promise<Clip> {
  const parsed = parseSourceUrl(input.url);
  if (!parsed) {
    throw new ClipError('That URL is not a Kick, YouTube, Instagram or X link.');
  }
  if (!input.title.trim()) {
    throw new ClipError('A clip needs a title — it is what people read in the carousel.');
  }
  if (input.pinned && (await pinnedCount()) >= MAX_PINS) {
    throw new ClipError(`Only ${MAX_PINS} clips can be pinned at once. Unpin one first.`);
  }
  if (input.kind === 'big_win') {
    const bet = input.bet ?? 0;
    const payout = input.payout ?? 0;
    if (bet <= 0 || payout <= 0) {
      throw new ClipError('A big win needs a bet and a payout — the multiplier is derived from them.');
    }
  }

  const id = parsed.id ?? `clip_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

  const inserted = await write<ClipRow>(
    `INSERT INTO clips
       (id, kind, source, url, embed_url, thumb_url, title, aspect,
        duration_seconds, occurred_at, pinned, status, slot_name,
        bet_amount, payout_amount, added_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (id) DO UPDATE
       SET title         = EXCLUDED.title,
           kind          = EXCLUDED.kind,
           status        = EXCLUDED.status,
           pinned        = EXCLUDED.pinned,
           slot_name     = EXCLUDED.slot_name,
           bet_amount    = EXCLUDED.bet_amount,
           payout_amount = EXCLUDED.payout_amount,
           occurred_at   = EXCLUDED.occurred_at
     RETURNING ${COLUMNS}`,
    [
      id,
      input.kind,
      parsed.source,
      input.url.trim(),
      parsed.embedUrl,
      parsed.thumbUrl,
      input.title.trim(),
      parsed.aspect,
      input.occurredAt ?? new Date().toISOString(),
      input.pinned ?? false,
      input.status,
      input.slotName?.trim() || null,
      input.bet ?? null,
      input.payout ?? null,
      input.addedBy ?? null,
    ],
  );
  return toClip(inserted[0]);
}

export async function setClipStatus(id: string, status: 'draft' | 'published'): Promise<void> {
  await write('UPDATE clips SET status = $2 WHERE id = $1', [id, status]);
}

export async function setClipPinned(id: string, pinned: boolean): Promise<void> {
  if (pinned && (await pinnedCount()) >= MAX_PINS) {
    throw new ClipError(`Only ${MAX_PINS} clips can be pinned at once. Unpin one first.`);
  }
  await write('UPDATE clips SET pinned = $2 WHERE id = $1', [id, pinned]);
}

export async function deleteClip(id: string): Promise<void> {
  await write('DELETE FROM clips WHERE id = $1', [id]);
}

export class ClipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClipError';
  }
}

/* -------------------------------------------------------------------------- */
/* URL parsing                                                                */
/* -------------------------------------------------------------------------- */

export type ParsedSource = {
  source: ClipSource;
  id: string | null;
  embedUrl: string;
  thumbUrl: string;
  aspect: '16:9' | '9:16';
};

/**
 * Works out the platform, the embed and — where the platform exposes one from
 * the id alone — a thumbnail. Kick and YouTube do; Instagram and X do not
 * without an API call, so those come back with an empty thumbnail rather than
 * a guessed URL that 404s in the carousel.
 */
export function parseSourceUrl(raw: string): ParsedSource | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');

  if (host.endsWith('kick.com')) {
    // https://kick.com/<channel>/clips/<clipId>
    const parts = url.pathname.split('/').filter(Boolean);
    const clipIndex = parts.indexOf('clips');
    const channel = parts[0];
    const id = clipIndex >= 0 ? parts[clipIndex + 1] : url.searchParams.get('clip');
    if (id && channel) {
      return {
        source: 'kick',
        id,
        embedUrl: `https://player.kick.com/${channel}?clip=${id}`,
        thumbUrl: `https://clips.kick.com/clips/60/${id}/thumbnail.webp`,
        aspect: '16:9',
      };
    }
    return { source: 'kick', id: null, embedUrl: trimmed, thumbUrl: '', aspect: '16:9' };
  }

  if (host.endsWith('youtube.com') || host === 'youtu.be') {
    const short = host === 'youtu.be' ? url.pathname.slice(1) : null;
    const shorts = url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : null;
    const id = short || shorts || url.searchParams.get('v');
    if (!id) return null;
    return {
      source: 'youtube',
      id: `yt_${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumbUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      aspect: shorts ? '9:16' : '16:9',
    };
  }

  if (host.endsWith('instagram.com')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[1] ?? null;
    return {
      source: 'instagram',
      id: id ? `ig_${id}` : null,
      embedUrl: id ? `https://www.instagram.com/${parts[0]}/${id}/embed` : trimmed,
      thumbUrl: '',
      aspect: '9:16',
    };
  }

  if (host === 'x.com' || host.endsWith('twitter.com')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1] ?? null;
    return {
      source: 'x',
      id: id ? `x_${id}` : null,
      embedUrl: trimmed,
      thumbUrl: '',
      aspect: '16:9',
    };
  }

  return null;
}
