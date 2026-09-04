'use client';

import { useState } from 'react';

/**
 * The referral code, and a button that copies it.
 *
 * The confirmation replaces the button label rather than firing a toast: the
 * thing you just clicked telling you it worked is less to track than a message
 * somewhere else on the screen.
 */
export function CopyCode({ code, label = 'Referral code' }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked. The code is on screen and selectable, so there is
      // nothing to recover from — just don't claim it copied.
    }
  }

  return (
    <div className="codebox">
      <div>
        <div className="cl">{label}</div>
        <div className="cc">{code}</div>
      </div>
      <button type="button" className="btn sm" onClick={copy}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
