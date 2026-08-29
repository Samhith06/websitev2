'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/typography';
import { CopyButton } from '@/components/ui/CopyButton';

/**
 * Collapsed by default, on every giveaway card (UI Spec §11). A few hours of
 * work, and most of the credibility the site has: the hash is published before
 * entries open, the seed is revealed at draw time, and anyone can recompute the
 * winning row from the two.
 */
export function FairnessBlock({
  serverSeedHash,
  serverSeed,
  icon,
  className,
}: {
  serverSeedHash: string;
  serverSeed?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const drawn = Boolean(serverSeed);

  return (
    <div className={cn('border-t border-line', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-6 py-3.5 text-left transition-colors duration-150 hover:bg-surface-2"
      >
        <span className="flex items-center gap-2">
          {icon ? <span className="text-brand">{icon}</span> : null}
          <Label>{drawn ? 'Provably fair — seed revealed' : 'Provably fair — seed committed'}</Label>
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line px-6 py-5">
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
            {drawn
              ? 'The seed below was committed as a SHA-256 hash before entries opened and revealed when the draw ran. Hash it yourself and it matches the commitment; feed it through the verifier and it produces the same winning row.'
              : 'This hash was published before entries opened, which locks in the seed behind it. When the draw runs the seed itself is revealed, and anyone can confirm the winning row was decided before a single entry was bought.'}
          </p>

          <Seed label="Server seed hash (published)" value={serverSeedHash} />
          {serverSeed ? <Seed label="Server seed (revealed)" value={serverSeed} /> : null}

          <Link
            href="/verify"
            className="inline-flex text-[13.5px] text-brand underline underline-offset-2 hover:text-brand-dim"
          >
            How to check this yourself →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Seed({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[3px] border border-line bg-surface-2 px-3 py-2 font-mono text-[12px] text-ink-2">
          {value}
        </code>
        <CopyButton value={value} compact />
      </div>
    </div>
  );
}
