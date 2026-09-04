import { pendingPayouts } from '@/lib/store/milestones';
import { archivedPeriods, frozenPeriod } from '@/lib/store/periods';
import { dateTime, money } from '@/lib/format';
import { ClaimRow } from '@/components/admin/QueueRows';
import { CopyOne, CopyPayoutList } from '@/components/admin/PayoutList';

export const metadata = { title: 'Payouts' };
export const dynamic = 'force-dynamic';

/**
 * The payout queue.
 *
 * Razed has no API for sending tips, so every figure on this screen is
 * something Matty has to do by hand and then mark off. That makes this one of
 * the most-used screens in the staff area rather than an afterthought, which is
 * why it copies a whole month as a paste-ready list, tracks how long each one
 * has been waiting, and turns a row red past 48 hours.
 */
export default async function PayoutsPage() {
  const [claims, frozen, archive] = await Promise.all([
    pendingPayouts(),
    frozenPeriod(),
    archivedPeriods(3),
  ]);

  const board = frozen ?? archive[0] ?? null;
  const standings = board?.frozenStandings ?? [];
  const boardDue = standings.filter((row) => row.prize > 0);

  const claimsTotal = claims.reduce((sum, c) => sum + c.reward, 0);
  const boardTotal = boardDue.reduce((sum, r) => sum + r.prize, 0);
  const overdue = claims.filter((c) => c.hoursWaiting > 48).length;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{claims.length + boardDue.length} to send by hand</span>
          <h1>Payouts</h1>
          <div className="sh-sub">
            Razed has no tips API, so every one of these is a tip sent on Razed and then marked off
            here. The site moves no money.
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Outstanding</div>
          <div className="kv g">{money(claimsTotal + boardTotal)}</div>
          <div className="kd">{claims.length + boardDue.length} payments</div>
        </div>
        <div className="kpi">
          <div className="kl">Overdue</div>
          <div className={`kv ${overdue ? 'w' : ''}`}>{overdue}</div>
          <div className="kd">waiting over 48 hrs</div>
        </div>
        <div className="kpi">
          <div className="kl">Milestone claims</div>
          <div className="kv b">{money(claimsTotal)}</div>
          <div className="kd">{claims.length} pending</div>
        </div>
        <div className="kpi">
          <div className="kl">Leaderboard</div>
          <div className="kv">{money(boardTotal)}</div>
          <div className="kd">{boardDue.length} winners</div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* The frozen board. Standings here are immutable.                     */}
      {/* ------------------------------------------------------------------ */}
      {board && standings.length > 0 ? (
        <div className="card" style={{ borderColor: 'var(--edge-hot)', marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2 style={{ fontSize: 15, marginBottom: 3 }}>
                {new Date(board.startsAt).toLocaleString('en-GB', {
                  timeZone: 'UTC',
                  month: 'long',
                  year: 'numeric',
                })}{' '}
                leaderboard
              </h2>
              <div className="small muted">
                {board.frozenAt ? `Frozen ${dateTime(board.frozenAt)} · ` : ''}standings are
                immutable · {boardDue.length} winners
              </div>
            </div>
            <CopyPayoutList
              label="Copy winners as list"
              rows={boardDue.map((r) => ({ username: r.maskedUsername, amount: r.prize }))}
            />
          </div>

          <div className="divider" />

          {boardDue.map((row) => (
            <div className="qrow" style={{ marginBottom: 7 }} key={row.rank}>
              <div>
                <div className="qm">
                  <span
                    className={`rank ${row.rank <= 3 ? `r${row.rank}` : ''}`}
                    style={{ display: 'inline-grid', verticalAlign: 'middle', marginRight: 8 }}
                  >
                    {row.rank}
                  </span>
                  {row.maskedUsername}{' '}
                  <span style={{ color: 'var(--gold)' }}>{money(row.prize)}</span>
                </div>
                <div className="qd">
                  Wagered <b>{money(row.wagered)}</b> · send {money(row.prize)} as a tip on Razed
                </div>
              </div>
              <div className="qacts">
                <CopyOne username={row.maskedUsername} amount={row.prize} />
              </div>
            </div>
          ))}

          <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
            Names are masked here as they are everywhere else. Full Razed usernames for sending tips
            are on the <a href="/admin/razed">Razed wagerers</a> screen.
          </p>
        </div>
      ) : (
        <div className="emptyq" style={{ marginBottom: 20 }}>
          No frozen leaderboard yet. Freeze a month from the{' '}
          <a href="/admin/leaderboard">Leaderboard</a> screen and its winners appear here.
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      <h2 style={{ fontSize: 16 }}>Milestone claims</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Members are told to expect these within 24 hours. Anything red has broken that promise.
      </p>
      {claims.length === 0 ? (
        <div className="emptyq">Nothing waiting.</div>
      ) : (
        claims.map((row) => <ClaimRow key={row.claimId} row={row} />)
      )}

      <p className="small muted" style={{ marginTop: 18 }}>
        A reminder job pings Matty on Discord every six hours while anything here has been waiting
        over 48 hours.
      </p>
    </>
  );
}
