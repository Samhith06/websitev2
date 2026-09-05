import { allRaffles } from '@/lib/store/raffles';
import { coins, dateShort, dateTime, money } from '@/lib/format';
import { CloseRaffleButton, DrawRaffleButton } from '@/components/admin/AdminButtons';
import { AddRaffleForm } from '@/components/admin/RaffleForm';
import { auth } from '@/auth';
import { devBypass, roleFor } from '@/lib/admin';

export const metadata = { title: 'Raffles' };
export const dynamic = 'force-dynamic';

export default async function AdminRafflesPage() {
  const session = devBypass() ? null : await auth();
  const isOwner = devBypass() || roleFor(session?.user?.discordId ?? null) === 'owner';

  const raffles = await allRaffles();
  const open = raffles.filter((r) => r.status === 'open' || r.status === 'closed');
  const drawn = raffles.filter((r) => r.status === 'drawn');

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{open.length} open</span>
          <h1>Raffles</h1>
          <div className="sh-sub">
            The draw seed hash is published when a raffle opens, and the seed itself revealed after
            the draw.
          </div>
        </div>
      </div>

      {isOwner ? <AddRaffleForm /> : null}

      {open.length === 0 ? (
        <div className="emptyq">No raffles are open.</div>
      ) : (
        open.map((raffle) => (
          <div className="qrow" key={raffle.id}>
            <div>
              <div className="qm">{raffle.title}</div>
              <div className="qd">
                {raffle.valueLabel ? `${raffle.valueLabel} · ` : ''}
                <b>{coins(raffle.entryCount)}</b> entries ·{' '}
                {raffle.cost === 0 ? 'free entry' : `${coins(raffle.cost)} coins`} · max{' '}
                <b>{raffle.maxEntries}</b> · closes {dateTime(raffle.closesAt)}
                <br />
                seed hash{' '}
                <b style={{ fontSize: '10.5px' }} title={raffle.drawSeedHash}>
                  {raffle.drawSeedHash.slice(0, 20)}…
                </b>{' '}
                · published
              </div>
            </div>
            <div className="qacts">
              {raffle.status === 'open' ? <CloseRaffleButton raffleId={raffle.id} /> : null}
              <DrawRaffleButton raffleId={raffle.id} title={raffle.title} />
            </div>
          </div>
        ))
      )}

      <div className="sec" style={{ marginTop: 26 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Recently drawn</h2>
        {drawn.length === 0 ? (
          <div className="emptyq">Nothing drawn yet.</div>
        ) : (
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Prize</th>
                  <th>Winner</th>
                  <th>Entries</th>
                  <th>Drawn</th>
                  <th>Seed</th>
                </tr>
              </thead>
              <tbody>
                {drawn.map((raffle) => (
                  <tr key={raffle.id}>
                    <td>{raffle.title}</td>
                    <td className="n">{raffle.winnerUsername ?? '—'}</td>
                    <td className="n">{coins(raffle.entryCount)}</td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {raffle.drawnAt ? dateShort(raffle.drawnAt) : '—'}
                    </td>
                    <td
                      className="n"
                      style={{ color: 'var(--muted)', fontSize: 11 }}
                      title={raffle.drawSeed ?? undefined}
                    >
                      {raffle.drawSeed ? 'revealed' : 'sealed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Full winner names are shown here because staff need them to deliver the prize. The public
        page masks them, as it does everywhere else.
      </p>
    </>
  );
}
