import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { KothThrone } from '@/components/site/KothThrone';
import { score } from '@/lib/koth';
import { featuredGame, finishedGames, kothEntriesFor, kothTurnsFor, summariseKoth } from '@/lib/store/koth';
import { coins, dateShort, money, mult } from '@/lib/format';

export const metadata: Metadata = {
  title: 'King of the Hill',
  description:
    'King of the hill on MattySpins: call a slot with !sr, get drawn, and if your bonus buy beats the king’s multiplier the hill is yours.',
};

export const dynamic = 'force-dynamic';

export default async function KothPage() {
  const [game, history] = await Promise.all([featuredGame(), finishedGames(8)]);
  const [turns, waiting] = game
    ? await Promise.all([kothTurnsFor(game.id), kothEntriesFor(game.id, 'waiting')])
    : [[], []];
  const s = summariseKoth(turns);
  const running = game?.status === 'running';
  const past = history.filter((g) => g.id !== game?.id);
  const played = turns.filter((t) => t.status === 'played');

  return (
    <>
      {running ? <AutoRefresh seconds={8} /> : null}

      <div className="sec-head">
        <div>
          <span className="eyebrow">{running ? 'Live now' : 'King of the hill'}</span>
          <h1>{game?.title ?? 'King of the Hill'}</h1>
          <div className="sh-sub">
            {running
              ? 'Live from stream. This page updates itself.'
              : game
                ? `Ended ${game.finishedAt ? dateShort(game.finishedAt) : ''}. The next game starts on stream.`
                : 'No king of the hill has run yet. The next one starts on stream.'}{' '}
            See also the <Link href="/hunt">bonus hunt</Link>.
          </div>
        </div>
      </div>

      {game ? (
        <div className="koth-page">
          <div style={{ minWidth: 0 }}>
            {!running && s.king ? (
              <p className="bingo-banner">
                ♛ {s.king.kickUsername} is king with {mult(score(s.king) ?? 0)}
                {s.king.paid ? ` · +${coins(s.king.paid)} MC` : ''}
              </p>
            ) : null}
            <KothThrone s={s} />

            {played.length > 0 ? (
              <div className="card" style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Every challenger</h3>
                {[...played].reverse().map((t) => (
                  <div key={t.id} className="bingo-winner">
                    <span className={`bg-chip ${s.king?.id === t.id ? 'koth-chip-king' : s.crowned.has(t.id) ? '' : 'koth-chip-short'}`}>
                      {mult(score(t) ?? 0)}
                    </span>
                    <b>{t.kickUsername}</b>
                    <small className="muted">{t.slotName}</small>
                    {s.king?.id === t.id ? (
                      <span className="tag gold">♛ King</span>
                    ) : s.crowned.has(t.id) ? (
                      <span className="tag green">Took the hill</span>
                    ) : s.tied.has(t.id) ? (
                      <span className="tag">Tied — king holds</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, minWidth: 0 }}>
            <div className="card">
              <div className="hj-head">
                <span className={`tag ${running && game.requestsOpen ? 'green' : ''}`}>
                  {running && game.requestsOpen ? 'Open' : 'Closed'}
                </span>
                <h3>How to play</h3>
              </div>
              <p className="small muted">
                Type <code>!sr slot name</code> in Kick chat to join. Each round a random viewer is drawn and
                their slot is bonus-bought. The first buy takes the hill; after that, a buy takes it only by
                beating the king&apos;s multiplier — a tie isn&apos;t enough. Whether you win the hill or fall
                short, you can <code>!sr</code> again, and you go back in once everyone waiting has had a go.
                When the stream ends the game, whoever holds the hill
                {game.prize ? (
                  <>
                    {' '}wins <b style={{ color: 'var(--gold)' }}>{coins(game.prize)} MC</b>
                  </>
                ) : (
                  ' is king'
                )}
                . To be paid, your Kick account has to be <Link href="/profile">linked</Link>.
              </p>
              <p className="small" style={{ marginTop: 8 }}>
                {running ? (
                  <>
                    <b>{waiting.length}</b> waiting to be drawn ·{' '}
                  </>
                ) : null}
                <b>{s.bought}</b> challenger{s.bought === 1 ? '' : 's'} so far
                {s.dethroned ? (
                  <>
                    {' '}· hill changed hands <b>{s.dethroned}</b> time{s.dethroned === 1 ? '' : 's'}
                  </>
                ) : null}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="emptyq">Nothing to show yet.</div>
      )}

      {past.length > 0 ? (
        <div className="sec" style={{ marginTop: 38 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">History</span>
              <h2>Past kings</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Date</th>
                  <th>King</th>
                  <th>Multi</th>
                  <th>Challengers</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {past.map((g) => {
                  const profit = g.won - g.cost;
                  return (
                    <tr key={g.id}>
                      <td>{g.title}</td>
                      <td className="n" style={{ color: 'var(--muted)' }}>{g.finishedAt ? dateShort(g.finishedAt) : '—'}</td>
                      <td>
                        {g.king ? (
                          <>
                            <b>{g.king}</b> <small className="muted">{g.kingSlot}</small>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="n">{g.best == null ? '—' : mult(g.best)}</td>
                      <td className="n">{g.bought}</td>
                      <td className="n" style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {profit >= 0 ? '+' : ''}
                        {money(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
