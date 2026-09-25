import type { Metadata } from 'next';
import Link from 'next/link';
import { SlotArt } from '@/components/site/SlotArt';
import {
  bonusesFor,
  featuredHunt,
  finishedHunts,
  guessesFor,
  huntStats,
  requestsFor,
} from '@/lib/store/hunts';
import { coins, dateShort, money, mult } from '@/lib/format';
import { AutoRefresh } from '@/components/site/AutoRefresh';

export const metadata: Metadata = {
  title: 'Bonus Hunt',
  description:
    'The live bonus hunt on MattySpins: every bonus, what it paid, the running profit, slot requests from chat and guess the balance.',
};

export const dynamic = 'force-dynamic';

const PHASE = {
  collecting: 'Collecting bonuses',
  opening: 'Opening now',
  finished: 'Finished',
} as const;

export default async function HuntPage() {
  const [hunt, history] = await Promise.all([featuredHunt(), finishedHunts(8)]);
  const [bonuses, requests, guesses] = hunt
    ? await Promise.all([bonusesFor(hunt.id), requestsFor(hunt.id, 'pending'), guessesFor(hunt.id)])
    : [[], [], []];
  const stats = hunt ? huntStats(hunt, bonuses) : null;
  const live = hunt != null && hunt.status !== 'finished';

  // The bonus being opened is the first without a payout, in hunt order.
  const current = hunt?.status === 'opening' ? bonuses.find((b) => b.payout == null) : undefined;

  const final = hunt?.finalBalance;
  const closest =
    hunt?.gtbStatus === 'settled' && final != null
      ? [...guesses].sort((a, b) => Math.abs(a.guess - final) - Math.abs(b.guess - final)).slice(0, 10)
      : [];

  return (
    <>
      {live ? <AutoRefresh seconds={10} /> : null}

      <div className="sec-head">
        <div>
          <span className="eyebrow">{hunt ? PHASE[hunt.status] : 'Bonus hunt'}</span>
          <h1>{hunt?.title ?? 'Bonus Hunt'}</h1>
          <div className="sh-sub">
            {live
              ? 'Live from stream. This page updates itself.'
              : hunt
                ? `Finished ${hunt.finishedAt ? dateShort(hunt.finishedAt) : ''}. The next hunt starts on stream.`
                : 'No hunt has run yet. The next one starts on stream.'}{' '}
            Browse the <Link href="/slots">slot catalog</Link>, or follow <Link href="/bingo">slot bingo</Link>.
          </div>
        </div>
      </div>

      {hunt && stats ? (
        <>
          <div className="statgrid" style={{ marginBottom: 18 }}>
            <Stat label="Start" value={money(hunt.startCost)} />
            <Stat label="Bonuses" value={`${stats.opened}/${stats.bonuses}`} sub={`${money(stats.totalBet)} in bets`} />
            <Stat label="Won" value={money(stats.won)} tone="g" />
            <Stat
              label="Profit"
              value={`${stats.profit >= 0 ? '+' : ''}${money(stats.profit)}`}
              tone={stats.profit >= 0 ? 'g' : undefined}
            />
            <Stat label="Average" value={stats.averageX == null ? '—' : mult(stats.averageX)} />
            <Stat
              label="Break-even"
              value={stats.breakEvenX == null ? '—' : mult(stats.breakEvenX)}
              sub={stats.breakEvenX == null ? undefined : 'needed on what is left'}
              tone="b"
            />
            {stats.best && stats.best.payout != null ? (
              <Stat
                label="Best win"
                value={mult(stats.best.payout / stats.best.bet)}
                sub={`${stats.best.slotName} · ${money(stats.best.payout)}`}
                tone="g"
              />
            ) : null}
          </div>

          {/* Taking part -------------------------------------------------- */}
          <div className="huntjoin">
            <div className="card">
              <div className="hj-head">
                <span className={`tag ${hunt.status === 'collecting' && hunt.requestsOpen ? 'green' : ''}`}>
                  {hunt.status === 'collecting' && hunt.requestsOpen ? 'Open' : 'Closed'}
                </span>
                <h3>Suggest a slot</h3>
              </div>
              <p className="small muted">
                Type <code>!sr slot name</code> in Kick chat while bonuses are being collected.
                Suggest as many slots as you like — each one joins the queue.
              </p>
            </div>
            <div className="card">
              <div className="hj-head">
                <span
                  className={`tag ${hunt.gtbStatus === 'open' ? 'green' : hunt.gtbStatus === 'settled' ? 'gold' : ''}`}
                >
                  {hunt.gtbStatus === 'open' ? 'Open' : hunt.gtbStatus === 'settled' ? 'Settled' : hunt.gtbStatus === 'locked' ? 'Locked' : 'Not open'}
                </span>
                <h3>Guess the balance</h3>
              </div>
              <p className="small muted">
                Type <code>!gtb 1234.56</code> in chat to guess what the hunt pays back in total.
                Closest guess wins{hunt.gtbPrize ? <> <b style={{ color: 'var(--gold)' }}>{coins(hunt.gtbPrize)} MC</b></> : null}.
                Your latest guess counts until guessing locks. To be paid, your Kick account has to be{' '}
                <Link href="/profile">linked</Link>.
              </p>
              <p className="small" style={{ marginTop: 8 }}>
                <b>{coins(guesses.length)}</b> {guesses.length === 1 ? 'guess' : 'guesses'}
                {hunt.gtbStatus === 'settled' && final != null ? (
                  <>
                    {' '}· final balance <b>{money(final)}</b> ·{' '}
                    {hunt.gtbWinner ? (
                      <>
                        winner <b style={{ color: 'var(--gold)' }}>{hunt.gtbWinner.name}</b>
                      </>
                    ) : (
                      'no linked account guessed'
                    )}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {/* The bonuses -------------------------------------------------- */}
          <div className="sec">
            <h2 style={{ fontSize: 17, marginBottom: 12 }}>Bonuses</h2>
            {bonuses.length === 0 ? (
              <div className="emptyq">No bonuses collected yet.</div>
            ) : (
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Slot</th>
                      <th>Bet</th>
                      <th>Payout</th>
                      <th>Multi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonuses.map((b, i) => {
                      const isBest = stats.best?.id === b.id;
                      return (
                        <tr key={b.id} className={b.id === current?.id ? 'huntnow' : undefined}>
                          <td className="n" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                          <td>
                            <div className="slotcell">
                              <SlotArt src={b.imageUrl} name={b.slotName} fallbackClassName="ph" />
                              <span>
                                <b>
                                  {b.slotName}
                                  {b.id === current?.id ? <span className="tag blue" style={{ marginLeft: 8 }}>Opening</span> : null}
                                  {isBest ? <span className="tag gold" style={{ marginLeft: 8 }}>Best</span> : null}
                                </b>
                                <small>
                                  {b.provider || '—'}
                                  {b.requestedBy ? ` · requested by ${b.requestedBy}` : ''}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td className="n">{money(b.bet)}</td>
                          <td className="n">{b.payout == null ? '—' : money(b.payout)}</td>
                          <td
                            className="n"
                            style={{
                              color:
                                b.payout == null
                                  ? 'var(--muted)'
                                  : b.payout / b.bet >= 100
                                    ? 'var(--gold)'
                                    : b.payout / b.bet < 20
                                      ? 'var(--muted)'
                                      : undefined,
                            }}
                          >
                            {b.payout == null ? '—' : mult(b.payout / b.bet)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {hunt.status === 'collecting' && requests.length > 0 ? (
            <div className="sec" style={{ marginTop: 26 }}>
              <h2 style={{ fontSize: 17, marginBottom: 12 }}>Suggested by chat</h2>
              <div className="reqgrid">
                {requests.map((r) => (
                  <div className="slotcell reqcard" key={r.id}>
                    <SlotArt src={r.imageUrl} name={r.slotName ?? r.query} fallbackClassName="ph" />
                    <span>
                      <b>{r.slotName ?? r.query}</b>
                      <small>{r.kickUsername}</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {closest.length > 0 ? (
            <div className="sec" style={{ marginTop: 26 }}>
              <h2 style={{ fontSize: 17, marginBottom: 12 }}>Closest guesses</h2>
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>Chatter</th>
                      <th>Guess</th>
                      <th>Off by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closest.map((g) => (
                      <tr key={g.kickUserId}>
                        <td>
                          {g.kickUsername}
                          {hunt.gtbWinner?.kickUserId === g.kickUserId ? (
                            <span className="tag gold" style={{ marginLeft: 8 }}>Winner</span>
                          ) : !g.linked ? (
                            <span className="small muted" style={{ marginLeft: 8 }}>not linked</span>
                          ) : null}
                        </td>
                        <td className="n">{money(g.guess)}</td>
                        <td className="n">{money(Math.abs(g.guess - (final ?? 0)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="emptyq">Nothing to show yet.</div>
      )}

      {history.filter((h) => h.id !== hunt?.id).length > 0 ? (
        <div className="sec" style={{ marginTop: 38 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">History</span>
              <h2>Past hunts</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Hunt</th>
                  <th>Date</th>
                  <th>Bonuses</th>
                  <th>Start</th>
                  <th>Won</th>
                  <th>Profit</th>
                  <th>Best</th>
                </tr>
              </thead>
              <tbody>
                {history
                  .filter((h) => h.id !== hunt?.id)
                  .map((h) => {
                    const profit = h.won - h.startCost;
                    return (
                      <tr key={h.id}>
                        <td>{h.title}</td>
                        <td className="n" style={{ color: 'var(--muted)' }}>
                          {h.finishedAt ? dateShort(h.finishedAt) : '—'}
                        </td>
                        <td className="n">{h.bonuses}</td>
                        <td className="n">{money(h.startCost)}</td>
                        <td className="n">{money(h.won)}</td>
                        <td className="n" style={{ color: profit >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {profit >= 0 ? '+' : ''}
                          {money(profit)}
                        </td>
                        <td className="n">{h.bestX == null ? '—' : mult(h.bestX)}</td>
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

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'g' | 'b';
}) {
  return (
    <div className="stat">
      <div className="sl">{label}</div>
      <div className={`sv ${tone ?? ''}`}>{value}</div>
      {sub ? <div className="sm">{sub}</div> : null}
    </div>
  );
}
