'use client';

import { useState, useTransition } from 'react';
import { savePokerHandle } from '@/app/(site)/profile/actions';

/**
 * The PokerNow username box on the poker page. It saves to the same place as
 * the field on the profile page, so either one updates both.
 */
export function PokerHandleForm({ handle }: { handle: string }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(handle);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="poker-handle"
      action={(formData) =>
        startTransition(async () => {
          const result = await savePokerHandle(formData);
          if (result.ok) setSaved(String(formData.get('handle') ?? '').trim());
          setNote(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
        })
      }
    >
      <label htmlFor="pokernow-handle">Your PokerNow username</label>
      <div className="poker-handle-row">
        <input
          id="pokernow-handle"
          name="handle"
          className="inp"
          defaultValue={handle}
          placeholder="exactly as it shows on PokerNow"
          autoComplete="off"
          maxLength={64}
        />
        <button className="btn pri" disabled={pending}>
          {pending ? 'Saving…' : saved ? 'Update' : 'Save'}
        </button>
      </div>
      <div className="small" style={{ marginTop: 8 }}>
        {note ? (
          <span style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>{note.text}</span>
        ) : saved ? (
          <span style={{ color: 'var(--green)' }}>Saved as {saved}. You can change it any time before the game.</span>
        ) : (
          <span className="muted">Used to seat you at the table, so spell it exactly as it is on PokerNow.</span>
        )}
      </div>
    </form>
  );
}
