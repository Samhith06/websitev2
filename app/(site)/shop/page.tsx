import type { Metadata } from 'next';
import { Gift, MessageSquare, Shirt, Tv } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { listItems } from '@/lib/store/shop';
import { currentStream } from '@/lib/store/stream';
import { viewerOrSignedOut } from '@/lib/viewer';
import { currentUser } from '@/lib/player';
import { Display, Label, Num } from '@/components/ui/typography';
import { Button, Chip, ChipRow } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { CoinMark } from '@/components/ui/marks';
import { CoinBar } from '@/components/site/CoinBar';
import { ShopItemCard } from '@/components/site/ShopItemCard';
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

export const dynamic = 'force-dynamic';

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active = (CATEGORIES.find((c) => c.value === category)?.value ?? 'all') as ShopCategory | 'all';

  const [viewer, stream, user] = await Promise.all([
    viewerOrSignedOut(), currentStream(), currentUser(),
  ]);
  // The catalogue is per-viewer: a cooldown is personal, so it is computed for
  // this account rather than shown as a property of the item.
  const catalogue = await listItems(user?.id ?? null);
  const items = catalogue.filter((i) => active === 'all' || i.category === active);
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
          <ShopItemCard
            key={item.id}
            item={item}
            signedIn={viewer.signedIn}
            balance={viewer.balance}
            needsReview={item.needsReview}
          />
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
