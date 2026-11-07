'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';

/**
 * The referral code, as one big button that copies it.
 *
 * The confirmation replaces the button label rather than firing a toast: the
 * thing you just clicked telling you it worked is less to track than a message
 * somewhere else on the screen.
 */
export function CopyCode({ code }: { code: string }) {
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
    <button type="button" className="codebtn" onClick={copy} aria-label={`Copy the code ${code}`}>
      <span className="cc">{code}</span>
      <span className="ca">
        {copied ? 'Copied' : 'Copy'}
        <Copy size={18} aria-hidden />
      </span>
    </button>
  );
}
