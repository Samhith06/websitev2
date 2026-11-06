'use client';

import { useState, useTransition } from 'react';
import { addLifetimeByHandle, setLifetimeMember } from '@/app/(site)/admin/actions';

function Note({ note }: { note: { ok: boolean; text: string } | null }) {
  if (!note) return null;
  return (
    <div className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)', marginTop: 8 }}>
      {note.text}
    </div>
  );
}

/** The add box on the lifetime list. */
export function LifetimeAddForm() {
  const [handle, setHandle] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <form
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const result = await addLifetimeByHandle(handle);
            if (result.ok) {
              setHandle('');
              setNote({ ok: true, text: result.message });
            } else {
              setNote({ ok: false, text: result.error });
            }
          });
        }}
      >
        <input
          className="inp s"
          style={{ flex: 1, minWidth: 220 }}
          value={handle}
          onChange={(event) => setHandle(event.target.value)}
          aria-label="Username or Discord id"
          placeholder="Discord, Kick or Razed username, or Discord id"
        />
        <button className="btn pri sm" disabled={pending || !handle.trim()}>
          Add to lifetime list
        </button>
      </form>
      <Note note={note} />
    </>
  );
}

/** Add or remove one known member, from the list or from their member page. */
export function LifetimeToggle({
  userId,
  username,
  member,
}: {
  userId: number;
  username: string;
  member: boolean;
}) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        className={`btn sm ${member ? 'ghost' : ''}`}
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setLifetimeMember(userId, username, !member);
            setNote(
              result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error },
            );
          })
        }
      >
        {member ? 'Remove from lifetime list' : 'Add to lifetime list'}
      </button>
      <Note note={note} />
    </div>
  );
}
