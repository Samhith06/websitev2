import { hasDatabase } from '@/lib/db';
import { currentIdentity } from '@/lib/player';
import { roleFor } from '@/lib/admin';
import { listPeriods } from '@/lib/store/periods';
import { AdminHeader } from '@/components/admin/AdminShell';
import { PrizeEditor } from '@/components/admin/PrizeEditor';
import { Card } from '@/components/ui/surfaces';

export const metadata = { title: 'Prizes and periods' };
export const dynamic = 'force-dynamic';

export default async function PrizesPage() {
  if (!hasDatabase()) {
    return (
      <>
        <AdminHeader eyebrow="Boards, dates and prize money" title="Prizes and periods" />
        <Card tone="gold">
          <div className="px-5 py-5">
            <p className="text-[15px] text-ink">No database is configured.</p>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              Periods and prize tiers are rows in Postgres. Set{' '}
              <code className="font-mono text-gold">DATABASE_URL</code> and this screen works
              immediately.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const identity = await currentIdentity();
  const isOwner = roleFor(identity?.discordId) === 'owner';
  const periods = await listPeriods(50);

  return (
    <>
      <AdminHeader
        eyebrow="Boards, dates and prize money"
        title="Prizes and periods"
      />

      <Card className="mb-5">
        <p className="px-4 py-3.5 text-[12.5px] leading-relaxed text-muted">
          A period&rsquo;s dates are the window sent to Razed, so this screen decides what the
          leaderboard is actually measuring. Freezing is a button rather than a clock: the moment a
          board closes is the moment prizes are owed, and that should be something a person did, at
          a recorded time.
        </p>
      </Card>

      <PrizeEditor periods={periods} isOwner={isOwner} />
    </>
  );
}
