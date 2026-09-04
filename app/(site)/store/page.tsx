import Link from 'next/link';
import type { Metadata } from 'next';
import { currentUser } from '@/lib/player';
import { listItems } from '@/lib/store/shop';
import { balanceOf } from '@/lib/store/coins';
import { coins } from '@/lib/format';
import { RedeemButton } from '@/components/site/RedeemButton';
import type { ShopCategory } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Store',
  description:
    'Spend Matty Coins earned in chat on merch, Razed bonus tips, raffle tickets and Discord perks. No real-money checkout.',
};

export const dynamic = 'force-dynamic';

/** The shelves, and which stored categories each one gathers. */
const TABS: Array<{ key: string; label: string; categories: ShopCategory[] }> = [
  { key: 'merch', label: 'Merch', categories: ['merch'] },
  { key: 'tips', label: 'Bonus & tips', categories: ['tips'] },
  { key: 'tickets', label: 'Raffle tickets', categories: ['entries'] },
  { key: 'perks', label: 'Perks', categories: ['discord', 'stream'] },
];

/** A stand-in mark per shelf, used until an item carries its own image. */
const SYMBOLS: Record<ShopCategory, string> = {
  merch: '▣',
  tips: '$',
  entries: '✦',
  discord: '◈',
  stream: '◎',
};

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const user = await currentUser();

  const [items, balance] = await Promise.all([
    listItems(user?.id ?? null),
    user ? balanceOf(user.id) : Promise.resolve({ balance: 0, lifetimeEarned: 0 }),
  ]);

  // Only shelves with something on them are offered. An empty tab is a dead
  // end that looks like a bug.
  const stocked = TABS.filter((t) => items.some((i) => t.categories.includes(i.category)));
  const active = stocked.find((t) => t.key === tab) ?? stocked[0] ?? null;
  const shown = active ? items.filter((i) => active.categories.includes(i.category)) : [];

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">Coins only · no real-money checkout</span>
          <h1>Store</h1>
          <div className="sh-sub">Everything here is redeemed with Matty Coins earned in chat</div>
        </div>
      </div>

      <div className="balbar">
        <div>
          <div className="eyebrow">Your balance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div className="coin lg" aria-hidden>
              M
            </div>
            <span className="bv">{user ? coins(balance.balance) : '—'}</span>
          </div>
        </div>
        <div className="small muted" style={{ maxWidth: '44ch' }}>
          Earn 1 coin per 3 minutes chatting during the stream, ×2 as a sub, ×2.5 as a VIP, ×3 for
          both, plus 10 bonus coins for every unbroken hour. Capped at 500 coins per stream.
        </div>
      </div>

      {stocked.length === 0 ? (
        <div className="emptyq">
          The store is empty right now. New items are added from the staff area.
        </div>
      ) : (
        <>
          <div className="tabs">
            {stocked.map((t) => (
              <Link
                key={t.key}
                href={`/store?tab=${t.key}`}
                className={active?.key === t.key ? 'on' : ''}
                scroll={false}
              >
                {t.label}
              </Link>
            ))}
          </div>

          <div className="sgrid">
            {shown.map((item) => {
              const outOfStock = item.stock === 0;
              const onCooldown = (item.cooldownDaysRemaining ?? 0) > 0;
              const short = user ? Math.max(0, item.cost - balance.balance) : 0;
              const cant = Boolean(user) && (short > 0 || outOfStock || onCooldown);

              return (
                <div className={`item ${cant ? 'cant' : ''}`} key={item.id}>
                  <div className="iimg">
                    <span className="sym" aria-hidden>
                      {SYMBOLS[item.category] ?? '▣'}
                    </span>
                    {item.stock !== null && item.stock > 0 && item.stock <= 5 ? (
                      <span
                        className="badge tag warn"
                        style={{ position: 'absolute', top: 9, left: 9 }}
                      >
                        Only {item.stock} left
                      </span>
                    ) : null}
                  </div>

                  <div className="ib">
                    <div className="it">{item.name}</div>
                    <div className="ip">
                      <div className="coin" aria-hidden>
                        M
                      </div>
                      {coins(item.cost)}
                    </div>
                    <div className={`is ${item.stock !== null && item.stock <= 5 ? 'low' : ''}`}>
                      {item.stock === null
                        ? 'Unlimited'
                        : item.stock === 0
                          ? 'Out of stock'
                          : `${item.stock} in stock`}
                      {item.needsReview ? ' · reviewed by a mod' : ''}
                    </div>

                    {!user ? (
                      <Link
                        className="btn sm wide discord"
                        href="/api/auth/signin?callbackUrl=/store"
                      >
                        Sign in
                      </Link>
                    ) : outOfStock ? (
                      <button className="btn sm wide" disabled>
                        Out of stock
                      </button>
                    ) : onCooldown ? (
                      <button className="btn sm wide" disabled>
                        Again in {item.cooldownDaysRemaining}d
                      </button>
                    ) : short > 0 ? (
                      <button className="btn sm wide" disabled>
                        Need {coins(short)} more
                      </button>
                    ) : (
                      <RedeemButton
                        itemId={Number(item.id)}
                        name={item.name}
                        cost={item.cost}
                        balance={balance.balance}
                        needsShipping={item.category === 'merch'}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="small muted" style={{ marginTop: 22, maxWidth: '72ch' }}>
        Merch is fulfilled by hand by Matty and the mod team — you&rsquo;ll be asked for a shipping
        address after it is approved, and you can track the order from your profile. Razed tips are
        sent to your linked casino account. Shipping details are kept only until an order is
        fulfilled.
      </p>
    </>
  );
}
