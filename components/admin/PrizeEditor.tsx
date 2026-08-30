'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { dateRange, money } from '@/lib/format';
import { Button, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label, Num } from '@/components/ui/typography';
import { StatusPill } from './Table';
import {
  addPeriod, changeStatus, editPeriodDates, removeTier, saveTier, type ActionResult,
} from '@/app/admin/prizes/actions';
import type { PeriodStatus, PrizeTier } from '@/lib/types';

type Period = {
  id: number;
  type: 'weekly' | 'monthly';
  startsAt: string;
  endsAt: string;
  status: PeriodStatus;
  pot: number;
  tiers: PrizeTier[];
};

/** yyyy-mm-dd for a date input, in UTC — the board's own timezone. */
function dayValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p
      className={cn('mt-3 text-[13px] leading-relaxed', result.ok ? 'text-brand' : 'text-danger')}
      role="status"
    >
      {result.ok ? result.message : result.error}
    </p>
  );
}

export function PrizeEditor({ periods, isOwner }: { periods: Period[]; isOwner: boolean }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(periods[0]?.id ?? null);
  const selected = periods.find((p) => p.id === selectedId) ?? periods[0] ?? null;

  return (
    <>
      <NewPeriod onResult={setResult} />

      <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Periods
      </h2>

      <Card>
        {periods.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13.5px] text-muted">
            No periods yet. Open one above — until a board exists, the leaderboard has no window
            to ask Razed about.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {periods.map((period) => (
              <li key={period.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(period.id)}
                  className={cn(
                    'flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left',
                    'transition-colors duration-150 hover:bg-surface-2',
                    selected?.id === period.id && 'bg-surface-2',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13.5px] tabular-nums text-ink">
                      {dateRange(period.startsAt, period.endsAt)}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
                      {period.type} · {period.tiers.length} tier{period.tiers.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <Num tone="gold" className="shrink-0 text-[15px]">
                    {money(period.pot)}
                  </Num>
                  <StatusPill
                    tone={
                      period.status === 'open' ? 'brand'
                      : period.status === 'frozen' ? 'gold'
                      : 'muted'
                    }
                  >
                    {period.status}
                  </StatusPill>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected ? (
        <PeriodDetail
          key={selected.id}
          period={selected}
          isOwner={isOwner}
          onResult={setResult}
        />
      ) : null}

      <Feedback result={result} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function NewPeriod({ onResult }: { onResult: (r: ActionResult) => void }) {
  const [pending, start] = useTransition();
  const [type, setType] = useState<'weekly' | 'monthly'>('weekly');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [copyTiers, setCopyTiers] = useState(true);

  return (
    <Card>
      <div className="border-b border-line px-4 py-3">
        <Label>Open a board</Label>
      </div>
      <div className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <Label className="mb-1.5">Type</Label>
          <div className="flex rounded-[8px] border border-line-2 bg-bg p-1">
            {(['weekly', 'monthly'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={cn(
                  'rounded-[6px] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]',
                  'transition-colors duration-150',
                  type === t ? 'bg-surface-2 text-brand' : 'text-muted hover:text-ink-2',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="mb-1.5">Starts</Label>
          <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
            className="h-9 w-40 text-[13px]" />
        </div>
        <div>
          <Label className="mb-1.5">Ends</Label>
          <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
            className="h-9 w-40 text-[13px]" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-2 text-[13px] text-ink-2">
          <input type="checkbox" checked={copyTiers} onChange={(e) => setCopyTiers(e.target.checked)}
            className="size-4 accent-[#2B8FFF]" />
          Copy the last board’s tiers
        </label>
        <Button
          size="sm"
          disabled={pending || !startsAt || !endsAt}
          onClick={() => {
            const data = new FormData();
            data.set('type', type);
            data.set('startsAt', startsAt);
            data.set('endsAt', endsAt);
            if (copyTiers) data.set('copyTiers', 'on');
            start(async () => onResult(await addPeriod(data)));
          }}
        >
          {pending ? 'Opening…' : 'Open board'}
        </Button>
      </div>
      <p className="border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-muted">
        These dates are what get sent to Razed as <code className="font-mono">from</code> and{' '}
        <code className="font-mono">to</code>, and both ends are inclusive — a board ending on the
        2nd counts everything wagered on the 2nd, in UTC. Only one board of each type can be open
        at a time.
      </p>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function PeriodDetail({
  period,
  isOwner,
  onResult,
}: {
  period: Period;
  isOwner: boolean;
  onResult: (r: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const [startsAt, setStartsAt] = useState(dayValue(period.startsAt));
  const [endsAt, setEndsAt] = useState(dayValue(period.endsAt));
  const editable = period.status === 'open';

  return (
    <>
      <h2 className="mb-3 mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        {dateRange(period.startsAt, period.endsAt)} · {period.type}
      </h2>

      <Card>
        {/* ----------------------------------------------------------- */}
        {/* Dates and status                                            */}
        {/* ----------------------------------------------------------- */}
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div>
            <Label className="mb-1.5">Starts</Label>
            <Input type="date" value={startsAt} disabled={!editable}
              onChange={(e) => setStartsAt(e.target.value)} className="h-9 w-40 text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5">Ends</Label>
            <Input type="date" value={endsAt} disabled={!editable}
              onChange={(e) => setEndsAt(e.target.value)} className="h-9 w-40 text-[13px]" />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !editable}
            onClick={() => {
              const data = new FormData();
              data.set('periodId', String(period.id));
              data.set('startsAt', startsAt);
              data.set('endsAt', endsAt);
              start(async () => onResult(await editPeriodDates(data)));
            }}
          >
            Save dates
          </Button>

          <span className="ml-auto flex flex-wrap items-center gap-2">
            {period.status === 'open' ? (
              <Button size="sm" variant="danger" disabled={pending || !isOwner}
                onClick={() => start(async () => onResult(await changeStatus(period.id, 'frozen')))}>
                Freeze board
              </Button>
            ) : null}
            {period.status === 'frozen' ? (
              <>
                <Button size="sm" disabled={pending || !isOwner}
                  onClick={() => start(async () => onResult(await changeStatus(period.id, 'paid')))}>
                  Mark paid
                </Button>
                <Button size="sm" variant="outline" disabled={pending || !isOwner}
                  onClick={() => start(async () => onResult(await changeStatus(period.id, 'open')))}>
                  Reopen
                </Button>
              </>
            ) : null}
            {period.status === 'paid' ? (
              <Button size="sm" variant="outline" disabled={pending || !isOwner}
                onClick={() => start(async () => onResult(await changeStatus(period.id, 'archived')))}>
                Archive
              </Button>
            ) : null}
          </span>
        </div>

        {!editable ? (
          <p className="border-b border-line bg-gold-bg px-4 py-2.5 text-[12.5px] text-gold">
            This board is {period.status}, so its dates and tiers are locked. It is the record of
            what people competed for.
          </p>
        ) : null}
        {!isOwner ? (
          <p className="border-b border-line px-4 py-2.5 text-[12.5px] text-muted">
            You can edit tiers. Freezing and finalising a board is owner-only.
          </p>
        ) : null}

        {/* ----------------------------------------------------------- */}
        {/* Prize pool — derived, never typed                           */}
        {/* ----------------------------------------------------------- */}
        <div className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-4">
          <div>
            <Label className="mb-2">Prize pool · calculated</Label>
            <Num tone="gold" className="text-[30px] leading-none">{money(period.pot)}</Num>
          </div>
          <p className="max-w-md text-[12px] leading-relaxed text-muted">
            Summed from the tiers below, counting every rank a range covers. There is deliberately
            no field for it, so the advertised pool can never disagree with what the tiers pay.
          </p>
        </div>

        <TierTable period={period} editable={editable} pending={pending} onResult={onResult} />
      </Card>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function TierTable({
  period,
  editable,
  pending,
  onResult,
}: {
  period: Period;
  editable: boolean;
  pending: boolean;
  onResult: (r: ActionResult) => void;
}) {
  const [busy, start] = useTransition();
  const [rankFrom, setRankFrom] = useState('');
  const [rankTo, setRankTo] = useState('');
  const [amount, setAmount] = useState('');

  const disabled = pending || busy || !editable;

  return (
    <>
      <div className="border-b border-line px-4 py-3">
        <Label>Prize tiers</Label>
      </div>

      {period.tiers.length === 0 ? (
        <p className="px-4 py-6 text-[13.5px] text-muted">
          No tiers yet. A board with no tiers pays nothing and shows a pool of $0.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {period.tiers.map((tier) => (
            <TierRow key={tier.id} tier={tier} periodId={period.id} disabled={disabled}
              onResult={onResult} />
          ))}
        </ul>
      )}

      {editable ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-line p-4">
          <div>
            <Label className="mb-1.5">Rank from</Label>
            <Input type="number" min={1} value={rankFrom} onChange={(e) => setRankFrom(e.target.value)}
              className="h-9 w-24 text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5">Rank to</Label>
            <Input type="number" min={1} value={rankTo} onChange={(e) => setRankTo(e.target.value)}
              className="h-9 w-24 text-[13px]" />
          </div>
          <div>
            <Label className="mb-1.5">Amount each</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
              className="h-9 w-32 text-[13px]" />
          </div>
          <Button
            size="sm"
            disabled={disabled || !rankFrom || !rankTo || !amount}
            onClick={() => {
              const data = new FormData();
              data.set('periodId', String(period.id));
              data.set('rankFrom', rankFrom);
              data.set('rankTo', rankTo);
              data.set('amount', amount);
              start(async () => {
                const r = await saveTier(data);
                onResult(r);
                if (r.ok) { setRankFrom(''); setRankTo(''); setAmount(''); }
              });
            }}
          >
            Add tier
          </Button>
          <p className="w-full text-[12px] leading-relaxed text-muted">
            A range is one row: ranks 4–10 at $400 each is a single tier paying $2,800. Ranks
            cannot overlap — the database refuses it, because a rank paid twice is the kind of
            mistake nobody notices until someone is owed money.
          </p>
        </div>
      ) : null}
    </>
  );
}

function TierRow({
  tier,
  periodId,
  disabled,
  onResult,
}: {
  tier: PrizeTier;
  periodId: number;
  disabled: boolean;
  onResult: (r: ActionResult) => void;
}) {
  const [busy, start] = useTransition();
  const [amount, setAmount] = useState(String(tier.amount));
  const covers = tier.rankTo - tier.rankFrom + 1;

  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', busy && 'opacity-50')}>
      <span className="w-28 shrink-0 font-mono text-[13.5px] tabular-nums text-ink">
        {tier.rankFrom === tier.rankTo ? `Rank ${tier.rankFrom}` : `${tier.rankFrom}–${tier.rankTo}`}
      </span>
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
        {covers} place{covers === 1 ? '' : 's'}
      </span>

      <span className="flex items-center gap-2">
        <span className="font-mono text-[13px] text-muted">$</span>
        <Input type="number" min={0} value={amount} disabled={disabled}
          onChange={(e) => setAmount(e.target.value)} className="h-8 w-28 text-[13px]" />
        <span className="font-mono text-[11px] text-faint">each</span>
      </span>

      <Num tone="gold" className="w-28 shrink-0 text-right text-[13.5px]">
        {money(covers * tier.amount)}
      </Num>

      <span className="flex shrink-0 items-center gap-3 font-mono text-[11.5px]">
        <button
          type="button"
          disabled={disabled || amount === String(tier.amount)}
          onClick={() => {
            const data = new FormData();
            data.set('periodId', String(periodId));
            data.set('tierId', tier.id);
            data.set('rankFrom', String(tier.rankFrom));
            data.set('rankTo', String(tier.rankTo));
            data.set('amount', amount);
            start(async () => onResult(await saveTier(data)));
          }}
          className="text-brand hover:underline disabled:opacity-30"
        >
          Save
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => start(async () => onResult(await removeTier(Number(tier.id))))}
          className="text-danger hover:underline disabled:opacity-30"
        >
          Remove
        </button>
      </span>
    </li>
  );
}
