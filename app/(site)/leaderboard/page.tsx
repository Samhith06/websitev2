import type { Metadata } from 'next';
import { archivedPeriods, currentPeriod, potOf, prizeForRank } from '@/lib/store/periods';
import { fetchRazedLeaderboard, healthFrom, toBoardRows } from '@/lib/razed';
import { money, relativeTime } from '@/lib/format';
import { Countdown } from '@/components/ui/Countdown';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'The monthly Razed wager leaderboard for MattySpins. Every figure comes straight from Razed — nothing is self-reported.',
};

/** The board moves, and a cached one during a close finish is how you get
 *  accused of rigging. */
export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const period = await currentPeriod('monthly');

  /**
   * The period is a stored decision, not a clock. Its dates are what get sent
   * to Razed as from/to, so a board with no period configured asks Razed
   * nothing rather than inventing a window.
   */
  const feed = period
    ? await fetchRazedLeaderboard({
        from: period.startsAt.slice(0, 10),
        to: period.endsAt.slice(0, 10),
      })
    : null;

  const health = feed ? healthFrom(feed) : null;
  const rows = feed?.ok ? toBoardRows(feed.rows, (rank) => prizeForRank(period!.tiers, rank)) : [];
  const archive = await archivedPeriods(12);

  const pot = period ? potOf(period.tiers) : 0;
  const monthLabel = period
    ? new Date(period.startsAt).toLocaleString('en-GB', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const [first, second, third] = rows;
  const rest = rows.slice(3);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Wagered under code MATTYSPINS</span>
          <h1>Monthly Leaderboard</h1>
          <div className="sh-sub">
            {health?.status === 'healthy'
              ? `Live from Razed · last synced ${relativeTime(health.lastSyncAt)}`
              : (health?.code ?? 'No leaderboard period is open yet.')}
          </div>
        </div>
      </div>

      {period ? (
        <div className="lb-head">
          <div>
            <div className="eyebrow">{monthLabel} prize pool</div>
            <div className="pool">{pot ? money(pot) : '—'}</div>
            <div className="small muted">
              {period.tiers.length
                ? `Top ${period.tiers.length} paid · tipped directly by Razed`
                : 'No prize tiers set for this period yet.'}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 7 }}>
              Board locks in
            </div>
            <Countdown to={period.endsAt} />
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* The board itself. Silence is never rendered as zero — an empty      */}
      {/* board says why it is empty.                                         */}
      {/* ------------------------------------------------------------------ */}
      {rows.length === 0 ? (
        <div className="emptyq">
          {period
            ? 'The board could not be read from Razed just now. The last good figures return on the next sync — nothing has been lost.'
            : 'No leaderboard period is open. Once one is created in the staff area the board fills in from Razed automatically.'}
        </div>
      ) : (
        <>
          {first ? (
            <div className="podium">
              {second ? (
                <div className="pod second">
                  <div className="medal">2</div>
                  <div className="pn">{second.maskedUsername}</div>
                  <div className="pw">{money(second.wagered)}</div>
                  <div className="pp">{second.prize ? money(second.prize) : '—'}</div>
                </div>
              ) : (
                <div />
              )}
              <div className="pod first">
                <div className="medal">1</div>
                <div className="pn">{first.maskedUsername}</div>
                <div className="pw">{money(first.wagered)}</div>
                <div className="pp">{first.prize ? money(first.prize) : '—'}</div>
              </div>
              {third ? (
                <div className="pod third">
                  <div className="medal">3</div>
                  <div className="pn">{third.maskedUsername}</div>
                  <div className="pw">{money(third.wagered)}</div>
                  <div className="pp">{third.prize ? money(third.prize) : '—'}</div>
                </div>
              ) : (
                <div />
              )}
            </div>
          ) : null}

          {rest.length > 0 ? (
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Wagered</th>
                    <th>Prize</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((row) => (
                    <tr key={row.rank}>
                      <td className="n" style={{ color: 'var(--muted)' }}>
                        {row.rank}
                      </td>
                      <td className="n">{row.maskedUsername}</td>
                      <td className="n">{money(row.wagered)}</td>
                      <td className="g">
                        {row.prize ? (
                          money(row.prize)
                        ) : (
                          <span style={{ color: 'var(--muted-2)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}

      <div
        className="card"
        style={{
          marginTop: 14,
          borderColor: 'var(--edge-hot)',
          background: 'linear-gradient(100deg,rgba(34,211,255,.05),var(--panel) 60%)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span className="tag blue">Payouts</span>
          <div className="small muted" style={{ flex: 1 }}>
            Winners are tipped directly to their Razed account within 48 hours of the board locking.
            This site never holds or transfers funds. Usernames are masked — the first four
            characters are shown and the rest hidden, so regulars stay recognisable without being
            fully exposed.
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Archive. Once frozen, standings are immutable — the archive can     */}
      {/* never drift because Razed restated something later.                 */}
      {/* ------------------------------------------------------------------ */}
      {archive.length > 0 ? (
        <div className="sec" style={{ marginTop: 38 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">Archive</span>
              <h2>Past winners</h2>
            </div>
          </div>
          {archive.map((month) => {
            const label = new Date(month.startsAt).toLocaleString('en-GB', {
              timeZone: 'UTC',
              month: 'long',
              year: 'numeric',
            });
            const standings = month.frozenStandings ?? [];
            const winner = standings[0];
            return (
              <details className="acc" key={month.id}>
                <summary>
                  <div>
                    <div className="am">{label}</div>
                    <div className="ap">
                      {winner
                        ? `Winner ${winner.maskedUsername} · ${money(winner.prize)}`
                        : 'Standings not frozen'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span className="tag gold">{money(potOf(month.tiers))} pool</span>
                    <span className="chev">▾</span>
                  </div>
                </summary>
                <div className="abody">
                  {standings.length === 0 ? (
                    <div className="small muted" style={{ padding: '10px 17px' }}>
                      This period closed without frozen standings.
                    </div>
                  ) : (
                    standings.slice(0, 10).map((row, j) => (
                      <div className="mini-row" style={{ padding: '10px 17px' }} key={row.rank}>
                        <div className={`rank ${j < 3 ? `r${j + 1}` : ''}`}>{row.rank}</div>
                        <div className="nm">{row.maskedUsername}</div>
                        <div className="nm" style={{ flex: 'none', color: 'var(--muted)' }}>
                          {money(row.wagered)}
                        </div>
                        <div className="vl">{row.prize ? money(row.prize) : '—'}</div>
                      </div>
                    ))
                  )}
                </div>
              </details>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
