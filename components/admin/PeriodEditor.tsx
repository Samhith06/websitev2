'use client';

import { useState, useTransition } from 'react';
import { money } from '@/lib/format';
import {
  discardBoard,
  openMonthlyPeriod,
  removePrizeTier,
  savePrizeTier,
  setPeriodDates,
} from '@/app/(site)/admin/actions';
import type { PrizeTier } from '@/lib/types';

function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return (
    <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
      {note.text}
    </span>
  );
}

/**
 * Opening a month.
 *
 * The month picker defaults to the current calendar month because that is
 * almost always what is wanted, and the dates are derived in UTC to match what
 * the site tells members — a board whose window disagrees with the copy would
 * pay the wrong people.
 */
export function OpenPeriod({ defaultMonth }: { defaultMonth: string }) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card">
      <h2 style={{ fontSize: 15, marginBottom: 4 }}>Open a monthly board</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>
        The window is the calendar month in UTC, which is what the leaderboard tells members. Only
        one monthly board can be open at a time.
      </p>

      <form
        action={(formData) =>
          start(async () => {
            const result = await openMonthlyPeriod(formData);
            setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
          })
        }
        style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="month">Month</label>
          <input
            id="month"
            className="inp"
            type="month"
            name="month"
            defaultValue={defaultMonth}
            required
          />
        </div>

        <label
          className="small muted"
          style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}
        >
          <input type="checkbox" name="copyTiers" defaultChecked />
          Copy prizes from the last board
        </label>

        <button className="btn pri sm" disabled={pending} style={{ marginBottom: 2 }}>
          {pending ? 'Opening…' : 'Open board'}
        </button>
      </form>

      <div style={{ marginTop: 10 }}>
        <Note note={note} />
      </div>
    </div>
  );
}

/**
 * The prize ladder for an open board.
 *
 * A tier covers a rank range rather than a single rank, so "11th to 25th get
 * $25" is one row instead of fifteen. Prizes stay editable until the month is
 * frozen, which is the arrangement Matty asked for.
 */
export function PrizeEditor({
  periodId,
  tiers,
  editable,
}: {
  periodId: number;
  tiers: PrizeTier[];
  editable: boolean;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const nextRank = tiers.length ? Math.max(...tiers.map((t) => t.rankTo)) + 1 : 1;

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 15, marginBottom: 4 }}>Prize table</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>
        {editable
          ? 'Editable until the month is frozen. Changes show on the public board immediately.'
          : 'This board is frozen — the standings and prizes are now a record and cannot change.'}
      </p>

      {tiers.length === 0 ? (
        <div className="emptyq" style={{ marginBottom: 14 }}>
          No prizes set. Nobody is paid until there is at least one tier.
        </div>
      ) : (
        tiers.map((tier) => (
          <form
            key={tier.id}
            className="editrow"
            style={{ gridTemplateColumns: '90px 90px 1fr auto auto' }}
            action={(formData) =>
              start(async () => {
                const result = await savePrizeTier(formData);
                setNote(
                  result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
                );
              })
            }
          >
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="tierId" value={tier.id} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="er">#</span>
              <input
                className="inp s"
                name="rankFrom"
                type="number"
                min="1"
                defaultValue={tier.rankFrom}
                disabled={!editable}
                aria-label="First rank"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="er">to</span>
              <input
                className="inp s"
                name="rankTo"
                type="number"
                min="1"
                defaultValue={tier.rankTo}
                disabled={!editable}
                aria-label="Last rank"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="er">$</span>
              <input
                className="inp s"
                name="amount"
                type="number"
                min="0"
                step="1"
                defaultValue={tier.amount}
                disabled={!editable}
                aria-label="Amount"
              />
            </div>

            {editable ? (
              <>
                <button className="btn sm" disabled={pending}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await removePrizeTier(Number(tier.id), periodId);
                      setNote(
                        result.ok
                          ? { ok: true, text: result.message }
                          : { ok: false, text: result.error },
                      );
                    })
                  }
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <span className="er">{money(tier.amount)}</span>
                <span />
              </>
            )}
          </form>
        ))
      )}

      {editable ? (
        <form
          className="editrow"
          style={{ gridTemplateColumns: '90px 90px 1fr auto', borderBottom: 0, marginTop: 8 }}
          action={(formData) =>
            start(async () => {
              const result = await savePrizeTier(formData);
              setNote(
                result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
              );
            })
          }
        >
          <input type="hidden" name="periodId" value={periodId} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="er">#</span>
            <input
              className="inp s"
              name="rankFrom"
              type="number"
              min="1"
              defaultValue={nextRank}
              required
              aria-label="First rank"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="er">to</span>
            <input
              className="inp s"
              name="rankTo"
              type="number"
              min="1"
              defaultValue={nextRank}
              aria-label="Last rank"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="er">$</span>
            <input
              className="inp s"
              name="amount"
              type="number"
              min="0"
              step="1"
              required
              aria-label="Amount"
            />
          </div>
          <button className="btn pri sm" disabled={pending}>
            Add prize
          </button>
        </form>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <Note note={note} />
      </div>
    </div>
  );
}

/**
 * Moving or discarding an open board.
 *
 * Both are correction paths rather than routine controls, so they sit below the
 * prize table rather than beside the numbers people edit every week. Discarding
 * asks first, because it takes the prize ladder with it.
 */
export function PeriodControls({
  periodId,
  month,
  frozen,
}: {
  periodId: number;
  month: string;
  frozen: boolean;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (frozen) {
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Board window</h2>
        <p className="small muted" style={{ margin: 0 }}>
          This board is frozen. Its dates are the question people already answered and its
          standings are what some of them have been paid against, so neither can be changed now.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 15, marginBottom: 4 }}>Board window</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Moving the window changes which dates are sent to Razed, so the standings re-read straight
        away. Possible until the month is frozen.
      </p>

      <form
        action={(formData) =>
          start(async () => {
            const result = await setPeriodDates(formData);
            setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
          })
        }
        style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
      >
        <input type="hidden" name="periodId" value={periodId} />
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="period-month">Month</label>
          <input id="period-month" className="inp" type="month" name="month" defaultValue={month} />
        </div>
        <button className="btn sm" disabled={pending} style={{ marginBottom: 2 }}>
          {pending ? 'Saving…' : 'Move window'}
        </button>
      </form>

      <div className="divider" />

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn sm ghost" onClick={() => setConfirming(true)} disabled={pending}>
          Discard this board
        </button>
        <span className="small muted" style={{ flex: 1, minWidth: 240 }}>
          For a board opened by mistake. Only one monthly board can be open at a time, so a wrong
          one blocks the right one.
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <Note note={note} />
      </div>

      {confirming ? (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Discard this board">
          <div className="mbox">
            <h2>Discard this board?</h2>
            <p>
              The board and its prize ladder are deleted. Nothing has been paid against it yet — a
              frozen board cannot be discarded at all — but you will have to set the prizes again on
              whichever board replaces it.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn ghost wide" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                className="btn danger wide"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await discardBoard(periodId);
                    setNote(
                      result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
                    );
                    setConfirming(false);
                  })
                }
              >
                Discard it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
