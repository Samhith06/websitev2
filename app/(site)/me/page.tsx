import Link from 'next/link';
import type { Metadata } from 'next';
import { BadgeCheck, Dices, Gift } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins, dateShort, money, relativeTime } from '@/lib/format';
import { activeClaim, discordInvite} from '@/lib/mock';
import { currentStream } from '@/lib/store/stream';
import { currentUser } from '@/lib/player';
import { currentViewer } from '@/lib/viewer';
import { verificationStateFor } from '@/lib/store/accounts';
import { ledgerFor } from '@/lib/store/coins';
import { pendingCountFor, redemptionsFor } from '@/lib/store/shop';
import { Display, Label, Num } from '@/components/ui/typography';
import { Button, ButtonLink, StatusDot } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { CoinMark, PlatformMark } from '@/components/ui/marks';
import { Verification } from '@/components/site/Verification';
import { Ledger } from '@/components/site/Ledger';
import { LimitsBlock } from '@/components/site/LimitsBlock';
import { ProfileMobile } from '@/components/site/ProfileMobile';

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
// Everything on this page is the signed-in person's own data, so none of it can
// be prerendered.
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await currentUser();
  const viewer = user ? await currentViewer() : null;
  if (!user || !viewer) return <SignedOut />;

  const [verification, ledger, stream, redemptions, pending] = await Promise.all([
    verificationStateFor(user.id),
    ledgerFor(user.id, 60),
    currentStream(),
    redemptionsFor(user.id, 20),
    pendingCountFor(user.id),
  ]);

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

      {/* ================================================================= */}
      {/* Desktop. Two columns, from the supplied reference: identity and     */}
      {/* connections on the left, the detail stack on the right.            */}
      {/* ================================================================= */}
      <div className="relative hidden lg:block">
        {/* Atmospheric layers, scoped to this page. */}
        <div className="page-grain" aria-hidden />
        <div className="page-glow" aria-hidden />

        <div className="container-page relative z-10 py-10 lg:py-12">
          <div className="grid grid-cols-12 gap-5">
            {/* ========================================================= */}
            {/* Left: identity and connections                            */}
            {/* ========================================================= */}
            <div className="col-span-4 flex flex-col gap-5">
              <section id="overview" className="scroll-mt-24">
                <div className="glass relative flex flex-col items-center overflow-hidden p-6 text-center">
                  <span
                    className="pointer-events-none absolute -top-16 left-1/2 size-32 -translate-x-1/2 rounded-full bg-brand opacity-20 blur-3xl"
                    aria-hidden
                  />

                  <div className="relative mb-4 size-24">
                    <span className="bloom-blue absolute inset-0 rounded-full" aria-hidden />
                    <span className="relative z-10 grid size-full place-items-center rounded-full border-2 border-brand bg-bg text-[28px] font-bold uppercase text-brand">
                      {viewer.discordUsername.slice(0, 2)}
                    </span>
                    <span className="absolute -bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5">
                      <BadgeCheck size={12} className="text-brand" />
                      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink">
                        {tier}
                      </span>
                    </span>
                  </div>

                  <Display size="s" as="p" className="mb-1">
                    {viewer.discordUsername}
                  </Display>
                  <p className="mb-6 text-[14px] text-muted">
                    {viewer.multiplier.label} · Member since {dateShort(viewer.memberSince)}
                  </p>

                  {/* Balance, not a wallet. Gold means money; there is no
                      deposit, no withdraw and nothing here can be cashed out. */}
                  <div className="relative w-full overflow-hidden rounded-[10px] border border-line bg-[#0a0e17] p-4 text-left">
                    <span className="absolute left-0 top-0 h-full w-1 bg-gold" aria-hidden />
                    <Label className="mb-1.5">Total MC balance</Label>
                    <div className="flex items-end gap-2">
                      <CoinMark size={20} variant="detail" />
                      <Num tone="gold" className="text-[34px] font-medium leading-none tracking-tight">
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
              </section>

              {/* Connections and settings */}
              <div className="glass flex flex-col gap-1 p-4">
                <Label className="mb-2 px-2">Connections &amp; settings</Label>

                <ConnectionRow
                  icon={<PlatformMark platform="discord" size={17} className="text-ink-2" />}
                  title="Discord"
                  detail={`Signed in as ${viewer.discordUsername}`}
                  action={
                    <Link href="/api/auth/signout" className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger hover:underline">
                      Sign out
                    </Link>
                  }
                />

                {/* An unlinked account earns nothing, and that is the first
                    thing to check when someone says coins are broken. It is
                    the loudest row in this panel on purpose. */}
                <ConnectionRow
                  icon={<PlatformMark platform="kick" size={17} className={linked ? 'text-brand' : 'text-gold'} />}
                  title="Kick verification"
                  detail={linked && viewer.kick ? `Verified as ${viewer.kick.kickUsername}` : 'Not linked. Coins are blocked.'}
                  accent={!linked}
                  action={
                    <span className={cn(
                      'rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]',
                      linked ? 'bg-brand/10 text-brand' : 'bg-gold-bg text-gold',
                    )}>
                      {linked ? 'Linked' : 'Pending'}
                    </span>
                  }
                />

                <ConnectionRow
                  icon={<Gift size={17} className="text-ink-2" />}
                  title="Pending redemptions"
                  detail={pending > 0 ? `${pending} waiting on a moderator` : 'Nothing pending'}
                  action={
                    pending > 0 ? (
                      <span className="grid size-5 place-items-center rounded-full bg-surface-2 font-mono text-[10px] text-ink">
                        {pending}
                      </span>
                    ) : (
                      <Link href="#redemptions" className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand hover:underline">
                        View
                      </Link>
                    )
                  }
                />

                <ConnectionRow
                  icon={<Dices size={17} className={viewer.games.enabled ? 'text-ink-2' : 'text-faint'} />}
                  title="Games"
                  detail={viewer.games.enabled ? 'Switched on for your account' : 'Switched off'}
                  action={
                    <Link href="#limits" className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand hover:underline">
                      Settings
                    </Link>
                  }
                />
              </div>
            </div>

            {/* ========================================================= */}
            {/* Right: stats, verification, ledger                        */}
            {/* ========================================================= */}
            <div className="col-span-8 flex min-w-0 flex-col gap-5">
              <div className="grid grid-cols-4 gap-4">
                <StatTile label="Lifetime earned" value={coins(viewer.lifetimeEarned)} tone="gold" coin />
                <StatTile label="Earned this week" value={coins(viewer.earnedThisWeek)} tone="gold" coin />
                <StatTile label="Coins spent" value={coins(Math.max(0, spent))} tone="ink-2" coin />
                <StatTile
                  label="Net from games today"
                  value={`${viewer.games.netToday >= 0 ? '+' : '\u2212'}${coins(Math.abs(viewer.games.netToday))}`}
                  tone={viewer.games.netToday < 0 ? 'danger' : viewer.games.netToday > 0 ? 'gold' : 'ink-2'}
                  coin
                />
              </div>

              {/* The most important component on the site: the first thing a
                  new user does, and the thing that tells them whether any of
                  this works. It sits at the top of the detail stack. */}
              <Verification initial={verification} live={stream.live} />

              <section id="coins" className="scroll-mt-24">
                <div className="glass overflow-hidden">
                  <div className="flex items-center justify-between border-b border-line px-6 py-5">
                    <Display size="s" as="h2">Coin ledger</Display>
                    <span className="font-mono text-[11px] tabular-nums text-faint">
                      {stream.live
                        ? `Earning ${viewer.multiplier.value} MC every 3 min`
                        : 'Earning resumes when Matty goes live'}
                    </span>
                  </div>
                  {/* Ledger draws its own bordered box. Inside the glass
                      panel that would double the border, so it is flattened
                      here rather than by adding a prop to the component. */}
                  <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:border-t-0">
                    <Ledger entries={ledger} />
                  </div>
                  <p className="border-t border-line px-6 py-4 text-[13px] text-muted">
                    Watch sessions are grouped rather than listed as forty separate three-minute
                    rows. Click one to see the individual ticks behind it.
                  </p>
                </div>
              </section>
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
      <div className="container-page relative z-10 space-y-6 pb-12">
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
          {/* Desktop renders the ledger in the right-hand stack above, so only
              the phone needs it here. Two instances would mean a duplicate
              `coins` id and the same table rendered twice. */}
          <section className="scroll-mt-24 lg:hidden">
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
            {redemptions.length === 0 ? (
              <Card className="px-5 py-6">
                <p className="text-[14px] text-muted">
                  Nothing redeemed yet. Anything you buy in the{' '}
                  <Link href="/shop" className="text-brand underline underline-offset-2">
                    shop
                  </Link>{' '}
                  appears here with its status while a moderator works through it.
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {redemptions.map((r) => (
                  <Card key={r.id} tone={r.status === 'rejected' ? 'danger' : 'default'}>
                    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-[14.5px] text-ink">{r.itemName}</p>
                        <p className="mt-1 flex items-center gap-2 font-mono text-[11.5px] tabular-nums text-faint">
                          <CoinMark size={12} />
                          {coins(r.cost)} · {relativeTime(r.createdAt)}
                          {r.handledBy ? ` · handled by ${r.handledBy}` : ''}
                        </p>
                        {/* A rejection always carries its reason, and the coins
                            come back automatically — the shop promises both. */}
                        {r.reason ? (
                          <p className="mt-1.5 text-[13px] text-danger">{r.reason}</p>
                        ) : null}
                      </div>
                      <StatusDot tone={r.status === 'rejected' ? 'danger' : r.status === 'fulfilled' ? 'brand' : 'gold'}>
                        {r.status}
                      </StatusDot>
                    </div>
                  </Card>
                ))}
              </div>
            )}
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
            {/* Desktop renders this in the right-hand stack above, so only the
                phone needs it here. Two live instances would mean two polling
                loops and duplicate ids. */}
            <div className="lg:hidden">
              <Verification initial={verification} live={stream.live} />
            </div>

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
  label,
  value,
  tone = 'ink-2',
  coin = false,
}: {
  label: string;
  value: string;
  tone?: 'gold' | 'ink-2' | 'danger';
  coin?: boolean;
}) {
  const tones = { gold: 'text-gold', 'ink-2': 'text-ink-2', danger: 'text-danger' } as const;
  const wash = {
    gold: 'bg-gold/5',
    'ink-2': 'bg-transparent',
    danger: 'bg-danger/5',
  } as const;

  return (
    <div className="glass glass-hover relative flex h-28 flex-col justify-between overflow-hidden p-4 transition-colors duration-150">
      <span className={cn('pointer-events-none absolute right-0 top-0 size-16 rounded-bl-full', wash[tone])} aria-hidden />
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</span>
      <span className="mt-auto flex items-center gap-1.5">
        {coin ? <CoinMark size={15} className={tone === 'gold' ? undefined : 'opacity-45'} /> : null}
        <span className={cn('font-mono text-[24px] font-medium leading-none tracking-tight tabular-nums', tones[tone])}>
          {value}
        </span>
      </span>
    </div>
  );
}

function ConnectionRow({
  icon,
  title,
  detail,
  action,
  accent = false,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  action: React.ReactNode;
  /** The unlinked-Kick row, which costs someone money if they miss it. */
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-[10px] border px-3 py-3 transition-colors duration-150',
        accent
          ? 'border-line border-l-2 border-l-gold bg-surface-2/50'
          : 'border-transparent hover:border-line hover:bg-surface-2/50',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[14px] text-ink">{title}</p>
          <p className="truncate text-[12px] text-muted">{detail}</p>
        </div>
      </div>
      <span className="shrink-0">{action}</span>
    </div>
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
