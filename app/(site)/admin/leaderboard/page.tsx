import { currentPeriod, potOf, prizeForRank } from '@/lib/store/periods';
import { fetchRazedLeaderboard, toBoardRows } from '@/lib/razed';
import { devBypass, roleFor } from '@/lib/admin';
import { auth } from '@/auth';
import { money } from '@/lib/format';
import { FreezeMonthButton } from '@/components/admin/AdminButtons';
import { OpenPeriod, PeriodControls, PrizeEditor } from '@/components/admin/PeriodEditor';

export const metadata = { title: 'Leaderboard' };
export const dynamic = 'force-dynamic';

/**
 * The month as staff see it.
 *
 * Standings are read-only — they come from Razed and the site never computes
 * them. Prizes are the editable half, and stay editable right up to the freeze,
 * which is the arrangement Matty asked for.
 */
export default async function AdminLeaderboardPage() {
  const session = devBypass() ? null : await auth();
  const isOwner = devBypass() || roleFor(session?.user?.discordId ?? null) === 'owner';

  const period = await currentPeriod('monthly');

  const feed = period
    ? await fetchRazedLeaderboard({
        from: period.startsAt.slice(0, 10),
        to: period.endsAt.slice(0, 10),
      })
    : null;
  const rows = feed?.ok ? toBoardRows(feed.rows, (rank) => prizeForRank(period!.tiers, rank)) : [];

  if (!period) {
    const now = new Date();
    const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    return (
      <>
        <div className="sec-head">
          <div>
            <span className="eyebrow">Nothing open</span>
            <h1>Leaderboard</h1>
            <div className="sh-sub">
              Open a board and it fills in from Razed automatically — the standings are read, never
              computed here.
            </div>
          </div>
        </div>
        {isOwner ? (
          <OpenPeriod defaultMonth={month} />
        ) : (
          <div className="emptyq">No monthly board is open. Only Matty can open one.</div>
        )}
      </>
    );
  }

  const monthLabel = new Date(period.startsAt).toLocaleString('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
  const totalWagered = rows.reduce((sum, r) => sum + r.wagered, 0);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{monthLabel} · live</span>
          <h1>Leaderboard</h1>
          <div className="sh-sub">
            Standings are read-only from Razed. Prizes stay editable until the month freezes.
          </div>
        </div>
        {isOwner ? <FreezeMonthButton /> : null}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Prize pool</div>
          <div className="kv g">{money(potOf(period.tiers))}</div>
          <div className="kd">Top {period.tiers.length} paid</div>
        </div>
        <div className="kpi">
          <div className="kl">Status</div>
          <div className="kv b">{period.status}</div>
          <div className="kd">
            {period.frozenAt ? 'standings stored' : 'live from Razed'}
          </div>
        </div>
        <div className="kpi">
          <div className="kl">Qualifying wagerers</div>
          <div className="kv">{rows.length}</div>
          <div className="kd">wagered &gt; $0</div>
        </div>
        <div className="kpi">
          <div className="kl">Total wagered</div>
          <div className="kv">{money(totalWagered)}</div>
          <div className="kd">under the code</div>
        </div>
      </div>

      {!feed?.ok ? (
        <div className="emptyq" style={{ marginBottom: 18, borderColor: 'rgba(255,92,122,.4)' }}>
          Razed could not be read: {feed?.detail ?? 'no period window'}. The public board shows the
          same message rather than an empty table, and freezing is refused until it recovers —
          archiving a month we cannot see would store an empty board.
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Standings</h2>
        <p className="small muted" style={{ marginBottom: 14 }}>
          Read-only — these come from Razed and the site never computes them.
        </p>

        {rows.length === 0 ? (
          <div className="emptyq">Nothing to show yet.</div>
        ) : (
          rows.slice(0, 25).map((row) => (
            <div className="editrow" key={row.rank}>
              <div className="er">#{row.rank}</div>
              <div className="er" style={{ color: 'var(--text)' }}>
                {row.maskedUsername}
              </div>
              <div className="er">{money(row.wagered)} wagered</div>
              <div className="er" style={{ color: row.prize ? 'var(--gold)' : 'var(--muted-2)' }}>
                {row.prize ? money(row.prize) : '—'}
              </div>
            </div>
          ))
        )}
      </div>

      <PrizeEditor
        periodId={period.id}
        tiers={period.tiers}
        editable={isOwner && period.frozenAt == null}
      />

      {isOwner ? (
        <PeriodControls
          periodId={period.id}
          month={period.startsAt.slice(0, 7)}
          frozen={period.frozenAt != null}
        />
      ) : null}

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Freezing stores these standings permanently and queues the winners on the payouts screen.
        After that the month renders from the stored rows, so a restatement by Razed cannot move a
        board somebody has already been paid against.
      </p>
    </>
  );
}
