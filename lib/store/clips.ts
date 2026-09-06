import 'server-only';
import { randomUUID } from 'node:crypto';
import { one, rows, write } from '@/lib/db';
import { fetchKickClip } from '@/lib/kick-api';
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
  video_url: string;
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
  max_win: boolean;
  /** Joined from `clip_plays`; absent on the RETURNING paths, which is fine. */
  plays?: number | null;
};

const COLUMNS = `id, kind, source, url, embed_url, video_url, thumb_url, title, aspect,
                 duration_seconds, views, occurred_at, pinned, status,
                 slot_name, bet_amount, payout_amount, max_win`;

/**
 * The same columns qualified, plus the play count joined on.
 *
 * `COLUMNS` stays unqualified because `RETURNING` cannot join — a freshly
 * written row simply has no plays yet, and reads zero, which is true.
 */
const QUALIFIED = COLUMNS.split(',').map((c) => `c.${c.trim()}`).join(', ');
const SELECT_WITH_PLAYS = `SELECT ${QUALIFIED}, COALESCE(p.plays, 0)::int AS plays
                             FROM clips c
                             LEFT JOIN clip_plays p ON p.clip_id = c.id`;

function toClip(row: ClipRow): Clip {
  return {
    id: row.id,
    kind: row.kind === 'big_win' ? 'big_win' : 'clip',
    source: row.source as ClipSource,
    url: row.url,
    embedUrl: row.embed_url,
    videoUrl: row.video_url ?? '',
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
    maxWin: row.max_win,
    plays: row.plays ?? 0,
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
    where.push(`c.kind = $${values.length}`);
  }
  if (options.status) {
    values.push(options.status);
    where.push(`c.status = $${values.length}`);
  }
  values.push(options.limit ?? 60);

  const found = await rows<ClipRow>(
    `${SELECT_WITH_PLAYS}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY c.pinned DESC, c.sort_order ASC, c.occurred_at DESC
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
  const row = await one<ClipRow>(`${SELECT_WITH_PLAYS} WHERE c.id = $1`, [id]);
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
  maxWin?: boolean;
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

  /**
   * Kick's real thumbnail and duration, asked for rather than guessed.
   *
   * The path segment in a Kick thumbnail URL is per-clip — `parseSourceUrl`
   * builds a plausible one so the shape is right, but only Kick knows the
   * actual value, and the guessed URL 403s. This overwrites it with the truth
   * where we can get it, and leaves the thumbnail empty where we cannot, so
   * the card falls back to a placeholder rather than a broken image.
   *
   * The duration arrives here too. It was previously inserted as a literal
   * zero and never filled in, which is why every clip read 0:00.
   */
  const live =
    parsed.source === 'kick' && parsed.id
      ? await fetchKickClip(parsed.id)
      : { thumbnailUrl: null, videoUrl: null, durationSeconds: null, views: null, title: null, occurredAt: null };

  const thumbUrl = parsed.source === 'kick' ? (live.thumbnailUrl ?? '') : parsed.thumbUrl;
  const videoUrl = parsed.source === 'kick' ? (live.videoUrl ?? '') : '';

  // Kick knows when the clip was taken better than a mod filling in a date
  // field, but a date typed on purpose wins over one inferred.
  const occurredAt = input.occurredAt ?? live.occurredAt ?? new Date().toISOString();

  const inserted = await write<ClipRow>(
    `INSERT INTO clips
       (id, kind, source, url, embed_url, thumb_url, title, aspect,
        duration_seconds, views, occurred_at, pinned, status, slot_name,
        bet_amount, payout_amount, added_by, video_url, max_win)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $16, $17, $9, $10, $11, $12, $13, $14, $15, $18, $19)
     ON CONFLICT (id) DO UPDATE
       SET title         = EXCLUDED.title,
           kind          = EXCLUDED.kind,
           status        = EXCLUDED.status,
           pinned        = EXCLUDED.pinned,
           slot_name     = EXCLUDED.slot_name,
           bet_amount    = EXCLUDED.bet_amount,
           payout_amount = EXCLUDED.payout_amount,
           max_win       = EXCLUDED.max_win,
           occurred_at   = EXCLUDED.occurred_at,
           -- Re-adding a clip is how a mod fixes one whose metadata failed the
           -- first time, so a real thumbnail must be allowed to replace an
           -- empty one — but never the other way round.
           thumb_url     = COALESCE(NULLIF(EXCLUDED.thumb_url, ''), clips.thumb_url),
           video_url     = COALESCE(NULLIF(EXCLUDED.video_url, ''), clips.video_url),
           duration_seconds = GREATEST(EXCLUDED.duration_seconds, clips.duration_seconds),
           views         = COALESCE(EXCLUDED.views, clips.views)
     RETURNING ${COLUMNS}`,
    [
      id,
      input.kind,
      parsed.source,
      input.url.trim(),
      parsed.embedUrl,
      thumbUrl,
      input.title.trim(),
      parsed.aspect,
      occurredAt,
      input.pinned ?? false,
      input.status,
      input.slotName?.trim() || null,
      input.bet ?? null,
      input.payout ?? null,
      input.addedBy ?? null,
      live.durationSeconds ?? 0,
      live.views,
      videoUrl,
      input.maxWin ?? false,
    ],
  );
  return toClip(inserted[0]);
}

export type RefreshReport = { checked: number; fixed: number; failed: string[] };

/**
 * Re-fetch metadata for the Kick clips already stored.
 *
 * Every clip added before the thumbnail was fetched rather than guessed holds
 * a URL built from a hardcoded shard segment, which 403s. Those rows cannot
 * fix themselves — the correct URL is not derivable from anything in the row —
 * so this asks Kick about each one and writes back what it says.
 *
 * Safe to run repeatedly: a clip whose metadata cannot be fetched is left
 * exactly as it was rather than being blanked, so a Kick outage costs nothing.
 */
export async function refreshClipMetadata(): Promise<RefreshReport> {
  const found = await rows<{ id: string; thumb_url: string; duration_seconds: number }>(
    `SELECT id, thumb_url, duration_seconds
       FROM clips
      WHERE source = 'kick' AND id LIKE 'clip\\_%'`,
  );

  const report: RefreshReport = { checked: found.length, fixed: 0, failed: [] };

  for (const row of found) {
    const live = await fetchKickClip(row.id);
    if (!live.thumbnailUrl && live.durationSeconds === null && !live.videoUrl) {
      report.failed.push(row.id);
      continue;
    }

    // The playlist is what makes a clip playable at all, so a row missing it
    // counts as changed even when nothing else moved — that is how clips added
    // before the Kick player stopped serving clips get repaired.
    const changed = await write<{ id: string }>(
      `UPDATE clips
          SET thumb_url        = COALESCE($2, thumb_url),
              duration_seconds = COALESCE($3, duration_seconds),
              views            = COALESCE($4, views),
              video_url        = COALESCE(NULLIF($5, ''), video_url)
        WHERE id = $1
          AND (thumb_url IS DISTINCT FROM COALESCE($2, thumb_url)
               OR duration_seconds IS DISTINCT FROM COALESCE($3, duration_seconds)
               OR video_url IS DISTINCT FROM COALESCE(NULLIF($5, ''), video_url))
        RETURNING id`,
      [row.id, live.thumbnailUrl, live.durationSeconds, live.views, live.videoUrl ?? ''],
    );
    if (changed.length) report.fixed += 1;
  }

  return report;
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

/**
 * Mark a big win as the slot's ceiling, or take the mark off.
 *
 * Only a big win can carry it: the tag sits beside the multiplier on the wall
 * of fame, and a plain clip has neither.
 */
/**
 * One play of one clip.
 *
 * Counts nothing but the play: no viewer, no session, no address. Repeat plays
 * are filtered in the browser rather than here, because telling them apart on
 * the server would mean keeping a record of who watched what, and the question
 * being asked is only how many times.
 *
 * A clip that is not published — or not a clip at all — inserts nothing and
 * comes back zero, so the endpoint needs no separate existence check and an
 * invented id cannot create a row.
 */
export async function recordClipPlay(id: string): Promise<number> {
  const updated = await write<{ plays: number }>(
    `INSERT INTO clip_plays (clip_id, plays, last_play_at)
     SELECT id, 1, now() FROM clips WHERE id = $1 AND status = 'published'
     ON CONFLICT (clip_id) DO UPDATE
       SET plays = clip_plays.plays + 1, last_play_at = now()
     RETURNING plays`,
    [id],
  );
  return updated[0]?.plays ?? 0;
}

export async function setClipMaxWin(id: string, maxWin: boolean): Promise<void> {
  await write(
    `UPDATE clips SET max_win = $2 WHERE id = $1 AND kind = 'big_win'`,
    [id, maxWin],
  );
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
        // Deliberately empty, and this is the fix rather than an omission.
        // `player.kick.com/<channel>?clip=<id>` looks like a clip embed and is
        // not one: the player reads the channel slug, drops the query string
        // and renders the live player, so every Kick clip on the site opened
        // on "MattySpinss is offline". Kick has no clip embed left, so the
        // clip is played from its own HLS playlist instead — fetched in
        // `createClip`, for the same reason as the thumbnail below.
        embedUrl: '',
        // Deliberately empty. The shard segment in a Kick thumbnail URL is
        // per-clip and cannot be derived from the id — the guessed form this
        // used to build 403'd on every clip — so the real one is fetched in
        // `createClip` and an unfetchable clip renders a placeholder instead.
        thumbUrl: '',
        aspect: '16:9',
      };
    }
    return { source: 'kick', id: null, embedUrl: '', thumbUrl: '', aspect: '16:9' };
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
