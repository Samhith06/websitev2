import { dateTime, relativeTime } from '@/lib/format';
import { auditLog } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, FilterBar } from '@/components/admin/Table';
import { Chip, ChipRow, Input } from '@/components/ui/controls';
import { Label } from '@/components/ui/typography';

export const metadata = { title: 'Audit log' };

const COLS = 'lg:grid-cols-[190px_150px_200px_1fr]';

/** Every destructive action writes a row naming the admin (Master Plan §11). */
export default function AuditPage() {
  return (
    <>
      <AdminHeader eyebrow="Every action, permanently" title="Audit log" />

      <FilterBar>
        <div className="min-w-[240px] flex-1">
          <Label className="mb-1.5">Search</Label>
          <Input placeholder="admin, action or target" className="h-9 text-[13px]" />
        </div>
        <ChipRow label="Filter by admin" className="pb-0.5">
          <Chip active>All admins</Chip>
          <Chip>Matty (owner)</Chip>
          <Chip>Sarah (mod)</Chip>
        </ChipRow>
      </FilterBar>

      <AdminTable cols={COLS} columns={['When', 'Admin', 'Action', 'Target']}>
        {auditLog.map((entry) => (
          <AdminRow key={entry.id} cols={COLS}>
            <Cell className="font-mono text-[12px] tabular-nums text-faint">
              {dateTime(entry.createdAt)}
            </Cell>
            <Cell label="Admin" className="text-[13.5px] text-ink-2">{entry.admin}</Cell>
            <Cell label="Action" className="text-[13.5px] text-ink">{entry.action}</Cell>
            <Cell label="Target" className="truncate text-[13.5px] text-muted">
              {entry.target}
              <span className="ml-2 font-mono text-[11px] text-faint">
                {relativeTime(entry.createdAt)}
              </span>
            </Cell>
          </AdminRow>
        ))}
      </AdminTable>

      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        Rows are never edited or deleted, including by the owner. If an action was a mistake, the
        correction is a second row, not a rewrite of the first.
      </p>
    </>
  );
}
