'use client';

import { useState, useTransition } from 'react';
import { Gift, MessageSquare, Shirt, Tv } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { Button } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { CoinMark } from '@/components/ui/marks';
import { redeemItem, type RedeemOutcome } from '@/app/(site)/shop/actions';
import type { ShopCategory, ShopItem } from '@/lib/types';

const CATEGORY_STYLE: Record<ShopCategory, { icon: typeof Gift; tint: string; label: string }> = {
  entries: { icon: Gift, tint: 'bg-brand-bg text-brand border-brand-line', label: 'Entry' },
  discord: { icon: MessageSquare, tint: 'bg-[#141A38] text-[#8f9bf5] border-[#252d5c]', label: 'Discord' },
  merch: { icon: Shirt, tint: 'bg-gold-bg text-gold border-gold-line', label: 'Merch' },
  stream: { icon: Tv, tint: 'bg-surface-2 text-ink-2 border-line-2', label: 'On stream' },
};

/**
 * One item, and the button that actually spends coins.
 *
 * The button asks once and then confirms, because a redemption cannot be
 * undone by the person who made it — a mis-click on a 1,250 MC hoodie is six
 * weeks of watching. Everything that could refuse the purchase is re-checked on
 * the server against locked rows; this is only the part a person sees.
 */
export function ShopItemCard({
  item,
  signedIn,
  balance,
  needsReview,
}: {
  item: ShopItem;
  signedIn: boolean;
  balance: number;
  needsReview: boolean;
}) {
  const style = CATEGORY_STYLE[item.category];
  const Icon = style.icon;

  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<RedeemOutcome | null>(null);
  const [pending, start] = useTransition();

  const outOfStock = item.stock === 0;
  const onCooldown = (item.cooldownDaysRemaining ?? 0) > 0;
  // Never hide an unavailable item — its price is part of what makes the coin
  // feel worth earning.
  const unavailable = outOfStock || onCooldown;
  const affordable = !signedIn || balance >= item.cost;
  const bought = result?.ok === true;

  function confirm() {
    start(async () => {
      const outcome = await redeemItem(Number(item.id));
      setResult(outcome);
      setConfirming(false);
    });
  }

  return (
    <Card hover className={cn('flex flex-col', unavailable && !bought && 'opacity-55')}>
      <div className={cn('grid h-24 place-items-center border-b', style.tint)}>
        <Icon size={26} strokeWidth={1.6} />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <Label className="mb-2">{style.label}</Label>
        <h2 className="text-[16px] font-semibold leading-snug text-ink">{item.name}</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{item.description}</p>

        {item.stock !== null && item.stock > 0 ? (
          <p className="mt-3 font-mono text-[11.5px] tabular-nums text-faint">{item.stock} left</p>
        ) : null}

        {needsReview && !bought ? (
          <p className="mt-3 font-mono text-[11px] text-faint">Reviewed by a moderator</p>
        ) : null}

        {result ? (
          <p
            className={cn(
              'mt-3 text-[12.5px] leading-relaxed',
              result.ok ? 'text-brand' : 'text-danger',
            )}
            role="status"
          >
            {result.ok ? result.message : result.error}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <span className="flex items-center gap-1.5">
          <CoinMark size={16} />
          <Num tone={unavailable ? 'muted' : 'brand'} className="text-[20px] font-medium leading-none">
            {coins(item.cost)}
          </Num>
        </span>

        {bought ? (
          <span className="rounded-[2px] border border-brand-line bg-brand-bg px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-brand">
            Redeemed
          </span>
        ) : outOfStock ? (
          <Pill>Out of stock</Pill>
        ) : onCooldown ? (
          <Pill>In {item.cooldownDaysRemaining} days</Pill>
        ) : !signedIn ? (
          <Button size="sm" variant="discord" onClick={() => setResult({ ok: false, error: 'Sign in with Discord to spend coins.' })}>
            Sign in to redeem
          </Button>
        ) : confirming ? (
          <span className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirm} disabled={pending}>
              {pending ? 'Redeeming…' : `Confirm ${coins(item.cost)}`}
            </Button>
          </span>
        ) : (
          <Button size="sm" disabled={!affordable} onClick={() => setConfirming(true)}>
            {affordable ? 'Redeem' : `Need ${coins(item.cost - balance)}`}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[2px] border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
      {children}
    </span>
  );
}
