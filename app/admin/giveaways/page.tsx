import { coins, dateShort, relativeTime } from '@/lib/format';
import { giveaways, pastGiveaways } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, StatusPill } from '@/components/admin/Table';
import { Button } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { CopyButton } from '@/components/ui/CopyButton';

export const metadata = { title: 'Giveaways' };

const COLS = 'lg:grid-cols-[1fr_130px_110px_110px_150px_120px]';

export default function AdminGiveawaysPage() {
  return (
    <>
      <AdminHeader
        eyebrow="Entries, draws, winners"
        title="Giveaways"
        right={<Button size="sm">New giveaway</Button>}
      />

      <div className="mb-6 space-y-4">
        {giveaways.map((giveaway) => (
          <Card key={giveaway.id}>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3.5">
              <div>
                <p className="text-[15px] text-ink">{giveaway.prize}</p>
                <p className="mt-0.5 font-mono text-[11.5px] tabular-nums text-faint">
                  {giveaway.title} · draws {dateShort(giveaway.drawsAt)} ·{' '}
                  {coins(giveaway.totalEntries)} entries
                </p>
              </div>
              <StatusPill tone="brand">Open</StatusPill>
            </div>

            <div className="grid gap-px bg-line sm:grid-cols-4 [&>div]:bg-surface">
              <Figure label="Entry cost" value={`${coins(giveaway.entryCost)} MC`} />
              <Figure label="Entries" value={coins(giveaway.totalEntries)} />
              <Figure label="Cap per user" value={String(giveaway.maxEntriesPerUser)} />
              <Figure label="Coins taken" value={coins(giveaway.totalEntries * giveaway.entryCost)} tone="brand" />
            </div>

            {/* The commitment is published before entries open. Revealing the
                seed early would let someone compute the winner in advance, so
                the reveal is the draw. */}
            <div className="border-t border-line px-4 py-3.5">
              <Label className="mb-1.5">Server seed hash · published {relativeTime(giveaway.opensAt)}</Label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-[3px] border border-line bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink-2">
                  {giveaway.serverSeedHash}
                </code>
                <CopyButton value={giveaway.serverSeedHash} compact />
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                The seed behind this hash is held until the draw runs. Drawing reveals it and writes
                the winner row permanently.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">
              <Button variant="outline" size="sm">Edit</Button>
              <Button size="sm">Draw now</Button>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Completed draws
      </h2>

      <AdminTable cols={COLS} columns={['Prize', 'Drawn', 'Entries', 'Cost', 'Winner', '']}>
        {pastGiveaways.map((g) => (
          <AdminRow key={g.id} cols={COLS}>
            <Cell className="truncate text-ink">{g.prize}</Cell>
            <Cell label="Drawn" className="font-mono text-[12.5px] tabular-nums text-faint">
              {dateShort(g.drawnAt!)}
            </Cell>
            <Cell label="Entries" className="font-mono tabular-nums text-ink-2">
              {coins(g.totalEntries)}
            </Cell>
            <Cell label="Cost" className="font-mono tabular-nums text-ink-2">
              {coins(g.entryCost)}
            </Cell>
            <Cell label="Winner" className="font-mono text-[13px] text-gold">{g.winnerMasked}</Cell>
            <Cell>
              <StatusPill tone="muted">Seed revealed</StatusPill>
            </Cell>
          </AdminRow>
        ))}
      </AdminTable>

      <p className="mt-5 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        Winner rows are never deleted, including draws where nobody claimed. A winner has seven days
        before the prize is redrawn from the remaining entries, and the redraw appears as its own
        row with its own seed.
      </p>
    </>
  );
}

function Figure({ label, value, tone = 'ink' }: { label: string; value: string; tone?: 'ink' | 'brand' }) {
  return (
    <div className="px-4 py-3.5">
      <Label className="mb-1.5">{label}</Label>
      <Num tone={tone} className="text-[18px] leading-none">
        {value}
      </Num>
    </div>
  );
}
