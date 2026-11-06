import Link from 'next/link';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/player';
import {
  buildLadder,
  claimsFor,
  claimsForCycle,
  listTiers,
  nextTier,
  progressTo,
} from '@/lib/store/milestones';
import { wagerStateFor } from '@/lib/store/wager';
import { feedHealth } from '@/lib/store/razed-snapshots';
import { cycleLabel, dateShort, money, relativeTime } from '@/lib/format';
import { ClaimButton } from '@/components/site/ClaimButton';
import { discordInvite } from '@/lib/mock';

export const metadata: Metadata = {
  title: 'Milestones',
  description:
    'The monthly wager milestone ladder. Every tier is claimable once a month and paid straight to your Razed account.',
};

export const dynamic = 'force-dynamic';

export default async function MilestonesPage() {
  const user = await currentUser();
  /**
   * `feed` is the age of the figures, not of the page.
   *
   * The leaderboard asks Razed on every request, so its numbers are as current
   * as the page itself. The ladder reads a stored snapshot that a background
   * job refreshes, so `force-dynamic` re-renders the same figures until that
   * job writes a new one — and the gap is invisible unless the page says it.
   */
  const [tiers, wager, claims] = await Promise.all([
    listTiers(),
    wagerStateFor(user?.id ?? null),
    user ? claimsFor(user.id) : Promise.resolve([]),
  ]);
  const { milestone } = wager;
  const feed = await feedHealth(milestone.period);

  const monthly = milestone.mode === 'monthly';
  const month = cycleLabel(milestone.cycle);
  const resetsOn = milestone.resetsAt ? dateShort(milestone.resetsAt) : null;
  const wagerLabel = monthly
    ? `Wagered in ${month} under MATTYSPINS`
    : 'Lifetime wagered under MATTYSPINS';

  const wagered = milestone.wagered ?? 0;
  const cycleClaims = claimsForCycle(claims, milestone.cycle);
  const ladder = buildLadder(tiers, cycleClaims, wagered, wager.approved);
  const next = nextTier(tiers, wagered);
  const pct = progressTo(tiers, wagered);
  const claimedTotal = cycleClaims
    .filter((c) => c.status === 'paid' || c.status === 'pending')
    .reduce((sum, c) => sum + c.reward, 0);
  const claimedTiers = ladder.filter((r) => r.state === 'paid' || r.state === 'pending').length;

  // A claim made last month has left this month's ladder but may not have been
  // paid yet. Without this it just looks like the reset ate it.
  const earlierOwed = monthly
    ? claims
        .filter((c) => c.status === 'pending' && c.cycle !== milestone.cycle)
        .reduce((sum, c) => sum + c.reward, 0)
    : 0;

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {monthly ? 'Starts again every month' : 'Claim once, keep forever'}
          </span>
          <h1>Wager Milestones</h1>
          <div className="sh-sub">
            {monthly
              ? `${month} wagering only — the ladder resets on ${resetsOn} (UTC)`
              : 'You are on the lifetime ladder — your total never resets'}
            {feed.lastSyncAt
              ? ` · figures read from Razed ${relativeTime(feed.lastSyncAt)}`
              : ' · figures not read from Razed yet'}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Header: progress if we can show it, an honest reason if we cannot   */}
      {/* ------------------------------------------------------------------ */}
      {!user ? (
        <div className="ms-head">
          <div>
            <span className="eyebrow">Monthly wager ladder</span>
            <h2 style={{ fontSize: 22, margin: '6px 0 8px' }}>Sign in to track your progress</h2>
            <div className="small muted">
              Every tier below is claimable once a month and paid straight to your Razed account.
            </div>
          </div>
          <Link className="btn pri discord" href="/api/auth/signin?callbackUrl=/milestones">
            Sign in with Discord
          </Link>
        </div>
      ) : milestone.wagered == null ? (
        <div className="ms-head">
          <div>
            <span className="eyebrow">{wagerLabel}</span>
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
            <span className="eyebrow">{wagerLabel}</span>
            <div className="mono" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.15 }}>
              {money(wagered)}
            </div>
            <div className="railbar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="small muted" style={{ marginTop: 9 }}>
              {next ? (
                <>
                  {money(next.threshold - wagered)} more to unlock{' '}
                  <b style={{ color: 'var(--gold)' }}>{money(next.reward)}</b> at{' '}
                  {money(next.threshold)}
                </>
              ) : (
                'Every tier on the ladder is unlocked.'
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="eyebrow">{monthly ? 'Claimed this month' : 'Claimed so far'}</div>
            <div
              className="mono"
              style={{ fontSize: 26, fontWeight: 600, color: 'var(--gold)' }}
            >
              {money(claimedTotal)}
            </div>
            <div className="small muted">
              {claimedTiers} of {tiers.length} tiers
            </div>
          </div>
        </div>
      )}

      {earlierOwed > 0 ? (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 13, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tag warn">Still being paid</span>
            <div className="small muted" style={{ flex: 1, minWidth: 220 }}>
              {money(earlierOwed)} you claimed in an earlier month is still waiting on payout. The
              monthly reset does not affect it.
            </div>
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* When the figures are old, say so                                    */}
      {/* ------------------------------------------------------------------ */}
      {/* Wagering that has not been read yet looks exactly like wagering that
          did not count, and the second reading is the one people reach for.
          Only shown to somebody with a linked username: they are the ones
          looking at a number about themselves. */}
      {user && wager.link && feed.stale ? (
        <div
          className="card"
          style={{ marginBottom: 18, borderColor: 'rgba(255,179,71,.4)' }}
        >
          <div style={{ display: 'flex', gap: 13, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="tag warn">Figures may be behind</span>
            <div className="small muted" style={{ flex: 1, minWidth: 220 }}>
              {feed.lastSyncAt
                ? `The wager data was last read from Razed ${relativeTime(
                    feed.lastSyncAt,
                  )}. Anything wagered since then is not counted below yet — it is not lost, and it lands on the next sync.`
                : monthly
                  ? `The wager data for ${month} has not been read from Razed yet, so there is nothing for the ladder to measure against until the next sync.`
                  : 'The wager data has never been read from Razed, so there is nothing for the ladder to measure against yet.'}
            </div>
          </div>
        </div>
      ) : null}

      {/* The link state, when it is the thing standing between someone and a
          claim. Shown separately from the header so it reads as an action
          rather than a status. */}
      {user && milestone.wagered != null && !wager.approved ? (
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
      {/* Payout rules: read before anyone claims                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="card" style={{ marginBottom: 18, borderColor: 'rgba(255,179,71,.4)' }}>
        <span className="eyebrow">Before you claim</span>
        <ul
          className="small muted"
          style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7, listStyle: 'disc' }}
        >
          {monthly ? (
            <li>
              Unclaimed tiers <b>do not carry over</b>. Claim before the ladder resets on{' '}
              <b>{resetsOn}</b>.
            </li>
          ) : null}
          <li>
            If you mainly play <b>Originals</b>, milestone rewards are <b>cut in half</b>.
          </li>
          <li>
            If <b>over 60%</b> of your wager is on <b>slots</b>, you can claim the{' '}
            <b>entire milestone</b>.
          </li>
          <li>
            Once you have claimed, please{' '}
            <a
              href={discordInvite}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline' }}
            >
              open a ticket in Discord
            </a>{' '}
            so your payout can be checked and sent.
          </li>
        </ul>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* The ladder                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="ladder">
        {ladder.map((rung, i) => {
          const { tier, state, claim } = rung;
          return (
            <div className={`tier ${state === 'paid' ? 'claimed' : state}`} key={tier.id}>
              <div className="tn">
                {state === 'paid'
                  ? '✓'
                  : state === 'pending'
                    ? '…'
                    : (tier.name.charAt(0) || `T${i + 1}`)}
              </div>
              <div>
                <div className="tt">
                  {tier.name}
                  <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>
                    {' · '}
                    {money(tier.threshold)} wagered
                  </span>
                </div>
                <div className="td">
                  {state === 'paid' && claim?.paidAt
                    ? `Claimed ${dateShort(claim.paidAt)} · tipped on Razed`
                    : state === 'pending'
                      ? 'Claimed — open a ticket in Discord to get it paid out'
                      : state === 'claimable'
                        ? 'Ready to claim — sent to your Razed account'
                        : user && milestone.wagered != null
                          ? `${money(Math.max(0, tier.threshold - wagered))} more wagered to unlock`
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
