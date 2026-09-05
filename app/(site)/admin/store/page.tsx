import { rows } from '@/lib/db';
import { allItems } from '@/lib/store/shop';
import { coins } from '@/lib/format';
import { auth } from '@/auth';
import { devBypass, roleFor } from '@/lib/admin';
import { ShopItemForm } from '@/components/admin/ShopItemForm';

export const metadata = { title: 'Store' };
export const dynamic = 'force-dynamic';

export default async function AdminStorePage() {
  const session = devBypass() ? null : await auth();
  const isOwner = devBypass() || roleFor(session?.user?.discordId ?? null) === 'owner';

  const [items, redeemed] = await Promise.all([
    allItems(),
    rows<{ item_id: string; n: string }>(
      `SELECT item_id::text, COUNT(*)::text AS n
         FROM redemptions WHERE status <> 'rejected' GROUP BY item_id`,
    ),
  ]);

  const counts = new Map(redeemed.map((r) => [r.item_id, Number(r.n)]));
  const categories = new Set(items.map((i) => i.category));

  return (
    <>
      <div className="sec-head">
        <div>
          <span className="eyebrow">
            {categories.size} categories · {items.length} items
          </span>
          <h1>Store</h1>
          <div className="sh-sub">
            Stock decrements in the same transaction as the coin debit, so nothing oversells.
          </div>
        </div>
        {isOwner ? <ShopItemForm /> : null}
      </div>

      {items.length === 0 ? (
        <div className="emptyq">No items yet.</div>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Redeemed</th>
                <th>Review</th>
                <th>Status</th>
                {isOwner ? <th style={{ textAlign: 'right' }}>Edit</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={item.active ? undefined : { opacity: 0.5 }}>
                  <td>{item.name}</td>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {item.category}
                  </td>
                  <td className="g">{coins(item.cost)}</td>
                  <td
                    className="n"
                    style={
                      item.stock !== null && item.stock <= 5 ? { color: 'var(--warn)' } : undefined
                    }
                  >
                    {item.stock === null ? '∞' : item.stock}
                  </td>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {counts.get(item.id) ?? 0}
                  </td>
                  <td className="n" style={{ color: 'var(--muted)' }}>
                    {item.needsReview ? 'mod' : 'auto'}
                  </td>
                  <td>
                    <span className={`tag ${item.active ? 'green' : ''}`}>
                      {item.active ? 'live' : 'hidden'}
                    </span>
                  </td>
                  {isOwner ? (
                    <td style={{ textAlign: 'right' }}>
                      <ShopItemForm item={item} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 14, maxWidth: '72ch' }}>
        A rejected redemption refunds the coins through a normal ledger entry and returns the stock,
        so a member&rsquo;s history reads as &ldquo;spent, then refunded&rdquo; rather than
        &ldquo;someone edited my balance&rdquo;.
      </p>
    </>
  );
}
