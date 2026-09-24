'use client';

import { useState, useTransition } from 'react';
import {
  dismissBingoEntry,
  drawBingo,
  endBingo,
  resolveBingoTurn,
  skipBingoTurn,
  startBingo,
  toggleBingoRequests,
  undoBingoResult,
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

export function StartBingoForm() {
  const { note, pending, run } = useAction();
  return (
    <form className="card" style={{ marginBottom: 18 }} action={(data: FormData) => run(() => startBingo(data))}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Start a slot bingo</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Chat joins with <b>!sr &lt;slot&gt;</b> the moment it starts. Each draw picks a random viewer and a
        random open square; a profitable buy turns the square green. The first full line is BINGO, and
        the viewers whose squares make up that line win the prize.
      </p>
      <div style={row}>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="bingo-title">Name</label>
          <input id="bingo-title" name="title" className="inp" placeholder="Sunday Bingo" required />
        </div>
        <div className="field" style={{ flex: '1 1 110px', marginBottom: 0 }}>
          <label htmlFor="bingo-size">Card</label>
          <select id="bingo-size" name="size" className="inp" defaultValue="4">
            <option value="3">3 × 3</option>
            <option value="4">4 × 4</option>
            <option value="5">5 × 5</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
          <label htmlFor="bingo-prize">Prize per line winner (MC)</label>
          <input id="bingo-prize" name="squarePrize" className="inp" type="number" min="0" step="1" defaultValue="100" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Starting…' : 'Start bingo'}
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

/**
 * The card's controls in the order a stream uses them. Drawing is the main
 * button; it is held back while a buy is in play or the card has BINGO,
 * since the next step then is recording the result or ending the card.
 */
export function BingoSwitches({
  cardId,
  requestsOpen,
  waiting,
  inPlay,
  bingo,
  canUndo,
}: {
  cardId: number;
  requestsOpen: boolean;
  waiting: number;
  inPlay: boolean;
  bingo: boolean;
  canUndo: boolean;
}) {
  const { note, pending, run } = useAction();
  const drawBlocked = inPlay ? 'Record the buy in play first' : bingo ? 'BINGO — end the card' : waiting === 0 ? 'Nobody waiting' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        <button
          className="btn gold"
          disabled={pending || drawBlocked != null}
          title={drawBlocked ?? undefined}
          onClick={() => run(() => drawBingo(cardId))}
        >
          {pending ? 'Drawing…' : `Draw viewer & square (${waiting} waiting)`}
        </button>
        <button className="btn sm" disabled={pending} onClick={() => run(() => toggleBingoRequests(cardId, !requestsOpen))}>
          {requestsOpen ? 'Close !sr' : 'Open !sr'}
        </button>
        {canUndo ? (
          <button className="btn ghost sm" disabled={pending} onClick={() => run(() => undoBingoResult(cardId))}>
            Undo last result
          </button>
        ) : null}
        <button
          className={`btn sm ${bingo ? 'gold' : 'ghost'}`}
          disabled={pending || inPlay}
          title={inPlay ? 'Record or skip the buy in play first' : undefined}
          onClick={() => {
            if (bingo || window.confirm('End this bingo without a line? Nobody will be paid.')) {
              run(() => endBingo(cardId));
            }
          }}
        >
          {bingo ? 'End bingo & pay' : 'End bingo'}
        </button>
      </div>
      <NoteText note={note} />
    </div>
  );
}

/** The drawn viewer's buy: what it cost and what it paid, or skip it. */
export function TurnResultForm({ turnId }: { turnId: number }) {
  const { note, pending, run } = useAction();
  return (
    <div>
      <form style={row} action={(data: FormData) => run(() => resolveBingoTurn(data))}>
        <input type="hidden" name="turnId" value={turnId} />
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="turn-cost">Buy cost ($)</label>
          <input id="turn-cost" name="buyCost" className="inp s" inputMode="decimal" placeholder="200" required autoFocus />
        </div>
        <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label htmlFor="turn-payout">Paid ($)</label>
          <input id="turn-payout" name="payout" className="inp s" inputMode="decimal" placeholder="0" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Record result'}
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={pending}
          title="The slot can't be played — the square stays open and they can !sr again"
          onClick={() => run(() => skipBingoTurn(turnId))}
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

export function DismissEntryButton({ entryId }: { entryId: number }) {
  const { note, pending, run } = useAction();
  return (
    <>
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => dismissBingoEntry(entryId))}>
        Remove
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </>
  );
}
