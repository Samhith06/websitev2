'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  addHuntBonus,
  deleteBonus,
  dismissSlotRequest,
  findSlots,
  lockGuessing,
  moveHunt,
  openGuessing,
  saveBonusPayout,
  saveHunt,
  settleHunt,
  startHunt,
  toggleRequests,
  type Outcome,
} from '@/app/(site)/admin/actions';
import type { Slot } from '@/lib/store/slots';

type Note = { ok: boolean; text: string } | null;

/** One action in flight and what it said, the same pattern every admin control uses. */
function useAction() {
  const [note, setNote] = useState<Note>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Outcome>, after?: (ok: boolean) => void) =>
    start(async () => {
      const result = await fn();
      setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      after?.(result.ok);
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

export function StartHuntForm() {
  const { note, pending, run } = useAction();
  return (
    <form
      className="card"
      style={{ marginBottom: 18 }}
      action={(data: FormData) => run(() => startHunt(data))}
    >
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Start a hunt</h3>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Chat can <b>!sr</b> slots the moment it starts. Guessing opens separately, when you choose.
      </p>
      <div style={row}>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="hunt-title">Name</label>
          <input id="hunt-title" name="title" className="inp" placeholder="Friday Send" required />
        </div>
        <div className="field" style={{ flex: '1 1 140px', marginBottom: 0 }}>
          <label htmlFor="hunt-start">Start balance ($)</label>
          <input id="hunt-start" name="startCost" className="inp" inputMode="decimal" placeholder="1000" required />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Starting…' : 'Start hunt'}
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

export function HuntSettings({
  huntId,
  title,
  startCost,
}: {
  huntId: number;
  title: string;
  startCost: number;
}) {
  const { note, pending, run } = useAction();
  return (
    <form action={(data: FormData) => run(() => saveHunt(data))} style={row}>
      <input type="hidden" name="huntId" value={huntId} />
      <div className="field" style={{ flex: '2 1 200px', marginBottom: 0 }}>
        <label htmlFor="hs-title">Name</label>
        <input id="hs-title" name="title" className="inp s" defaultValue={title} required />
      </div>
      <div className="field" style={{ flex: '1 1 120px', marginBottom: 0 }}>
        <label htmlFor="hs-start">Start balance ($)</label>
        <input id="hs-start" name="startCost" className="inp s" inputMode="decimal" defaultValue={startCost} required />
      </div>
      <button className="btn ghost sm" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      <NoteText note={note} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

type Phase = 'collecting' | 'opening' | 'finished';
type Gtb = 'closed' | 'open' | 'locked' | 'settled';

/**
 * The hunt's switches in the order a stream uses them: requests while
 * collecting, guessing opened then locked, start opening, finish, settle.
 * Only the moves that are legal right now are shown.
 */
export function HuntSwitches({
  huntId,
  status,
  requestsOpen,
  gtbStatus,
  gtbPrize,
  unopened,
}: {
  huntId: number;
  status: Phase;
  requestsOpen: boolean;
  gtbStatus: Gtb;
  gtbPrize: number;
  unopened: number;
}) {
  const { note, pending, run } = useAction();
  const [prize, setPrize] = useState(String(gtbPrize || 250));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={row}>
        {status === 'collecting' ? (
          <button className="btn sm" disabled={pending} onClick={() => run(() => toggleRequests(huntId, !requestsOpen))}>
            {requestsOpen ? 'Close !sr' : 'Open !sr'}
          </button>
        ) : null}

        {status === 'collecting' && gtbStatus !== 'open' ? (
          <form
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            action={(data: FormData) => run(() => openGuessing(data))}
          >
            <input type="hidden" name="huntId" value={huntId} />
            <label className="small muted" htmlFor="gtb-prize">Prize (MC)</label>
            <input
              id="gtb-prize"
              name="prize"
              className="inp s"
              style={{ width: 100 }}
              type="number"
              min="0"
              step="1"
              value={prize}
              onChange={(e) => setPrize(e.target.value)}
            />
            <button className="btn sm" type="submit" disabled={pending}>
              {gtbStatus === 'locked' ? 'Reopen guessing' : 'Open guessing'}
            </button>
          </form>
        ) : null}

        {gtbStatus === 'open' ? (
          <button className="btn sm" disabled={pending} onClick={() => run(() => lockGuessing(huntId))}>
            Lock guessing
          </button>
        ) : null}

        {status === 'collecting' ? (
          <button className="btn gold sm" disabled={pending} onClick={() => run(() => moveHunt(huntId, 'opening'))}>
            Start opening
          </button>
        ) : null}

        {status === 'opening' ? (
          <>
            <button className="btn ghost sm" disabled={pending} onClick={() => run(() => moveHunt(huntId, 'collecting'))}>
              Back to collecting
            </button>
            <button
              className="btn gold sm"
              disabled={pending || unopened > 0}
              title={unopened > 0 ? `${unopened} still unopened` : undefined}
              onClick={() => run(() => moveHunt(huntId, 'finished'))}
            >
              Finish hunt
            </button>
          </>
        ) : null}

        {status === 'finished' && (gtbStatus === 'locked' || gtbStatus === 'open') ? (
          <button className="btn gold sm" disabled={pending} onClick={() => run(() => settleHunt(huntId))}>
            Settle guesses{gtbPrize ? ` · pay ${gtbPrize} MC` : ''}
          </button>
        ) : null}
      </div>
      <NoteText note={note} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Adding a bonus. Type two letters and the catalog answers; pick one, or keep
 * typing and add it as a free-text name — the catalog only knows what the
 * BonusHunt feed has shown it, and a hunt cannot wait for a sync.
 */
export function AddBonusForm({ huntId }: { huntId: number }) {
  const { note, pending, run } = useAction();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Slot[]>([]);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [bet, setBet] = useState('');
  const betRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const found = await findSlots(query);
      if (live) setResults(found);
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, picked]);

  const submit = (data: FormData) => {
    data.set('huntId', String(huntId));
    if (picked) data.set('slotId', String(picked.id));
    else data.set('name', query);
    run(
      () => addHuntBonus(data),
      (ok) => {
        if (!ok) return;
        setQuery('');
        setPicked(null);
      },
    );
  };

  return (
    <form action={submit} className="card" style={{ marginBottom: 14 }}>
      <h3 style={{ fontSize: 14, marginBottom: 10 }}>Add a bonus</h3>
      <div style={row}>
        <div className="field" style={{ flex: '3 1 240px', marginBottom: 0, position: 'relative' }}>
          <label htmlFor="bonus-slot">Slot</label>
          <input
            id="bonus-slot"
            className="inp s"
            autoComplete="off"
            value={picked ? `${picked.name}${picked.provider ? ` · ${picked.provider}` : ''}` : query}
            onChange={(e) => {
              setPicked(null);
              setQuery(e.target.value);
            }}
            placeholder="Search the catalog or type a name"
            required
          />
          {results.length > 0 ? (
            <div className="slot-suggest" role="listbox">
              {results.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setPicked(slot);
                    setResults([]);
                    betRef.current?.focus();
                  }}
                >
                  {slot.imageUrl ? <img src={slot.imageUrl} alt="" /> : <span className="ph" />}
                  <span>
                    <b>{slot.name}</b>
                    <small>{slot.provider || 'Unknown provider'}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="field" style={{ flex: '1 1 100px', marginBottom: 0 }}>
          <label htmlFor="bonus-bet">Bet ($)</label>
          <input
            id="bonus-bet"
            ref={betRef}
            name="bet"
            className="inp s"
            inputMode="decimal"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            placeholder="2.00"
            required
          />
        </div>
        <button className="btn gold sm" type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      <div style={{ marginTop: 8, minHeight: 18 }}>
        {!picked && query.trim().length >= 2 && results.length === 0 ? (
          <span className="small muted">Not in the catalog — it will be added by name.</span>
        ) : (
          <NoteText note={note} />
        )}
      </div>
    </form>
  );
}

/** A bonus row's payout box: Enter saves, empty clears. */
export function PayoutInput({ bonusId, payout }: { bonusId: number; payout: number | null }) {
  const { note, pending, run } = useAction();
  return (
    <form
      style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}
      action={(data: FormData) => run(() => saveBonusPayout(data))}
    >
      <input type="hidden" name="bonusId" value={bonusId} />
      <input
        name="payout"
        className="inp s"
        style={{ width: 96, textAlign: 'right' }}
        inputMode="decimal"
        defaultValue={payout ?? ''}
        placeholder="payout"
        aria-label="Payout"
      />
      <button className="btn sm" type="submit" disabled={pending}>
        {pending ? '…' : 'Save'}
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </form>
  );
}

export function RemoveBonusButton({ bonusId }: { bonusId: number }) {
  const { note, pending, run } = useAction();
  return (
    <>
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => deleteBonus(bonusId))}>
        Remove
      </button>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </>
  );
}

/** A chat request: give it a bet and it joins the hunt, or dismiss it. */
export function RequestActions({ huntId, requestId }: { huntId: number; requestId: number }) {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <form
        style={{ display: 'flex', gap: 6, alignItems: 'center' }}
        action={(data: FormData) => {
          data.set('huntId', String(huntId));
          data.set('requestId', String(requestId));
          run(() => addHuntBonus(data));
        }}
      >
        <input
          name="bet"
          className="inp s"
          style={{ width: 80 }}
          inputMode="decimal"
          placeholder="bet $"
          aria-label="Bet"
          required
        />
        <button className="btn gold sm" type="submit" disabled={pending}>
          Add
        </button>
        <button
          className="btn ghost sm"
          type="button"
          disabled={pending}
          onClick={() => run(() => dismissSlotRequest(requestId))}
        >
          Dismiss
        </button>
      </form>
      {note && !note.ok ? <NoteText note={note} /> : null}
    </div>
  );
}
