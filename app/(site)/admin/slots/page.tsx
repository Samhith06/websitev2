import Link from 'next/link';
import { SlotArt } from '@/components/site/SlotArt';
import { catalogStats, searchSlots } from '@/lib/store/slots';
import { coins, dateShort, relativeTime } from '@/lib/format';
import { AddSlotForm, RemoveSlotButton, SyncSlotsButton } from '@/components/admin/SlotControls';

export const metadata = { title: 'Slot catalog' };
export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

export default async function AdminSlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const page = Math.max(1, Number(params.page) || 1);

  const [stats, { slots, total }] = await Promise.all([
    catalogStats(),
    searchSlots({ q, page, perPage: PER_PAGE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => `/admin/slots?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{coins(stats.total)} slots · {coins(stats.providers)} providers</span>
          <h1>Slot catalog</h1>
          <div className="sh-sub">
            Synced from BonusHunt.gg&rsquo;s new-slots feed, which covers the last seven days, so the
            catalog grows with every sync.{' '}
            {stats.lastSyncedAt ? `Last synced ${relativeTime(stats.lastSyncedAt)}.` : 'Never synced.'}{' '}
            Public page: <Link href="/slots">/slots</Link>.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <SyncSlotsButton />
        <p className="small muted" style={{ marginTop: 10 }}>
          To keep it current without pressing this, point a scheduler at{' '}
          <code>POST /api/slots/sync</code> once a day with <code>Authorization: Bearer CRON_SECRET</code>.
        </p>
      </div>

      <AddSlotForm />

      <form className="ufilters" action="/admin/slots">
        <label className="uf-pick uf-search">
          <span>Search</span>
          <input className="inp s" name="q" defaultValue={q} placeholder="Slot or provider…" />
        </label>
        <button className="btn sm" type="submit">Search</button>
      </form>

      {slots.length === 0 ? (
        <div className="emptyq">
          {q ? `Nothing matches “${q}”.` : 'The catalog is empty. Sync it from BonusHunt above.'}
        </div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Slot</th>
                <th>Casinos</th>
                <th>Source</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.id}>
                  <td>
                    <div className="slotcell">
                      <SlotArt src={slot.imageUrl} name={slot.name} fallbackClassName="ph" />
                      <span>
                        <b>{slot.name}</b>
                        <small>
                          {slot.provider || '—'}
                          {slot.bonusBuy ? ' · bonus buy' : ''}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td className="n" style={{ color: 'var(--muted)', maxWidth: 220 }}>
                    {slot.casinos.length ? slot.casinos.join(', ') : '—'}
                  </td>
                  <td className="n" style={{ color: 'var(--muted)' }}>{slot.source}</td>
                  <td className="n" style={{ color: 'var(--muted)' }}>{dateShort(slot.addedAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <RemoveSlotButton slotId={slot.id} name={slot.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="small" style={{ display: 'flex', gap: 14, marginTop: 14, alignItems: 'center' }}>
          {page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : null}
          <span className="muted">
            Page {page} of {pages} · {coins(total)} slots
          </span>
          {page < pages ? <Link href={href(page + 1)}>Next →</Link> : null}
        </div>
      ) : null}
    </>
  );
}
