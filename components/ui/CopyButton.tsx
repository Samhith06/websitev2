'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

export function CopyButton({
  value,
  label = 'Copy',
  className,
  compact = false,
}: {
  value: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused — leave the value on screen, which is the fallback
      // that has always worked.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label} ${value}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[3px] border border-line-2 bg-surface-2 px-2.5',
        'font-mono text-[11px] uppercase tracking-[0.14em] text-muted',
        'transition-colors duration-150 hover:border-brand hover:text-brand',
        compact ? 'h-7' : 'h-8',
        className,
      )}
    >
      {copied ? <Check size={13} className="text-brand" /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
