'use client';

import { useState } from 'react';
import { money } from '@/lib/format';

/**
 * Copying a whole month of winners as a paste-ready list.
 *
 * Every payout is Matty tipping by hand on Razed, so the useful thing this
 * screen can do is put the entire list on the clipboard in one go rather than
 * making him copy forty names one at a time.
 */
export function CopyPayoutList({
  rows,
  label,
}: {
  rows: Array<{ username: string; amount: number }>;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  if (rows.length === 0) return null;

  return (
    <button
      className="btn sm"
      onClick={async () => {
        const text = rows.map((r) => `${r.username} $${r.amount}`).join('\n');
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          /* the list is on screen */
        }
      }}
    >
      {copied ? `✓ ${rows.length} copied` : label}
    </button>
  );
}

export function CopyOne({ username, amount }: { username: string; amount: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${username} $${amount}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* the figures are on screen */
        }
      }}
      title={`Copy "${username} ${money(amount)}"`}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}
