'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Coins, Radio, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins } from '@/lib/format';
import { Button, Input } from '@/components/ui/controls';
import { Label, Num } from '@/components/ui/typography';
import {
  bulkAdjustCoins, previewTargets,
  type BulkResult, type PreviewResult, type TargetMode,
} from '@/app/admin/members/actions';

type Preview = Extract<PreviewResult, { ok: true }>;

const MODES: Array<{ key: TargetMode; label: string; hint: string; Icon: typeof Users }> = [
  { key: 'paste', label: 'Paste a list', hint: 'Names copied out of chat, a giveaway draw or a spreadsheet', Icon: Users },
  { key: 'earning', label: 'Everyone watching', hint: 'Every account with an open presence window right now', Icon: Radio },
  { key: 'filter', label: 'A search result', hint: 'Everybody matching a search and filter, not just the visible page', Icon: Coins },
];

/**
 * Grant coins to a lot of people at once.
 *
 * The screen is deliberately two steps. Step one resolves who is being paid and
 * shows it — including, crucially, the names that matched *nobody*. Step two
 * writes. Nothing is written until the operator has seen the roster and the
 * total, because on a busy night this button mints five figures across three
 * hundred accounts and there is no undo.
 */
export function BulkGrant({ role }: { role: 'owner' | 'mod' }) {
  const [mode, setMode] = useState<TargetMode>('paste');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [pending, start] = useTransition();

  const amountNumber = Math.round(Number(amount));
  const validAmount = Number.isFinite(amountNumber) && amountNumber !== 0;
  const targets = preview?.members ?? [];
  const totalCoins = validAmount ? amountNumber * targets.length : 0;

  /** Any change to the targeting invalidates a preview taken before it. */
  function retarget<T>(set: (v: T) => void) {
    return (value: T) => {
      set(value);
      setPreview(null);
      setResult(null);
      setError(null);
    };
  }

  function runPreview() {
    setResult(null);
    setError(null);
    start(async () => {
      const outcome = await previewTargets({ mode, text, query, filter });
      if (outcome.ok) setPreview(outcome);
      else {
        setPreview(null);
        setError(outcome.error);
      }
    });
  }

  function apply() {
    if (!preview) return;
    setError(null);
    start(async () => {
      const outcome = await bulkAdjustCoins({
        userIds: preview.members.map((m) => m.id),
        amount: amountNumber,
        reason,
      });
      setResult(outcome);
      if (outcome.ok) {
        setPreview(null);
        setText('');
        setAmount('');
        setReason('');
      }
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:items-start">
      {/* ================================================================== */}
      {/* Left: who, and how much                                            */}
      {/* ================================================================== */}
      <div className="space-y-5">
        <section className="rounded-md border border-line bg-surface">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">Who is being paid</h2>
            <p className="mt-1 text-[13px] text-muted">Pick where the list of people comes from.</p>
          </header>

          <div className="grid gap-px bg-line sm:grid-cols-3">
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => retarget(setMode)(m.key)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col gap-1.5 px-4 py-4 text-left transition-colors duration-150',
                    active ? 'bg-brand-bg text-brand' : 'bg-surface text-ink-2 hover:bg-surface-2',
                  )}
                >
                  <span className="flex items-center gap-2 text-[13.5px] font-medium">
                    <m.Icon size={15} strokeWidth={1.8} />
                    {m.label}
                  </span>
                  <span className="text-[12px] leading-relaxed text-muted">{m.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-line px-5 py-5">
            {mode === 'paste' ? (
              <>
                <Label className="mb-2">Names</Label>
                <textarea
                  value={text}
                  onChange={(e) => retarget(setText)(e.target.value)}
                  rows={9}
                  spellCheck={false}
                  placeholder={'One per line, or comma separated.\n\nsteve6874\nZardoslivesKpop\nvortexx_01'}
                  className="w-full rounded-md border border-line-2 bg-surface-2 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink placeholder:text-faint focus:border-brand focus:outline-none"
                />
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  Discord names and Kick names both work, and the two can be mixed in one list.
                  Matching is exact but ignores case and a leading @ — nothing is guessed at, because
                  a near miss on a coin grant is the wrong person paid.
                </p>
              </>
            ) : mode === 'filter' ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <Label className="mb-2">Search</Label>
                  <Input
                    value={query}
                    onChange={(e) => retarget(setQuery)(e.target.value)}
                    placeholder="Discord name, Kick name or ID"
                    className="h-10 text-[13.5px]"
                  />
                </div>
                <div>
                  <Label className="mb-2">Filter</Label>
                  <select
                    value={filter}
                    onChange={(e) => retarget(setFilter)(e.target.value)}
                    className="h-10 rounded-md border border-line-2 bg-surface-2 px-3 text-[13.5px] text-ink focus:border-brand focus:outline-none"
                  >
                    <option value="all">Everyone</option>
                    <option value="unlinked">Unlinked only</option>
                    <option value="frozen">Frozen only</option>
                  </select>
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] leading-relaxed text-ink-2">
                Everybody with an open presence window — the same window the coin tick pays, so this
                means exactly the people currently earning. Frozen accounts are left out.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface">
          <header className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">How much, and why</h2>
          </header>
          <div className="flex flex-wrap items-end gap-4 px-5 py-5">
            <div>
              <Label className="mb-2">Amount each</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setResult(null);
                }}
                placeholder="0"
                className="h-10 w-32 text-[14px]"
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <Label className="mb-2">Reason (required)</Label>
              <Input
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setResult(null);
                }}
                placeholder="e.g. Friday giveaway — 3rd place"
                className="h-10 text-[14px]"
              />
            </div>
          </div>
          <p className="border-t border-line px-5 py-3.5 text-[12.5px] leading-relaxed text-muted">
            The reason is written onto every ledger row in the batch, not just the audit log, so it
            travels with the movement it explains. A negative amount takes coins away.
          </p>
        </section>
      </div>

      {/* ================================================================== */}
      {/* Right: the dry run, then the button that writes                    */}
      {/* ================================================================== */}
      <div className="xl:sticky xl:top-[26px]">
        <section className="rounded-md border border-line bg-surface">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold text-ink">Confirm</h2>
            <Button size="sm" variant="outline" onClick={runPreview} disabled={pending}>
              {pending ? 'Checking…' : preview ? 'Re-check' : 'Check the list'}
            </Button>
          </header>

          {error ? (
            <p className="border-b border-danger-line bg-danger-bg px-5 py-3.5 text-[13px] text-danger" role="status">
              {error}
            </p>
          ) : null}

          {result ? (
            <div
              className={cn(
                'border-b px-5 py-4',
                result.ok ? 'border-online-line bg-online-bg' : 'border-danger-line bg-danger-bg',
              )}
              role="status"
            >
              <p className={cn('flex items-start gap-2 text-[13.5px]', result.ok ? 'text-online' : 'text-danger')}>
                {result.ok ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                )}
                <span>{result.ok ? result.message : result.error}</span>
              </p>
              {!result.ok && result.blocked?.length ? (
                <ul className="mt-2 space-y-0.5 pl-6 font-mono text-[11.5px] text-danger">
                  {result.blocked.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {!preview ? (
            <p className="px-5 py-10 text-center text-[13px] leading-relaxed text-muted">
              Nothing is written until you check the list and confirm. Check it to see exactly who
              gets paid — and which names matched nobody.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-px bg-line">
                <div className="bg-surface px-5 py-4">
                  <Label className="mb-2">Accounts</Label>
                  <Num tone="ink" className="text-[26px] leading-none">
                    {targets.length}
                  </Num>
                </div>
                <div className="bg-surface px-5 py-4">
                  <Label className="mb-2">Total {totalCoins < 0 ? 'removed' : 'minted'}</Label>
                  <Num tone={totalCoins < 0 ? 'danger' : 'brand'} className="text-[26px] leading-none">
                    {validAmount ? coins(Math.abs(totalCoins)) : '—'}
                  </Num>
                </div>
              </div>

              {preview.unmatched.length > 0 ? (
                <div className="border-t border-gold-line bg-gold-bg px-5 py-4">
                  <p className="flex items-center gap-2 text-[13px] text-gold">
                    <AlertTriangle size={14} className="shrink-0" />
                    {preview.unmatched.length} name{preview.unmatched.length === 1 ? '' : 's'} matched
                    nobody
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {preview.unmatched.map((n) => (
                      <li
                        key={n}
                        className="rounded-sm border border-gold-line px-1.5 py-0.5 font-mono text-[11px] text-gold"
                      >
                        {n}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                    These are skipped. Check the spelling, or whether they have ever signed in — an
                    account only exists once somebody has.
                  </p>
                </div>
              ) : null}

              {preview.ambiguous.length > 0 ? (
                <div className="border-t border-danger-line bg-danger-bg px-5 py-4">
                  <p className="flex items-center gap-2 text-[13px] text-danger">
                    <AlertTriangle size={14} className="shrink-0" />
                    {preview.ambiguous.length} name{preview.ambiguous.length === 1 ? '' : 's'} matched
                    more than one account
                  </p>
                  <ul className="mt-2 space-y-1 font-mono text-[11.5px] text-danger">
                    {preview.ambiguous.map((a) => (
                      <li key={a.input}>
                        {a.input} → {a.candidates.map((c) => c.discordUsername).join(', ')}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                    Skipped rather than guessed at. Pay these by hand from the member screen.
                  </p>
                </div>
              ) : null}

              <div className="border-t border-line">
                <div className="flex items-center justify-between border-b border-line px-5 py-3">
                  <Label>Being paid</Label>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
                    {targets.length} matched
                  </span>
                </div>
                {targets.length === 0 ? (
                  <p className="px-5 py-6 text-[13px] text-muted">
                    Nobody matched. Nothing would be written.
                  </p>
                ) : (
                  <ul className="max-h-[300px] divide-y divide-line overflow-y-auto">
                    {targets.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-ink">
                            {m.discordUsername}
                          </span>
                          <span className="block truncate font-mono text-[11px] text-faint">
                            {m.kickUsername ?? 'no Kick link'}
                            {m.frozen ? <span className="text-danger"> · frozen</span> : null}
                          </span>
                        </span>
                        <Num tone="muted" className="shrink-0 text-[12px]">
                          {coins(m.balance)}
                        </Num>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-line px-5 py-4">
                <Button
                  full
                  onClick={apply}
                  disabled={pending || targets.length === 0 || !validAmount || !reason.trim()}
                  variant={amountNumber < 0 ? 'danger' : 'primary'}
                >
                  {pending
                    ? 'Applying…'
                    : !validAmount || !reason.trim()
                      ? 'Set an amount and a reason'
                      : `${amountNumber < 0 ? 'Remove' : 'Grant'} ${coins(Math.abs(amountNumber))} MC ${amountNumber < 0 ? 'from' : 'to'} ${targets.length}`}
                </Button>
                <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                  Applied as one transaction: it all lands, or none of it does. There is no undo —
                  reversing it means a second batch the other way.
                </p>
              </div>
            </>
          )}
        </section>

        <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">
          {role === 'owner'
            ? 'As an owner you can grant to up to 2,000 accounts in one batch, at any amount.'
            : 'As a moderator you can grant up to 500 MC each, to at most 50 accounts at a time. Bigger batches need an owner.'}
        </p>
      </div>
    </div>
  );
}
