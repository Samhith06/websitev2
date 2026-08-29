import Link from 'next/link';
import type { Metadata } from 'next';
import { Coins, Dices, Gift, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins, dateShort, money, relativeTime } from '@/lib/format';
import {
  activeClaim, discordInvite, ledger, redemptions, stream, verification, viewer,
} from '@/lib/mock';
import { Display, Label, Num } from '@/components/ui/typography';
import { Button, ButtonLink, StatusDot } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { CoinMark, PlatformMark } from '@/components/ui/marks';
import { Verification } from '@/components/site/Verification';
import { Ledger } from '@/components/site/Ledger';
import { LimitsBlock } from '@/components/site/LimitsBlock';
import { ProfileSidebar } from '@/components/site/ProfileSidebar';
import { ProfileMobile } from '@/components/site/ProfileMobile';
import type { Redemption } from '@/lib/types';

export const metadata: Metadata = {
  title: 'My profile',
  description: 'Your Matty Coins, ledger, redemptions and play settings.',
};

/**
 * The profile, laid out from the supplied reference: a docked sub-nav, a header
 * card carrying identity and balance, a bento of stats, quick settings, and the
 * history table.
 *
 * Two things from that reference are deliberately absent — Deposit and
 * Withdraw. Matty Coins cannot be bought and have no cash value, and that is
 * the single decision keeping this site promotional rather than a licensed
 * operator (Master Plan §12). A deposit button here would undo it.
 */
export default function ProfilePage() {
  if (!viewer.signedIn) return <SignedOut />;

  const linked = verification.status === 'linked';
  const spent = viewer.lifetimeEarned - viewer.balance;
  const tier = viewer.multiplier.value >= 2.5 ? 'VIP' : viewer.multiplier.value >= 2 ? 'Sub' : 'Member';

  return (
    <>
      {/* Both layouts are in the DOM at once, so the page heading lives here,
          once, rather than being duplicated inside each of them. */}
      <h1 className="sr-only">My profile</h1>

      {/* The phone gets its own layout; the two are different enough that one
          responsive tree would be worse than two clear ones. */}
      <ProfileMobile viewer={viewer} ledger={ledger} tier={tier} live={stream.live} />

      <div className="container-page hidden py-8 lg:block lg:py-12">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-start">
        <ProfileSidebar
          username={viewer.discordUsername}
          tier={tier}
          discordInvite={discordInvite}
        />

        <div className="min-w-0 space-y-6">
          {/* ========================================================= */}
          {/* Header card                                               */}
          {/* ========================================================= */}
          <section id="overview" className="scroll-mt-24">
            <Card className="relative overflow-hidden">
              <span
                className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-brand/10 blur-3xl"
                aria-hidden
              />
              <div className="relative flex flex-col items-center gap-5 p-5 md:flex-row md:items-start lg:p-6">
                <div className="relative shrink-0">
                  <span className="grid size-24 place-items-center rounded-full bg-gradient-to-br from-brand to-surface p-0.5">
                    <span className="grid size-full place-items-center rounded-full bg-bg text-[26px] font-bold uppercase text-brand">
                      {viewer.discordUsername.slice(0, 2)}
                    </span>
                  </span>
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-[5px] border-2 border-bg bg-gold px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-brand-ink">
                    {tier}
                  </span>
                </div>

                <div className="flex-1 text-center md:pt-1 md:text-left">
                  <Display size="s" as="p">
                    {viewer.discordUsername}
                  </Display>
                  <p className="mt-2 text-[13.5px] text-muted">
                    Member since {dateShort(viewer.memberSince)}
                    {linked && viewer.kick ? ` · Kick as ${viewer.kick.kickUsername}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5 md:justify-start">
                    <Tag>{viewer.multiplier.value}× multiplier</Tag>
                    <Tag>{viewer.multiplier.label}</Tag>
                    {viewer.frozen.frozen ? <Tag tone="danger">Earning paused</Tag> : null}
                  </div>
                </div>

                {/* Balance, not a wallet. Nothing here can be cashed out. */}
                <div className="w-full shrink-0 rounded-[10px] border border-line bg-bg/50 p-5 text-center md:w-auto md:min-w-[210px] md:text-right">
                  <Label className="mb-2">Coin balance</Label>
                  <div className="flex items-center justify-center gap-2 md:justify-end">
                    <CoinMark size={24} variant="detail" />
                    <Num tone="brand" className="text-[30px] font-medium leading-none">
                      {coins(viewer.balance)}
                    </Num>
                  </div>
                  <p className="mt-3 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed text-faint">
                    Earned by watching. Cannot be bought, sold or withdrawn.
                  </p>
                  <ButtonLink href="/shop" variant="outline" size="sm" full className="mt-3">
                    Spend in the shop
                  </ButtonLink>
                </div>
              </div>
            </Card>
          </section>

          {/* ========================================================= */}
          {/* Stats bento + quick settings                              */}
          {/* ========================================================= */}
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="grid grid-cols-2 gap-3 lg:col-span-8">
              <StatTile
                Icon={Coins}
                label="Lifetime earned"
                value={coins(viewer.lifetimeEarned)}
              />
              <StatTile
                Icon={Sparkles}
                label="Earned this week"
                value={coins(viewer.earnedThisWeek)}
              />
              <StatTile
                Icon={TrendingUp}
                label="Coins spent"
                value={coins(Math.max(0, spent))}
              />
              <StatTile
                Icon={Dices}
                label="Net from games today"
                value={`${viewer.games.netToday >= 0 ? '+' : '−'}${coins(Math.abs(viewer.games.netToday))}`}
                tone={viewer.games.netToday < 0 ? 'danger' : 'gold'}
                highlight
              />
            </div>

            <Card className="lg:col-span-4">
              <div className="border-b border-line px-5 py-3.5">
                <Label>Quick settings</Label>
              </div>
              <div className="divide-y divide-line">
                <SettingRow
                  icon={<PlatformMark platform="discord" size={16} className="text-brand" />}
                  title="Discord"
                  detail={`Signed in as ${viewer.discordUsername}`}
                  action={<Link href="/api/auth/signout" className="text-[12px] text-danger hover:underline">Sign out</Link>}
                />
                <SettingRow
                  icon={<PlatformMark platform="kick" size={16} className={linked ? 'text-brand' : 'text-gold'} />}
                  title="Kick account"
                  detail={linked && viewer.kick ? `Verified as ${viewer.kick.kickUsername}` : 'Not linked — coins are blocked'}
                  action={
                    <Link href="#security" className="text-[12px] text-brand hover:underline">
                      {linked ? 'Manage' : 'Link'}
                    </Link>
                  }
                />
                <SettingRow
                  icon={<Gift size={16} className="text-muted" />}
                  title="Pending redemptions"
                  detail={`${viewer.pendingRedemptions} awaiting a moderator`}
                  action={<Link href="#redemptions" className="text-[12px] text-brand hover:underline">View</Link>}
                />
                <SettingRow
                  icon={<Dices size={16} className={viewer.games.enabled ? 'text-brand' : 'text-faint'} />}
                  title="Games"
                  detail={viewer.games.enabled ? 'Switched on for your account' : 'Switched off'}
                  action={<Link href="#limits" className="text-[12px] text-brand hover:underline">Settings</Link>}
                />
              </div>
            </Card>
          </div>
        </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* Shared. These used to sit inside the desktop-only wrapper, which meant
          a phone had no way to reach self-exclusion at all — a control that has
          to be available wherever someone can play. Rendered once, for every
          viewport, rather than duplicated per layout. */}
      {/* ==================================================================== */}
      <div className="container-page space-y-6 pb-12">
          <section id="claims" className="scroll-mt-24">
            <Label className="mb-3">Prize claims</Label>
            {activeClaim ? (
              <Card tone="gold">
                <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
                  <div>
                    <Label className="mb-2 text-gold/70">Claim {activeClaim.reference}</Label>
                    <p className="text-[15px] text-ink">
                      {activeClaim.periodLabel} · position {activeClaim.rank} ·{' '}
                      <span className="font-mono text-gold">{money(activeClaim.amount)}</span>
                    </p>
                    <p className="mt-1.5 text-[13.5px] text-muted">
                      Submitted {relativeTime(activeClaim.createdAt)} as {activeClaim.claimedUsername}
                    </p>
                  </div>
                  <StatusDot tone="gold">{activeClaim.status}</StatusDot>
                </div>
              </Card>
            ) : (
              <Card className="px-5 py-6">
                <p className="text-[14px] text-muted">
                  No open claims. When a board freezes,{' '}
                  <Link href="/leaderboard/claim" className="text-brand underline underline-offset-2">
                    claim your position
                  </Link>{' '}
                  and it appears here.
                </p>
              </Card>
            )}
          </section>

          {/* ========================================================= */}
          {/* Coin history                                              */}
          {/* ========================================================= */}
          <section id="coins" className="scroll-mt-24">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <Label>Coin history</Label>
              <span className="font-mono text-[11.5px] tabular-nums text-faint">
                {stream.live ? `Earning ${viewer.multiplier.value} MC every 3 min` : 'Earning resumes when Matty goes live'}
              </span>
            </div>
            <Ledger entries={ledger} />
            <p className="mt-3 text-[13px] text-muted">
              Watch sessions are grouped rather than listed as forty separate three-minute rows.
              Click one to see the individual ticks behind it.
            </p>
          </section>

          {/* ========================================================= */}
          {/* Redemptions                                               */}
          {/* ========================================================= */}
          <section id="redemptions" className="scroll-mt-24">
            <Label className="mb-3">Redemptions</Label>
            <div className="space-y-2">
              {redemptions
                .filter((r) => r.member === viewer.discordUsername)
                .map((redemption) => (
                  <RedemptionRow key={redemption.id} redemption={redemption} />
                ))}
            </div>
          </section>

          {/* ========================================================= */}
          {/* Play settings                                             */}
          {/* ========================================================= */}
          <section id="limits" className="scroll-mt-24">
            <Label className="mb-3">Play settings</Label>
            {viewer.games.enabled ? (
              <LimitsBlock limits={viewer.games} />
            ) : (
              <Card className="px-5 py-5">
                <p className="text-[14.5px] text-ink-2">
                  Games are switched off for your account.{' '}
                  <Link href="/games" className="text-brand underline underline-offset-2">
                    Turn them on
                  </Link>{' '}
                  behind an 18+ confirmation.
                </p>
              </Card>
            )}
          </section>

          {/* ========================================================= */}
          {/* Account — Kick verification and deletion                  */}
          {/* ========================================================= */}
          <section id="security" className="scroll-mt-24 space-y-4">
            <Label className="mb-3 block">Account</Label>
            <Verification initial={verification} live={stream.live} />

            <Card tone="danger">
              <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-5">
                <div className="max-w-2xl">
                  <p className="text-[15px] text-ink">Delete my account</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                    Your Discord link, your Kick link and your coin balance go, permanently and
                    immediately. What stays: the ledger rows themselves, anonymised, because they
                    are the accounting record behind every coin ever issued; any giveaway you have
                    already won, since the winner list is never edited; and any prize claim already
                    paid.
                  </p>
                  <p className="mt-2 text-[13.5px] text-muted">
                    Coins have no cash value and are not refundable. Deleting forfeits the balance.
                  </p>
                </div>
                <Button variant="danger">Delete my account</Button>
              </div>
            </Card>
          </section>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function StatTile({
  Icon,
  label,
  value,
  tone = 'ink',
  highlight = false,
}: {
  Icon: typeof Coins;
  label: string;
  value: string;
  tone?: 'ink' | 'gold' | 'danger';
  highlight?: boolean;
}) {
  const tones = { ink: 'text-ink', gold: 'text-gold', danger: 'text-danger' } as const;
  return (
    <div
      className={cn(
        'flex h-[122px] flex-col justify-between rounded-[10px] border p-4 transition-colors duration-150',
        highlight ? 'border-brand-line bg-brand-bg' : 'border-line bg-surface hover:border-line-2',
      )}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        <Icon size={13} strokeWidth={2} />
        {label}
      </span>
      <span className={cn('font-mono text-[24px] font-medium leading-none tabular-nums', tones[tone])}>
        {value}
      </span>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] text-ink">{title}</p>
          <p className="truncate text-[11.5px] text-muted">{detail}</p>
        </div>
      </div>
      <span className="shrink-0">{action}</span>
    </div>
  );
}

function Tag({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <span
      className={cn(
        'rounded-[5px] border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em]',
        tone === 'danger'
          ? 'border-danger-line bg-danger-bg text-danger'
          : 'border-line bg-surface-2 text-muted',
      )}
    >
      {children}
    </span>
  );
}

function RedemptionRow({ redemption }: { redemption: Redemption }) {
  const tone =
    redemption.status === 'rejected' ? 'danger'
    : redemption.status === 'fulfilled' ? 'brand'
    : 'gold';

  return (
    <Card tone={redemption.status === 'rejected' ? 'danger' : 'default'}>
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[14.5px] text-ink">{redemption.itemName}</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-[11.5px] tabular-nums text-faint">
            <CoinMark size={12} />
            {coins(redemption.cost)} · {relativeTime(redemption.createdAt)}
            {redemption.handledBy ? ` · handled by ${redemption.handledBy}` : ''}
          </p>
          {redemption.reason ? (
            <p className="mt-1.5 text-[13px] text-danger">{redemption.reason}</p>
          ) : null}
        </div>
        <StatusDot tone={tone}>{redemption.status}</StatusDot>
      </div>
    </Card>
  );
}

function SignedOut() {
  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-lg text-center">
        <Display size="m" as="h1">
          Sign in
        </Display>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Signing in with Discord creates your account and lets you link a Kick username. That link
          is what earns coins — everything else on the site is readable without an account.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/api/auth/signin?callbackUrl=%2Fme" variant="discord" size="lg">
            <PlatformMark platform="discord" size={17} />
            Sign in with Discord
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
