import { hasDatabase } from '@/lib/db';
import { currentIdentity } from '@/lib/player';
import { queue } from '@/lib/store/shop';
import { AdminHeader } from '@/components/admin/AdminShell';
import { RedemptionQueue } from '@/components/admin/RedemptionQueue';
import { Card } from '@/components/ui/surfaces';

export const metadata = { title: 'Redemptions' };
export const dynamic = 'force-dynamic';

export default async function RedemptionsPage() {
  if (!hasDatabase()) {
    return (
      <>
        <AdminHeader eyebrow="Approve, reject, refund" title="Redemption queue" />
        <Card tone="gold">
          <div className="px-5 py-5">
            <p className="text-[15px] text-ink">No database is configured.</p>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              Redemptions are rows in Postgres. Set{' '}
              <code className="font-mono text-gold">DATABASE_URL</code> and this queue fills itself
              the first time somebody buys something.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const [identity, items] = await Promise.all([currentIdentity(), queue(null, 200)]);

  return (
    <>
      <AdminHeader eyebrow="Approve, reject, refund" title="Redemption queue" />

      <RedemptionQueue initial={items} who={identity?.discordUsername ?? 'admin'} />

      <p className="mt-6 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        Rejecting refunds the coins and restores the stock in the same write that changes the
        status, and the member sees the reason on their account page. Entries and Discord roles
        never reach this queue — they are granted the moment they are bought.
      </p>
    </>
  );
}
