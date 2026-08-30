'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { dateShort } from '@/lib/format';
import { Button } from '@/components/ui/controls';
import { Card } from '@/components/ui/surfaces';
import { Display, Label } from '@/components/ui/typography';
import { CopyButton } from '@/components/ui/CopyButton';
import { PlatformMark } from '@/components/ui/marks';
import type { VerificationState } from '@/lib/types';

/**
 * Three states in one card (UI Spec §13).
 *
 * The waiting state must update itself when the bot confirms — the viewer
 * should never have to refresh. It is the first thing they ever do on the site
 * and it sets their expectation of whether the whole thing works. In the real
 * build this is a subscription; here it is a poll against the same shape.
 */
export function Verification({
  initial,
  live,
}: {
  initial: VerificationState;
  live: boolean;
}) {
  const [state, setState] = useState<VerificationState>(initial);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== 'waiting') {
      setSecondsLeft(null);
      return;
    }
    const expires = new Date(state.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((expires - Date.now()) / 1000));
      setSecondsLeft(left);
      // Not an error — an expired code greys out and offers a new one (§28).
      if (left === 0) setState({ status: 'expired', code: state.code });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state]);

  /**
   * The wait polls the server, because the confirmation arrives from Kick and
   * not from anything this page did. It is the first thing anyone ever does on
   * the site, and having to refresh to find out whether it worked is how it
   * gets read as broken.
   */
  useEffect(() => {
    if (state.status !== 'waiting') return;
    const id = setInterval(async () => {
      try {
        const response = await fetch('/api/kick/verify', { cache: 'no-store' });
        if (!response.ok) return;
        const next = (await response.json()) as VerificationState;
        if (next.status === 'linked') setState(next);
      } catch {
        // A dropped poll is not worth showing anyone; the next one is in 4s.
      }
    }, 4000);
    return () => clearInterval(id);
  }, [state.status]);

  /**
   * The code is issued by the server and stored before it is shown. One
   * invented in the browser would prove nothing — the mechanism rests on the
   * site knowing a value the viewer could not have guessed, then seeing that
   * exact value arrive from Kick with a user id attached.
   */
  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/kick/verify', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.detail ?? 'Could not issue a code. Try again in a moment.');
        return;
      }
      setState(payload as VerificationState);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (state.status === 'linked') {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <PlatformMark platform="kick" size={22} className="text-ink-2" />
            <div>
              <Label className="mb-1">Kick account</Label>
              <p className="flex items-center gap-2 text-[15px] text-ink">
                {state.link.kickUsername}
                <BadgeCheck size={16} className="text-brand" aria-label="Verified" />
              </p>
            </div>
          </div>
          <p className="font-mono text-[11.5px] tabular-nums text-faint">
            Verified {dateShort(state.link.verifiedAt)}
          </p>
        </div>
      </Card>
    );
  }

  if (state.status === 'waiting' || state.status === 'expired') {
    const expired = state.status === 'expired';
    return (
      <Card tone={expired ? 'default' : 'brand'}>
        <div className="px-5 py-5">
          <Label className="mb-4">{expired ? 'Code expired' : 'Waiting for your message'}</Label>

          <div className="flex flex-wrap items-center gap-4">
            <Display size="m" as="p" className={expired ? 'text-faint line-through' : 'text-ink'}>
              {state.code}
            </Display>
            {!expired ? <CopyButton value={state.code} label="Copy code" /> : null}
          </div>

          {expired ? (
            <>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-muted">
                Codes last ten minutes so nobody can pass one around. Generate a new one and type it
                in chat while Matty is live.
              </p>
              <Button className="mt-5" onClick={generate} disabled={busy}>
                {busy ? 'Generating…' : 'Generate a new code'}
              </Button>
              {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
            </>
          ) : (
            <>
              <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink-2">
                Type this in Matty’s Kick chat while he’s live. The bot replies in chat and this page
                updates on its own — you do not need to refresh it.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-2 font-mono text-[13px] tabular-nums text-brand">
                  <span className="size-1.5 animate-pulse-dot rounded-full bg-brand" aria-hidden />
                  Expires in {formatSeconds(secondsLeft ?? 0)}
                </span>
                {!live ? (
                  <span className="font-mono text-[12px] text-gold">
                    Matty is offline — the code will work as soon as he is live
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="px-5 py-5">
        <Label className="mb-3">Link your Kick account</Label>
        <p className="max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
          Coins are earned for being in Matty’s Kick chat, so the site needs to know which Kick
          account is yours. We generate a short code, you type it in chat once, and that is the whole
          process — no password, no permissions, nothing to install.
        </p>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          One Kick account per site account, both ways. There is no casino account linking anywhere
          on this site.
        </p>
        <Button className="mt-5" onClick={generate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate my code'}
        </Button>
        {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}
      </div>
    </Card>
  );
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
