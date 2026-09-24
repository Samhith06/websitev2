import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { BingoGrid } from '@/components/site/BingoGrid';
import { SlotArt } from '@/components/site/SlotArt';
import { cellLabel, completedLines, lineLabel } from '@/lib/bingo';
import { entriesFor, featuredCard, finishedCards, summarise, turnsFor } from '@/lib/store/bingo';
import { coins, dateShort, money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Slot Bingo',
  description:
    'Slot bingo on MattySpins: call a slot with !sr, get drawn onto a square, and if the buy makes a profit the square is yours.',
};

export const dynamic = 'force-dynamic';

export default async function BingoPage() {
  const [card, history] = await Promise.all([featuredCard(), finishedCards(8)]);
  const [turns, waiting] = card ? await Promise.all([turnsFor(card.id), entriesFor(card.id, 'waiting')]) : [[], []];
  const s = summarise(turns);
  const lines = card ? completedLines(card.size, s.green.keys()) : [];
  const running = card?.status === 'running';
  const past = history.filter((c) => c.id !== card?.id);
  const winners = [...s.green.values()].sort((a, b) => a.position - b.position);

  return (
    <>
      {running ? <AutoRefresh seconds={8} /> : null}

      <div className="sec-head">
        <div>
          <span className="eyebrow">{running ? (lines.length ? 'BINGO!' : 'Live now') : 'Slot bingo'}</span>
          <h1>{card?.title ?? 'Slot Bingo'}</h1>
          <div className="sh-sub">
            {running
              ? 'Live from stream. This page updates itself.'
              : card
                ? `${card.result === 'bingo' ? 'BINGO' : 'Ended'} ${card.finishedAt ? dateShort(card.finishedAt) : ''}. The next bingo starts on stream.`
                : 'No bingo has run yet. The next one starts on stream.'}{' '}
            See also the <Link href="/hunt">bonus hunt</Link>.
          </div>
        </div>
      </div>

      {card ? (
        <>
          <div className="bingo-page">
            <div>
              {lines.length > 0 ? (
                <p className="bingo-banner">BINGO — {lines.map((l) => lineLabel(l, card.size)).join(' and ')}</p>
              ) : null}
              <BingoGrid
                size={card.size}
                green={s.green}
                playing={s.playing}
                onLine={new Set(lines.flatMap((l) => l.positions))}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, minWidth: 0 }}>
              {s.playing ? (
                <div className="card bingo-now">
                  <span className="eyebrow">Now playing · square {cellLabel(s.playing.position, card.size)}</span>
                  <div className="slotcell" style={{ marginTop: 8 }}>
                    <SlotArt src={s.playing.imageUrl} name={s.playing.slotName} fallbackClassName="ph" />
                    <span>
                      <b style={{ fontSize: 16 }}>{s.playing.slotName}</b>
                      <small>called by {s.playing.kickUsername}</small>
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="card">
                <div className="hj-head">
                  <span className={`tag ${running && card.requestsOpen ? 'green' : ''}`}>
                    {running && card.requestsOpen ? 'Open' : 'Closed'}
                  </span>
                  <h3>How to play</h3>
                </div>
                <p className="small muted">
                  Type <code>!sr slot name</code> in Kick chat to join. Each round a random viewer and a random
                  open square are drawn, and your slot is bonus-bought. If it pays back more than it cost, the
                  square turns green and it&apos;s yours
                  {card.squarePrize ? (
                    <>
                      {' '}— worth <b style={{ color: 'var(--gold)' }}>{coins(card.squarePrize)} MC</b> when the bingo ends
                    </>
                  ) : null}
                  . If not, you can <code>!sr</code> again. The first full row, column or diagonal is BINGO. To be
                  paid, your Kick account has to be <Link href="/profile">linked</Link>.
                </p>
                <p className="small" style={{ marginTop: 8 }}>
                  <b>{waiting.length}</b> waiting to be drawn · <b>{s.green.size}</b> of {card.size * card.size}{' '}
                  squares green
                </p>
              </div>

              {winners.length > 0 ? (
                <div className="card">
                  <h3 style={{ fontSize: 15, marginBottom: 8 }}>Green squares</h3>
                  {winners.map((t) => (
                    <div key={t.id} className="bingo-winner">
                      <span className="bg-chip">{cellLabel(t.position, card.size)}</span>
                      <b>{t.kickUsername}</b>
                      <small className="muted">{t.slotName}</small>
                      {t.paid ? <span className="tag gold">+{coins(t.paid)} MC</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {!running && winners.length > 0 && card.squarePrize && winners.some((t) => !t.paid) ? (
            <p className="small muted" style={{ marginTop: 10 }}>
              Squares without a prize tag belonged to viewers whose Kick account wasn&apos;t linked.
            </p>
          ) : null}
        </>
      ) : (
        <div className="emptyq">Nothing to show yet.</div>
      )}

      {past.length > 0 ? (
        <div className="sec" style={{ marginTop: 38 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">History</span>
              <h2>Past bingos</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Bingo</th>
                  <th>Date</th>
                  <th>Card</th>
                  <th>Result</th>
                  <th>Green</th>
                  <th>Buys</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {past.map((c) => {
                  const profit = c.won - c.cost;
                  return (
                    <tr key={c.id}>
                      <td>{c.title}</td>
                      <td className="n" style={{ color: 'var(--muted)' }}>{c.finishedAt ? dateShort(c.finishedAt) : '—'}</td>
                      <td className="n">{c.size}×{c.size}</td>
                      <td>{c.result === 'bingo' ? 'BINGO' : 'Stopped'}</td>
                      <td className="n">{c.green}</td>
                      <td className="n">{c.bought}</td>
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
