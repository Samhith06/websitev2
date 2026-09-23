import 'server-only';
import { one, rows, write } from '@/lib/db';
import { fetchSlotFeed, type FeedSlot } from '@/lib/bonushunt';

/**
 * The slot catalog: what the hunt picks from, what !sr matches against, and
 * what /slots lets anybody browse.
 */

export type Slot = {
  id: number;
  name: string;
  provider: string;
  imageUrl: string | null;
  playUrl: string | null;
  casinos: string[];
  bonusBuy: boolean | null;
  source: 'bonushunt' | 'manual';
  addedAt: string;
};

type Row = {
  id: string;
  name: string;
  provider: string;
  image_url: string | null;
  play_url: string | null;
  casinos: string[];
  bonus_buy: boolean | null;
  source: 'bonushunt' | 'manual';
  added_at: Date;
};

const SELECT = `SELECT id::text, name, provider, image_url, play_url, casinos, bonus_buy, source, added_at FROM slots`;

function toSlot(r: Row): Slot {
  return {
    id: Number(r.id),
    name: r.name,
    provider: r.provider,
    imageUrl: r.image_url,
    playUrl: r.play_url,
    casinos: r.casinos,
    bonusBuy: r.bonus_buy,
    source: r.source,
    addedAt: r.added_at.toISOString(),
  };
}

/** "Sugar Rush 1000!" and "sugar rush 1000" are the same request. */
export function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function keyFor(name: string, provider: string): string {
  return `${normalise(name)}|${normalise(provider)}`;
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

export type SlotQuery = {
  q?: string;
  provider?: string;
  bonusBuy?: boolean;
  sort?: 'new' | 'az';
  page?: number;
  perPage?: number;
};

export async function searchSlots(query: SlotQuery): Promise<{ slots: Slot[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  const q = query.q?.trim();
  if (q) {
    values.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(name ILIKE $${values.length} OR provider ILIKE $${values.length})`);
  }
  if (query.provider) {
    values.push(query.provider);
    where.push(`provider = $${values.length}`);
  }
  if (query.bonusBuy) where.push('bonus_buy IS TRUE');

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = query.sort === 'az' ? 'lower(name) ASC' : 'added_at DESC, lower(name) ASC';
  const perPage = query.perPage ?? 48;
  const page = Math.max(1, query.page ?? 1);

  const [found, count] = await Promise.all([
    rows<Row>(
      `${SELECT} ${clause} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, perPage, (page - 1) * perPage],
    ),
    one<{ n: string }>(`SELECT COUNT(*)::text AS n FROM slots ${clause}`, values),
  ]);
  return { slots: found.map(toSlot), total: Number(count?.n ?? 0) };
}

/** Providers with how many slots each, busiest first — the filter's options. */
export async function providers(): Promise<Array<{ name: string; count: number }>> {
  const found = await rows<{ provider: string; n: string }>(
    `SELECT provider, COUNT(*)::text AS n FROM slots
      WHERE provider <> '' GROUP BY provider ORDER BY COUNT(*) DESC, provider ASC`,
  );
  return found.map((r) => ({ name: r.provider, count: Number(r.n) }));
}

export async function slotById(id: number): Promise<Slot | null> {
  const row = await one<Row>(`${SELECT} WHERE id = $1`, [id]);
  return row ? toSlot(row) : null;
}

/**
 * The best catalog match for whatever a viewer typed after !sr.
 *
 * Exact (ignoring case and punctuation) beats a prefix, which beats a
 * substring, and within each the shortest name wins — "sugar rush" should find
 * Sugar Rush, not Sugar Rush 1000. No match is a normal outcome: the catalog
 * only knows what the feed has shown it, and the request is kept as typed.
 */
export async function matchSlot(text: string): Promise<Slot | null> {
  const needle = normalise(text);
  if (needle.length < 2) return null;
  const row = await one<Row & { rank: number }>(
    `SELECT * FROM (
       SELECT id::text, name, provider, image_url, play_url, casinos, bonus_buy, source, added_at,
              CASE
                WHEN regexp_replace(lower(name), '[^a-z0-9]', '', 'g') = $1 THEN 0
                WHEN regexp_replace(lower(name), '[^a-z0-9]', '', 'g') LIKE $1 || '%' THEN 1
                WHEN regexp_replace(lower(name), '[^a-z0-9]', '', 'g') LIKE '%' || $1 || '%' THEN 2
              END AS rank
         FROM slots
     ) m
     WHERE rank IS NOT NULL
     ORDER BY rank, length(name), added_at DESC
     LIMIT 1`,
    [needle],
  );
  return row ? toSlot(row) : null;
}

export async function catalogStats(): Promise<{
  total: number;
  providers: number;
  lastSyncedAt: string | null;
}> {
  const row = await one<{ total: string; providers: string; synced: Date | null }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(DISTINCT NULLIF(provider, ''))::text AS providers,
            MAX(updated_at) FILTER (WHERE source = 'bonushunt') AS synced
       FROM slots`,
  );
  return {
    total: Number(row?.total ?? 0),
    providers: Number(row?.providers ?? 0),
    lastSyncedAt: row?.synced?.toISOString() ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Merge a batch from the feed.
 *
 * The same game arrives once per casino, so rows are merged by key in memory
 * first — Postgres refuses an upsert that touches one row twice. On conflict
 * casinos are unioned and missing art filled in, but a manual row's name is
 * never overwritten: somebody typed that on purpose.
 */
async function upsertFeed(feed: FeedSlot[]): Promise<number> {
  const merged = new Map<string, FeedSlot & { key: string }>();
  for (const slot of feed) {
    const key = keyFor(slot.name, slot.provider);
    const seen = merged.get(key);
    if (!seen) {
      merged.set(key, { ...slot, key, casinos: [...slot.casinos] });
      continue;
    }
    seen.casinos = [...new Set([...seen.casinos, ...slot.casinos])];
    seen.imageUrl ??= slot.imageUrl;
    seen.playUrl ??= slot.playUrl;
    seen.bonusBuy ??= slot.bonusBuy;
    if (slot.addedAt < seen.addedAt) seen.addedAt = slot.addedAt;
  }
  if (merged.size === 0) return 0;

  const payload = [...merged.values()].map((s) => ({
    key: s.key,
    name: s.name,
    provider: s.provider,
    image_url: s.imageUrl,
    play_url: s.playUrl,
    casinos: s.casinos,
    bonus_buy: s.bonusBuy,
    added_at: s.addedAt,
  }));

  await write(
    `INSERT INTO slots (key, name, provider, image_url, play_url, casinos, bonus_buy, source, added_at)
     SELECT key, name, provider, image_url, play_url, casinos, bonus_buy, 'bonushunt', added_at
       FROM jsonb_to_recordset($1::jsonb) AS x(
         key text, name text, provider text, image_url text, play_url text,
         casinos text[], bonus_buy boolean, added_at timestamptz)
     ON CONFLICT (key) DO UPDATE SET
       casinos    = ARRAY(SELECT DISTINCT unnest(slots.casinos || EXCLUDED.casinos) ORDER BY 1),
       image_url  = COALESCE(slots.image_url, EXCLUDED.image_url),
       play_url   = COALESCE(slots.play_url, EXCLUDED.play_url),
       bonus_buy  = COALESCE(EXCLUDED.bonus_buy, slots.bonus_buy),
       updated_at = now()`,
    [JSON.stringify(payload)],
  );
  return merged.size;
}

export type SyncResult =
  | { ok: true; seen: number; pages: number; truncated: boolean; total: number }
  | { ok: false; detail: string };

export async function syncCatalog(): Promise<SyncResult> {
  const feed = await fetchSlotFeed();
  if (!feed.ok) return feed;
  const seen = await upsertFeed(feed.slots);
  const { total } = await catalogStats();
  return { ok: true, seen, pages: feed.pages, truncated: feed.truncated, total };
}

export class SlotError extends Error {}

export async function addManualSlot(input: {
  name: string;
  provider: string;
  imageUrl: string | null;
  bonusBuy: boolean | null;
}): Promise<Slot> {
  const name = input.name.trim();
  const provider = input.provider.trim();
  if (!normalise(name)) throw new SlotError('Give the slot a name.');
  if (input.imageUrl) {
    try {
      if (new URL(input.imageUrl).protocol !== 'https:') throw new Error();
    } catch {
      throw new SlotError('The image has to be an https:// link.');
    }
  }
  const [row] = await write<Row>(
    `INSERT INTO slots (key, name, provider, image_url, bonus_buy, source)
     VALUES ($1, $2, $3, $4, $5, 'manual')
     ON CONFLICT (key) DO NOTHING
     RETURNING id::text, name, provider, image_url, play_url, casinos, bonus_buy, source, added_at`,
    [keyFor(name, provider), name, provider, input.imageUrl, input.bonusBuy],
  );
  if (!row) throw new SlotError(`${name}${provider ? ` by ${provider}` : ''} is already in the catalog.`);
  return toSlot(row);
}

export async function deleteSlot(id: number): Promise<void> {
  await write('DELETE FROM slots WHERE id = $1', [id]);
}
