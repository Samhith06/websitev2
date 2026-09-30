import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { BattleBoard, BattleRosters, pointsChip } from '@/components/site/BattleBoard';
import { pts } from '@/lib/battle';
import { battleEntriesFor, battleTurnsFor, featuredBattle, finishedBattles, summariseBattle } from '@/lib/store/battle';
import { coins, dateShort, money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Team Battle',
  description:
    'Team battles on MattySpins: pick a side with !sr, and every bonus buy adds its multiplier to your team. The winning team splits the pot.',
};

export const dynamic = 'force-dynamic';

export default async function BattlePage() {
  const [battle, history] = await Promise.all([featuredBattle(), finishedBattles(8)]);
  const [turns, entries] = battle
    ? await Promise.all([battleTurnsFor(battle.id), battleEntriesFor(battle.id)])
    : [[], []];
  const s = battle ? summariseBattle(battle, turns, entries) : null;
  const running = battle?.status === 'running';
  const past = history.filter((b) => b.id !== battle?.id);
  const played = turns.filter((t) => t.status === 'played');
  const waiting = entries.filter((e) => e.status === 'waiting').length;

  return (
    <>
      {running ? <AutoRefresh seconds={8} /> : null}

      <div className="sec-head">
        <div>
          <span className="eyebrow">{running ? (s?.winner ? 'Decided!' : 'Live now') : 'Team battle'}</span>
          <h1>{battle?.title ?? 'Team Battle'}</h1>
          <div className="sh-sub">
            {running
              ? 'Live from stream. This page updates itself.'
              : battle
                ? `${battle.winner ? `${battle.names[battle.winner]} won` : 'Ended'} ${battle.finishedAt ? dateShort(battle.finishedAt) : ''}. The next battle starts on stream.`
                : 'No team battle has run yet. The next one starts on stream.'}{' '}
            See also the <Link href="/hunt">bonus hunt</Link>.
          </div>
        </div>
      </div>

      {battle && s ? (
        <div className="raid-page">
          <div style={{ minWidth: 0 }}>
            <BattleBoard battle={battle} s={s} />

            {played.length > 0 ? (
              <div className="card" style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Every buy</h3>
                {[...played].reverse().map((t) => (
                  <div key={t.id} className="bingo-winner">
                    <span className={`bg-chip bt-chip-${t.team}`}>{pointsChip(t)}</span>
                    <b>{t.kickUsername}</b>
                    <small className="muted">{t.slotName}</small>
                    <span className={`tag bt-tag-${t.team}`}>{battle.names[t.team]}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, minWidth: 0 }}>
            <div className="card">
              <div className="hj-head">
                <span className={`tag ${running && battle.requestsOpen ? 'green' : ''}`}>
                  {running && battle.requestsOpen ? 'Open' : 'Closed'}
                </span>
                <h3>How to play</h3>
              </div>
              <p className="small muted">
                Pick a side in Kick chat: <code>!sr {battle.names.a.toLowerCase()} slot name</code> or{' '}
                <code>!sr {battle.names.b.toLowerCase()} slot name</code>. Plain <code>!sr slot name</code> puts you on
                the smaller team, and you stay on the team you joined. Turns alternate between the teams; when
                it&apos;s your team&apos;s turn a random member is drawn and their slot is bonus-bought, and its
                multiplier is added to the team&apos;s total. After {battle.rounds} buys each, the higher total wins
                {battle.prize ? (
                  <>
                    {' '}and every member of the winning team splits{' '}
                    <b style={{ color: 'var(--gold)' }}>{coins(battle.prize)} MC</b>
                  </>
                ) : null}
                . A tie plays one more buy each. To be paid, your Kick account has to be{' '}
                <Link href="/profile">linked</Link>.
              </p>
              <p className="small" style={{ marginTop: 8 }}>
                {running ? (
                  <>
                    <b>{waiting}</b> waiting ·{' '}
                  </>
                ) : null}
                <b>{s.sides.a.members + s.sides.b.members}</b> members · <b>{s.bought}</b> buy
                {s.bought === 1 ? '' : 's'}
              </p>
            </div>

            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Top scorers</h3>
              <BattleRosters battle={battle} s={s} />
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
              <h2>Past battles</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Battle</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Winner</th>
                  <th>Buys</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {past.map((b) => {
                  const profit = b.won - b.cost;
                  return (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td className="n" style={{ color: 'var(--muted)' }}>{b.finishedAt ? dateShort(b.finishedAt) : '—'}</td>
                      <td className="n">
                        {b.names.a} {pts(b.total.a)} – {pts(b.total.b)} {b.names.b}
                      </td>
                      <td>{b.winner ? <b className={`bt-c-${b.winner}`}>{b.names[b.winner]}</b> : <span className="muted">Stopped</span>}</td>
                      <td className="n">{b.bought}</td>
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
