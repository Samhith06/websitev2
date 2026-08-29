import { TriangleAlert } from 'lucide-react';
import { redemptions } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { RedemptionQueue } from '@/components/admin/RedemptionQueue';

export const metadata = { title: 'Redemptions' };

export default function RedemptionsPage() {
  return (
    <>
      <AdminHeader
        eyebrow="Approve, reject, refund"
        title="Redemption queue"
      />

      {/* An action that looks like it worked but changed nothing is worse than
          one that is obviously unavailable. */}
      <div className="mb-4 flex items-start gap-3 rounded-[6px] border border-gold-line bg-gold-bg px-4 py-3">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden />
        <p className="text-[13px] leading-relaxed text-ink-2">
          <span className="text-gold">Not wired up yet.</span> Approving or rejecting here updates
          this screen only — no coins are refunded, no audit row is written, and nothing survives a
          reload. The queue behaviour is real; the persistence behind it lands with the database.
        </p>
      </div>

      <RedemptionQueue initial={redemptions} />
      <p className="mt-6 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        Rejecting refunds the coins automatically and the member sees the reason on their account
        page. Entries and Discord roles never reach this queue — they are granted the moment they
        are bought.
      </p>
    </>
  );
}
