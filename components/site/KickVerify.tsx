'use client';

import { useEffect, useState, useTransition } from 'react';
import { newVerificationCode } from '@/app/(site)/profile/actions';
import type { VerificationState } from '@/lib/types';

function countdown(expiresAt: string, now: number): string {
  const s = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Linking a Kick account.
 *
 * The code is typed into Matty's chat and caught by the same reader that runs
 * the points engine, so there is nothing to poll and nothing to paste back
 * here. The panel's whole job is to show the code, say what to do with it, and
 * be honest about the ten-minute expiry.
 */
export function KickVerify({ state }: { state: VerificationState }) {
  const [live, setLive] = useState(state);
  const [now, setNow] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (live.status === 'linked') {
    return (
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Kick verification</h3>
        <div className="linkrow" style={{ borderTop: 0 }}>
          <span className="lk">Linked account</span>
          <span className="lv" style={{ color: 'var(--green)' }}>
            {live.link.kickUsername} ✓
          </span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Coins are credited to this account whenever you chat during a stream. One Kick account
          links to one site account — re-linking from a different Discord needs a mod to unlink this
          one first, which is what stops coins being farmed across several accounts from one Kick
          identity.
        </p>
      </div>
    );
  }

  const issue = () =>
    startTransition(async () => {
      const result = await newVerificationCode();
      if (result.ok) {
        setLive({ status: 'waiting', code: result.code, expiresAt: result.expiresAt });
        setCopied(false);
      }
    });

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 12 }}>Kick verification</h3>

      {live.status === 'unlinked' ? (
        <div className="verifybox">
          <div className="small muted" style={{ textAlign: 'center' }}>
            Generate a code, then type it in Matty&rsquo;s Kick chat to link your account.
          </div>
          <button
            className="btn pri wide"
            style={{ marginTop: 14 }}
            onClick={issue}
            disabled={pending}
          >
            {pending ? 'Generating…' : 'Get my code'}
          </button>
        </div>
      ) : (
        <div className="verifybox">
          <div className="small muted" style={{ textAlign: 'center' }}>
            Type this code in Matty&rsquo;s Kick chat to link your account
          </div>
          <div className="codeflash">{live.code}</div>

          {live.status === 'expired' ? (
            <div className="waiting" style={{ color: 'var(--red)' }}>
              This code has expired — generate a new one.
            </div>
          ) : (
            <div className="waiting">
              <span className="pulse" aria-hidden /> Waiting for your message · expires in{' '}
              {now == null ? '—' : countdown(live.expiresAt, now)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <button
              className="btn sm wide"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(live.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* the code is on screen and selectable */
                }
              }}
            >
              {copied ? '✓ Copied' : 'Copy code'}
            </button>
            <button className="btn sm wide ghost" onClick={issue} disabled={pending}>
              {pending ? 'Working…' : 'New code'}
            </button>
          </div>
        </div>
      )}

      <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Codes last ten minutes. The bot reads every chat message for the points engine anyway, so it
        spots yours without you doing anything else.
      </p>
    </div>
  );
}
