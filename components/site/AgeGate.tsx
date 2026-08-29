'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/controls';
import { Label } from '@/components/ui/typography';
import { LogoMark } from '@/components/ui/marks';

const KEY = 'ms.agegate.v1';

/**
 * An age gate on first visit (Master Plan §12), with the persistent notice
 * living in the footer. Deliberately plain: this is the site stating what it
 * is, not a splash screen.
 */
export function AgeGate() {
  const [decided, setDecided] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDecided(window.localStorage.getItem(KEY) === 'yes');
    } catch {
      // Storage blocked (private window, site data off). Show the gate; the
      // page behind it still renders for anything that does not use JS.
      setDecided(false);
    }
  }, []);

  // Nothing renders until we know, so the gate never flashes for a returning
  // visitor.
  if (decided === null || decided) return null;

  function accept() {
    try {
      window.localStorage.setItem(KEY, 'yes');
    } catch {
      /* nothing to do — the gate simply reappears next visit */
    }
    setDecided(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="agegate-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-bg/95 p-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-[3px] border border-line bg-surface p-7">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark size={34} />
          <Label>MattySpins</Label>
        </div>

        <h1 id="agegate-title" className="display text-[34px] leading-none">
          This site is for
          <br />
          over-18s
        </h1>

        <div className="mt-5 space-y-3 text-[14px] leading-relaxed text-ink-2">
          <p>
            MattySpins covers online casino streaming and carries an affiliate link to Razed.
            Gambling with real money carries real risk.
          </p>
          <p className="text-muted">
            Matty Coins on this site are earned by watching. They cannot be bought, hold no cash
            value, and are not a wager.
          </p>
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          <Button onClick={accept} size="lg" full>
            I am 18 or over — continue
          </Button>
          <a
            href="https://www.begambleaware.org"
            className="flex h-11 items-center justify-center rounded-[3px] border border-line-2 text-[14px] text-ink-2 transition-colors duration-150 hover:border-line-2 hover:text-ink"
          >
            I am under 18 — leave
          </a>
        </div>
      </div>
    </div>
  );
}
