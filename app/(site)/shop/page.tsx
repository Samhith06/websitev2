import type { Metadata } from 'next';
import { Gift, MessageSquare, Shirt, Tv } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { shopItems, stream, viewer } from '@/lib/mock';
import { Display, Label, Num } from '@/components/ui/typography';
import { Button, Chip, ChipRow } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { CoinMark } from '@/components/ui/marks';
import { CoinBar } from '@/components/site/CoinBar';
import type { ShopCategory, ShopItem } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Coin shop',
  description:
    'Spend Matty Coins on giveaway entries, Discord perks, shoutouts and merch. Coins are earned by watching and cannot be bought.',
};

const CATEGORIES: Array<{ value: ShopCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'entries', label: 'Entries' },
  { value: 'discord', label: 'Discord' },
  { value: 'merch', label: 'Merch' },
  { value: 'stream', label: 'On stream' },
];

const CATEGORY_STYLE: Record<ShopCategory, { icon: typeof Gift; tint: string; label: string }> = {
  entries: { icon: Gift, tint: 'bg-brand-bg text-brand border-brand-line', label: 'Entry' },
  discord: { icon: MessageSquare, tint: 'bg-[#141A38] text-[#8f9bf5] border-[#252d5c]', label: 'Discord' },
  merch: { icon: Shirt, tint: 'bg-gold-bg text-gold border-gold-line', label: 'Merch' },
  stream: { icon: Tv, tint: 'bg-surface-2 text-ink-2 border-line-2', label: 'On stream' },
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active = (CATEGORIES.find((c) => c.value === category)?.value ?? 'all') as ShopCategory | 'all';

  const items = shopItems.filter((i) => i.active && (active === 'all' || i.category === active));
  const zeroCoins = viewer.signedIn && viewer.balance === 0;

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Label className="mb-3 flex items-center gap-2">
            <CoinMark size={15} />
            Earned by watching · never for sale
          </Label>
          <Display size="l" as="h1">
            Coin shop
          </Display>
        </div>

        <ChipRow label="Shop category">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              as="link"
              href={c.value === 'all' ? '/shop' : `/shop?category=${c.value}`}
              active={active === c.value}
            >
              {c.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <CoinBar viewer={viewer} live={stream.live} className="mt-8" />

      {zeroCoins ? (
        <p className="mt-4 text-[14px] text-muted">
          Watch a stream to start earning — prices stay right where they are in the meantime.
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} signedIn={viewer.signedIn} balance={viewer.balance} />
        ))}
      </div>

      <p className="mt-10 max-w-2xl text-[13.5px] leading-relaxed text-muted">
        Merch and on-stream redemptions are reviewed by a moderator, usually within a day. A
        rejected redemption refunds your coins automatically and tells you why. Entries and Discord
        roles are granted straight away.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ItemCard({
  item,
  signedIn,
  balance,
}: {
  item: ShopItem;
  signedIn: boolean;
  balance: number;
}) {
  const style = CATEGORY_STYLE[item.category];
  const Icon = style.icon;

  const outOfStock = item.stock === 0;
  const onCooldown = (item.cooldownDaysRemaining ?? 0) > 0;
  // Never hide an unavailable item — its price is part of what makes the coin
  // feel worth earning (§10).
  const unavailable = outOfStock || onCooldown;
  const affordable = !signedIn || balance >= item.cost;

  return (
    <Card hover className={cn('flex flex-col', unavailable && 'opacity-55')}>
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
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
        <span className="flex items-center gap-1.5">
          <CoinMark size={16} />
          <Num tone={unavailable ? 'muted' : 'brand'} className="text-[20px] font-medium leading-none">
            {coins(item.cost)}
          </Num>
        </span>

        {outOfStock ? (
          <span className="rounded-[2px] border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
            Out of stock
          </span>
        ) : onCooldown ? (
          <span className="rounded-[2px] border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
            In {item.cooldownDaysRemaining} days
          </span>
        ) : !signedIn ? (
          <Button size="sm" variant="discord">
            Sign in to redeem
          </Button>
        ) : (
          <Button size="sm" disabled={!affordable}>
            {affordable ? 'Redeem' : `Need ${coins(item.cost - balance)}`}
          </Button>
        )}
      </div>
    </Card>
  );
}
