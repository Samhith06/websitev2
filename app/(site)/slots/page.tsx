import type { Metadata } from 'next';
import Link from 'next/link';
import { catalogStats, providers as listProviders, searchSlots } from '@/lib/store/slots';
import { coins, relativeTime } from '@/lib/format';
import { SlotFilters } from '@/components/site/SlotFilters';
import { SlotArt } from '@/components/site/SlotArt';

export const metadata: Metadata = {
  title: 'Slot Catalog',
  description:
    'Every slot MattySpins can hunt, with the newest releases across the big crypto casinos. Suggest one in Kick chat with !sr.',
};

export const dynamic = 'force-dynamic';

const PER_PAGE = 48;
const WEEK = 7 * 86_400_000;

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; provider?: string; buy?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const provider = params.provider ?? '';
  const bonusBuy = params.buy === '1';
  const sort = params.sort === 'az' ? 'az' : 'new';
  const page = Math.max(1, Number(params.page) || 1);

  const [stats, providers, { slots, total }] = await Promise.all([
    catalogStats(),
    listProviders(),
    searchSlots({ q, provider: provider || undefined, bonusBuy, sort, page, perPage: PER_PAGE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (p: number) => {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (provider) query.set('provider', provider);
    if (bonusBuy) query.set('buy', '1');
    if (sort !== 'new') query.set('sort', sort);
    query.set('page', String(p));
    return `/slots?${query}`;
  };

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {coins(stats.total)} slots · {coins(stats.providers)} providers
          </span>
          <h1>Slot Catalog</h1>
          <div className="sh-sub">
            Want one in the next <Link href="/hunt">bonus hunt</Link>? Type <code>!sr slot name</code>{' '}
            in Kick chat while bonuses are being collected. New releases come from{' '}
            <a href="https://bonushunt.gg/new-slots" target="_blank" rel="noreferrer noopener">
              BonusHunt.gg
            </a>
            {stats.lastSyncedAt ? `, last updated ${relativeTime(stats.lastSyncedAt)}` : ''}.
          </div>
        </div>
      </div>

      <SlotFilters q={q} provider={provider} bonusBuy={bonusBuy} sort={sort} providers={providers} />

      {slots.length === 0 ? (
        <div className="emptyq">
          {stats.total === 0
            ? 'The catalog is still being filled. Check back after the next sync.'
            : 'No slots match that. Try fewer filters.'}
        </div>
      ) : (
        <div className="slotgrid">
          {slots.map((slot) => {
            const isNew = Date.now() - new Date(slot.addedAt).getTime() < WEEK && slot.source === 'bonushunt';
            return (
              <div className="slotcard" key={slot.id}>
                <div className="sc-art">
                  <SlotArt src={slot.imageUrl} name={slot.name} fallbackClassName="sc-none" lazy />
                  <div className="sc-tags">
                    {isNew ? <span className="tag blue">New</span> : null}
                    {slot.bonusBuy ? <span className="tag gold">Buy</span> : null}
                  </div>
                </div>
                <div className="sc-body">
                  <b title={slot.name}>{slot.name}</b>
                  <small>{slot.provider || 'Unknown provider'}</small>
                  {slot.casinos.length ? (
                    <small className="sc-casinos" title={slot.casinos.join(', ')}>
                      {slot.casinos.length === 1 ? slot.casinos[0] : `${slot.casinos.length} casinos`}
                    </small>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 ? (
        <div className="small" style={{ display: 'flex', gap: 14, marginTop: 18, alignItems: 'center', justifyContent: 'center' }}>
          {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : null}
          <span className="muted">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)}>Next →</Link> : null}
        </div>
      ) : null}
    </>
  );
}
