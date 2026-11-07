import type { Metadata } from 'next';
import { ArrowRight, DollarSign, Percent, Repeat, Trophy, Users } from 'lucide-react';
import { archivedPeriods, currentPeriod, potOf, prizeForRank } from '@/lib/store/periods';
import { fetchRazedLeaderboard, healthFrom, toBoardRows } from '@/lib/razed';
import { money, periodLabel, relativeTime } from '@/lib/format';
import { razed } from '@/lib/mock';
import { Countdown } from '@/components/ui/Countdown';
import { RacePodium } from '@/components/site/RacePodium';

const DAY = 24 * 60 * 60 * 1000;

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
  const windowLabel = period ? periodLabel(period.startsAt, period.endsAt) : '';

  /**
   * Everything wagered under the code this period, summed from the same rows
   * the table below is printed from — so the headline figure can never
   * disagree with the column it is the total of.
   *
   * Razed caps a page at 100 rows and `fetchRazedLeaderboard` stops at that
   * many, so on a month with more referred players than that this is the sum
   * of the board rather than the sum of the month. It says which it is instead
   * of rounding the difference away: a total quietly missing its tail is the
   * same failure as a board that stops at position 100.
   */
  const totalWagered = rows.reduce((sum, row) => sum + row.wagered, 0);
  const partialTotal = feed?.ok === true && feed.truncated;
  const playersInWindow = feed?.ok === true ? feed.total : rows.length;

  const rest = rows.slice(3);

  /**
   * How far through the race we are. Worked out here rather than on the client:
   * unlike the ticking clock, a day count cannot disagree with itself between
   * the server's render and the browser's.
   */
  const startsMs = period ? new Date(period.startsAt).getTime() : 0;
  const endsMs = period ? new Date(period.endsAt).getTime() : 0;
  const nowMs = Date.now();
  const totalDays = Math.max(1, Math.round((endsMs - startsMs) / DAY));
  const today = Math.min(totalDays, Math.max(1, Math.floor((nowMs - startsMs) / DAY) + 1));
  const elapsedPct = period
    ? Math.min(100, Math.max(0, ((nowMs - startsMs) / (endsMs - startsMs)) * 100))
    : 0;
  const raceOpen = period?.status === 'open' && nowMs < endsMs;

  /** The last place that gets paid: a "4–10" tier is one row but seven people. */
  const paidPlaces = period ? Math.max(0, ...period.tiers.map((tier) => tier.rankTo)) : 0;

  const feedHealthy = health?.status === 'healthy';
  const status = !period
    ? { label: 'Not open', live: false }
    : !feedHealthy
      ? { label: 'Delayed', live: false }
      : raceOpen
        ? { label: 'Live', live: true }
        : { label: 'Locked', live: false };

  return (
    <div className="lbx">
      <section className="lb-hero">
        <div className="lb-copy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lb-brand" src="/brand/razed.png" alt="Razed" width={118} height={41} />
          <h1>Monthly wager race{windowLabel ? ` · ${windowLabel}` : ''}</h1>
          <div className="lb-pot">{pot ? money(pot) : '—'}</div>
          <p className="lb-blurb">
            Play on Razed with code {razed.referralCode} and every dollar you wager counts.
            {paidPlaces > 0 && pot
              ? ` The top ${paidPlaces} at the end of the month split ${money(pot)}, tipped directly by Razed.`
              : ' Prizes for this race have not been set yet.'}
          </p>

          {period ? (
            <>
              <div className="lb-clockhead">
                <span>{raceOpen ? 'Race ends in' : 'Race over'}</span>
                <span>
                  Day {today} of {totalDays}
                </span>
              </div>
              {raceOpen ? <Countdown to={period.endsAt} /> : null}
              <div className="lb-bar">
                <i style={{ width: `${elapsedPct}%` }} />
              </div>
            </>
          ) : null}

          <a
            className="btn pri"
            href={razed.affiliateUrl}
            target="_blank"
            rel="noreferrer noopener sponsored"
          >
            Play on Razed
            <ArrowRight size={18} aria-hidden />
          </a>

          <a
            className="lb-promo"
            href={razed.affiliateUrl}
            target="_blank"
            rel="noreferrer noopener sponsored"
          >
            <span className="ic">
              <Percent size={18} aria-hidden />
            </span>
            <span className="tx">
              <b>200% welcome bonus</b>
              <small>On Razed with code {razed.referralCode}</small>
            </span>
            <ArrowRight size={18} aria-hidden />
          </a>
          <a
            className="lb-promo"
            href={razed.affiliateUrl}
            target="_blank"
            rel="noreferrer noopener sponsored"
          >
            <span className="ic">
              <Repeat size={18} aria-hidden />
            </span>
            <span className="tx">
              <b>Weekly rakeback</b>
              <small>On Razed with code {razed.referralCode}</small>
            </span>
            <ArrowRight size={18} aria-hidden />
          </a>
        </div>

        {/* Silence is never rendered as zero — an empty board says why. */}
        {rows.length === 0 ? (
          <div className="emptyq lb-empty">
            {period
              ? 'The board could not be read from Razed just now. The last good figures return on the next sync — nothing has been lost.'
              : 'No leaderboard period is open. Once one is created in the staff area the board fills in from Razed automatically.'}
          </div>
        ) : (
          <RacePodium rows={rows} />
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Four figures, all summed from the rows below or read from the feed  */}
      {/* ------------------------------------------------------------------ */}
      <section className="lb-stats">
        <div className="lb-stat">
          <span className="ring">
            <DollarSign size={18} aria-hidden />
          </span>
          <div className="v b">{rows.length ? money(Math.round(totalWagered)) : '—'}</div>
          <div className="l">Total wagered</div>
          {partialTotal ? (
            <div className="m">
              Top {rows.length} of {playersInWindow} players
            </div>
          ) : null}
        </div>
        <div className="lb-stat">
          <span className="ring">
            <Trophy size={18} aria-hidden />
          </span>
          <div className="v g">{pot ? money(pot) : '—'}</div>
          <div className="l">Prize pool</div>
        </div>
        <div className="lb-stat">
          <span className="ring">
            <Users size={18} aria-hidden />
          </span>
          <div className="v">{feed?.ok ? playersInWindow.toLocaleString('en-GB') : '—'}</div>
          <div className="l">Active players</div>
        </div>
        <div className="lb-stat">
          <span className={status.live ? 'ring' : 'ring off'}>
            <i aria-hidden />
          </span>
          <div className={status.live ? 'v b' : 'v w'}>{status.label}</div>
          <div className="l">Leaderboard status</div>
          {health && feedHealthy ? (
            <div className="m">Synced {relativeTime(health.lastSyncAt)}</div>
          ) : null}
        </div>
      </section>

      {rest.length > 0 ? (
        <div className="tw lb-table">
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

      <div
        className="card"
        style={{
          marginTop: 14,
          borderColor: 'var(--edge-hot)',
          background: 'linear-gradient(100deg,rgba(31,139,255,.05),var(--panel) 60%)',
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
            const label = periodLabel(month.startsAt, month.endsAt);
            const standings = month.frozenStandings ?? [];
            const winner = standings[0];
            return (
              <details className="acc" key={month.id}>
                <summary>
                  <div>
                    <div className="am">{label}</div>
                    <div className="ap">
                      {winner
                        ? // A month recorded after the fact has no prize figures, and
                          // saying nothing is true where "$0" would not be.
                          `Winner ${winner.maskedUsername}${winner.prize ? ` · ${money(winner.prize)}` : ''}`
                        : 'Standings not frozen'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {month.pot ? <span className="tag gold">{money(month.pot)} pool</span> : null}
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
    </div>
  );
}
