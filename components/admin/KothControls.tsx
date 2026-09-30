'use client';

import { useState, useTransition } from 'react';
import {
  dismissKothPoolEntry,
  drawKoth,
  endKoth,
  removeKoth,
  resolveKothTurn,
  skipKothTurn,
  startKoth,
  toggleKothRequests,
  undoKothResult,
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

export function StartKothForm() {
  const { note, pending, run } = useAction();
  return (
    <form className="card" style={{ marginBottom: 18 }} action={(data: FormData) => run(() => startKoth(data))}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Start a king of the hill</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Chat joins with <b>!sr &lt;slot&gt;</b> the moment it starts. Each draw picks a random viewer —
        everyone gets a go before anyone gets a second. The first buy takes the hill; after that a buy
        takes it only by beating the king&apos;s multiplier. End it when you like, and whoever holds the
        hill wins the prize.
      </p>
      <div style={row}>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="koth-title">Name</label>
          <input id="koth-title" name="title" className="inp" placeholder="Friday King of the Hill" required />
        </div>
        <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
          <label htmlFor="koth-prize">Prize for the king (MC)</label>
          <input id="koth-prize" name="prize" className="inp" type="number" min="0" step="1" defaultValue="250" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Starting…' : 'Start game'}
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

/**
 * The game's controls in the order a stream uses them. Drawing is the main
 * button; it is held back while a buy is in play, since the next step then is
 * recording its result.
 */
export function KothSwitches({
  gameId,
  requestsOpen,
  waiting,
  inPlay,
  hasKing,
  canUndo,
}: {
  gameId: number;
  requestsOpen: boolean;
  waiting: number;
  inPlay: boolean;
  hasKing: boolean;
  canUndo: boolean;
}) {
  const { note, pending, run } = useAction();
  const drawBlocked = inPlay ? 'Record the buy in play first' : waiting === 0 ? 'Nobody waiting' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || drawBlocked != null}
          title={drawBlocked ?? undefined}
          onClick={() => run(() => drawKoth(gameId))}
        >
          {pending ? 'Drawing…' : `Draw challenger (${waiting} waiting)`}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run(() => toggleKothRequests(gameId, !requestsOpen))}>
          {requestsOpen ? 'Close !sr' : 'Open !sr'}
        </button>
        {canUndo ? (
          <button className="btn ghost sm" disabled={pending} onClick={() => run(() => undoKothResult(gameId))}>
            Undo last result
          </button>
        ) : null}
        <button
          className={`btn sm ${hasKing ? 'gold' : 'ghost'}`}
          disabled={pending || inPlay}
          title={inPlay ? 'Record or skip the buy in play first' : undefined}
          onClick={() => {
            const ask = hasKing
              ? 'End the game and pay the king?'
              : 'End this game with nobody on the hill? Nobody will be paid.';
            if (window.confirm(ask)) run(() => endKoth(gameId));
          }}
        >
          {hasKing ? 'End & crown the king' : 'End game'}
        </button>
      </div>
      <NoteText note={note} />
    </div>
  );
}

/** The drawn challenger's buy: what it cost and what it paid, or skip it. */
export function ChallengeResultForm({ turnId }: { turnId: number }) {
  const { note, pending, run } = useAction();
  return (
    <div>
      <form style={row} action={(data: FormData) => run(() => resolveKothTurn(data))}>
        <input type="hidden" name="turnId" value={turnId} />
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="koth-cost">Buy cost ($)</label>
          <input id="koth-cost" name="buyCost" className="inp s" inputMode="decimal" placeholder="200" required autoFocus />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="koth-payout">Paid ($)</label>
          <input id="koth-payout" name="payout" className="inp s" inputMode="decimal" placeholder="0" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Record result'}
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={pending}
          title="The slot can't be played — the hill is unchanged and they can !sr again"
          onClick={() => run(() => skipKothTurn(turnId))}
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

export function DismissKothEntryButton({ entryId }: { entryId: number }) {
  const { note, pending, run } = useAction();
  return (
    <>
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => dismissKothPoolEntry(entryId))}>
        Remove
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </>
  );
}

export function DeleteKothButton({ gameId, title }: { gameId: number; title: string }) {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        className="btn ghost sm"
        style={{ color: 'var(--red)', borderColor: 'rgba(255, 92, 92, 0.35)' }}
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete "${title}" and all its challengers and requests? This cannot be undone.`)) {
            run(() => removeKoth(gameId));
          }
        }}
      >
        {pending ? 'Deleting…' : 'Delete game'}
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </div>
  );
}
