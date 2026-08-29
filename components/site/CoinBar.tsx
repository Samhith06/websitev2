import Link from 'next/link';
import { coins } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Label, Num } from '@/components/ui/typography';
import { ButtonLink } from '@/components/ui/controls';
import { CoinMark } from '@/components/ui/marks';
import type { Viewer } from '@/lib/types';

/**
 * The coin bar (UI Spec §25). Brand-tinted: balance at 38px in blue, hairline
 * dividers, then earned this week and pending redemptions, the live earn rate
 * pushed right, and a "Coin history" outline button.
 *
 * Signed out, the prices on the page around it stay fully visible — only the
 * actions change. A price you can see is part of what makes the coin feel worth
 * earning.
 */
export function CoinBar({
  viewer,
  live,
  className,
  historyHref = '/me#ledger',
}: {
  viewer: Viewer;
  live: boolean;
  className?: string;
  historyHref?: string;
}) {
  if (!viewer.signedIn) {
    return (
      <div className={cn('rounded-[3px] border border-line bg-surface px-5 py-5', className)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Label className="mb-2">Your balance</Label>
            <p className="text-[15px] text-ink-2">
              Sign in with Discord to see your coins. Every price on this page stays visible either
              way.
            </p>
          </div>
          <ButtonLink href="/api/auth/signin?callbackUrl=%2F" variant="discord">
            Sign in with Discord
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-[3px] border border-brand-line bg-brand-bg', className)}>
      <div className="grid gap-px bg-brand-line lg:grid-cols-[1.3fr_1fr_1fr_1.4fr] [&>*]:bg-brand-bg">
        <div className="px-5 py-5">
          <Label className="mb-2">Balance</Label>
          <span className="flex items-center gap-2.5">
            <CoinMark size={28} variant="detail" />
            <Num tone="brand" className="text-[32px] font-medium leading-none lg:text-[38px]">
              {coins(viewer.balance)}
            </Num>
            <span className="font-mono text-[13px] text-muted">MC</span>
          </span>
        </div>

        <div className="px-5 py-5">
          <Label className="mb-2">Earned this week</Label>
          <Num className="text-[20px]">{coins(viewer.earnedThisWeek)}</Num>
        </div>

        <div className="px-5 py-5">
          <Label className="mb-2">Pending</Label>
          <Num tone={viewer.pendingRedemptions > 0 ? 'gold' : 'muted'} className="text-[20px]">
            {viewer.pendingRedemptions}
          </Num>
          <p className="mt-1 text-[12px] text-muted">
            {viewer.pendingRedemptions === 1 ? 'redemption' : 'redemptions'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5">
          <div>
            <Label className="mb-2">Earn rate</Label>
            {viewer.frozen.frozen ? (
              <p className="text-[13.5px] text-danger">Earning is paused on your account</p>
            ) : !viewer.kick ? (
              <Link href="/me" className="text-[13.5px] text-gold underline underline-offset-2">
                Link your Kick account to earn
              </Link>
            ) : live ? (
              <span className="flex items-center gap-2">
                <span className="size-1.5 animate-pulse-online rounded-full bg-online" aria-hidden />
                <Num tone="brand" className="text-[15px]">
                  {viewer.multiplier.value} MC / 3 min
                </Num>
                <span className="text-[12.5px] text-muted">({viewer.multiplier.value}× multiplier)</span>
              </span>
            ) : (
              <p className="text-[13.5px] text-muted">Earning resumes when Matty goes live</p>
            )}
          </div>
          <ButtonLink href={historyHref} variant="outline" size="sm">
            Coin history
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
