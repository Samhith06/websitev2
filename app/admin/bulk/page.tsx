import { auth } from '@/auth';
import { devBypass, roleFor } from '@/lib/admin';
import { hasDatabase } from '@/lib/db';
import { userCount } from '@/lib/store/accounts';
import { openWindowCount } from '@/lib/store/presence';
import { AdminHeader } from '@/components/admin/AdminShell';
import { BulkGrant } from '@/components/admin/BulkGrant';
import { Card } from '@/components/ui/surfaces';

export const metadata = { title: 'Bulk coin grant' };
export const dynamic = 'force-dynamic';

/**
 * Paying a room, rather than a person.
 *
 * The member screen is built for one account at a time — find them, read the
 * ledger, adjust. That is the wrong shape for a giveaway with forty winners or
 * a "everyone watching gets 100" on a three hundred viewer night, where doing
 * it one at a time is both an hour of clicking and three hundred chances to
 * mistype an amount.
 */
export default async function BulkPage() {
  const session = devBypass() ? null : await auth();
  const role = devBypass() ? 'owner' : (roleFor(session?.user?.discordId) ?? 'mod');

  if (!hasDatabase()) {
    return (
      <>
        <AdminHeader eyebrow="Many accounts, one amount" title="Bulk coin grant" />
        <Card tone="gold">
          <div className="px-5 py-5">
            <p className="text-[15px] text-ink">No database is configured.</p>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
              Balances and the ledger live in Postgres. Set{' '}
              <code className="font-mono text-gold">DATABASE_URL</code> and this screen can pay
              people.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const [members, watching] = await Promise.all([userCount(), openWindowCount()]);

  return (
    <>
      <AdminHeader
        eyebrow="Many accounts, one amount"
        title="Bulk coin grant"
        right={
          <span className="font-mono text-[11.5px] tabular-nums text-muted">
            {watching} watching · {members} accounts
          </span>
        }
      />
      <BulkGrant role={role} />
    </>
  );
}
