import { hasDatabase } from '@/lib/db';
import { allItems } from '@/lib/store/shop';
import { AdminHeader } from '@/components/admin/AdminShell';
import { ShopEditor } from '@/components/admin/ShopEditor';
import { Card } from '@/components/ui/surfaces';

export const metadata = { title: 'Shop items' };
export const dynamic = 'force-dynamic';

export default async function AdminShopPage() {
  if (!hasDatabase()) {
    return (
      <>
        <AdminHeader eyebrow="Prices, stock, cooldowns" title="Shop items" />
        <Card tone="gold">
          <div className="px-5 py-5">
            <p className="text-[15px] text-ink">No database is configured.</p>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              Shop items are rows in Postgres. Set{' '}
              <code className="font-mono text-gold">DATABASE_URL</code> and the launch catalogue
              creates itself.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const items = await allItems();

  return (
    <>
      <AdminHeader eyebrow="Prices, stock, cooldowns" title="Shop items" />
      <ShopEditor
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          cost: i.cost,
          category: i.category,
          stock: i.stock,
          cooldownDays: i.cooldownDays,
          needsReview: i.needsReview,
          active: i.active,
        }))}
      />
    </>
  );
}
