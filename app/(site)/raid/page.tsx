import type { Metadata } from 'next';
import Link from 'next/link';
import { AutoRefresh } from '@/components/site/AutoRefresh';
import { BossCard, RaidDamageBoard } from '@/components/site/BossCard';
import { damageOf, hp } from '@/lib/raid';
import { featuredRaid, finishedRaids, raidEntriesFor, raidTurnsFor, summariseRaid } from '@/lib/store/raid';
import { coins, dateShort, money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Boss Raid',
  description:
    'Boss raids on MattySpins: call a slot with !sr, get drawn, and your bonus buy hits the boss for its multiplier. Land the killing blow to win.',
};

export const dynamic = 'force-dynamic';

export default async function RaidPage() {
  const [raid, history] = await Promise.all([featuredRaid(), finishedRaids(8)]);
  const [turns, waiting] = raid
    ? await Promise.all([raidTurnsFor(raid.id), raidEntriesFor(raid.id, 'waiting')])
    : [[], []];
  const s = raid ? summariseRaid(raid, turns) : null;
  const running = raid?.status === 'running';
  const past = history.filter((r) => r.id !== raid?.id);
  const hits = turns.filter((t) => t.status === 'played');

  return (
    <>
      {running ? <AutoRefresh seconds={8} /> : null}

      <div className="sec-head">
        <div>
          <span className="eyebrow">{running ? (s?.slain ? 'Slain!' : 'Live now') : 'Boss raid'}</span>
          <h1>{raid ? `Boss Raid: ${raid.boss}` : 'Boss Raid'}</h1>
          <div className="sh-sub">
            {running
              ? 'Live from stream. This page updates itself.'
              : raid
                ? `${raid.result === 'slain' ? 'Slain' : 'Ended'} ${raid.finishedAt ? dateShort(raid.finishedAt) : ''}. The next raid starts on stream.`
                : 'No boss raid has run yet. The next one starts on stream.'}{' '}
            See also the <Link href="/hunt">bonus hunt</Link>.
          </div>
        </div>
      </div>

      {raid && s ? (
        <div className="raid-page">
          <div style={{ minWidth: 0 }}>
            <BossCard raid={raid} s={s} />

            {hits.length > 0 ? (
              <div className="card" style={{ marginTop: 14 }}>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Every hit</h3>
                {[...hits].reverse().map((t) => (
                  <div key={t.id} className="bingo-winner">
                    <span className={`bg-chip ${s.killer?.id === t.id ? 'koth-chip-king' : 'raid-chip'}`}>
                      {damageOf(t) ? `−${hp(damageOf(t) ?? 0)}` : 'miss'}
                    </span>
                    <b>{t.kickUsername}</b>
                    <small className="muted">{t.slotName}</small>
                    {s.killer?.id === t.id ? (
                      <span className="tag gold">Killing blow{t.paid ? ` · +${coins(t.paid)} MC` : ''}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, minWidth: 0 }}>
            <div className="card">
              <div className="hj-head">
                <span className={`tag ${running && raid.requestsOpen ? 'green' : ''}`}>
                  {running && raid.requestsOpen ? 'Open' : 'Closed'}
                </span>
                <h3>How to play</h3>
              </div>
              <p className="small muted">
                Type <code>!sr slot name</code> in Kick chat to join the raid. Each round a random viewer is drawn
                and their slot is bonus-bought. Your buy hits the boss for its multiplier — a 130× bonus deals 130
                damage. Whether it lands big or small, you can <code>!sr</code> again, and you go back in once
                everyone waiting has had a go. The hit that takes the boss to 0 HP is the killing blow
                {raid.prize ? (
                  <>
                    , and wins <b style={{ color: 'var(--gold)' }}>{coins(raid.prize)} MC</b>
                  </>
                ) : null}
                . To be paid, your Kick account has to be <Link href="/profile">linked</Link>.
              </p>
              <p className="small" style={{ marginTop: 8 }}>
                {running ? (
                  <>
                    <b>{waiting.length}</b> waiting to be drawn ·{' '}
                  </>
                ) : null}
                <b>{s.bought}</b> hit{s.bought === 1 ? '' : 's'} · <b>{hp(s.dealt)}</b> damage dealt
              </p>
            </div>

            {s.raiders.length > 0 ? (
              <div className="card">
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>Top damage</h3>
                <RaidDamageBoard s={s} />
              </div>
            ) : null}
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
              <h2>Past raids</h2>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Boss</th>
                  <th>Date</th>
                  <th>HP</th>
                  <th>Killing blow</th>
                  <th>Hits</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                {past.map((r) => {
                  const profit = r.won - r.cost;
                  return (
                    <tr key={r.id}>
                      <td>{r.boss}</td>
                      <td className="n" style={{ color: 'var(--muted)' }}>{r.finishedAt ? dateShort(r.finishedAt) : '—'}</td>
                      <td className="n">{r.maxHp.toLocaleString('en-US')}</td>
                      <td>
                        {r.killer ? (
                          <>
                            <b>{r.killer}</b> <small className="muted">{r.killerSlot}</small>
                          </>
                        ) : (
                          <span className="muted">Survived</span>
                        )}
                      </td>
                      <td className="n">{r.bought}</td>
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
