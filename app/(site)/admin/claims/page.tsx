import Link from 'next/link';
import { claimCycles, claimsInCycle } from '@/lib/store/milestones';
import { monthKey } from '@/lib/store/razed-snapshots';
import { cycleLabel, dateShort, money } from '@/lib/format';

export const metadata = { title: 'Milestone claims' };
export const dynamic = 'force-dynamic';

/** More than a month would plausibly hold. The page says so if it is ever hit. */
const SHOWN = 500;

const STATUS_TAG = { paid: 'green', pending: 'warn', rejected: 'red' } as const;

/**
 * Every milestone claim, by month.
 *
 * The payout queue only holds what is still pending and a member's page only
 * holds that member, so neither answers "who claimed what in October". Open to
 * all staff, like the payout queue, because it shows nothing that queue does not.
 */
export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const current = monthKey();
  const cycles = await claimCycles();

  // The running month gets a tab even before anyone has claimed in it.
  const tabs = cycles.some((c) => c.cycle === current)
    ? cycles
    : [{ cycle: current, claims: 0, members: 0, paid: 0, pending: 0, rejected: 0 }, ...cycles];

  const selected = tabs.find((c) => c.cycle === params.month) ?? tabs.find((c) => c.cycle === current)!;
  const claims = await claimsInCycle(selected.cycle, SHOWN);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Every claim, by month</span>
          <h1>Milestone claims</h1>
          <div className="sh-sub">
            Everything claimed on each month&rsquo;s ladder, paid or not. Claims waiting to be sent
            are worked from <Link href="/admin/payouts">Payouts</Link>.
          </div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <Link
            key={tab.cycle}
            className={tab.cycle === selected.cycle ? 'on' : undefined}
            href={`/admin/claims?month=${encodeURIComponent(tab.cycle)}`}
          >
            {cycleLabel(tab.cycle)} ({tab.claims})
          </Link>
        ))}
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Claims</div>
          <div className="kv">{selected.claims}</div>
          <div className="kd">
            {selected.members} member{selected.members === 1 ? '' : 's'}
          </div>
        </div>
        <div className="kpi">
          <div className="kl">Marked paid</div>
          <div className="kv g">{money(selected.paid)}</div>
          <div className="kd">at the 100% rate</div>
        </div>
        <div className="kpi">
          <div className="kl">Pending</div>
          <div className={`kv ${selected.pending > 0 ? 'w' : ''}`}>{money(selected.pending)}</div>
          <div className="kd">at the 100% rate</div>
        </div>
        <div className="kpi">
          <div className="kl">Rejected</div>
          <div className="kv">{money(selected.rejected)}</div>
          <div className="kd">not paid</div>
        </div>
      </div>

      {claims.length === 0 ? (
        <div className="emptyq">Nobody has claimed a milestone in {cycleLabel(selected.cycle)}.</div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Razed</th>
                <th>Tier</th>
                <th>Wagered at claim</th>
                <th>Reward</th>
                <th>Claimed</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.claimId}>
                  <td>
                    <Link href={`/admin/users/${claim.userId}`}>{claim.username}</Link>
                  </td>
                  <td>{claim.razedUsername ?? '—'}</td>
                  <td>{claim.tierName || money(claim.threshold)}</td>
                  <td className="n">{money(claim.wageredAtClaim)}</td>
                  <td className="n g">{money(claim.reward)}</td>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {dateShort(claim.createdAt)}
                  </td>
                  <td>
                    <span className={`tag ${STATUS_TAG[claim.status]}`}>{claim.status}</span>
                    {claim.handledBy ? (
                      <div className="small muted">by {claim.handledBy}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.claims > claims.length ? (
        <p className="small" style={{ marginTop: 12, color: 'var(--warn)' }}>
          Showing the newest {claims.length} of {selected.claims} claims. The totals above cover all
          of them.
        </p>
      ) : null}

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        Rewards are the ladder&rsquo;s 100% figure. The site does not record the amount actually
        tipped, so a claim paid at the 50% Originals rate still shows the full reward here.
      </p>
    </>
  );
}
