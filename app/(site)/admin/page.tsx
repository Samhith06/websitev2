import { reviewQueue } from '@/lib/store/razed-links';
import { pendingPayouts } from '@/lib/store/milestones';
import { queue as redemptionQueue } from '@/lib/store/shop';
import { coinFlow } from '@/lib/store/coins';
import { userCount } from '@/lib/store/accounts';
import { coins, money } from '@/lib/format';
import { ClaimRow, RazedLinkRow, RedemptionRow } from '@/components/admin/QueueRows';

export const metadata = { title: 'Approvals' };
export const dynamic = 'force-dynamic';

/** The only screen a mod needs open during a stream. */
export default async function ApprovalsPage() {
  const [links, claims, orders, flow, members] = await Promise.all([
    reviewQueue(),
    pendingPayouts(),
    redemptionQueue('pending'),
    coinFlow(new Date(0)),
    userCount(),
  ]);

  const flagged = links.filter((l) => l.flagged).length;
  const waiting = links.length + claims.length + orders.length;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">{waiting} waiting</span>
          <h1>Approvals</h1>
          <div className="sh-sub">The only screen a mod needs open during a stream.</div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kl">Razed links</div>
          <div className={`kv ${links.length ? 'w' : ''}`}>{links.length}</div>
          <div className="kd">{flagged ? `${flagged} flagged` : 'none flagged'}</div>
        </div>
        <div className="kpi">
          <div className="kl">Milestone claims</div>
          <div className={`kv ${claims.length ? 'w' : ''}`}>{claims.length}</div>
          <div className="kd">
            {money(claims.reduce((sum, c) => sum + c.reward, 0))} to tip
          </div>
        </div>
        <div className="kpi">
          <div className="kl">Redemptions</div>
          <div className={`kv ${orders.length ? 'w' : ''}`}>{orders.length}</div>
          <div className="kd">awaiting a decision</div>
        </div>
        <div className="kpi">
          <div className="kl">Coins in circulation</div>
          <div className="kv g">{coins(flow.minted - flow.destroyed)}</div>
          <div className="kd">across {coins(members)} accounts</div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      <h2 style={{ marginTop: 8, fontSize: 16 }}>Razed link requests</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Each username has been matched against wagering under the code. There is no technical check
        that a username belongs to the person claiming it — check Discord before approving anything
        flagged, and never approve these in bulk.
      </p>
      {links.length === 0 ? (
        <div className="emptyq">Nothing waiting.</div>
      ) : (
        links.map((row) => <RazedLinkRow key={row.userId} row={row} />)
      )}

      {/* ------------------------------------------------------------------ */}
      <h2 style={{ marginTop: 26, fontSize: 16 }}>Milestone claims</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Send the tip on Razed first, then mark it paid here. The site moves no money.
      </p>
      {claims.length === 0 ? (
        <div className="emptyq">Nothing waiting.</div>
      ) : (
        claims.map((row) => <ClaimRow key={row.claimId} row={row} />)
      )}

      {/* ------------------------------------------------------------------ */}
      <h2 style={{ marginTop: 26, fontSize: 16 }}>Store redemptions</h2>
      {orders.length === 0 ? (
        <div className="emptyq">Nothing waiting.</div>
      ) : (
        orders.map((row) => <RedemptionRow key={row.id} row={row} />)
      )}
    </>
  );
}
