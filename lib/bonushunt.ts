import 'server-only';

/**
 * BonusHunt.gg, as a source of slot data.
 *
 * Only one endpoint is used: the public slot-updates feed behind their "New
 * Slots" page. It needs no key and lists every game each tracked casino added
 * in the last week — name, provider, art, a play link and which casinos carry
 * it. That is a rolling window, not a whole catalog, so the sync accumulates
 * into `slots` rather than mirroring it: a slot that ages out of the feed is
 * still a slot.
 *
 * Their keyed API (`Authorization: Bearer …`, key issued from the signed-in
 * /api page) is not used. Nothing here needs it, and its docs are only
 * readable signed in, so any shape assumed for it would be a guess.
 */

const FEED = 'https://bonushunt.gg/api/public/slots/updates';

/**
 * A ceiling on pages per sync. The window is about a thousand games at 48 a
 * page, so this is headroom rather than a limit anybody should reach — it
 * exists so a feed that kept answering `hasMore: true` could not turn one
 * scheduled sync into an unbounded crawl of somebody else's API.
 */
const MAX_PAGES = 60;

export type FeedSlot = {
  name: string;
  provider: string;
  imageUrl: string | null;
  playUrl: string | null;
  casinos: string[];
  bonusBuy: boolean | null;
  addedAt: string;
};

type FeedItem = {
  slotName?: unknown;
  provider?: unknown;
  image?: unknown;
  url?: unknown;
  casinos?: unknown;
  bonusBuy?: unknown;
  addedAt?: unknown;
};

type FeedPage = { items?: FeedItem[]; hasMore?: boolean };

export type FeedResult =
  | { ok: true; slots: FeedSlot[]; pages: number; truncated: boolean }
  | { ok: false; detail: string };

function toSlot(item: FeedItem): FeedSlot | null {
  const name = typeof item.slotName === 'string' ? item.slotName.trim() : '';
  if (!name) return null;
  const provider = typeof item.provider === 'string' ? item.provider.trim() : '';
  const addedAt =
    typeof item.addedAt === 'string' && !Number.isNaN(Date.parse(item.addedAt))
      ? item.addedAt
      : new Date().toISOString();
  return {
    name,
    provider: provider === 'N/A' ? '' : provider,
    imageUrl: httpsOrNull(item.image),
    playUrl: httpsOrNull(item.url),
    casinos: Array.isArray(item.casinos)
      ? item.casinos.filter((c): c is string => typeof c === 'string')
      : [],
    bonusBuy: typeof item.bonusBuy === 'boolean' ? item.bonusBuy : null,
    addedAt,
  };
}

/** Art and links end up in `src` and `href` on our pages, so only https. */
function httpsOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** Walks the feed a page at a time. A failure anywhere returns nothing. */
export async function fetchSlotFeed(): Promise<FeedResult> {
  const slots: FeedSlot[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    let body: FeedPage;
    try {
      const response = await fetch(`${FEED}?tab=added&offset=${offset}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return { ok: false, detail: `BonusHunt answered ${response.status} on page ${page + 1}.` };
      }
      body = (await response.json()) as FeedPage;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      return { ok: false, detail: `BonusHunt could not be reached: ${reason}` };
    }

    const items = Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      const slot = toSlot(item);
      if (slot) slots.push(slot);
    }

    if (!body.hasMore || items.length === 0) {
      return { ok: true, slots, pages: page + 1, truncated: false };
    }
    offset += items.length;
  }

  return { ok: true, slots, pages: MAX_PAGES, truncated: true };
}
