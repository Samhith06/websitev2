import { coins } from '@/lib/format';
import { shopItems } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, StatusPill } from '@/components/admin/Table';
import { Button } from '@/components/ui/controls';
import { CoinMark } from '@/components/ui/marks';

export const metadata = { title: 'Shop items' };

const COLS = 'lg:grid-cols-[1fr_120px_110px_110px_130px_110px]';

export default function AdminShopPage() {
  return (
    <>
      <AdminHeader
        eyebrow="Prices, stock, cooldowns"
        title="Shop items"
        right={<Button size="sm">New item</Button>}
      />

      <AdminTable cols={COLS} columns={['Item', 'Category', 'Cost', 'Stock', 'Cooldown', 'Status']}>
        {shopItems.map((item) => {
          const out = item.stock === 0;
          return (
            <AdminRow key={item.id} cols={COLS} tint={out ? 'gold' : undefined}>
              <Cell>
                <span className="block truncate text-ink">{item.name}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                  {item.description}
                </span>
              </Cell>
              <Cell label="Category" className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
                {item.category}
              </Cell>
              <Cell label="Cost">
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-brand">
                  <CoinMark size={13} />
                  {coins(item.cost)}
                </span>
              </Cell>
              <Cell label="Stock" className="font-mono tabular-nums text-ink-2">
                {item.stock === null ? '∞' : item.stock}
              </Cell>
              <Cell label="Cooldown" className="font-mono text-[12.5px] tabular-nums text-faint">
                {item.cooldownDaysRemaining ? `${item.cooldownDaysRemaining} days` : '—'}
              </Cell>
              <Cell>
                <StatusPill tone={out ? 'gold' : item.active ? 'brand' : 'muted'}>
                  {out ? 'Out of stock' : item.active ? 'Live' : 'Hidden'}
                </StatusPill>
              </Cell>
            </AdminRow>
          );
        })}
      </AdminTable>

      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        An out-of-stock item stays visible on the public shop with its price shown and the button
        replaced by a chip. Hiding it removes a reason to keep earning, which is the opposite of
        what the shop is for.
      </p>
    </>
  );
}
