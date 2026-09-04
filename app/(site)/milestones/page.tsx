import Link from 'next/link';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/player';
import { buildLadder, claimsFor, listTiers, nextTier, progressTo } from '@/lib/store/milestones';
import { wagerStateFor } from '@/lib/store/wager';
import { dateShort, money } from '@/lib/format';
import { ClaimButton } from '@/components/site/ClaimButton';

export const metadata: Metadata = {
  title: 'Milestones',
  description:
    'The lifetime wager milestone ladder. Every tier is claimable once and paid straight to your Razed account.',
};

export const dynamic = 'force-dynamic';

export default async function MilestonesPage() {
  const user = await currentUser();
  const [tiers, wager, claims] = await Promise.all([
    listTiers(),
    wagerStateFor(user?.id ?? null),
    user ? claimsFor(user.id) : Promise.resolve([]),
  ]);

  const lifetime = wager.lifetime ?? 0;
  const ladder = buildLadder(tiers, claims, lifetime, wager.approved);
  const next = nextTier(tiers, lifetime);
  const pct = progressTo(tiers, lifetime);
  const claimedTotal = claims
    .filter((c) => c.status === 'paid' || c.status === 'pending')
    .reduce((sum, c) => sum + c.reward, 0);

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Claim once, keep forever</span>
          <h1>Wager Milestones</h1>
          <div className="sh-sub">Lifetime totals — these never reset at month end</div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Header: progress if we can show it, an honest reason if we cannot   */}
      {/* ------------------------------------------------------------------ */}
      {!user ? (
        <div className="ms-head">
          <div>
            <span className="eyebrow">Lifetime wager ladder</span>
            <h2 style={{ fontSize: 22, margin: '6px 0 8px' }}>Sign in to track your progress</h2>
            <div className="small muted">
              Every tier below is claimable once and paid straight to your Razed account.
            </div>
          </div>
          <Link className="btn pri discord" href="/api/auth/signin?callbackUrl=/milestones">
            Sign in with Discord
          </Link>
        </div>
      ) : wager.lifetime == null ? (
        <div className="ms-head">
          <div>
            <span className="eyebrow">Lifetime wagered under MATTYSPINS</span>
            <h2 style={{ fontSize: 22, margin: '6px 0 8px' }}>
              {wager.link ? 'Waiting on the next Razed sync' : 'Link your Razed username'}
            </h2>
            <div className="small muted">
              {wager.link
                ? 'Your username is on file. Progress appears as soon as the wager data has been read.'
                : 'The ladder runs on wagering under the referral code, so it needs to know which Razed account is yours.'}
            </div>
          </div>
          <Link className="btn" href="/profile">
            Go to profile
          </Link>
        </div>
      ) : (
        <div className="ms-head">
          <div>
            <span className="eyebrow">Lifetime wagered under MATTYSPINS</span>
            <div className="mono" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.15 }}>
              {money(lifetime)}
            </div>
            <div className="railbar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="small muted" style={{ marginTop: 9 }}>
              {next ? (
                <>
                  {money(next.threshold - lifetime)} more to unlock{' '}
                  <b style={{ color: 'var(--gold)' }}>{money(next.reward)}</b> at{' '}
                  {money(next.threshold)}
                </>
              ) : (
                'Every tier on the ladder is unlocked.'
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">Claimed so far</div>
            <div
              className="mono"
              style={{ fontSize: 26, fontWeight: 600, color: 'var(--gold)' }}
            >
              {money(claimedTotal)}
            </div>
            <div className="small muted">
              {claims.length} of {tiers.length} tiers
            </div>
          </div>
        </div>
      )}

      {/* The link state, when it is the thing standing between someone and a
          claim. Shown separately from the header so it reads as an action
          rather than a status. */}
      {user && wager.lifetime != null && !wager.approved ? (
        <div
          className="card"
          style={{
            marginBottom: 18,
            borderColor: wager.link ? 'rgba(255,179,71,.4)' : 'var(--edge-2)',
          }}
        >
          <div style={{ display: 'flex', gap: 13, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`tag ${wager.link ? 'warn' : 'red'}`}>
              {wager.link ? 'Awaiting approval' : 'Not linked'}
            </span>
            <div className="small muted" style={{ flex: 1, minWidth: 220 }}>
              {wager.link
                ? 'Your Razed username has been matched against the referral data and is waiting for a mod to approve it. Progress is shown now; claiming unlocks on approval.'
                : 'Link your Razed username in your profile to claim milestone rewards.'}
            </div>
            <Link className="btn sm" href="/profile">
              Go to profile
            </Link>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* The ladder                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="ladder">
        {ladder.map((rung, i) => {
          const { tier, state, claim } = rung;
          return (
            <div className={`tier ${state === 'paid' ? 'claimed' : state}`} key={tier.id}>
              <div className="tn">
                {state === 'paid' ? '✓' : state === 'pending' ? '…' : state === 'claimable' ? '!' : `T${i + 1}`}
              </div>
              <div>
                <div className="tt">Wager {money(tier.threshold)}</div>
                <div className="td">
                  {state === 'paid' && claim?.paidAt
                    ? `Claimed ${dateShort(claim.paidAt)} · tipped on Razed`
                    : state === 'pending'
                      ? 'Claimed — queued for payout, usually within 24 hours'
                      : state === 'claimable'
                        ? 'Ready to claim — sent to your Razed account'
                        : user && wager.lifetime != null
                          ? `${money(Math.max(0, tier.threshold - lifetime))} more wagered to unlock`
                          : 'Locked'}
                </div>
              </div>
              <div className="tright">
                <div className="tr">{money(tier.reward)}</div>
                {state === 'paid' ? (
                  <span className="tag green">Paid</span>
                ) : state === 'pending' ? (
                  <span className="tag warn">Pending payout</span>
                ) : state === 'claimable' ? (
                  <ClaimButton tierId={tier.id} reward={tier.reward} />
                ) : (
                  <button className="btn sm" disabled>
                    Locked
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="small muted" style={{ marginTop: 18, maxWidth: '70ch' }}>
        Milestone rewards are tipped by Razed to the account linked to your profile, usually within
        24 hours of claiming. Razed has no API for sending tips, so every payout is done by hand and
        marked off here — which is why the ladder promises a window rather than an instant.
      </p>
    </>
  );
}
