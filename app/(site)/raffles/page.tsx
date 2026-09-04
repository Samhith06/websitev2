import type { Metadata } from 'next';
import { currentUser } from '@/lib/player';
import { drawnRaffles, entriesFor, openRaffles } from '@/lib/store/raffles';
import { dateShort, maskUsername } from '@/lib/format';
import { RaffleCard } from '@/components/site/RaffleCard';

export const metadata: Metadata = {
  title: 'Raffles',
  description:
    'Open raffles and giveaways on MattySpins. Some are free to enter, some cost coins, and every winner is drawn from a seed committed before entries closed.',
};

export const dynamic = 'force-dynamic';

export default async function RafflesPage() {
  const user = await currentUser();
  const [open, past, mine] = await Promise.all([
    openRaffles(),
    drawnRaffles(8),
    user ? entriesFor(user.id) : Promise.resolve(new Map<number, number>()),
  ]);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Open now</span>
          <h1>Raffles &amp; Giveaways</h1>
          <div className="sh-sub">
            Some are free to enter, some cost coins. Winners drawn live on stream.
          </div>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="emptyq">
          Nothing open right now. New raffles are announced on stream and in Discord.
        </div>
      ) : (
        <div className="rgrid">
          {open.map((raffle) => (
            <RaffleCard
              key={raffle.id}
              raffle={raffle}
              signedIn={Boolean(user)}
              entries={mine.get(raffle.id) ?? 0}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* The commitment, stated plainly. This is the reason the draw seed    */}
      {/* exists at all, so it belongs on the page rather than in a FAQ.      */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="card"
        style={{
          marginTop: 16,
          borderColor: 'var(--edge-hot)',
          background: 'linear-gradient(100deg,rgba(34,211,255,.05),var(--panel) 60%)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span className="tag blue">Provably fair</span>
          <div className="small muted" style={{ flex: 1 }}>
            Every raffle is given a random draw seed when it is created, and the hash of that seed is
            published before anyone enters. When entries close the winner is chosen by hashing that
            seed against the ordered list of entries, and the seed itself is revealed. Because the
            hash was public first, nobody — including us — could have known or changed who would win.
          </div>
        </div>
      </div>

      {past.length > 0 ? (
        <div className="sec" style={{ marginTop: 38 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">Proof it&rsquo;s real</span>
              <h2>Recent winners</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Prize</th>
                  <th>Winner</th>
                  <th>Drawn</th>
                  <th>Draw seed</th>
                </tr>
              </thead>
              <tbody>
                {past.map((raffle) => (
                  <tr key={raffle.id}>
                    <td>{raffle.title}</td>
                    <td className="n">
                      {raffle.winnerUsername ? maskUsername(raffle.winnerUsername) : '—'}
                    </td>
                    <td className="n" style={{ color: 'var(--muted)' }}>
                      {raffle.drawnAt ? dateShort(raffle.drawnAt) : '—'}
                    </td>
                    <td
                      className="n"
                      style={{ color: 'var(--muted-2)', fontSize: 11, maxWidth: 220 }}
                      title={raffle.drawSeed ?? undefined}
                    >
                      {raffle.drawSeed ? `${raffle.drawSeed.slice(0, 16)}…` : 'Not revealed'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
