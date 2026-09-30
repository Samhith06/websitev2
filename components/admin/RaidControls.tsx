'use client';

import { useState, useTransition } from 'react';
import {
  dismissRaidPoolEntry,
  drawRaid,
  endRaid,
  removeRaid,
  resolveRaid,
  skipRaid,
  startRaid,
  toggleRaidRequests,
  undoRaidResult,
  type Outcome,
} from '@/app/(site)/admin/actions';

type Note = { ok: boolean; text: string } | null;

/** One action in flight and what it said, as on every other admin screen. */
function useAction() {
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Outcome>) =>
    start(async () => {
      const result = await fn();
      setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
    });
  return { note, pending, run };
}

function NoteText({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
      {note.text}
    </span>
  );
}

const row = { display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' } as const;

/* -------------------------------------------------------------------------- */

export function StartRaidForm() {
  const { note, pending, run } = useAction();
  return (
    <form className="card" style={{ marginBottom: 18 }} action={(data: FormData) => run(() => startRaid(data))}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Start a boss raid</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Chat joins with <b>!sr &lt;slot&gt;</b> the moment it starts. Each draw picks a random viewer —
        everyone gets a go before anyone gets a second — and their buy hits the boss for its multiplier:
        a 130× buy deals 130 damage. The buy that takes the boss to 0 HP is the killing blow, and wins the
        prize.
      </p>
      <div style={row}>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="raid-boss">Boss</label>
          <input id="raid-boss" name="boss" className="inp" placeholder="The Kraken" maxLength={60} required />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="raid-hp">HP</label>
          <input id="raid-hp" name="maxHp" className="inp" type="number" min="1" step="1" defaultValue="500" required />
        </div>
        <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
          <label htmlFor="raid-prize">Killing blow prize (MC)</label>
          <input id="raid-prize" name="prize" className="inp" type="number" min="0" step="1" defaultValue="250" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Starting…' : 'Start raid'}
        </button>
      </div>
      <p className="small muted" style={{ margin: '10px 0 0' }}>
        HP guide: 10 buys averaging 50× deal 500. Set it higher for a longer fight.
      </p>
      <div style={{ marginTop: 10 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

/**
 * The raid's controls in the order a stream uses them. Drawing is the main
 * button; it is held back while a buy is in play or once the boss is slain,
 * since the next step then is recording the result or ending the raid.
 */
export function RaidSwitches({
  gameId,
  requestsOpen,
  waiting,
  inPlay,
  slain,
  canUndo,
}: {
  gameId: number;
  requestsOpen: boolean;
  waiting: number;
  inPlay: boolean;
  slain: boolean;
  canUndo: boolean;
}) {
  const { note, pending, run } = useAction();
  const drawBlocked = inPlay
    ? 'Record the buy in play first'
    : slain
      ? 'The boss is slain — end the raid'
      : waiting === 0
        ? 'Nobody waiting'
        : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || drawBlocked != null}
          title={drawBlocked ?? undefined}
          onClick={() => run(() => drawRaid(gameId))}
        >
          {pending ? 'Drawing…' : `Draw raider (${waiting} waiting)`}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run(() => toggleRaidRequests(gameId, !requestsOpen))}>
          {requestsOpen ? 'Close !sr' : 'Open !sr'}
        </button>
        {canUndo ? (
          <button className="btn ghost sm" disabled={pending} onClick={() => run(() => undoRaidResult(gameId))}>
            Undo last result
          </button>
        ) : null}
        <button
          className={`btn sm ${slain ? 'gold' : 'ghost'}`}
          disabled={pending || inPlay}
          title={inPlay ? 'Record or skip the buy in play first' : undefined}
          onClick={() => {
            if (slain || window.confirm('End this raid with the boss still standing? Nobody will be paid.')) {
              run(() => endRaid(gameId));
            }
          }}
        >
          {slain ? 'End raid & pay' : 'End raid'}
        </button>
      </div>
      <NoteText note={note} />
    </div>
  );
}

/** The drawn raider's buy: what it cost and what it paid, or skip it. */
export function RaidResultForm({ turnId }: { turnId: number }) {
  const { note, pending, run } = useAction();
  return (
    <div>
      <form style={row} action={(data: FormData) => run(() => resolveRaid(data))}>
        <input type="hidden" name="turnId" value={turnId} />
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="raid-cost">Buy cost ($)</label>
          <input id="raid-cost" name="buyCost" className="inp s" inputMode="decimal" placeholder="200" required autoFocus />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="raid-payout">Paid ($)</label>
          <input id="raid-payout" name="payout" className="inp s" inputMode="decimal" placeholder="0" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Record hit'}
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={pending}
          title="The slot can't be played — the boss is untouched and they can !sr again"
          onClick={() => run(() => skipRaid(turnId))}
        >
          Skip
        </button>
      </form>
      <div style={{ marginTop: 8, minHeight: 18 }}>
        <NoteText note={note} />
      </div>
    </div>
  );
}

export function DismissRaidEntryButton({ entryId }: { entryId: number }) {
  const { note, pending, run } = useAction();
  return (
    <>
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => dismissRaidPoolEntry(entryId))}>
        Remove
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </>
  );
}

export function DeleteRaidButton({ gameId, boss }: { gameId: number; boss: string }) {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        className="btn ghost sm"
        style={{ color: 'var(--red)', borderColor: 'rgba(255, 92, 92, 0.35)' }}
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete the raid on ${boss} and all its hits and requests? This cannot be undone.`)) {
            run(() => removeRaid(gameId));
          }
        }}
      >
        {pending ? 'Deleting…' : 'Delete raid'}
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </div>
  );
}
