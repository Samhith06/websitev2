'use client';

import { useState, useTransition } from 'react';
import { chooseSplitSteal, enterSplitSteal, type Outcome } from '@/app/(site)/split-or-steal/actions';

type Note = { ok: boolean; text: string } | null;

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
    <p className="ss-note" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }} role="status">
      {note.text}
    </p>
  );
}

/** The entry button. The wager is checked again on the server when it is pressed. */
export function EnterSplitSteal({ disabled }: { disabled?: boolean }) {
  const { note, pending, run } = useAction();
  return (
    <div>
      <button className="btn gold ss-enter" disabled={pending || disabled} onClick={() => run(enterSplitSteal)}>
        {pending ? 'Checking your wager…' : 'Enter Split or Steal'}
      </button>
      <NoteText note={note} />
    </div>
  );
}

/** The two buttons. A choice is final, so each asks once before it is sent. */
export function ChooseSplitSteal({ opponent }: { opponent: string }) {
  const { note, pending, run } = useAction();
  const pick = (choice: 'split' | 'steal') => {
    const word = choice === 'split' ? 'SPLIT' : 'STEAL';
    if (window.confirm(`Lock in ${word} against ${opponent}? You cannot change it afterwards.`)) {
      run(() => chooseSplitSteal(choice));
    }
  };
  return (
    <div>
      <div className="ss-choices">
        <button className="ss-choice split" disabled={pending} onClick={() => pick('split')}>
          <b>Split</b>
          <span>Share the prize</span>
        </button>
        <button className="ss-choice steal" disabled={pending} onClick={() => pick('steal')}>
          <b>Steal</b>
          <span>Try to take it all</span>
        </button>
      </div>
      <NoteText note={note} />
    </div>
  );
}
