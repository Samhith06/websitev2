'use client';

import { useState, useTransition } from 'react';
import { settleChatWeeks } from '@/app/(site)/admin/actions';

export function SettleChatWeeksButton({ pending: owed }: { pending: number }) {
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        className="btn gold sm"
        type="button"
        disabled={pending || owed === 0}
        onClick={() =>
          start(async () => {
            const r = await settleChatWeeks();
            setNote(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
          })
        }
      >
        {pending ? 'Paying…' : owed ? `Pay ${owed} finished week${owed === 1 ? '' : 's'} now` : 'Nothing to pay'}
      </button>
      {note ? (
        <span className="small" style={{ color: note.ok ? 'var(--green)' : 'var(--red)' }}>
          {note.text}
        </span>
      ) : null}
    </div>
  );
}
