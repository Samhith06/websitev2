'use client';

import { useState, useTransition } from 'react';
import { addSlot, removeSlot, syncSlots, type Outcome } from '@/app/(site)/admin/actions';

type Note = { ok: boolean; text: string } | null;

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

export function SyncSlotsButton() {
  const { note, pending, run } = useAction();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn gold sm" disabled={pending} onClick={() => run(syncSlots)}>
        {pending ? 'Syncing… (about 20 pages)' : 'Sync from BonusHunt'}
      </button>
      <NoteText note={note} />
    </div>
  );
}

/**
 * For the slots the feed has never shown — anything older than a week. !sr
 * matches against these exactly like synced rows.
 */
export function AddSlotForm() {
  const { note, pending, run } = useAction();
  const [key, setKey] = useState(0);
  return (
    <form
      key={key}
      className="card"
      style={{ marginBottom: 18 }}
      action={(data: FormData) => run(() => addSlot(data), (ok) => ok && setKey((k) => k + 1))}
    >
      <h3 style={{ fontSize: 14, marginBottom: 10 }}>Add a slot by hand</h3>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '2 1 200px', marginBottom: 0 }}>
          <label htmlFor="slot-name">Name</label>
          <input id="slot-name" name="name" className="inp s" placeholder="Sugar Rush 1000" required />
        </div>
        <div className="field" style={{ flex: '1 1 150px', marginBottom: 0 }}>
          <label htmlFor="slot-provider">Provider</label>
          <input id="slot-provider" name="provider" className="inp s" placeholder="Pragmatic Play" />
        </div>
        <div className="field" style={{ flex: '2 1 220px', marginBottom: 0 }}>
          <label htmlFor="slot-image">Image URL (https, optional)</label>
          <input id="slot-image" name="imageUrl" className="inp s" type="url" placeholder="https://…" />
        </div>
        <label className="small" style={{ display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 8 }}>
          <input type="checkbox" name="bonusBuy" /> Bonus buy
        </label>
        <button className="btn sm" type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <NoteText note={note} />
      </div>
    </form>
  );
}

export function RemoveSlotButton({ slotId, name }: { slotId: number; name: string }) {
  const { note, pending, run } = useAction();
  if (note?.ok) return <NoteText note={note} />;
  return (
    <>
      <button className="btn ghost sm" disabled={pending} onClick={() => run(() => removeSlot(slotId, name))}>
        Remove
      </button>
      <NoteText note={note} />
    </>
  );
}
