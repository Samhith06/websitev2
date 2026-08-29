import { TriangleAlert } from 'lucide-react';
import { dateRange, money } from '@/lib/format';
import { archivedPeriods, frozenPeriod, prizeTiers, weeklyPeriod } from '@/lib/mock';
import { AdminHeader } from '@/components/admin/AdminShell';
import { AdminRow, AdminTable, Cell, StatusPill } from '@/components/admin/Table';
import { Button, Chip, ChipRow, Input } from '@/components/ui/controls';
import { Banner, Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import type { Period, PrizeTier } from '@/lib/types';

export const metadata = { title: 'Prizes and periods' };

const PERIOD_COLS = 'lg:grid-cols-[1fr_120px_120px_150px_130px_140px]';

const METAL = {
  1: 'text-gold',
  2: 'text-silver',
  3: 'text-bronze',
} as const;

export default function PrizesPage() {
  const periods: Period[] = [weeklyPeriod, frozenPeriod, ...archivedPeriods];
  const pot = prizeTiers.reduce((sum, t) => sum + t.amount * (t.rankTo - t.rankFrom + 1), 0);

  return (
    <>
      <AdminHeader
        eyebrow="Editing the next weekly period"
        title="Prizes and periods"
        right={
          <ChipRow label="Period type">
            <Chip active>Weekly</Chip>
            <Chip>Monthly</Chip>
          </ChipRow>
        }
      />

      {/* Always visible, never dismissible. */}
      <Banner tone="gold" className="mb-4" icon={<TriangleAlert size={16} />}>
        <span className="text-ink">Changes apply to the next period by default.</span> Editing a
        period that is already live is allowed, but it is logged and the public board shows viewers
        a “prizes updated” note with a timestamp. Finalised periods are locked.
      </Banner>

      {/* ------------------------------------------------------------- */}
      {/* Tier editor                                                   */}
      {/* ------------------------------------------------------------- */}
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <Label>Prize tiers</Label>
          <Num tone="gold" className="text-[15px]">
            {money(pot)} total pot
          </Num>
        </div>

        <div className="divide-y divide-line">
          {prizeTiers.map((tier) => (
            <TierRow key={tier.id} tier={tier} />
          ))}
        </div>

        <div className="border-t border-line p-4">
          <button
            type="button"
            className="flex h-10 w-full items-center justify-center rounded-[3px] border border-dashed border-line-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors duration-150 hover:border-brand hover:text-brand"
          >
            + Add tier
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3.5">
          <Button variant="outline" size="sm">Preview the public board</Button>
          <Button size="sm">Save and publish</Button>
        </div>
      </Card>

      <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        A range tier — “4–10 → $400 each” — is a first-class row, not a workaround, so nobody is
        typing seven identical lines every month.
      </p>

      {/* ------------------------------------------------------------- */}
      {/* Period list                                                   */}
      {/* ------------------------------------------------------------- */}
      <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Periods
      </h2>

      <AdminTable
        cols={PERIOD_COLS}
        columns={['Period', 'Type', 'State', 'Pot', 'Winner', '']}
      >
        {periods.map((period) => {
          const tone =
            period.status === 'open' ? 'brand'
            : period.status === 'frozen' ? 'gold'
            : 'muted';
          const outstanding =
            period.status === 'frozen'
              ? period.rows.filter((r) => r.prize > 0).length - Object.keys(period.claimedRanks ?? {}).length
              : 0;

          return (
            <AdminRow key={period.id} cols={PERIOD_COLS} tint={period.status === 'frozen' ? 'gold' : undefined}>
              <Cell className="font-mono text-[13px] tabular-nums text-ink">
                {dateRange(period.startsAt, period.endsAt)}
              </Cell>
              <Cell label="Type" className="font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
                {period.type}
              </Cell>
              <Cell>
                <StatusPill tone={tone}>{period.status}</StatusPill>
              </Cell>
              <Cell label="Pot" className="font-mono tabular-nums text-gold">
                {money(period.pot)}
              </Cell>
              <Cell label="Winner" className="truncate text-[13.5px] text-ink-2">
                {period.status === 'open' ? '—' : period.rows[0].maskedUsername}
              </Cell>
              <Cell>
                {period.status === 'frozen' ? (
                  <button type="button" className="text-[13px] text-brand hover:text-brand-dim">
                    Finalise ({outstanding} unclaimed)
                  </button>
                ) : period.status === 'archived' ? (
                  <button type="button" className="text-[13px] text-muted hover:text-ink">
                    View board
                  </button>
                ) : (
                  <span className="font-mono text-[12px] text-faint">running</span>
                )}
              </Cell>
            </AdminRow>
          );
        })}
      </AdminTable>
    </>
  );
}

function TierRow({ tier }: { tier: PrizeTier }) {
  const isRange = tier.rankTo > tier.rankFrom;
  const metal = METAL[tier.rankFrom as 1 | 2 | 3] ?? 'text-ink-2';

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3">
      <span className={`w-20 shrink-0 font-mono text-[18px] font-bold tabular-nums ${metal}`}>
        {isRange ? `${tier.rankFrom}–${tier.rankTo}` : tier.rankFrom}
      </span>

      <div className="flex items-center gap-2">
        <Input type="number" defaultValue={tier.amount} className="h-9 w-32 text-[13px]" />
        <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-faint">
          {tier.currency}
        </span>
      </div>

      {isRange ? (
        <span className="text-[13px] text-muted">
          each · {tier.rankTo - tier.rankFrom + 1} positions ={' '}
          <span className="font-mono text-gold">
            {money(tier.amount * (tier.rankTo - tier.rankFrom + 1))}
          </span>
        </span>
      ) : null}

      <button
        type="button"
        className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em] text-faint transition-colors duration-150 hover:text-danger"
      >
        Remove
      </button>
    </div>
  );
}
