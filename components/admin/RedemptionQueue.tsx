'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { coins, relativeTime } from '@/lib/format';
import { Button, Chip, ChipRow, Input } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Label } from '@/components/ui/typography';
import { CoinMark } from '@/components/ui/marks';
import { StatusPill } from './Table';
import type { Redemption } from '@/lib/types';

const REJECT_PRESETS = ['Out of stock', 'Ineligible', 'Suspected abuse'];

/**
 * The screen used most often (UI Spec §18). It should be operable in a few
 * seconds per item, on a phone, between bonus buys.
 *
 * Rows rather than cards. Handled rows stay visible for the session at 60% with
 * the moderator's name and the time — seeing what your co-moderator just did
 * prevents the double-approval.
 */
export function RedemptionQueue({ initial }: { initial: Redemption[] }) {
  const [items, setItems] = useState(initial);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<'queue' | 'handled'>('queue');
  /** Handled in *this* session — they stay in the queue view, dimmed. */
  const [justHandled, setJustHandled] = useState<string[]>([]);

  const pending = items.filter((i) => i.status === 'pending');
  const handled = items.filter((i) => i.status !== 'pending');

  // Seeing what your co-moderator just did is what prevents the double
  // approval, so a row you have handled does not vanish out from under you —
  // it dims and stays put until the page is reloaded.
  const visible =
    tab === 'queue'
      ? items.filter((i) => i.status === 'pending' || justHandled.includes(i.id))
      : handled;

  function decide(id: string, status: Redemption['status'], why?: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status, handledBy: 'Matty (owner)', reason: why, createdAt: item.createdAt }
          : item,
      ),
    );
    setJustHandled((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setRejecting(null);
    setReason('');
  }

  return (
    <>
      <ChipRow label="Queue view" className="mb-4">
        <Chip active={tab === 'queue'} onClick={() => setTab('queue')}>
          Queue · {pending.length}
        </Chip>
        <Chip active={tab === 'handled'} onClick={() => setTab('handled')}>
          Recently handled · {handled.length}
        </Chip>
      </ChipRow>

      {visible.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="text-[14.5px] text-ink-2">
            {tab === 'queue' ? 'Nothing waiting. The queue is clear.' : 'Nothing handled yet this session.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => {
            const done = item.status !== 'pending';
            const open = expanded === item.id;
            const hasDetail = Boolean(item.fulfilmentData);

            return (
              <Card key={item.id} className={cn(done && 'opacity-60')}>
                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] text-ink">
                      {item.itemName}
                      <span className="ml-2 text-muted">· {item.member}</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11.5px] tabular-nums text-faint">
                      <span className="inline-flex items-center gap-1">
                        <CoinMark size={11} />
                        {coins(item.cost)}
                      </span>
                      <span>· {relativeTime(item.createdAt)}</span>
                      {item.handledBy ? <span>· {item.handledBy}</span> : null}
                    </p>
                    {item.reason ? (
                      <p className="mt-1.5 text-[12.5px] text-danger">
                        {item.reason} — coins refunded in full
                      </p>
                    ) : null}
                  </div>

                  {done ? (
                    <StatusPill tone={item.status === 'rejected' ? 'danger' : 'brand'}>
                      {item.status}
                    </StatusPill>
                  ) : (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {hasDetail ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : item.id)}
                          aria-expanded={open}
                          className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line-2 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted transition-colors duration-150 hover:border-brand hover:text-brand"
                        >
                          Detail
                          <ChevronDown size={13} className={cn('transition-transform duration-150', open && 'rotate-180')} />
                        </button>
                      ) : null}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setRejecting(rejecting === item.id ? null : item.id)}
                      >
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => decide(item.id, 'approved')}>
                        Approve
                      </Button>
                    </div>
                  )}
                </div>

                {/* Approving something that needs fulfilment detail expands the
                    row rather than opening a new screen. */}
                {open && item.fulfilmentData ? (
                  <div className="border-t border-line bg-surface-2 px-4 py-3.5">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(item.fulfilmentData).map(([key, value]) => (
                        <div key={key}>
                          <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                            {key}
                          </dt>
                          <dd className="mt-1 text-[13.5px] text-ink-2">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}

                {/* A reason is required, and typing one every time is what makes
                    people stop giving reasons — hence the presets. */}
                {rejecting === item.id ? (
                  <div className="border-t border-line bg-surface-2 px-4 py-3.5">
                    <Label className="mb-2">Reason for rejection</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {REJECT_PRESETS.map((preset) => (
                        <Chip key={preset} active={reason === preset} onClick={() => setReason(preset)}>
                          {preset}
                        </Chip>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="or write one"
                        className="min-w-[200px] flex-1"
                      />
                      <Button
                        variant="danger"
                        disabled={reason.trim().length < 3}
                        onClick={() => decide(item.id, 'rejected', reason.trim())}
                      >
                        Reject and refund {coins(item.cost)} MC
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
