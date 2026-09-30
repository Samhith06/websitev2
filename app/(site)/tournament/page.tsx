import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { SlotArt } from '@/components/site/SlotArt';
import { TourneyBracket, TourneyVersus } from '@/components/site/TourneyBracket';
import { roundName } from '@/lib/tourney';
import {
  featuredTourney,
  finishedTourneys,
  summariseTourney,
  tourneyEntriesFor,
  tourneyMatchesFor,
  tourneyTurnsFor,
} from '@/lib/store/tourney';
import { coins, dateShort, money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Slot Tournament',
  description:
    'Slot tournaments on MattySpins: sign up with !sr, get drawn into the bracket, and beat your opponent’s multiplier head to head. The champion wins the prize.',
};

export const dynamic = 'force-dynamic';

export default async function TourneyPage() {
  const [t, history] = await Promise.all([featuredTourney(), finishedTourneys(8)]);
  const [entries, matches, turns] = t
    ? await Promise.all([tourneyEntriesFor(t.id), tourneyMatchesFor(t.id), tourneyTurnsFor(t.id)])
    : [[], [], []];
  const s = t ? summariseTourney(t, entries, matches, turns) : null;
  const live = t != null && t.status !== 'finished';
  const past = history.filter((h) => h.id !== t?.id);
  const champEntry = s?.champion ? entries.find((e) => e.id === s.champion?.entryId) : undefined;

  return (
    <>
      {live ? <AutoRefresh seconds={8} /> : null}

      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {t?.status === 'signup' ? 'Sign-ups open' : live ? (s?.champion ? 'Champion!' : 'Live now') : 'Slot tournament'}
          </span>
          <h1>{t?.title ?? 'Slot Tournament'}</h1>
          <div className="sh-sub">
            {live
              ? 'Live from stream. This page updates itself.'
              : t
                ? `${s?.champion ? `Won by ${s.champion.kickUsername}` : 'Ended'} ${t.finishedAt ? dateShort(t.finishedAt) : ''}. The next tournament starts on stream.`
                : 'No tournament has run yet. The next one starts on stream.'}{' '}
            See also the <Link href="/hunt">bonus hunt</Link>.
          </div>
        </div>
      </div>

      {t && s ? (
        <>
          {s.champion ? (
            <p className="bingo-banner">
              ♜ {s.champion.kickUsername} is champion
              {s.runnerUp ? `, beating ${s.runnerUp.kickUsername} in the final` : ''}
              {champEntry?.paid ? ` · +${coins(champEntry.paid)} MC` : ''}
            </p>
          ) : null}

          <div className="raid-page">
            <div style={{ minWidth: 0 }}>
              {t.status === 'signup' ? (
                <div className="card">
                  <h3 style={{ fontSize: 15, marginBottom: 8 }}>
                    Signed up <span className="muted small">({entries.length} for {t.size} places)</span>
                  </h3>
                  {entries.length === 0 ? (
                    <p className="small muted">Nobody yet — be first.</p>
                  ) : (
                    entries.map((e) => (
                      <div key={e.id} className="bingo-winner">
                        <SlotArt src={e.imageUrl} name={e.slotName ?? e.query} className="ovl-art" fallbackClassName="ovl-art ph" />
                        <b>{e.kickUsername}</b>
                        <small className="muted">{e.slotName ?? e.query}</small>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  {s.current ? <TourneyVersus s={s} round={roundName(s.current.round, s.rounds)} /> : null}
                  <div className="card" style={{ overflowX: 'auto', marginTop: s.current ? 14 : 0 }}>
                    <TourneyBracket s={s} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, minWidth: 0 }}>
              <div className="card">
                <div className="hj-head">
                  <span className={`tag ${live && t.requestsOpen ? 'green' : ''}`}>
                    {t.status === 'signup' && t.requestsOpen ? 'Sign-ups open' : live && t.requestsOpen ? 'Open' : 'Closed'}
                  </span>
                  <h3>How to play</h3>
                </div>
                <p className="small muted">
                  Type <code>!sr slot name</code> in Kick chat while sign-ups are open. The bracket of {t.size} is
                  drawn at random from everyone who signed up. Each match is one bonus buy for each player, and the
                  higher multiplier goes through; if it&apos;s level, you both buy again. Still in? You can{' '}
                  <code>!sr</code> a new slot before your next match. The winner of the final is champion
                  {t.prize ? (
                    <>
                      {' '}and wins <b style={{ color: 'var(--gold)' }}>{coins(t.prize)} MC</b>
                    </>
                  ) : null}
                  . To be paid, your Kick account has to be <Link href="/profile">linked</Link>.
                </p>
                {t.status !== 'signup' ? (
                  <p className="small" style={{ marginTop: 8 }}>
                    <b>{s.alive.size}</b> still in · <b>{s.bought}</b> buy{s.bought === 1 ? '' : 's'}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="emptyq">Nothing to show yet.</div>
      )}

      {past.length > 0 ? (
        <div className="sec" style={{ marginTop: 38 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">History</span>
              <h2>Past champions</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Date</th>
                  <th>Champion</th>
                  <th>Players</th>
                  <th>Buys</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {past.map((h) => {
                  const profit = h.won - h.cost;
                  return (
                    <tr key={h.id}>
                      <td>{h.title}</td>
                      <td className="n" style={{ color: 'var(--muted)' }}>{h.finishedAt ? dateShort(h.finishedAt) : '—'}</td>
                      <td>{h.champion ? <b>{h.champion}</b> : <span className="muted">Not finished</span>}</td>
                      <td className="n">{h.players}</td>
                      <td className="n">{h.bought}</td>
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
